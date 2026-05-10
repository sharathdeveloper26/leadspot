import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase'; 

interface BrandingContextType {
  logoUrl: string;
  companyName: string;
  isLoadingBranding: boolean;
}

const defaultBranding: BrandingContextType = {
  logoUrl: '/leadspot.png', 
  companyName: 'Leadspot CRM',
  isLoadingBranding: true,
};

const BrandingContext = createContext<BrandingContextType>(defaultBranding);

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingContextType>(defaultBranding);

  useEffect(() => {
    const fetchBranding = async () => {
      const hostname = window.location.hostname;

      if (
        (hostname === 'localhost' || hostname.includes('127.0.0.1') || 
         hostname.includes('firebaseapp.com') || hostname.includes('web.app')) &&
         hostname !== 'crm.exam-results.in' 
      ) {
        setBranding({ ...defaultBranding, isLoadingBranding: false });
        return;
      }

      try {
        const q = query(collection(db, 'clients'), where('customDomain', '==', hostname), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const clientData = querySnapshot.docs[0].data();
          setBranding({
            logoUrl: clientData.logoUrl || '/leadspot.png',
            companyName: clientData.name || 'Workspace',
            isLoadingBranding: false,
          });
        } else {
          setBranding({ ...defaultBranding, isLoadingBranding: false });
        }
      } catch (error) {
        console.error("🔥 Branding Error:", error);
        setBranding({ ...defaultBranding, isLoadingBranding: false });
      }
    };

    fetchBranding();
  }, []);

  useEffect(() => {
    if (!branding.isLoadingBranding) {
      // 1. Dynamic Title
      document.title = branding.companyName === 'Leadspot CRM' 
        ? 'Leadspot CRM | Enterprise Revenue Platform' 
        : `${branding.companyName} | Intelligent Workspace`;

      // 2. Dynamic Favicon - FIX: Using HTMLLinkElement
      const favicon = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
      const appleIcon = document.getElementById('dynamic-apple-icon') as HTMLLinkElement | null;
      
      if (favicon) favicon.href = branding.logoUrl;
      if (appleIcon) appleIcon.href = branding.logoUrl;
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>
      {branding.isLoadingBranding ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
           <div className="w-10 h-10 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (
        children
      )}
    </BrandingContext.Provider>
  );
};