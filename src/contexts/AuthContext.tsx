import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../firebase';

export interface CustomUser extends User {
  clientId?: string | null;
  role?: string | null;
}

interface AuthContextType {
  user: CustomUser | null;
  role: string | null;
  clientId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Force refresh to get the latest custom claims (role, clientId)
          const tokenResult = await currentUser.getIdTokenResult(true);
          
          let extractedRole = (tokenResult.claims.role as string) || null;
          let extractedClientId = (tokenResult.claims.clientId as string) || null;

          // Master Bypass for Super Admin
          if (currentUser.email === 'sharath@mintagemarkcomm.com') {
            extractedRole = 'SUPER_ADMIN';
            extractedClientId = null;
          }

          setRole(extractedRole);
          setClientId(extractedClientId);
          
          // Attach to user object so user.clientId works
          const customUser = currentUser as CustomUser;
          customUser.role = extractedRole;
          customUser.clientId = extractedClientId;
          
          setUser(customUser);
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          setUser(currentUser as CustomUser);
        }
      } else {
        setUser(null);
        setRole(null);
        setClientId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
