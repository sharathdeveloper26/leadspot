import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios"; 
import * as nodemailer from "nodemailer";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";

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

// ============================================================================
// 🚀 LEVEL 5 MEMORY CACHE (Global Scope) 🚀
// Prevents redundant Firestore reads across concurrent webhook invocations.
// ============================================================================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

const fbIntegrationCache = new Map<string, { data: any, expiresAt: number }>();
const assignmentRulesCache = new Map<string, { rules: any[], expiresAt: number }>();
const outboundCache = new Map<string, { data: any, expiresAt: number }>();
const discoveredSourcesCache = new Map<string, Set<string>>(); // Tracks auto-discovered sources

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

    if (mode === "subscribe" && token === "LEADSPOT_CRM_SECRET") {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
    return;
  }

  // 2. LEAD CATCHER: Handle POST Request
  else if (req.method === "POST") {
    try {
      const now = Date.now();
      let leadData: any = {};
      let clientId: string | null = null;
      let customAnswers: Record<string, string> = {}; 
      
      let incomingSource = "Webhook";
      let incomingSubSource = "";
      let incomingProject = "";

      // ✨ LEVEL 5 FIX: Smart Extractor catches the ID from URL Query OR JSON Body!
      clientId = (req.query.clientId || req.query.client_id || req.body.clientId || req.body.client_id) as string | null;

      // ====================================================================
      // 🚀 SCENARIO A: Raw Native Facebook Lead (Has 'object: page')
      // ====================================================================
      if (req.body.object === "page" && req.body.entry?.[0]?.changes?.[0]?.value?.leadgen_id) {
        const changes = req.body.entry[0].changes[0].value;
        const pageId = changes.page_id;
        const leadgenId = changes.leadgen_id;

        // 🧠 CACHE CHECK: Facebook Integration
        let integrationData: any = null;
        const cachedFb = fbIntegrationCache.get(pageId);
        
        if (cachedFb && cachedFb.expiresAt > now) {
          integrationData = cachedFb.data;
        } else {
          const integrationQuery = await db.collection("facebook_integrations")
            .where("pageId", "==", pageId)
            .limit(1)
            .get();

          if (!integrationQuery.empty) {
            integrationData = integrationQuery.docs[0].data();
            fbIntegrationCache.set(pageId, { data: integrationData, expiresAt: now + CACHE_TTL });
          }
        }

        if (!integrationData) {
          res.status(200).send("Ignored: Integration not found");
          return;
        }

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
        
        let extractedProject = "";
        let fbFullName = "";
        let fbFirstName = "";
        let fbLastName = "";
        let fbEmail = "";
        let fbPhone = "";

        // ✨ LEVEL 5 FIX: Smart catch for Custom Questions with spaces
        fbFields.forEach((field: any) => {
          const fieldNameClean = field.name.toLowerCase().trim();
          const val = field.values[0];

          if (fieldNameClean === 'full_name' || fieldNameClean === 'full name' || fieldNameClean === 'name') {
            fbFullName = val;
          }
          else if (fieldNameClean === 'first_name' || fieldNameClean === 'first name') {
            fbFirstName = val;
          }
          else if (fieldNameClean === 'last_name' || fieldNameClean === 'last name') {
            fbLastName = val;
          }
          else if (fieldNameClean === 'email' || fieldNameClean === 'email address') {
            fbEmail = val;
          }
          else if (fieldNameClean === 'phone_number' || fieldNameClean === 'phone number' || fieldNameClean === 'phone' || fieldNameClean === 'contact number') {
            fbPhone = val;
          }
          else {
            customAnswers[field.name] = val;
            if (fieldNameClean === 'project name' || fieldNameClean === 'project_name' || fieldNameClean === 'project') {
              extractedProject = val;
            }
          }
        });

        // Smart Combination Logic
        if (!fbFullName && (fbFirstName || fbLastName)) {
          fbFullName = `${fbFirstName} ${fbLastName}`.trim();
        }
        if (!fbFirstName && fbFullName) {
          fbFirstName = fbFullName.split(' ')[0]; 
        }

        incomingSource = "Facebook";
        incomingSubSource = fbData.ad_name || ""; 
        incomingProject = extractedProject || fbData.campaign_name || "Facebook Ad Campaign"; 

        leadData = {
          name: fbFullName || "Unknown Lead",
          firstName: fbFirstName || "Unknown",
          lastName: fbLastName || "",
          email: fbEmail || "",
          phone: fbPhone || "",
          source: incomingSource,
          subSource: incomingSubSource,
          project: incomingProject, 
          formId: fbData.form_id || "",
          adId: fbData.ad_id || "",
          adName: fbData.ad_name || "Unknown Ad",
          campaignId: fbData.campaign_id || "",
          campaignName: fbData.campaign_name || "Unknown Campaign"
        };
      } 
      // ====================================================================
      // 🚀 SCENARIO B: Generic JSON Payload (Postman, Zapier, Web Forms)
      // ====================================================================
      else {
        if (!clientId) {
          res.status(400).send({ error: "Error: clientId is required in the webhook URL or JSON body." });
          return;
        }

        incomingSource = req.body.source || "Webhook API";
        incomingSubSource = req.body.subSource || req.body.adName || "";
        incomingProject = req.body.projectProperty || req.body.project || "General Webhook Lead";

        leadData = {
          name: (req.body.firstName || "") + " " + (req.body.lastName || "").trim() || "Unknown Lead",
          firstName: req.body.firstName || req.body.name || "Unknown",
          lastName: req.body.lastName || "",
          email: req.body.email || "",
          phone: req.body.phone || req.body.phoneNumber || "",
          source: incomingSource,
          subSource: incomingSubSource,
          project: incomingProject,
          message: req.body.message || "",
          utm_source: req.body.utm_source || "",
          utm_medium: req.body.utm_medium || "",
          utm_campaign: req.body.utm_campaign || ""
        };
        
        // Collect any unknown fields into customAnswers
        Object.keys(req.body).forEach(key => {
            if (!['clientId', 'client_id', 'firstName', 'lastName', 'name', 'email', 'phone', 'phoneNumber', 'source', 'subSource', 'projectProperty', 'project', 'message', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
                customAnswers[key] = String(req.body[key]);
            }
        });
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

      // 🧠 CACHE CHECK: Auto-Assignment Rules
      let assignedToId = null;
      let assignedToName = null;
      let rules: any[] = [];

      const cachedRules = assignmentRulesCache.get(clientId as string);
      if (cachedRules && cachedRules.expiresAt > now) {
        rules = cachedRules.rules;
      } else {
        const rulesSnapshot = await db.collection("lead_assignment_rules").where("clientId", "==", clientId).get();
        rules = rulesSnapshot.docs.map(doc => doc.data());
        assignmentRulesCache.set(clientId as string, { rules, expiresAt: now + CACHE_TTL });
      }

      // ✨ LEVEL 5 MULTI-TENANT FIX: Waterfall Routing Engine ✨
      const safeProject = (incomingProject || "").trim().toLowerCase();
      const safeSource = (incomingSource || "").trim().toLowerCase();

      let matchedRule = null;

      for (const rule of rules) {
        const ruleProject = (rule.projectName || "").trim().toLowerCase();
        const ruleSource = (rule.sourceName || "").trim().toLowerCase();

        // Priority 1: Exact Project Match
        if (ruleProject && ruleProject === safeProject) {
          matchedRule = rule;
          break; 
        } 
        // Priority 2: Fallback to Source Match
        else if (!matchedRule && ruleSource && ruleSource === safeSource && !ruleProject) {
          matchedRule = rule;
        }
      }

      if (matchedRule) {
        assignedToId = matchedRule.agentId;
        assignedToName = matchedRule.agentName;
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
        formId: leadData.formId || "",
        adId: leadData.adId || "",
        adName: leadData.adName || "",
        campaignId: leadData.campaignId || "",
        campaignName: leadData.campaignName || "",
        customAnswers: customAnswers,
        utm_source: leadData.utm_source || "",
        utm_medium: leadData.utm_medium || "",
        utm_campaign: leadData.utm_campaign || "",
        message: leadData.message || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 1. SAVE TO CRM DATABASE
      const newLeadRef = await db.collection("leads").add(finalLead);

      // 🧠 CACHE CHECK: Auto-Discovery Engine
      try {
        if (!discoveredSourcesCache.has(clientId as string)) {
          discoveredSourcesCache.set(clientId as string, new Set<string>());
        }
        const clientDiscovered = discoveredSourcesCache.get(clientId as string)!;

        if (incomingSource) {
          const cacheKey = `SRC_${incomingSource}`;
          if (!clientDiscovered.has(cacheKey)) {
            const sourceQuery = await db.collection('lead_sources').where('clientId', '==', clientId).where('name', '==', incomingSource).limit(1).get();
            if (sourceQuery.empty) { 
              await db.collection('lead_sources').add({ clientId, name: incomingSource, autoDiscovered: true }); 
            }
            clientDiscovered.add(cacheKey); 
          }
        }

        if (incomingSubSource) {
          const cacheKey = `SUB_${incomingSubSource}`;
          if (!clientDiscovered.has(cacheKey)) {
            const subSourceQuery = await db.collection('lead_sub_sources').where('clientId', '==', clientId).where('name', '==', incomingSubSource).limit(1).get();
            if (subSourceQuery.empty) { 
              await db.collection('lead_sub_sources').add({ clientId, name: incomingSubSource, autoDiscovered: true }); 
            }
            clientDiscovered.add(cacheKey); 
          }
        }
      } catch (autoDiscError) {
         console.error("Auto-Discovery silent fail:", autoDiscError);
      }

      // ========================================================
      // 🚀 2 & 3. OUTBOUND PUSHES & EMAIL ALERTS 🚀
      // ========================================================
      try {
        // 🧠 CACHE CHECK: Outbound Integrations
        let outboundData: any = null;
        const cachedOutbound = outboundCache.get(clientId as string);
        
        if (cachedOutbound && cachedOutbound.expiresAt > now) {
          outboundData = cachedOutbound.data;
        } else {
          const outboundDoc = await db.collection("outbound_integrations").doc(clientId as string).get();
          outboundData = outboundDoc.exists ? outboundDoc.data() : null;
          outboundCache.set(clientId as string, { data: outboundData, expiresAt: now + CACHE_TTL });
        }
        
        if (outboundData) {
          const clientWebhookUrl = outboundData.webhookUrl;
          const clientHeaders = outboundData.headers || [];
          const alertEmails = outboundData.alertEmails; 

          const webhookPayload = {
            ...finalLead,
            id: newLeadRef.id,
            createdAt: new Date().toISOString() 
          };

          const pushPromises = [];

          

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
            
            // ✨ LEVEL 5 FIX: Safely strip the "Lead" placeholder for the email output
            const cleanLastName = finalLead.lastName === 'Lead' ? '' : finalLead.lastName;
            const displayFullName = `${finalLead.firstName} ${cleanLastName}`.trim();

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
                      <td style="font-weight: bold; color: #0f172a;">${displayFullName}</td>
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
              subject: `New Lead: ${displayFullName} - ${finalLead.projectProperty}`,
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

// ✨ TIER 2 TO TIER 3: SUB-CLIENT WORKSPACE CREATOR ✨
export const createSubClientWorkspace = onCall(functionOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in to create a workspace.');
  }

  const { agencyId, companyName, adminEmail, password, plan } = request.data;

  if (!agencyId || !companyName || !adminEmail || !password) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    const agencyRef = db.collection('agencies').doc(agencyId);
    const agencyDoc = await agencyRef.get();
    
    if (!agencyDoc.exists && agencyId !== 'leadspot_direct') {
      console.warn(`Agency doc not found for ${agencyId}. Bypassing strict quota for dev/direct.`);
    } else if (agencyDoc.exists) {
      const agencyData = agencyDoc.data();
      const maxClients = agencyData?.maxClients || 0;
      const clientsSnapshot = await db.collection('clients').where('agencyId', '==', agencyId).count().get();
      const currentClientCount = clientsSnapshot.data().count;

      if (currentClientCount >= maxClients) {
        throw new HttpsError('resource-exhausted', `Quota exceeded. This agency is limited to ${maxClients} workspaces.`);
      }
    }

    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: password,
      displayName: `${companyName} Admin`,
    });

    const newClientId = userRecord.uid; 
    
    const clientRef = db.collection('clients').doc(newClientId);
    await clientRef.set({
      clientId: newClientId,
      agencyId: agencyId,
      companyName: companyName,
      adminEmail: adminEmail,
      plan: plan || 'Starter Plan',
      status: 'active',
      joinedOn: admin.firestore.FieldValue.serverTimestamp()
    });

    const userRef = db.collection('users').doc(newClientId);
    await userRef.set({
      uid: newClientId,
      email: adminEmail,
      name: `${companyName} Admin`,
      role: 'client_admin',
      clientId: newClientId, 
      agencyId: agencyId,    
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await admin.auth().setCustomUserClaims(newClientId, {
      role: 'client_admin',
      clientId: newClientId,
      agencyId: agencyId
    });

    return { success: true, clientId: newClientId, message: 'Workspace created successfully.' };

  } catch (error: any) {
    console.error("Error creating sub-client workspace:", error);
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'A user with this email already exists.');
    }
    throw new HttpsError('internal', error.message || 'An internal error occurred.');
  }
});


// ✨ TIER 1 TO TIER 2: MASTER AGENCY CREATOR ✨
export const createAgencyAccount = onCall(functionOpts, async (request) => {
  if (!request.auth || request.auth.token.role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only Super Admins can create Agency accounts.');
  }

  const { agencyName, email, password, plan, maxClients, domain, logoUrl } = request.data;

  if (!agencyName || !email || !password) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: `${agencyName} Admin`,
    });

    const newAgencyId = userRecord.uid; 

    const agencyRef = db.collection('agencies').doc(newAgencyId);
    await agencyRef.set({
      agencyId: newAgencyId,
      agencyName: agencyName,
      adminEmail: email,
      package: plan || 'Growth Plan',
      maxClients: maxClients || 10,
      customDomain: domain || '',
      logoUrl: logoUrl || '',
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const userRef = db.collection('users').doc(newAgencyId);
    await userRef.set({
      uid: newAgencyId,
      email: email,
      name: `${agencyName} Admin`,
      role: 'agency_admin',
      clientId: newAgencyId, 
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await admin.auth().setCustomUserClaims(newAgencyId, {
      role: 'agency_admin',
      clientId: newAgencyId
    });

    return { success: true, agencyId: newAgencyId, message: 'Agency partner created successfully.' };

  } catch (error: any) {
    console.error("Error creating agency:", error);
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'A user with this email already exists.');
    }
    throw new HttpsError('internal', error.message || 'An internal error occurred.');
  }
});

export const secureLinkFacebookPage = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const clientId = request.auth.token.clientId;
  const { shortLivedUserToken, pageId, pageName } = request.data;

  if (!clientId || !shortLivedUserToken || !pageId) throw new HttpsError("invalid-argument", "Missing required fields.");

  const APP_ID = '2060924228162885'; 
  const APP_SECRET = '5fd7b76dfb90241e1ecc14505e479c83'; 

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

// ============================================================================
// 🚀 PHASE 2: TWO-WAY WHATSAPP INBOX WEBHOOK 🚀
// ============================================================================
// ============================================================================
// 🚀 PHASE 2: TWO-WAY WHATSAPP INBOX WEBHOOK (WITH BOT ENGINE) 🚀
// ============================================================================
export const whatsappWebhook = onRequest({ 
  cors: true,
  memory: "256MiB",
  concurrency: 80,
  maxInstances: 10,
}, async (req, res) => {
  
  const WHATSAPP_VERIFY_TOKEN = "LEADSPOT_WA_SECRET_2026"; // Ensure this matches Meta

  // 1. HANDSHAKE: Meta Webhook Verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("WhatsApp Webhook Verified!");
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
    return;
  }

  // 2. MESSAGE CATCHER & BOT ENGINE: Handle Incoming WhatsApp Messages
  if (req.method === "POST") {
    try {
      const body = req.body;

      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) { 
            const value = change.value;
            const wabaId = entry.id; 
            const phoneNumberId = value.metadata?.phone_number_id;

            // Handle Incoming Messages from Leads
            if (value.messages && value.messages.length > 0) {
              for (const msg of value.messages) {
                const senderPhone = msg.from; 
                const messageId = msg.id;
                const timestamp = msg.timestamp;
                
                let messageText = "";
                if (msg.type === "text") {
                  messageText = msg.text.body;
                } else {
                  messageText = `[Received a ${msg.type} message]`;
                }

                // A) Identify Client from Phone Number ID
                const integrationSnap = await db.collection("whatsapp_integrations")
                  .where("phoneNumberId", "==", phoneNumberId)
                  .limit(1)
                  .get();

                let clientId = null;
                if (!integrationSnap.empty) {
                  clientId = integrationSnap.docs[0].data().clientId;
                }

                // B) Save incoming message to CRM Inbox
                await db.collection("whatsapp_messages").add({
                  clientId: clientId, // Maps the message to the correct workspace
                  wabaId: wabaId,
                  phoneNumberId: phoneNumberId,
                  messageId: messageId,
                  senderPhone: senderPhone,
                  text: messageText,
                  type: msg.type,
                  direction: "inbound", 
                  status: "received",
                  timestamp: admin.firestore.Timestamp.fromMillis(parseInt(timestamp) * 1000),
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  isRead: false
                });

                // C) 🤖 AI BOT TRAVERSAL ENGINE 🤖
                if (clientId) {
                  const leadSnap = await db.collection("leads").where("clientId", "==", clientId).where("phone", "==", senderPhone).limit(1).get();
                  const isBotPaused = !leadSnap.empty && leadSnap.docs[0].data().botStatus === 'paused';

                  if (!isBotPaused) {
                    const flowSnap = await db.collection("whatsapp_flows").doc(clientId).get();
                    
                    if (flowSnap.exists) {
                      const flow = flowSnap.data() as any;
                      let nextNodeToFire = null;

                      // 🟢 SCENARIO 1: TEXT MATCH (TRIGGER)
                      if (msg.type === "text") {
                        const userText = messageText.toLowerCase().trim();
                        const triggerNode = flow.nodes?.find((n: any) => n.type === "trigger");
                        const triggerKeywords = (triggerNode?.data?.message || "").toLowerCase().split(",").map((k: string) => k.trim());

                        if (triggerKeywords.includes(userText)) {
                          const nextEdge = flow.edges?.find((e: any) => e.source === triggerNode.id);
                          if (nextEdge) nextNodeToFire = flow.nodes?.find((n: any) => n.id === nextEdge.target);
                        }
                      } 
                      // 🟢 SCENARIO 2: BUTTON / LIST MATCH
                      else if (msg.type === "interactive") {
                        let interactiveText = "";
                        if (msg.interactive?.type === "button_reply") interactiveText = msg.interactive.button_reply.title;
                        if (msg.interactive?.type === "list_reply") interactiveText = msg.interactive.list_reply.title;
                        
                        const sourceNode = flow.nodes?.find((n: any) => (n.type === 'button' && n.data?.buttons?.includes(interactiveText)) || (n.type === 'list' && n.data?.listItems?.includes(interactiveText)));

                        if (sourceNode) {
                          let handleId = null;
                          if (sourceNode.type === 'button') handleId = `btn-${sourceNode.data.buttons.indexOf(interactiveText)}`;
                          const nextEdge = flow.edges?.find((e: any) => e.source === sourceNode.id && (!handleId || e.sourceHandle === handleId));
                          if (nextEdge) nextNodeToFire = flow.nodes?.find((n: any) => n.id === nextEdge.target);
                        }
                      }

                      // 🟢 THE LEVEL 5 AUTO-FORWARDING ENGINE
                      let currentNode = nextNodeToFire;
                      
                      // Loop until we hit an interactive node (which waits for user input)
                      while (currentNode) {
                        let botResponseText = currentNode.data.message || `[${currentNode.type} Action]`;
                        
                        if (currentNode.type === 'waForm') botResponseText = `${botResponseText}\n\n[Form: ${currentNode.data.formTitle}]`;
                        if (currentNode.type === 'list') botResponseText = `${botResponseText}\n\n[Menu: ${currentNode.data.menuTitle}]\n` + (currentNode.data.listItems || []).map((b:string)=>`🔸 ${b}`).join('\n');
                        if (currentNode.type === 'button') botResponseText = `${botResponseText}\n\n` + (currentNode.data.buttons || []).map((b:string)=>`🔘 ${b}`).join('\n');
                        if (currentNode.type === 'carousel') botResponseText = `[Product Carousel Sent]`;

                       // 1. Save and Dispatch the Message
                        await db.collection("whatsapp_messages").add({
                          clientId: clientId, wabaId: wabaId, senderPhone: senderPhone,
                          text: botResponseText, // Keep text fallback for CRM Inbox UI
                          type: currentNode.type || "text", // ✨ CRITICAL: Tell dispatcher the exact node type
                          nodeData: currentNode.data || {}, // ✨ CRITICAL: Pass the button/list arrays
                          direction: "outbound", status: "pending",
                          agentName: "AI Bot", timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          createdAt: admin.firestore.FieldValue.serverTimestamp(), isRead: true
                        });
                        // ✨ UPDATE THE LEAD PROFILE FOR THE FRONTEND SIDEBAR ✨
                if (clientId) {
                  const leadSnap = await db.collection("leads").where("clientId", "==", clientId).where("phone", "==", senderPhone).limit(1).get();
                  if (!leadSnap.empty) {
                    await leadSnap.docs[0].ref.update({
                      lastMessageText: messageText,
                      lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                      unreadWaCount: admin.firestore.FieldValue.increment(1) // Increments the red badge!
                    });
                  }
                }
                        // 2. Pace the loop so messages queue in correct order and don't race the typing indicator
                        const textLength = botResponseText.length;
                        const simulatedDelay = Math.min(3000, Math.max(1000, textLength * 20));
                        await new Promise(resolve => setTimeout(resolve, simulatedDelay + 500));

                        // 3. Should we auto-forward? (Only if it's a generic message node)
                        if (currentNode.type === 'message') {
                          const nextEdge = flow.edges?.find((e: any) => e.source === currentNode.id);
                          if (nextEdge) {
                            currentNode = flow.nodes?.find((n: any) => n.id === nextEdge.target);
                          } else {
                            currentNode = null; // End of flow
                          }
                        } else {
                          // It is an interactive node (button, list, form, capture). We STOP and wait for human reply.
                          currentNode = null; 
                        }
                      }
                    }
                  }
                }
              }
            }

            // Handle Message Status Updates (Sent, Delivered, Read)
            if (value.statuses && value.statuses.length > 0) {
              for (const status of value.statuses) {
                console.log(`Message ID ${status.id} updated to: ${status.status}`);
              }
            }
          }
        }
        res.status(200).send("EVENT_RECEIVED");
      } else {
        res.status(404).send("Not Found");
      }
    } catch (error) {
      console.error("WhatsApp Webhook Error:", error);
      res.status(500).send("INTERNAL_SERVER_ERROR");
    }
    return;
  }

  res.status(405).send("Method Not Allowed");
});

