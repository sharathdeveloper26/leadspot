"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureLinkFacebookPage = exports.registerNewClient = exports.updateAgent = exports.deleteAgent = exports.createAgent = exports.incomingLeadWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const axios_1 = require("axios");
// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = (0, firestore_1.getFirestore)(admin.app(), 'crmdb');
exports.incomingLeadWebhook = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // 1. HANDSHAKE: Handle Meta Verification (GET Request)
    if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        // Use the secret you'll put in the Meta Developer Portal
        if (mode === "subscribe" && token === "MINTAGE_CRM_SECRET") {
            res.status(200).send(challenge);
            return;
        }
        res.status(403).send("Forbidden");
        return;
    }
    // 2. LEAD CATCHER: Handle POST Request (Manual Webhook OR Meta)
    if (req.method === "POST") {
        try {
            let leadData = {};
            let clientId = null;
            let customAnswers = {};
            // CHECK: Is this from Meta? (Facebook sends a specific structure)
            if (req.body.object === "page" && ((_e = (_d = (_c = (_b = (_a = req.body.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.changes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.leadgen_id)) {
                const changes = req.body.entry[0].changes[0].value;
                const pageId = changes.page_id;
                const leadgenId = changes.leadgen_id;
                // Find the client who owns this Facebook Page
                const integrationQuery = await db.collection("facebook_integrations")
                    .where("pageId", "==", pageId)
                    .limit(1)
                    .get();
                if (integrationQuery.empty) {
                    console.error(`No client integration found for Page ID: ${pageId}`);
                    res.status(200).send("Ignored: Integration not found");
                    return;
                }
                const integrationData = integrationQuery.docs[0].data();
                clientId = integrationData.clientId;
                // Token Safety Check
                const pageAccessToken = integrationData.pageAccessToken || integrationData.accessToken;
                if (!pageAccessToken) {
                    console.error(`CRITICAL ERROR: No access token found in database for Page ID: ${pageId}`);
                    res.status(200).send("Ignored: Missing Access Token");
                    return;
                }
                // Fetch actual lead details AND Campaign Tracking Data from Meta Graph API
                const fbResponse = await axios_1.default.get(`https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,form_id,ad_id,ad_name,campaign_id,campaign_name&access_token=${pageAccessToken}`);
                const fbData = fbResponse.data;
                const fbFields = fbData.field_data || [];
                // LOOP TO EXTRACT ALL CUSTOM FACEBOOK QUESTIONS
                fbFields.forEach((field) => {
                    if (!['full_name', 'email', 'phone_number'].includes(field.name)) {
                        customAnswers[field.name] = field.values[0];
                    }
                });
                leadData = {
                    name: ((_f = fbFields.find((f) => f.name === "full_name")) === null || _f === void 0 ? void 0 : _f.values[0]) || "FB Lead",
                    email: ((_g = fbFields.find((f) => f.name === "email")) === null || _g === void 0 ? void 0 : _g.values[0]) || "",
                    phone: ((_h = fbFields.find((f) => f.name === "phone_number")) === null || _h === void 0 ? void 0 : _h.values[0]) || "",
                    source: "Facebook",
                    project: fbData.campaign_name || "Facebook Ad Campaign",
                    // Campaign Tracking Info
                    formId: fbData.form_id || "",
                    adId: fbData.ad_id || "",
                    adName: fbData.ad_name || "Unknown Ad",
                    campaignId: fbData.campaign_id || "",
                    campaignName: fbData.campaign_name || "Unknown Campaign"
                };
            }
            else {
                // Fallback: Use your existing manual webhook logic (for Pabbly/Zapier/Direct)
                const data = Object.assign(Object.assign({}, req.query), req.body);
                clientId = data.clientId;
                customAnswers = data.customAnswers || {};
                leadData = {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    source: data.source || "Webhook",
                    project: data.project || "General Inquiry",
                    formId: "", adId: "", adName: "", campaignId: "", campaignName: "",
                    utm_source: data.utm_source || "", utm_medium: data.utm_medium || "", utm_campaign: data.utm_campaign || ""
                };
            }
            if (!clientId) {
                res.status(200).send("Error: clientId is required.");
                return;
            }
            // --- 🚀 START APOLLO ENRICHMENT LOGIC 🚀 ---
            let designation = "Unknown";
            let location = "Unknown";
            let linkedinUrl = "";
            if (leadData.email) {
                try {
                    const apolloResponse = await axios_1.default.post('https://api.apollo.io/v1/people/match', {
                        api_key: 'vWaMRrj2mpju0d1hVAN6RQ', // Your Apollo API Key
                        email: leadData.email,
                        name: leadData.name
                    }, {
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (apolloResponse.data && apolloResponse.data.person) {
                        const person = apolloResponse.data.person;
                        designation = person.title || "Unknown";
                        location = person.city ? `${person.city}, ${person.state || ''}` : "Unknown";
                        linkedinUrl = person.linkedin_url || "";
                    }
                }
                catch (enrichmentError) {
                    console.error("Apollo API Miss:", enrichmentError.message);
                }
            }
            let assignedToId = null;
            let assignedToName = null;
            const rulesSnapshot = await db.collection("lead_assignment_rules")
                .where("clientId", "==", clientId)
                .where("sourceName", "==", leadData.source)
                .get();
            if (!rulesSnapshot.empty) {
                const ruleData = rulesSnapshot.docs[0].data();
                assignedToId = ruleData.agentId;
                assignedToName = ruleData.agentName;
            }
            // 👇 SMART NAME SPLITTING LOGIC 👇
            let fName = leadData.name || "Unknown";
            let lName = "";
            // If the name has a space, intelligently split it into first and last name
            if (fName.includes(" ") && fName !== "FB Lead") {
                const parts = fName.trim().split(" ");
                fName = parts[0];
                lName = parts.slice(1).join(" ");
            }
            else if (fName === "FB Lead") {
                fName = "Facebook";
                lName = "Lead";
            }
            // 👆 END SMART NAME SPLITTING 👆
            const finalLead = {
                clientId: clientId,
                firstName: fName, // Uses cleanly split first name
                lastName: lName, // Uses cleanly split last name (NO MORE HARDCODED "Lead")
                email: leadData.email || "",
                phone: leadData.phone || "",
                source: leadData.source,
                projectProperty: leadData.project,
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
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection("leads").add(finalLead);
            res.status(200).json({ success: true, message: "Event processed" });
        }
        catch (error) {
            console.error("Webhook Processing Error:", error.message || error);
            res.status(200).send("EVENT_RECEIVED_BUT_ERRORED");
        }
        return;
    }
    res.status(200).send("Method Not Allowed");
});
exports.createAgent = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to create an agent.");
    }
    if (request.auth.token.role !== "client_admin") {
        throw new https_1.HttpsError("permission-denied", "Only Client Admins can create agents.");
    }
    const clientId = request.auth.token.clientId;
    if (!clientId) {
        throw new https_1.HttpsError("failed-precondition", "No clientId found on caller's token.");
    }
    const { email, password, name } = request.data;
    if (!email || !password || !name) {
        throw new https_1.HttpsError("invalid-argument", "Email, password, and name are required.");
    }
    try {
        const clientDoc = await db.collection("clients").doc(clientId).get();
        if (!clientDoc.exists) {
            throw new https_1.HttpsError("not-found", "Client document not found.");
        }
        const maxAgents = ((_a = clientDoc.data()) === null || _a === void 0 ? void 0 : _a.maxAgents) || 0;
        const agentsSnapshot = await db.collection("users")
            .where("clientId", "==", clientId)
            .where("role", "==", "client_agent")
            .count()
            .get();
        const currentCount = agentsSnapshot.data().count;
        if (currentCount >= maxAgents) {
            throw new https_1.HttpsError("resource-exhausted", `Agent limit reached. Maximum allowed is ${maxAgents}.`);
        }
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: true
        });
        const userId = userRecord.uid;
        await admin.auth().setCustomUserClaims(userId, {
            role: "client_agent",
            clientId: clientId,
        });
        await db.collection("users").doc(userId).set({
            name,
            email,
            role: "client_agent",
            clientId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: "Agent created successfully", userId };
    }
    catch (error) {
        console.error("Error creating agent:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to create agent.");
    }
});
exports.deleteAgent = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth || request.auth.token.role !== "client_admin") {
        throw new https_1.HttpsError("permission-denied", "Only Client Admins can delete agents.");
    }
    const clientId = request.auth.token.clientId;
    const { agentId } = request.data;
    if (!agentId) {
        throw new https_1.HttpsError("invalid-argument", "Agent ID is required.");
    }
    try {
        const agentDoc = await db.collection("users").doc(agentId).get();
        if (!agentDoc.exists || ((_a = agentDoc.data()) === null || _a === void 0 ? void 0 : _a.clientId) !== clientId || ((_b = agentDoc.data()) === null || _b === void 0 ? void 0 : _b.role) !== "client_agent") {
            throw new https_1.HttpsError("permission-denied", "You can only delete agents in your own workspace.");
        }
        await admin.auth().deleteUser(agentId);
        await db.collection("users").doc(agentId).delete();
        return { success: true, message: "Agent deleted successfully." };
    }
    catch (error) {
        console.error("Error deleting agent:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to delete agent.");
    }
});
exports.updateAgent = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth || request.auth.token.role !== "client_admin") {
        throw new https_1.HttpsError("permission-denied", "Only Client Admins can update agents.");
    }
    const clientId = request.auth.token.clientId;
    const { agentId, name } = request.data;
    if (!agentId || !name) {
        throw new https_1.HttpsError("invalid-argument", "Agent ID and name are required.");
    }
    try {
        const agentDoc = await db.collection("users").doc(agentId).get();
        if (!agentDoc.exists || ((_a = agentDoc.data()) === null || _a === void 0 ? void 0 : _a.clientId) !== clientId || ((_b = agentDoc.data()) === null || _b === void 0 ? void 0 : _b.role) !== "client_agent") {
            throw new https_1.HttpsError("permission-denied", "You can only update agents in your own workspace.");
        }
        await admin.auth().updateUser(agentId, { displayName: name });
        await db.collection("users").doc(agentId).update({ name });
        return { success: true, message: "Agent updated successfully." };
    }
    catch (error) {
        console.error("Error updating agent:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to update agent.");
    }
});
exports.registerNewClient = (0, https_1.onCall)(async (request) => {
    const { email, password, companyName } = request.data;
    if (!email || !password || !companyName) {
        throw new https_1.HttpsError("invalid-argument", "The function must be called with email, password, and companyName.");
    }
    try {
        const clientRef = db.collection("clients").doc();
        const clientId = clientRef.id;
        await clientRef.set({
            name: companyName,
            subscriptionPlan: "BASIC",
            status: "ACTIVE",
            maxAgents: 2,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: false,
        });
        const userId = userRecord.uid;
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: "client_admin",
            clientId: clientRef.id,
        });
        await db.collection("users").doc(userId).set({
            email: email,
            role: "client_admin",
            clientId: clientRef.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const verificationLink = await admin.auth().generateEmailVerificationLink(email);
        console.log(`Verification link generated for ${email}: ${verificationLink}`);
        return {
            success: true,
            message: "Client registered successfully. Please check your email to verify your account.",
            clientId: clientId,
            userId: userId,
            verificationLink: verificationLink
        };
    }
    catch (error) {
        console.error("Error registering new client:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to register new client.");
    }
});
exports.secureLinkFacebookPage = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be logged in.");
    const clientId = request.auth.token.clientId;
    const { shortLivedUserToken, pageId, pageName } = request.data;
    if (!clientId || !shortLivedUserToken || !pageId) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    const APP_ID = '1439047481212574';
    const APP_SECRET = 'c8ea2e55436a18ecb2ca51ccdeac0937';
    try {
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortLivedUserToken}`;
        const exchangeRes = await axios_1.default.get(exchangeUrl);
        const longLivedUserToken = exchangeRes.data.access_token;
        const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`;
        const pagesRes = await axios_1.default.get(pagesUrl);
        const pageData = pagesRes.data.data.find((p) => p.id === pageId);
        if (!pageData) {
            throw new Error("Could not find the requested page. Check permissions.");
        }
        const permanentPageToken = pageData.access_token;
        await axios_1.default.post(`https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`, new URLSearchParams({
            subscribed_fields: 'leadgen',
            access_token: permanentPageToken
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        await db.collection('facebook_integrations').doc(clientId).set({
            clientId: clientId,
            pageId: pageId,
            pageName: pageName,
            pageAccessToken: permanentPageToken,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: "Page securely linked with permanent token." };
    }
    catch (error) {
        console.error("Token Exchange Error:", error.response ? error.response.data : error.message);
        throw new https_1.HttpsError("internal", "Failed to secure Facebook connection.");
    }
});
//# sourceMappingURL=index.js.map