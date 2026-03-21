import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios"; 
import * as nodemailer from "nodemailer";

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = getFirestore(admin.app(), 'crmdb');

// ✨ GMAIL TRANSPORTER SETUP ✨
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sharathdeveloper20@gmail.com', 
    pass: 'cnks dslx mgvn tabo' 
  }
});

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
  else if (req.method === "POST") {
    try {
      let leadData: any = {};
      let clientId: string | null = null;
      let customAnswers: Record<string, string> = {}; 
      
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
        incomingSubSource = fbData.ad_name || ""; 

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
          try { data = JSON.parse(data); } catch (e) { }
        }
        data = { ...req.query, ...data };
        
        clientId = data.clientId;
        customAnswers = data.customAnswers || {}; 
        
        incomingSource = data.source || "Webhook";
        incomingSubSource = data.subSource || "";
        incomingProject = data.projectProperty || data.project || "General Inquiry";

        const finalFirstName = data.firstName || data.name || "Unknown";
        const finalLastName = data.lastName || "";

        leadData = {
          name: finalLastName ? `${finalFirstName} ${finalLastName}`.trim() : finalFirstName,
          firstName: finalFirstName, 
          lastName: finalLastName,   
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

      // --- PHONE ENRICHMENT LOGIC (Truecaller4 API via RapidAPI) ---
      let designation = "Unknown";
      let location = "Unknown";
      let linkedinUrl = ""; 
      let truecallerName = "Unknown";
      let truecallerBusiness = "Unknown";

      if (leadData.phone) {
        try {
            let cleanPhone = leadData.phone.replace(/[^0-9]/g, '');
            if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
                cleanPhone = cleanPhone.substring(2);
            }
            
            const options = {
                method: 'GET',
                url: 'https://truecaller4.p.rapidapi.com/api/v1/getDetails',
                params: { phone: cleanPhone, countryCode: 'IN' },
                headers: {
                    'Content-Type': 'application/json',
                    'x-rapidapi-host': 'truecaller4.p.rapidapi.com',
                    'x-rapidapi-key': '9b36bedba0msh60363bc45adf442p158081jsn4b5089ee4aec'
                },
                timeout: 3000
            };

            const phoneResponse = await axios.request(options);
            const resData = phoneResponse.data;

            let person = null;
            if (resData.data && Array.isArray(resData.data) && resData.data.length > 0) {
                person = resData.data[0];
            } else if (Array.isArray(resData) && resData.length > 0) {
                person = resData[0];
            } else if (resData.name) {
                person = resData;
            }

            if (person) {
                truecallerName = person.name || "Unknown";
                
                if (person.badges && person.badges.includes('company')) {
                    truecallerBusiness = person.name;
                    designation = "Business Owner / Enterprise";
                }

                if (person.addresses && person.addresses.length > 0) {
                    location = person.addresses[0].city || person.addresses[0].countryCode || "Unknown";
                }
                
                if (person.tags && person.tags.length > 0) {
                    designation = person.tags[0] || "Unknown";
                }
                
                if (person.internetAddresses && person.internetAddresses.length > 0 && !leadData.email) {
                    leadData.email = person.internetAddresses[0].id;
                }
            }
        } catch (enrichmentError: any) {
            console.error("Truecaller API Miss/Timeout:", enrichmentError.message);
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
        source: incomingSource,             
        subSource: incomingSubSource,       
        projectProperty: incomingProject,   
        status: "New",
        assignedTo: assignedToId,
        assignedToId: assignedToId,
        assignedToName: assignedToName,
        designation: designation,           
        location: location,                 
        linkedin: linkedinUrl,              
        truecallerName: truecallerName,     
        truecallerBusiness: truecallerBusiness, 
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

      // AUTO-DISCOVERY ENGINE
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
      }

      // ========================================================
      // 🚀 2 & 3. OUTBOUND PUSHES & EMAIL ALERTS 🚀
      // ========================================================
      try {
        const outboundDoc = await db.collection("outbound_integrations").doc(clientId).get();
        
        if (outboundDoc.exists) {
          const outboundData = outboundDoc.data();
          const clientWebhookUrl = outboundData?.webhookUrl;
          const googleSheetUrl = outboundData?.googleSheetUrl; 
          const clientHeaders = outboundData?.headers || [];
          const alertEmails = outboundData?.alertEmails; // ✨ Safe Extraction!

          const webhookPayload = {
            ...finalLead,
            id: newLeadRef.id,
            createdAt: new Date().toISOString() 
          };

          const pushPromises = [];

          // Pipeline A: Google Sheets
          if (googleSheetUrl) {
            pushPromises.push(
              axios.post(googleSheetUrl, webhookPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 4000
              }).catch(e => console.error(`Google Sheets push failed for client ${clientId}:`, e.message))
            );
          }

          // Pipeline B: External Custom CRM 
          if (clientWebhookUrl) {
            const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
            if (Array.isArray(clientHeaders)) {
              clientHeaders.forEach(h => {
                if (h.key && h.value && h.key.trim() !== '') { requestHeaders[h.key.trim()] = h.value.trim(); }
              });
            }
            pushPromises.push(
              axios.post(clientWebhookUrl, webhookPayload, {
                headers: requestHeaders,
                timeout: 4000
              }).catch(e => console.error(`CRM API push failed for client ${clientId}:`, e.message))
            );
          }

          if (pushPromises.length > 0) {
            await Promise.allSettled(pushPromises);
            console.log(`Successfully executed outbound pipelines for Client (${clientId})`);
          }

          // ✨ Pipeline C: Instant Email Alert Notifications ✨
          if (alertEmails && alertEmails.trim() !== '') {
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0f172a; padding: 20px; text-align: center;">
                  <h2 style="color: #74ebd5; margin: 0;">🚨 New Lead Alert</h2>
                  <p style="color: #cbd5e1; font-size: 14px; margin: 5px 0 0 0;">Generated via ${incomingSource}</p>
                </div>
                <div style="padding: 20px;">
                  <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse; text-align: left; font-size: 14px;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <th style="width: 35%; color: #64748b;">Full Name</th>
                      <td style="font-weight: bold; color: #0f172a;">${finalLead.firstName} ${finalLead.lastName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                      <th style="color: #64748b;">Phone Number</th>
                      <td style="font-weight: bold; color: #0f172a;">
                        <a href="tel:${finalLead.phone}" style="color: #2563eb; text-decoration: none;">${finalLead.phone}</a>
                      </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <th style="color: #64748b;">Email Address</th>
                      <td>${finalLead.email || 'Not provided'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                      <th style="color: #64748b;">Project Inquiry</th>
                      <td style="font-weight: bold; color: #b45309;">${finalLead.projectProperty || 'General Inquiry'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <th style="color: #64748b;">Sub-Source / Ad</th>
                      <td>${finalLead.subSource || finalLead.adName || 'N/A'}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #eff6ff;">
                      <th style="color: #1e3a8a;">Truecaller Verify</th>
                      <td style="color: #1e3a8a; font-weight: bold;">${finalLead.truecallerName}</td>
                    </tr>
                  </table>
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="https://crm.mintagemarkcomm.com" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">View in CRM Dashboard</a>
                  </div>
                </div>
              </div>
            `;

            const mailOptions = {
              from: '"Mintage CRM" <sharathdeveloper20@gmail.com>', 
              to: alertEmails,
              subject: `New Lead: ${finalLead.firstName} ${finalLead.lastName} - ${finalLead.projectProperty}`,
              html: emailHtml
            };

            await mailTransporter.sendMail(mailOptions);
            console.log(`Alert email successfully sent for Client (${clientId})`);
          }
        }
      } catch (integrationError: any) {
        console.error(`Failed to process outbound integrations/emails for Client (${clientId}):`, integrationError.message);
      }

      res.status(200).json({ success: true, message: "Event processed", leadId: newLeadRef.id });

    } catch (error: any) {
      console.error("Webhook Processing Error:", error.message || error);
      res.status(200).send("EVENT_RECEIVED_BUT_ERRORED"); 
    }
    return;
  }
  
  else {
    res.status(405).send("Method Not Allowed");
    return;
  }
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

export const sendBulkWhatsAppCampaign = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const clientId = request.auth.token.clientId;
  const userEmail = request.auth.token.email || "Unknown Agent";
  const { templateName, targetPhones } = request.data;

  if (!clientId || !templateName || !targetPhones || !Array.isArray(targetPhones)) {
    throw new HttpsError("invalid-argument", "Missing WhatsApp campaign parameters.");
  }

  try {
    let successCount = 0;
    let failCount = 0;

    const sendPromises = targetPhones.map(async (rawPhone: string) => {
      try {
        let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`; 
        
        successCount++;
      } catch (e) {
        failCount++;
        console.error(`Failed to send to ${rawPhone}:`, e);
      }
    });

    await Promise.all(sendPromises);

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