import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's new Firebase configuration (Leadspot CRM)
const firebaseConfig = {
  apiKey: "AIzaSyDx1KKisBomun-POUzygHZ-whjp1SHmBYw",
  authDomain: "leadspot-crm-52ab4.firebaseapp.com",
  projectId: "leadspot-crm-52ab4",
  storageBucket: "leadspot-crm-52ab4.firebasestorage.app",
  messagingSenderId: "196721751018",
  appId: "1:196721751018:web:f2b2314d09f091a8e8f893"
  // Note: measurementId is missing from the new config. 
  // If you plan to use Google Analytics, you will need to enable it in the new Firebase console and add it here.
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Cloud Functions (explicitly setting region to us-central1)
export const functions = getFunctions(app, 'us-central1');

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with the specific database name 'crmdb'
export const db = getFirestore(app, 'crmdb');