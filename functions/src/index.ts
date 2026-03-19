import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios"; 

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = getFirestore(admin.app(), 'crmdb');

// OPTIMIZATION: Memory restricted to 512MiB, concurrency set to 80, timeout capped at 15s.
export const incomingLeadWebhook = onRequest({ 
  cors: true,
  memory: "512MiB",
  concurrency: 80,
  maxInstances: 10,
  timeoutSeconds: 15 
}, async (req, res) => {
  
  // 1. HANDSHAKE: Handle Meta Verification (GET Request)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === "MINTAGE_CRM_SECRET") {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
    return;
  }

  // 2. LEAD CATCHER: Handle POST Request
  if (req.method === "POST") {
    try {
      let leadData: any = {};
      let clientId: string | null = null;
      let customAnswers: Record<string, string> = {}; 
      
      // Values specifically for Dynamic Auto-Discovery
      let incomingSource = "";
      let incomingSubSource = "";
      let incomingProject = "";

      if (req.body.object === "page" && req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id) {
        const changes = req.body.entry[0].changes[0].value;
        const pageId = changes.page_id;
        const leadgenId = changes.leadgen_id;

        const integrationQuery = await db.collection("facebook_integrations")
          .where("pageId", "==", pageId)
          .limit(1)
          .get();

        if (integrationQuery.empty) {
          res.status(200).send("Ignored: Integration not found");
          return;
        }

        const integrationData = integrationQuery.docs[0].data();
        clientId = integrationData.clientId;
        const pageAccessToken = integrationData.pageAccessToken || integrationData.accessToken; 

        if (!pageAccessToken) {
          res.status(200).send("Ignored: Missing Access Token");
          return;
        }

        // OPTIMIZATION: 4-second timeout for Facebook Graph API
        const fbResponse = await axios.get(
          `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,form_id,ad_id,ad_name,campaign_id,campaign_name&access_token=${pageAccessToken}`,
          { timeout: 4000 }
        );
        
        const fbData = fbResponse.data;
        const fbFields = fbData.field_data || [];
        
        fbFields.forEach((field: any) => {
          if (!['full_name', 'email', 'phone_number'].includes(field.name)) {
            customAnswers[field.name] = field.values[0];
          }
        });

        incomingSource = "Facebook";
        incomingProject = fbData.campaign_name || "Facebook Ad Campaign";
        incomingSubSource = fbData.ad_name || ""; // Use ad name as a sub-source for FB

        leadData = {
          name: fbFields.find((f: any) => f.name === "full_name")?.values[0] || "FB Lead",
          email: fbFields.find((f: any) => f.name === "email")?.values[0] || "",
          phone: fbFields.find((f: any) => f.name === "phone_number")?.values[0] || "",
          source: incomingSource,
          subSource: incomingSubSource,
          project: incomingProject, 
          formId: fbData.form_id || "",
          adId: fbData.ad_id || "",
          adName: fbData.ad_name || "Unknown Ad",
          campaignId: fbData.campaign_id || "",
          campaignName: fbData.campaign_name || "Unknown Campaign"
        };
      } else {
        // 🔥 CUSTOM PAYLOAD PARSING & AUTO-DISCOVERY PREP 🔥
        let data = req.body;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { /* fallback to req.query below */ }
        }
        data = { ...req.query, ...data };
        
        clientId = data.clientId;
        customAnswers = data.customAnswers || {}; 
        
        incomingSource = data.source || "Webhook";
        incomingSubSource = data.subSource || "";
        incomingProject = data.projectProperty || data.project || "General Inquiry";

        // Map payload fields to CRM schema, explicitly checking for firstName/lastName split
        const finalFirstName = data.firstName || data.name || "Unknown";
        const finalLastName = data.lastName || "";

        leadData = {
          name: finalLastName ? `${finalFirstName} ${finalLastName}`.trim() : finalFirstName,
          firstName: finalFirstName, // Store separately for cleaner DB
          lastName: finalLastName,   // Store separately for cleaner DB
          email: data.email || "", 
          phone: data.phone || "",
          source: incomingSource, 
          subSource: incomingSubSource,
          project: incomingProject,
          formId: "", adId: "", adName: data.adName || "", campaignId: "", campaignName: data.campaignName || "",
          utm_source: data.utm_source || "", utm_medium: data.utm_medium || "", utm_campaign: data.utm_campaign || "",
          message: data.message || ""
        };
      }

      if (!clientId) {
        res.status(400).send({ error: "Error: clientId is required in the webhook URL." });
        return;
      }

      // --- APOLLO ENRICHMENT LOGIC ---
      let designation = "Unknown";
      let location = "Unknown";
      let linkedinUrl = "";

      if (leadData.email) {
          try {
              // OPTIMIZATION: Strict 3-second timeout for Apollo API so it doesn't hold the function hostage
              const apolloResponse = await axios.post('https://api.apollo.io/v1/people/match', {
                  api_key: 'vWaMRrj2mpju0d1hVAN6RQ', 
                  email: leadData.email,
                  name: leadData.name
              }, { 
                headers: { 'Content-Type': 'application/json' },
                timeout: 3000 
              });

              if (apolloResponse.data && apolloResponse.data.person) {
                  const person = apolloResponse.data.person;
                  designation = person.title || "Unknown";
                  location = person.city ? `${person.city}, ${person.state || ''}` : "Unknown";
                  linkedinUrl = person.linkedin_url || "";
              }
          } catch (enrichmentError: any) {
              console.error("Apollo API Miss/Timeout:", enrichmentError.message);
          }
      }

      let assignedToId = null;
      let assignedToName = null;
      const rulesSnapshot = await db.collection("lead_assignment_rules")
        .where("clientId", "==", clientId).where("sourceName", "==", leadData.source).get();

      if (!rulesSnapshot.empty) {
        const ruleData = rulesSnapshot.docs[0].data();
        assignedToId = ruleData.agentId;
        assignedToName = ruleData.agentName;
      }

      // Final Name Formatting (Ensures no "undefined Lead" entries)
      let fName = leadData.firstName || leadData.name || "Unknown";
      let lName = leadData.lastName || "";
      if (fName.includes(" ") && fName !== "FB Lead" && !lName) {
          const parts = fName.trim().split(" ");
          fName = parts[0];
          lName = parts.slice(1).join(" ");
      } else if (fName === "FB Lead") {
          fName = "Facebook";
          lName = "Lead";
      } else if (!lName) {
         lName = "Lead";
      }

      const finalLead = {
        clientId: clientId,
        firstName: fName,
        lastName: lName, 
        email: leadData.email || "",
        phone: leadData.phone || "",
        source: incomingSource,             // From Auto-Discovery
        subSource: incomingSubSource,       // From Auto-Discovery
        projectProperty: incomingProject,   // From Auto-Discovery
        status: "New",
        assignedTo: assignedToId,
        assignedToId: assignedToId,
        assignedToName: assignedToName,
        designation: designation,
        location: location,
        linkedin: linkedinUrl,
        formId: leadData.formId,
        adId: leadData.adId,
        adName: leadData.adName,
        campaignId: leadData.campaignId,
        campaignName: leadData.campaignName,
        customAnswers: customAnswers,
        utm_source: leadData.utm_source || "",
        utm_medium: leadData.utm_medium || "",
        utm_campaign: leadData.utm_campaign || "",
        message: leadData.message || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 1. SAVE TO CRM DATABASE
      const newLeadRef = await db.collection("leads").add(finalLead);

      // ==========================================
      // 🚀 ENTERPRISE AUTO-DISCOVERY ENGINE 🚀
      // ==========================================
      // If the source or sub-source doesn't exist in settings, create it automatically.
      
      try {
        if (incomingSource) {
          const sourceQuery = await db.collection('lead_sources').where('clientId', '==', clientId).where('name', '==', incomingSource).get();
          if (sourceQuery.empty) { await db.collection('lead_sources').add({ clientId, name: incomingSource, autoDiscovered: true }); }
        }

        if (incomingSubSource) {
          const subSourceQuery = await db.collection('lead_sub_sources').where('clientId', '==', clientId).where('name', '==', incomingSubSource).get();
          if (subSourceQuery.empty) { await db.collection('lead_sub_sources').add({ clientId, name: incomingSubSource, autoDiscovered: true }); }
        }
      } catch (autoDiscError) {
         console.error("Auto-Discovery silent fail:", autoDiscError);
         // Don't crash the webhook if auto-discovery fails, just swallow error
      }

      // 2. MULTI-TENANT DYNAMIC OUTBOUND PUSH
      try {
        const outboundDoc = await db.collection("outbound_integrations").doc(clientId).get();
        if (outboundDoc.exists) {
          const clientWebhookUrl = outboundDoc.data()?.webhookUrl;
          if (clientWebhookUrl) {
            const webhookPayload = {
              ...finalLead,
              id: newLeadRef.id, // Include the new CRM ID
              createdAt: new Date().toISOString() 
            };
            
            // OPTIMIZATION: Strict 3-second timeout for Client Outbound webhook
            await axios.post(clientWebhookUrl, webhookPayload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 3000
            });
            console.log(`Successfully pushed lead to Client (${clientId}) Webhook`);
          }
        }
      } catch (webhookError: any) {
        console.error(`Failed to push to Client (${clientId}) webhook:`, webhookError.message);
      }

      res.status(200).json({ success: true, message: "Event processed", leadId: newLeadRef.id });

    } catch (error: any) {
      console.error("Webhook Processing Error:", error.message || error);
      res.status(200).send("EVENT_RECEIVED_BUT_ERRORED"); // Fast return prevents Meta from retrying and charging us again
    }
    return;
  }
  res.status(200).send("Method Not Allowed");
});