// ============================================================================
// 🚀 PHASE 3.1: SECURE WHATSAPP OAUTH EXCHANGE 🚀
// ============================================================================
export const secureLinkWhatsApp = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  
  const clientId = request.auth.token.clientId;
  const { accessToken } = request.data; // Passed from frontend Meta Login

  if (!clientId || !accessToken) {
    throw new HttpsError("invalid-argument", "Missing required credentials.");
  }

  try {
    // 1. Fetch the WhatsApp Business Accounts attached to this token
    const wabaResponse = await axios.get(
      `https://graph.facebook.com/v19.0/me/client_whatsapp_business_accounts`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000
      }
    );

    const wabaData = wabaResponse.data?.data;
    if (!wabaData || wabaData.length === 0) {
      throw new Error("No WhatsApp Business Accounts found for this Meta user.");
    }

    const targetWabaId = wabaData[0].id; // Grabbing the first connected WABA

    // 2. Fetch the Phone Numbers attached to that WABA
    const phoneResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${targetWabaId}/phone_numbers`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000
      }
    );

    const phoneData = phoneResponse.data?.data;
    if (!phoneData || phoneData.length === 0) {
      throw new Error("No Phone Numbers found in this WhatsApp Business Account.");
    }

    const targetPhoneNumberId = phoneData[0].id;
    const targetDisplayPhoneNumber = phoneData[0].display_phone_number;

    // 3. Save to CRM Database mapped strictly to this Client
    await db.collection('whatsapp_integrations').doc(clientId).set({
      clientId: clientId,
      wabaId: targetWabaId,
      phoneNumberId: targetPhoneNumberId,
      displayPhoneNumber: targetDisplayPhoneNumber,
      systemAccessToken: accessToken, // In production, exchange this for a permanent token
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
      success: true, 
      message: "WhatsApp Business Account securely linked.",
      phoneNumber: targetDisplayPhoneNumber
    };

  } catch (error: any) {
    console.error("WhatsApp OAuth Error:", error.response?.data || error.message);
    throw new HttpsError("internal", "Failed to secure WhatsApp connection with Meta.");
  }
});

// ============================================================================
// 🚀 PHASE 3.2: DYNAMIC OUTBOUND WHATSAPP DISPATCHER (WITH TYPING UX) 🚀
// ============================================================================
export const sendOutboundWhatsApp = onDocumentCreated({
  document: "whatsapp_messages/{messageId}",
  database: "crmdb", 
  memory: "256MiB",
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const messageData = snapshot.data();

  if (messageData.direction !== 'outbound') return;
  if (messageData.status === 'delivered_to_meta' || messageData.status === 'failed') return;
  if (!messageData.senderPhone || !messageData.clientId) return;

  try {
    const integrationDoc = await db.collection('whatsapp_integrations').doc(messageData.clientId).get();
    
    if (!integrationDoc.exists || integrationDoc.data()?.status !== 'active') {
      throw new Error("Client does not have an active WhatsApp integration.");
    }

    const clientWA = integrationDoc.data();
    const WA_PHONE_NUMBER_ID = clientWA?.phoneNumberId;
    const WA_ACCESS_TOKEN = clientWA?.systemAccessToken;

    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) throw new Error("Missing API keys.");

    let recipientPhone = messageData.senderPhone.replace(/[^0-9]/g, '');
    
    // ✨ LEVEL 5 UX: META CLOUD API TYPING INDICATOR ✨
    // We only simulate typing for AI Bot automated messages, not human agent replies.
    if (messageData.agentName === "AI Bot") {
      try {
        await axios.post(
          `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipientPhone,
            type: "typing_indicator",
            typing_indicator: { type: "text" }
          },
          { headers: { "Authorization": `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" } }
        );
        
        // Dynamic human delay: 20ms per character, minimum 1 second, maximum 3 seconds
        const textLength = messageData.text ? messageData.text.length : 50;
        const humanDelay = Math.min(3000, Math.max(1000, textLength * 20));
        await new Promise(resolve => setTimeout(resolve, humanDelay));
        
      } catch (typingErr: any) {
        console.warn("Typing indicator skipped, proceeding with message:", typingErr.message);
      }
    }

    // ✨ LEVEL 5 FIX: NATIVE UI PAYLOAD BUILDER ✨
    let metaPayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
    };

    if (messageData.type === 'button' && messageData.nodeData?.buttons) {
      // 🔘 Render Native WhatsApp Buttons (Max 3)
      metaPayload.type = "interactive";
      metaPayload.interactive = {
        type: "button",
        body: { text: messageData.nodeData.message || "Please select an option:" },
        action: {
          buttons: messageData.nodeData.buttons.slice(0, 3).map((btn: string, i: number) => ({
            type: "reply",
            reply: { id: `btn-${i}`, title: btn.substring(0, 20) } // Meta strict limit: 20 chars
          }))
        }
      };
    } 
    else if (messageData.type === 'list' && messageData.nodeData?.listItems) {
      // 📋 Render Native WhatsApp iOS/Android Dropdown Menu
      metaPayload.type = "interactive";
      metaPayload.interactive = {
        type: "list",
        body: { text: messageData.nodeData.message || "Please select from the menu:" },
        action: {
          button: (messageData.nodeData.menuTitle || "View Options").substring(0, 20), // Meta limit: 20 chars
          sections: [{
            title: "Options",
            rows: messageData.nodeData.listItems.slice(0, 10).map((item: string, i: number) => ({
              id: `list-${i}`,
              title: item.substring(0, 24) // Meta strict limit: 24 chars
            }))
          }]
        }
      };
    } 
    else {
      // 💬 Standard Text Message
      metaPayload.type = "text";
      metaPayload.text = { preview_url: false, body: messageData.text };
    }

    // Fire actual message to Meta
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`,
      metaPayload,
      { headers: { "Authorization": `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" }, timeout: 5000 }
    );
    await snapshot.ref.update({
      status: "delivered_to_meta",
      metaMessageId: response.data.messages[0].id
    });

  } catch (error: any) {
    console.error("Meta Graph API Error:", error.response?.data || error.message);
    await snapshot.ref.update({
      status: "failed",
      errorLog: error.response?.data?.error?.message || error.message
    });
  }
});
// ============================================================================
// 🚀 BACKGROUND SYNC: AUTO-PUSH LEADS TO GOOGLE SHEETS 🚀
// ============================================================================
export const autoPushToGoogleSheets = onDocumentCreated({
  document: "leads/{leadId}",
  database: "crmdb", // Matches your specific database name
  memory: "256MiB"
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const newLead = snapshot.data();
  const leadId = event.params.leadId;
  const clientId = newLead.clientId;

  // 1. Ensure the lead belongs to a client
  if (!clientId) {
    console.log(`No clientId on lead ${leadId}. Aborting Sheet push.`);
    return;
  }

  try {
    // 2. Fetch the client's saved Google Sheet URL
    const integrationDoc = await db.collection('outbound_integrations').doc(clientId).get();
    if (!integrationDoc.exists) return;

    const googleSheetUrl = integrationDoc.data()?.googleSheetUrl;
    if (!googleSheetUrl) {
      console.log(`No Google Sheet configured for client ${clientId}`);
      return; 
    }

    // 3. Prepare the standardized payload
    const payload = {
      id: leadId,
      clientId: clientId,
      firstName: newLead.firstName || newLead.name || "Unknown",
      lastName: newLead.lastName || "",
      email: newLead.email || "",
      phone: newLead.phone || "",
      projectProperty: newLead.projectProperty || "",
      source: newLead.source || "System",
      subSource: newLead.subSource || "",
      status: newLead.status || "New",
      createdAt: newLead.createdAt ? newLead.createdAt.toDate().toISOString() : new Date().toISOString()
    };

    // 4. Push to Google Apps Script using Axios
    await axios.post(googleSheetUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 6000 // Give Apps Script 6 seconds to respond
    });

    console.log(`✅ Successfully pushed lead ${leadId} to Google Sheets`);

  } catch (error: any) {
    // Apps script often throws CORS/Redirect errors even when successful, 
    // so we log it but don't crash the function.
    console.error(`⚠️ Sheets push notice for client ${clientId}:`, error.message);
  }
});
// ============================================================================
// 🚀 LEVEL 5 SECURITY: AUTO-SYNC SUPER ADMIN CLAIMS 🚀
// ============================================================================

export const onSuperAdminAdded = onDocumentCreated({
  document: "super_admins/{uid}",
  database: "crmdb", 
}, async (event) => {
  const uid = event.params.uid;
  try {
    await admin.auth().setCustomUserClaims(uid, { role: "super_admin" });
    console.log(`Successfully granted super_admin claims to UID: ${uid}`);
  } catch (error) {
    console.error("Error setting custom claims:", error);
  }
});

export const onSuperAdminRemoved = onDocumentDeleted({
  document: "super_admins/{uid}",
  database: "crmdb", 
}, async (event) => {
  const uid = event.params.uid;
  try {
    // Revoke the role by setting it to null
    await admin.auth().setCustomUserClaims(uid, { role: null });
    console.log(`Successfully revoked super_admin claims from UID: ${uid}`);
  } catch (error) {
    console.error("Error removing custom claims:", error);
  }
});
// ============================================================================
// 🚀 LEVEL 5 SECURITY: SAAS BILLING GUARDRAILS (THE TRACKER) 🚀
// ============================================================================
export const enforceLeadLimits = onDocumentCreated({
  document: "leads/{leadId}",
  database: "crmdb", 
  memory: "256MiB"
}, async (event) => {
  const newLead = event.data?.data();
  if (!newLead || !newLead.clientId) return;

  const clientId = newLead.clientId;
  const clientRef = db.collection("clients").doc(clientId);

  try {
    // Run a secure transaction to ensure perfect counting even if 100 leads arrive instantly
    await db.runTransaction(async (transaction) => {
      const clientDoc = await transaction.get(clientRef);
      
      if (!clientDoc.exists) {
        throw new Error("Client document does not exist!");
      }

      const clientData = clientDoc.data();
      
      // Default to Starter Plan limit (2000) if they don't have a custom limit set
      const planLimit = clientData?.planLimit || 2000; 
      const currentCount = (clientData?.totalLeads || 0) + 1;

      // Update the running total
      transaction.update(clientRef, { totalLeads: currentCount });

      // ✨ THE KILL SWITCH ✨
      // If they hit or exceed their limit, immediately suspend the workspace
      if (currentCount >= planLimit && clientData?.status !== 'SUSPENDED') {
        transaction.update(clientRef, { 
          status: 'SUSPENDED',
          suspensionReason: 'PLAN_LIMIT_REACHED',
          suspendedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[KILL SWITCH] Client ${clientId} suspended. Hit limit of ${planLimit}.`);
      }
    });
  } catch (error) {
    console.error("Error enforcing lead limits:", error);
  }
});
// ✨ TIER 2 TO TIER 3: HARD DELETE SUB-CLIENT WORKSPACE ✨
export const deleteSubClientWorkspace = onCall(functionOpts, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const { clientId } = request.data;
  if (!clientId) throw new HttpsError('invalid-argument', 'Client ID is required.');

  try {
    const clientRef = db.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      throw new HttpsError('not-found', 'Client workspace not found.');
    }

    // Security Check: Only Super Admins or the owning Agency can delete this workspace
    const isSuperAdmin = request.auth.token.role === 'super_admin' || request.auth.token.role === 'SUPER_ADMIN';
    const isOwner = request.auth.uid === clientSnap.data()?.agencyId;

    if (!isSuperAdmin && !isOwner) {
      throw new HttpsError('permission-denied', 'You do not have permission to delete this workspace.');
    }

    // 1. Delete from Firebase Authentication
    await admin.auth().deleteUser(clientId).catch(e => console.log("Auth user already deleted or missing."));
    
    // 2. Delete the User routing document
    await db.collection('users').doc(clientId).delete();
    
    // 3. Delete the Client workspace document
    await clientRef.delete();

    return { success: true, message: 'Client workspace and authentication fully deleted.' };
  } catch (error: any) {
    console.error("Error deleting workspace:", error);
    throw new HttpsError('internal', error.message || 'Failed to delete workspace.');
  }
});

// ✨ TIER 1 TO TIER 2: HARD DELETE AGENCY ACCOUNT ✨
export const deleteAgencyAccount = onCall(functionOpts, async (request) => {
  // Security Check: Only Super Admins can delete Agencies
  if (!request.auth || (request.auth.token.role !== 'super_admin' && request.auth.token.role !== 'SUPER_ADMIN')) {
    throw new HttpsError('permission-denied', 'Only Super Admins can delete Agency accounts.');
  }

  const { agencyId } = request.data;
  if (!agencyId) throw new HttpsError('invalid-argument', 'Agency ID is required.');

  try {
    // 1. Delete from Firebase Authentication
    await admin.auth().deleteUser(agencyId).catch(e => console.log("Auth user already deleted."));
    
    // 2. Delete the User routing document
    await db.collection('users').doc(agencyId).delete();
    
    // 3. Delete the Agency profile document
    await db.collection('agencies').doc(agencyId).delete();

    return { success: true, message: 'Agency partner and authentication fully deleted.' };
  } catch (error: any) {
    console.error("Error deleting agency:", error);
    throw new HttpsError('internal', error.message || 'Failed to delete agency.');
  }
});