/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrandingProvider } from './contexts/BrandingContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import AgentDashboard from './components/AgentDashboard';
import Login from './components/Login';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole: string }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  
  if (role !== allowedRole && role?.toUpperCase() !== allowedRole?.toUpperCase()) {
    // Redirect to appropriate dashboard if wrong role
    if (role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
    if (role === 'CLIENT_ADMIN' || role === 'client_admin') return <Navigate to="/client-admin" />;
    if (role === 'client_agent') return <Navigate to="/agent-dashboard" />;
    return <div className="p-8 text-center text-red-600">Unauthorized access.</div>;
  }
  
  return <>{children}</>;
}

function RootRedirect() {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  if (role === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
  if (role === 'CLIENT_ADMIN' || role === 'client_admin') return <Navigate to="/client-admin" />;
  if (role === 'client_agent') return <Navigate to="/agent-dashboard" />;
  
  return <div className="p-8 text-center text-red-600">Invalid account role.</div>;
}

function AppContent() {
  useIdleTimeout();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/super-admin" 
          element={
            <ProtectedRoute allowedRole="SUPER_ADMIN">
              <SuperAdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/client-admin" 
          element={
            <ProtectedRoute allowedRole="client_admin">
              <ClientDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agent-dashboard" 
          element={
            <ProtectedRoute allowedRole="client_agent">
              <AgentDashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* ✨ WRAPPED THE APP WITH YOUR BRANDING PROVIDER ✨ */}
      <BrandingProvider>
        <AppContent />
      </BrandingProvider>
    </AuthProvider>
  );
}