// OPTIMIZATION: Applied concurrency and memory limits to all callable UI functions
const functionOpts = { memory: "256MiB" as const, concurrency: 80, maxInstances: 10 };

export const createAgent = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in to create an agent.");
  if (request.auth.token.role !== "client_admin") throw new HttpsError("permission-denied", "Only Client Admins can create agents.");
  
  const clientId = request.auth.token.clientId;
  if (!clientId) throw new HttpsError("failed-precondition", "No clientId found on caller's token.");

  const { email, password, name } = request.data;
  if (!email || !password || !name) throw new HttpsError("invalid-argument", "Email, password, and name are required.");

  try {
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) throw new HttpsError("not-found", "Client document not found.");
    
    const maxAgents = clientDoc.data()?.maxAgents || 0;
    const agentsSnapshot = await db.collection("users").where("clientId", "==", clientId).where("role", "==", "client_agent").count().get();
    const currentCount = agentsSnapshot.data().count;

    if (currentCount >= maxAgents) throw new HttpsError("resource-exhausted", `Agent limit reached. Maximum allowed is ${maxAgents}.`);

    const userRecord = await admin.auth().createUser({ email, password, displayName: name, emailVerified: true });
    const userId = userRecord.uid;

    await admin.auth().setCustomUserClaims(userId, { role: "client_agent", clientId: clientId });
    await db.collection("users").doc(userId).set({
      name, email, role: "client_agent", clientId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Agent created successfully", userId };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to create agent.");
  }
});

