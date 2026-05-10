import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase'; 

interface BrandingContextType {
  logoUrl: string;
  companyName: string;
  isLoadingBranding: boolean;
  customDomain: string | null;
}

const defaultBranding: BrandingContextType = {
  logoUrl: '/leadspot.png', 
  companyName: 'Leadspot CRM',
  isLoadingBranding: true,
  customDomain: null,
};

const BrandingContext = createContext<BrandingContextType>(defaultBranding);

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingContextType>(defaultBranding);

  // ✨ ENGINE 1: Fetch Branding Data from Firestore based on Domain
  useEffect(() => {
    const fetchBranding = async () => {
      const hostname = window.location.hostname;

      // Optimization: Skip DB query for local development or default Firebase domains
      // Unless you are explicitly testing crm.exam-results.in via hosts file
      if (
        (hostname === 'localhost' || hostname.includes('127.0.0.1') || 
         hostname.includes('firebaseapp.com') || hostname.includes('web.app')) &&
         hostname !== 'crm.exam-results.in' 
      ) {
        setBranding(prev => ({ ...prev, isLoadingBranding: false }));
        return;
      }

      try {
        const q = query(
          collection(db, 'clients'),
          where('customDomain', '==', hostname),
          limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const clientData = querySnapshot.docs[0].data();
          setBranding({
            logoUrl: clientData.logoUrl || '/leadspot.png',
            companyName: clientData.name || 'CRM Workspace',
            customDomain: hostname,
            isLoadingBranding: false,
          });
        } else {
          setBranding(prev => ({ ...prev, isLoadingBranding: false }));
        }
      } catch (error) {
        console.error("🔥 Error fetching white-label branding:", error);
        setBranding(prev => ({ ...prev, isLoadingBranding: false }));
      }
    };

    fetchBranding();
  }, []);

  // ✨ ENGINE 2: Dynamic Browser Tab Title
  useEffect(() => {
    if (!branding.isLoadingBranding) {
      // Sets the tab title to "Client Name | Enterprise Revenue Platform"
      document.title = `${branding.companyName} | Enterprise Revenue Platform`;
    }
  }, [branding.companyName, branding.isLoadingBranding]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};