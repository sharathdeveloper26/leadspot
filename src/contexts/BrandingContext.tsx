import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path if your firebase.ts is elsewhere

interface BrandingContextType {
  logoUrl: string;
  companyName: string;
  isLoadingBranding: boolean;
  customDomain: string | null;
}

const defaultBranding: BrandingContextType = {
  logoUrl: '/leadspot.png', // The default system logo
  companyName: 'Leadspot CRM',
  isLoadingBranding: true,
  customDomain: null,
};

const BrandingContext = createContext<BrandingContextType>(defaultBranding);

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingContextType>(defaultBranding);

  useEffect(() => {
    const fetchBranding = async () => {
      // 1. Grab the exact domain the user typed into their browser
      const hostname = window.location.hostname;

      // 2. Enterprise Optimization: Skip the DB query if they are on localhost or the base Firebase domain.
      // This saves you massive amounts of Firestore read costs.
      if (
        hostname === 'localhost' || 
        hostname.includes('127.0.0.1') || 
        hostname.includes('firebaseapp.com') || 
        hostname.includes('web.app')
      ) {
        setBranding(prev => ({ ...prev, isLoadingBranding: false }));
        return;
      }

      try {
        // 3. Query the clients collection to find who owns this domain
        const q = query(
          collection(db, 'clients'),
          where('customDomain', '==', hostname),
          limit(1) // We only ever need 1 match
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const clientData = querySnapshot.docs[0].data();
          
          // 4. Inject the White-Label data into the global state
          setBranding({
            logoUrl: clientData.logoUrl || '/leadspot.png', // Fallback to Leadspot if they didn't upload a logo
            companyName: clientData.name || 'CRM Workspace',
            customDomain: hostname,
            isLoadingBranding: false,
          });
        } else {
          // Domain isn't registered in our DB, fallback to default
          setBranding(prev => ({ ...prev, isLoadingBranding: false }));
        }
      } catch (error) {
        console.error("🔥 Error fetching white-label branding:", error);
        // Fail safely to default branding so the app doesn't crash
        setBranding(prev => ({ ...prev, isLoadingBranding: false }));
      }
    };

    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {/* Optional: Add a brief loading screen here if you want to completely hide the UI until the logo loads */}
      {children}
    </BrandingContext.Provider>
  );
};