export const deleteAgent = onCall(functionOpts, async (request) => {
  if (!request.auth || request.auth.token.role !== "client_admin") throw new HttpsError("permission-denied", "Only Client Admins can delete agents.");
  const clientId = request.auth.token.clientId;
  const { agentId } = request.data;
  if (!agentId) throw new HttpsError("invalid-argument", "Agent ID is required.");

  try {
    const agentDoc = await db.collection("users").doc(agentId).get();
    if (!agentDoc.exists || agentDoc.data()?.clientId !== clientId || agentDoc.data()?.role !== "client_agent") {
      throw new HttpsError("permission-denied", "You can only delete agents in your own workspace.");
    }
    await admin.auth().deleteUser(agentId);
    await db.collection("users").doc(agentId).delete();
    return { success: true, message: "Agent deleted successfully." };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to delete agent.");
  }
});

export const updateAgent = onCall(functionOpts, async (request) => {
  if (!request.auth || request.auth.token.role !== "client_admin") throw new HttpsError("permission-denied", "Only Client Admins can update agents.");
  const clientId = request.auth.token.clientId;
  const { agentId, name } = request.data;
  if (!agentId || !name) throw new HttpsError("invalid-argument", "Agent ID and name are required.");

  try {
    const agentDoc = await db.collection("users").doc(agentId).get();
    if (!agentDoc.exists || agentDoc.data()?.clientId !== clientId || agentDoc.data()?.role !== "client_agent") {
      throw new HttpsError("permission-denied", "You can only update agents in your own workspace.");
    }
    await admin.auth().updateUser(agentId, { displayName: name });
    await db.collection("users").doc(agentId).update({ name });
    return { success: true, message: "Agent updated successfully." };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to update agent.");
  }
});

