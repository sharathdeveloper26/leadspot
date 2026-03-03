import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = getFirestore(admin.app(), 'crmdb');

export const incomingLeadWebhook = onRequest({ cors: true }, async (req, res) => {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed. Please use POST.");
    return;
  }

  // 2. Extract data from body or query (for flexibility)
  const data = { ...req.query, ...req.body };
  const { clientId, name, email, phone, source, project } = data;

  // 3. Validate clientId (Required for data isolation)
  if (!clientId) {
    res.status(400).send("Error: clientId is required for lead attribution.");
    return;
  }

  try {
    const finalSource = source || "Webhook";
    let assignedToId = null;
    let assignedToName = null;

    // Fetch assignment rules
    const rulesSnapshot = await db.collection("lead_assignment_rules")
      .where("clientId", "==", clientId)
      .where("sourceName", "==", finalSource)
      .get();

    if (!rulesSnapshot.empty) {
      const ruleData = rulesSnapshot.docs[0].data();
      assignedToId = ruleData.agentId;
      assignedToName = ruleData.agentName;
    }

    // 4. Map incoming data to our Lead schema
    const leadData = {
      clientId: clientId,
      firstName: name || "External",
      lastName: "Lead",
      email: email || "",
      phone: phone || "",
      source: finalSource,
      projectProperty: project || "General Inquiry",
      status: "New",
      assignedTo: assignedToId,
      assignedToId: assignedToId,
      assignedToName: assignedToName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 5. Save to Firestore
    await db.collection("leads").add(leadData);

    // 6. Return success
    res.status(200).json({ 
      success: true, 
      message: "Lead captured successfully.",
      received: leadData 
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(500).send("Internal Server Error: Failed to save lead.");
  }
});

export const createAgent = onCall(async (request) => {
  // 1. Verify Authentication & Authorization
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create an agent.");
  }
  
  if (request.auth.token.role !== "client_admin") {
    throw new HttpsError("permission-denied", "Only Client Admins can create agents.");
  }

  const clientId = request.auth.token.clientId;
  if (!clientId) {
    throw new HttpsError("failed-precondition", "No clientId found on caller's token.");
  }

  // 2. Extract data
  const { email, password, name } = request.data;
  if (!email || !password || !name) {
    throw new HttpsError("invalid-argument", "Email, password, and name are required.");
  }

  try {
    // 2.5 Check Agent Limit
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) {
      throw new HttpsError("not-found", "Client document not found.");
    }
    const maxAgents = clientDoc.data()?.maxAgents || 0;

    const agentsSnapshot = await db.collection("users")
      .where("clientId", "==", clientId)
      .where("role", "==", "client_agent")
      .count()
      .get();
    
    const currentCount = agentsSnapshot.data().count;

    if (currentCount >= maxAgents) {
      throw new HttpsError("resource-exhausted", `Agent limit reached. Maximum allowed is ${maxAgents}.`);
    }

    // 3. Create Auth User
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true // Auto-verify for agents created by admin
    });

    const userId = userRecord.uid;

    // 4. Set Custom Claims
    await admin.auth().setCustomUserClaims(userId, {
      role: "client_agent",
      clientId: clientId,
    });

    // 5. Save to Firestore
    await db.collection("users").doc(userId).set({
      name,
      email,
      role: "client_agent",
      clientId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { 
      success: true, 
      message: "Agent created successfully", 
      userId 
    };
  } catch (error: any) {
    console.error("Error creating agent:", error);
    throw new HttpsError("internal", error.message || "Failed to create agent.");
  }
});

export const deleteAgent = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "client_admin") {
    throw new HttpsError("permission-denied", "Only Client Admins can delete agents.");
  }

  const clientId = request.auth.token.clientId;
  const { agentId } = request.data;

  if (!agentId) {
    throw new HttpsError("invalid-argument", "Agent ID is required.");
  }

  try {
    // Verify agent belongs to this client
    const agentDoc = await db.collection("users").doc(agentId).get();
    if (!agentDoc.exists || agentDoc.data()?.clientId !== clientId || agentDoc.data()?.role !== "client_agent") {
      throw new HttpsError("permission-denied", "You can only delete agents in your own workspace.");
    }

    // Delete from Auth
    await admin.auth().deleteUser(agentId);

    // Delete from Firestore
    await db.collection("users").doc(agentId).delete();

    return { success: true, message: "Agent deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting agent:", error);
    throw new HttpsError("internal", error.message || "Failed to delete agent.");
  }
});

export const updateAgent = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== "client_admin") {
    throw new HttpsError("permission-denied", "Only Client Admins can update agents.");
  }

  const clientId = request.auth.token.clientId;
  const { agentId, name } = request.data;

  if (!agentId || !name) {
    throw new HttpsError("invalid-argument", "Agent ID and name are required.");
  }

  try {
    // Verify agent belongs to this client
    const agentDoc = await db.collection("users").doc(agentId).get();
    if (!agentDoc.exists || agentDoc.data()?.clientId !== clientId || agentDoc.data()?.role !== "client_agent") {
      throw new HttpsError("permission-denied", "You can only update agents in your own workspace.");
    }

    // Update Auth (DisplayName)
    await admin.auth().updateUser(agentId, { displayName: name });

    // Update Firestore
    await db.collection("users").doc(agentId).update({ name });

    return { success: true, message: "Agent updated successfully." };
  } catch (error: any) {
    console.error("Error updating agent:", error);
    throw new HttpsError("internal", error.message || "Failed to update agent.");
  }
});

export const registerNewClient = onCall(async (request) => {
  // 1. Extract data from the request
  const { email, password, companyName } = request.data;

  // 2. Validate input
  if (!email || !password || !companyName) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with email, password, and companyName."
    );
  }

  try {
    // 3. Create the Client document first to generate a clientId
    const clientRef = db.collection("clients").doc();
    const clientId = clientRef.id;

    await clientRef.set({
      name: companyName,
      subscriptionPlan: "BASIC", // Default plan
      status: "ACTIVE",
      maxAgents: 2, // Default limit
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Create the Firebase Auth User
    // We set emailVerified to false so they must verify before accessing the app
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      emailVerified: false, 
    });

    const userId = userRecord.uid;

    // 5. Set Custom Claims for the new Client Admin
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "client_admin",
      clientId: clientRef.id,
    });

    // 6. Create the User document in Firestore
    await db.collection("users").doc(userId).set({
      email: email,
      role: "client_admin",
      clientId: clientRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 7. Generate Email Verification Link
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    
    // TODO: Integrate with an email provider (SendGrid, Postmark, Nodemailer) to send this link.
    // Example: await sendEmail(email, "Verify your email", `Click here: ${verificationLink}`);
    console.log(`Verification link generated for ${email}: ${verificationLink}`);

    // 8. Return success to the frontend
    return {
      success: true,
      message: "Client registered successfully. Please check your email to verify your account.",
      clientId: clientId,
      userId: userId,
      // NOTE: Returning the link here is useful for development/testing. 
      // In production, you should email it and remove it from this response payload.
      verificationLink: verificationLink 
    };

  } catch (error: any) {
    console.error("Error registering new client:", error);
    
    // Throw a structured error back to the client
    throw new HttpsError(
      "internal", 
      error.message || "Failed to register new client."
    );
  }
});