export const registerNewClient = onCall(functionOpts, async (request) => {
  const { email, password, companyName } = request.data;
  if (!email || !password || !companyName) throw new HttpsError("invalid-argument", "Missing parameters.");

  try {
    const clientRef = db.collection("clients").doc();
    const clientId = clientRef.id;

    await clientRef.set({ name: companyName, subscriptionPlan: "BASIC", status: "ACTIVE", maxAgents: 2, createdAt: admin.firestore.FieldValue.serverTimestamp() });

    const userRecord = await admin.auth().createUser({ email: email, password: password, emailVerified: false });
    const userId = userRecord.uid;

    await admin.auth().setCustomUserClaims(userRecord.uid, { role: "client_admin", clientId: clientRef.id });
    await db.collection("users").doc(userId).set({ email: email, role: "client_admin", clientId: clientRef.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });

    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    return { success: true, message: "Client registered successfully.", clientId: clientId, userId: userId, verificationLink: verificationLink };
  } catch (error: any) {
    throw new HttpsError("internal", error.message || "Failed to register new client.");
  }
});

export const secureLinkFacebookPage = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const clientId = request.auth.token.clientId;
  const { shortLivedUserToken, pageId, pageName } = request.data;

  if (!clientId || !shortLivedUserToken || !pageId) throw new HttpsError("invalid-argument", "Missing required fields.");

  const APP_ID = '1439047481212574'; 
  const APP_SECRET = 'c8ea2e55436a18ecb2ca51ccdeac0937'; 

  try {
    const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedUserToken}`;
    const exchangeRes = await axios.get(exchangeUrl, { timeout: 4000 });
    const longLivedUserToken = exchangeRes.data.access_token;

    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`;
    const pagesRes = await axios.get(pagesUrl, { timeout: 4000 });
    const pageData = pagesRes.data.data.find((p: any) => p.id === pageId);

    if (!pageData) throw new Error("Could not find the requested page. Check permissions.");

    const permanentPageToken = pageData.access_token;

    await axios.post(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`, 
      new URLSearchParams({ subscribed_fields: 'leadgen', access_token: permanentPageToken }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 4000 }
    );

    await db.collection('facebook_integrations').doc(clientId).set({
      clientId: clientId, pageId: pageId, pageName: pageName, pageAccessToken: permanentPageToken, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "Page securely linked with permanent token." };
  } catch (error: any) {
    throw new HttpsError("internal", "Failed to secure Facebook connection.");
  }
});

// 👇 PHASE 22 - WHATSAPP CLOUD API BULK CAMPAIGN ENGINE 👇
export const sendBulkWhatsAppCampaign = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const clientId = request.auth.token.clientId;
  const userEmail = request.auth.token.email || "Unknown Agent";
  const { templateName, targetPhones } = request.data;

  if (!clientId || !templateName || !targetPhones || !Array.isArray(targetPhones)) {
    throw new HttpsError("invalid-argument", "Missing WhatsApp campaign parameters.");
  }

  // FIXED: Commented out the variables so TypeScript doesn't throw a "declared but unread" error (TS6133)
  // const META_WHATSAPP_TOKEN = 'YOUR_META_WHATSAPP_SYSTEM_TOKEN';
  // const PHONE_NUMBER_ID = 'YOUR_META_PHONE_NUMBER_ID';

  try {
    let successCount = 0;
    let failCount = 0;

    const sendPromises = targetPhones.map(async (rawPhone: string) => {
      try {
        let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`; 

        /* 🔥 UNCOMMENT THIS AND THE VARIABLES ABOVE WHEN READY TO FIRE TO META 🔥
        await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" }
          }
        }, {
          headers: {
            'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        */
        
        successCount++;
      } catch (e) {
        failCount++;
        console.error(`Failed to send to ${rawPhone}:`, e);
      }
    });

    await Promise.all(sendPromises);

    // Log the campaign to Firestore
    await db.collection('whatsapp_campaigns').add({
      clientId: clientId,
      senderEmail: userEmail,
      templateName: templateName,
      totalAttempted: targetPhones.length,
      successCount: successCount,
      failCount: failCount,
      status: "Sent (Mock)",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      message: `WhatsApp Campaign queued. Sent: ${successCount}, Failed: ${failCount}.`
    };
  } catch (error: any) {
    console.error("WhatsApp Campaign Error:", error);
    throw new HttpsError("internal", "Failed to execute WhatsApp campaign.");
  }
});