import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where, addDoc, serverTimestamp, getDoc, setDoc, getCountFromServer } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Database, Settings, LogOut, Plus, Edit2, Trash2, ShieldAlert, CheckCircle2, XCircle, Info, AlertCircle, Building2, Activity, Server, Search, Menu, X, Calendar, Globe, Key, Save, Facebook, MessageCircle, CheckSquare } from 'lucide-react';

interface ClientData {
  id: string;
  name: string;
  status: string;
  subscriptionPlan: string;
  maxAgents: number;
  createdAt: any;
}

interface GlobalSource {
  id: string;
  name: string;
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  
  // ✨ LEVEL 5 FIX: Default tab set to 'dashboard' instead of 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'lead_sources' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Global Stats
  const [totalAgents, setTotalAgents] = useState(0);

  // ✨ LEVEL 5 FIX: Platform Telemetry State
  const [telemetry, setTelemetry] = useState({
    totalLeads: 0,
    totalMessages: 0,
    totalTasks: 0,
    totalFbPages: 0
  });

  // Global Sources State
  const [globalSources, setGlobalSources] = useState<GlobalSource[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // System Settings State
  const [systemSettings, setSystemSettings] = useState({
    metaAppId: '',
    metaAppSecret: '',
    apolloApiKey: '',
    supportEmail: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal States
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  
  // New Client Form
  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Inline Editing
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editMaxAgents, setEditMaxAgents] = useState<number>(2);

  // Custom Global Dialog Engine
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'success' | 'error';
    title: string;
    message: string;
    onConfirm?: () => void;
    onCloseAction?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showDialog = (type: 'alert' | 'confirm' | 'success' | 'error', title: string, message: string, onConfirm?: () => void, onCloseAction?: () => void) => {
    setDialogState({ isOpen: true, type, title, message, onConfirm, onCloseAction });
  };

  const closeDialog = () => {
    if (dialogState.onCloseAction && dialogState.type !== 'confirm') dialogState.onCloseAction();
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  // ✨ LEVEL 5 SECURITY: 15-Minute Inactivity Auto-Logout ✨
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => { 
        showDialog('alert', 'Session Expired', 'Your Super Admin session has expired due to 15 minutes of inactivity for security reasons.', undefined, () => { logout(); }); 
      }, 900000); // 15 minutes
    };
    
    resetTimer();
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    
    return () => { 
      if (timeoutRef.current) clearTimeout(timeoutRef.current); 
      events.forEach(event => window.removeEventListener(event, handleActivity)); 
    };
  }, [logout]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Clients
      const clientsSnap = await getDocs(collection(db, 'clients'));
      const fetchedClients: ClientData[] = [];
      clientsSnap.forEach(doc => {
        fetchedClients.push({ id: doc.id, ...doc.data() } as ClientData);
      });
      
      // ULTRA-SAFE SORTING (Prevents crashes if createdAt is missing)
      fetchedClients.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          return new Date(val).getTime() || 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
      setClients(fetchedClients);

      // 2. Fetch Total Agents across system
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'client_agent')));
      setTotalAgents(usersSnap.size);

      // 3. Fetch Global Sources
      const sourcesSnap = await getDocs(collection(db, 'global_lead_sources'));
      const fetchedSources: GlobalSource[] = [];
      sourcesSnap.forEach(doc => {
        fetchedSources.push({ id: doc.id, name: doc.data().name });
      });
      setGlobalSources(fetchedSources.sort((a, b) => a.name.localeCompare(b.name)));

      // 4. Fetch System Settings
      const settingsDoc = await getDoc(doc(db, 'system_settings', 'core'));
      if (settingsDoc.exists()) {
        setSystemSettings(prev => ({ ...prev, ...settingsDoc.data() }));
      }

      // 5. ✨ LEVEL 5 FIX: Fetch Platform Telemetry inside fetchData!
      const [leadsCount, msgsCount, tasksCount, fbCount] = await Promise.all([
        getCountFromServer(collection(db, 'leads')),
        getCountFromServer(collection(db, 'whatsapp_messages')),
        getCountFromServer(collection(db, 'reminders')),
        getCountFromServer(collection(db, 'facebook_integrations'))
      ]);

      setTelemetry({
        totalLeads: leadsCount.data().count,
        totalMessages: msgsCount.data().count,
        totalTasks: tasksCount.data().count,
        totalFbPages: fbCount.data().count
      });

    } catch (error: any) {
      console.error("🔥 Detailed Sync Error:", error);
      showDialog('error', 'Sync Error', error.message || 'Failed to synchronize system data. Press F12 to check console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CLIENT MANAGEMENT FUNCTIONS ---
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !adminEmail || !adminPassword) {
      showDialog('error', 'Missing Fields', 'Please fill in all required fields.');
      return;
    }
    setAddingClient(true);
    try {
      const registerFn = httpsCallable(functions, 'registerNewClient');
      await registerFn({ email: adminEmail, password: adminPassword, companyName: companyName });
      
      setCompanyName(''); setAdminEmail(''); setAdminPassword('');
      setIsAddClientModalOpen(false);
      await fetchData();
      showDialog('success', 'Workspace Created', `${companyName} has been successfully provisioned.`);
    } catch (error: any) {
      console.error("Error creating client:", error);
      showDialog('error', 'Provisioning Failed', error.message || "Failed to create client workspace.");
    } finally {
      setAddingClient(false);
    }
  };

  const toggleClientStatus = async (clientId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionText = newStatus === 'ACTIVE' ? 'activate' : 'suspend';
    
    showDialog('confirm', 'Change Workspace Status', `Are you sure you want to ${actionText} this workspace?`, async () => {
      try {
        await updateDoc(doc(db, 'clients', clientId), { status: newStatus });
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c));
        showDialog('success', 'Status Updated', `Workspace has been marked as ${newStatus}.`);
      } catch (error) {
        showDialog('error', 'Update Failed', 'Failed to update client status.');
      }
    });
  };

  const saveAgentLimit = async (clientId: string) => {
    try {
      await updateDoc(doc(db, 'clients', clientId), { maxAgents: editMaxAgents });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, maxAgents: editMaxAgents } : c));
      setEditingClientId(null);
      showDialog('success', 'Limit Updated', `Agent limit has been successfully updated to ${editMaxAgents}.`);
    } catch (error) {
      showDialog('error', 'Update Failed', 'Failed to update agent limit.');
    }
  };

  const deleteClient = async (clientId: string) => {
    showDialog('confirm', 'CRITICAL WARNING', 'Are you absolutely sure you want to delete this workspace? This will orphan all associated users and leads. This cannot be undone.', async () => {
      try {
        await deleteDoc(doc(db, 'clients', clientId));
        setClients(prev => prev.filter(c => c.id !== clientId));
        showDialog('success', 'Deleted', 'Client workspace has been permanently deleted.');
      } catch (error) {
        showDialog('error', 'Deletion Failed', 'Failed to delete workspace. Check permissions.');
      }
    });
  };

  // --- GLOBAL SOURCES FUNCTIONS ---
  const handleAddGlobalSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    setAddingSource(true);
    try {
      const docRef = await addDoc(collection(db, 'global_lead_sources'), { 
        name: newSourceName.trim(), 
        createdAt: serverTimestamp() 
      });
      setGlobalSources([...globalSources, { id: docRef.id, name: newSourceName.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSourceName('');
      showDialog('success', 'Source Added', 'Global lead source added successfully.');
    } catch (error) {
      showDialog('error', 'Error', 'Failed to add global source.');
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteGlobalSource = async (id: string) => {
    showDialog('confirm', 'Delete Source', 'Remove this global source from the system?', async () => {
      try {
        await deleteDoc(doc(db, 'global_lead_sources', id));
        setGlobalSources(prev => prev.filter(s => s.id !== id));
        showDialog('success', 'Deleted', 'Source removed successfully.');
      } catch (error) {
        showDialog('error', 'Error', 'Failed to delete source.');
      }
    });
  };

  // --- SYSTEM SETTINGS FUNCTIONS ---
  const handleSaveSystemSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'system_settings', 'core'), systemSettings, { merge: true });
      showDialog('success', 'Settings Saved', 'System configurations have been securely updated.');
    } catch (error) {
      showDialog('error', 'Save Failed', 'Failed to update system settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      
      {/* ✨ CUSTOM DIALOG COMPONENT ✨ */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 shadow-inner ${
                dialogState.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 
                dialogState.type === 'error' ? 'bg-red-100 text-red-600' :
                dialogState.type === 'success' ? 'bg-[#74ebd5]/20 text-[#50bdaf]' :
                'bg-blue-100 text-blue-600'
              }`}>
                 {dialogState.type === 'confirm' ? <AlertCircle className="h-7 w-7" /> : 
                  dialogState.type === 'error' ? <XCircle className="h-7 w-7" /> :
                  dialogState.type === 'success' ? <CheckCircle2 className="h-7 w-7" /> :
                  <Info className="h-7 w-7" />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{dialogState.title}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{dialogState.message}</p>
            </div>
            <div className="p-4 bg-slate-50/50 border-t border-slate-100/80 flex gap-3">
              {dialogState.type === 'confirm' && (
                <button
                  onClick={closeDialog}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (dialogState.type === 'confirm' && dialogState.onConfirm) {
                    dialogState.onConfirm();
                  } else if (dialogState.onCloseAction) {
                    dialogState.onCloseAction();
                  }
                  closeDialog();
                }}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg ${
                  dialogState.type === 'confirm' ? 'bg-slate-900 shadow-slate-900/20' :
                  dialogState.type === 'error' ? 'bg-red-600 shadow-red-500/30' :
                  'bg-gradient-to-r from-[#74ebd5] to-[#9face6] shadow-[#74ebd5]/30'
                }`}
              >
                {dialogState.type === 'confirm' ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#74ebd5]/40 to-teal-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#9face6]/40 to-indigo-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-purple-100/30 to-pink-50/30 blur-3xl opacity-70 mix-blend-multiply" />
      </div>

      <div className="md:hidden relative z-20 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white p-4 shrink-0 shadow-sm">
        <img src="/mintage-logo.png" alt="Mintage" className="h-14 w-auto" />
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900 focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-50/80 backdrop-blur-2xl border-r border-white/80 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.03)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-24 flex items-center justify-between px-6 border-b border-slate-100/50 bg-white/40">
          <img src="/mintage-logo.png" alt="Mintage" className="h-16 w-auto drop-shadow-sm" />
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-6 flex items-center gap-2 text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-500 uppercase tracking-[0.2em]">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          Super Admin
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'dashboard' 
                ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            System Overview
          </button>

          <button 
            onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'clients' 
                ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'
            }`}
          >
            <Building2 className="w-5 h-5" />
            Clients
          </button>

          <button 
            onClick={() => { setActiveTab('lead_sources'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'lead_sources' 
                ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'
            }`}
          >
            <Database className="w-5 h-5" />
            Global Sources
          </button>

          <button 
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'settings' 
                ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'
            }`}
          >
            <Settings className="w-5 h-5" />
            System Settings
          </button>
        </nav>

        <div className="p-5 border-t border-slate-100/50 bg-white/20">
          <button 
            onClick={() => showDialog('confirm', 'Sign Out', 'Are you sure you want to sign out?', () => logout())}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-600 font-medium hover:bg-red-50/80 hover:text-red-600 hover:shadow-sm transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="h-24 bg-white/60 backdrop-blur-xl border-b border-white flex items-center justify-between px-4 md:px-8 shrink-0 hidden md:flex shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            {activeTab === 'dashboard' ? 'System Telemetry' : activeTab === 'clients' ? 'Client Workspaces' : activeTab === 'lead_sources' ? 'Global Configurations' : 'System Settings'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
              <Server className="w-4 h-4 animate-pulse" />
              SYSTEM HEALTHY
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-auto overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full flex flex-col min-w-[800px] md:min-w-0">
            
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-10 h-10 border-4 border-[#74ebd5]/30 border-t-[#74ebd5] rounded-full animate-spin" />
              </div>
            ) : activeTab === 'dashboard' ? (
              /* 👇 SYSTEM OVERVIEW TAB 👇 */
              <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">
                    System Telemetry
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">Real-time usage metrics across all hosted workspaces.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Workspaces</h3>
                      <div className="p-2.5 bg-[#9face6]/15 rounded-xl text-[#7b8ed3] shadow-inner">
                        <Building2 className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{clients.length}</p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Accounts</h3>
                      <div className="p-2.5 bg-[#74ebd5]/15 rounded-xl text-[#50bdaf] shadow-inner">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{clients.filter(c => c.status === 'ACTIVE').length}</p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Agents Hosted</h3>
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-500 shadow-inner">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{totalAgents}</p>
                  </div>
                </div>

                {/* ✨ LEVEL 5 UI: Platform Throughput Telemetry Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                  {/* Total Leads Processed */}
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Leads Processed</h3>
                      <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500 shadow-inner">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl font-black text-slate-800">{telemetry.totalLeads.toLocaleString()}</p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">All Workspaces</div>
                  </div>

                  {/* Total WhatsApp Messages */}
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Messages Sent</h3>
                      <div className="p-2.5 bg-[#25D366]/10 rounded-xl text-[#25D366] shadow-inner">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl font-black text-slate-800">{telemetry.totalMessages.toLocaleString()}</p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Throughput</div>
                  </div>

                  {/* Connected FB Pages */}
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Ad Links</h3>
                      <div className="p-2.5 bg-[#1877F2]/10 rounded-xl text-[#1877F2] shadow-inner">
                        <Facebook className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl font-black text-slate-800">{telemetry.totalFbPages.toLocaleString()}</p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pages Synced</div>
                  </div>

                  {/* Tasks Generated */}
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent Tasks</h3>
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-500 shadow-inner">
                        <CheckSquare className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl font-black text-slate-800">{telemetry.totalTasks.toLocaleString()}</p>
                    </div>
                    <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Automation</div>
                  </div>
                </div>
              </div>

            ) : activeTab === 'clients' ? (
              /* 👇 CLIENTS MANAGEMENT TAB 👇 */
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Workspaces</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage client accounts, limits, and statuses.</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-4 py-2 h-11 flex-1 min-w-[250px] shadow-sm focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search workspace..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent w-full outline-none placeholder:font-normal"
                      />
                    </div>
                    <button
                      onClick={() => setIsAddClientModalOpen(true)}
                      className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl shadow-lg shadow-[#74ebd5]/30 text-sm font-bold text-white bg-gradient-to-r from-[#74ebd5] to-[#9face6] hover:opacity-90 focus:outline-none transition-all hover:-translate-y-0.5 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      New Workspace
                    </button>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden shrink-0">
                  <div className="overflow-x-auto max-h-[calc(100vh-280px)] custom-scrollbar">
                    <table className="w-full text-left border-collapse relative">
                      <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-xl shadow-sm">
                        <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200/60">
                          <th className="px-8 py-5">Company Name / ID</th>
                          <th className="px-6 py-5">Plan</th>
                          <th className="px-6 py-5">Status</th>
                          <th className="px-6 py-5">Agent Limit</th>
                          <th className="px-6 py-5">Created</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60 bg-transparent">
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="hover:bg-white/60 transition-colors group">
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="font-extrabold text-slate-800 text-sm">{client.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{client.id}</div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm uppercase tracking-widest">
                                {client.subscriptionPlan || 'BASIC'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <button
                                onClick={() => toggleClientStatus(client.id, client.status)}
                                className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold shadow-sm uppercase tracking-widest transition-colors ${
                                  client.status === 'ACTIVE' 
                                    ? 'bg-[#74ebd5]/20 text-[#4cb8a5] hover:bg-red-50 hover:text-red-600' 
                                    : 'bg-slate-200 text-slate-600 hover:bg-[#74ebd5]/20 hover:text-[#4cb8a5]'
                                }`}
                                title={client.status === 'ACTIVE' ? "Click to Suspend" : "Click to Activate"}
                              >
                                {client.status}
                              </button>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              {editingClientId === client.id ? (
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit">
                                  <input
                                    type="number"
                                    min="1"
                                    value={editMaxAgents}
                                    onChange={(e) => setEditMaxAgents(Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-sm font-bold border-none focus:ring-0 outline-none text-center"
                                    autoFocus
                                  />
                                  <button onClick={() => saveAgentLimit(client.id)} className="p-1.5 bg-[#74ebd5] text-white rounded-lg hover:bg-[#50bdaf] transition-colors"><CheckCircle2 className="w-3.5 h-3.5"/></button>
                                  <button onClick={() => setEditingClientId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-3.5 h-3.5"/></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-slate-700 text-sm">{client.maxAgents || 2}</span>
                                  <button 
                                    onClick={() => {
                                      setEditMaxAgents(client.maxAgents || 2);
                                      setEditingClientId(client.id);
                                    }}
                                    className="text-slate-400 hover:text-[#50bdaf] opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {client.createdAt ? new Date(client.createdAt.toDate()).toLocaleDateString() : 'Unknown'}
                              </div>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap text-right">
                              <button
                                onClick={() => deleteClient(client.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                title="Delete Workspace permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredClients.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-16 text-center text-slate-400 font-medium">No workspaces match your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'lead_sources' ? (
              /* 👇 GLOBAL SOURCES TAB 👇 */
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Global Sources</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage default lead sources available across all workspaces.</p>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden max-w-3xl">
                  <div className="p-6 border-b border-white/80 bg-white/40">
                    <form onSubmit={handleAddGlobalSource} className="flex gap-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="E.g., Facebook Ads, Walk-in, Website..."
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                          className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-3 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addingSource || !newSourceName.trim()}
                        className="flex items-center gap-2 py-3 px-6 rounded-xl shadow-lg shadow-[#74ebd5]/30 text-sm font-bold text-white bg-gradient-to-r from-[#74ebd5] to-[#9face6] hover:opacity-90 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                      >
                        {addingSource ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add Source
                      </button>
                    </form>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200/60 text-xs uppercase tracking-widest text-slate-500 font-bold">
                          <th className="px-8 py-5">Source Name</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {globalSources.map((source) => (
                          <tr key={source.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-8 py-5 whitespace-nowrap">
                              <div className="font-bold text-slate-800 flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Globe className="w-4 h-4" /></div>
                                {source.name}
                              </div>
                            </td>
                            <td className="px-8 py-5 whitespace-nowrap text-right">
                              <button
                                onClick={() => handleDeleteGlobalSource(source.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {globalSources.length === 0 && (
                          <tr>
                            <td colSpan={2} className="p-12 text-center text-slate-400 font-medium">No global sources defined.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            ) : (
              /* 👇 SYSTEM SETTINGS TAB 👇 */
              <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
                <div>
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">System Settings</h2>
                  <p className="text-slate-500 text-sm font-medium">Manage master API keys and core platform configurations.</p>
                </div>

                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden p-8">
                  <div className="flex items-center gap-4 mb-8 border-b border-slate-100/60 pb-6">
                    <div className="p-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl text-white shadow-lg shadow-slate-900/20">
                      <Key className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Core Integrations</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1">These keys power the enrichment and connection engines across all workspaces.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-5">
                      <div>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                          <Database className="w-3.5 h-3.5" />
                          Apollo.io Master API Key
                        </label>
                        <input
                          type="password"
                          value={systemSettings.apolloApiKey}
                          onChange={(e) => setSystemSettings({...systemSettings, apolloApiKey: e.target.value})}
                          placeholder="vWaMRrj2mpju..."
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all shadow-sm"
                        />
                        <p className="text-xs text-slate-400 mt-2 font-medium">Powers the B2B Data Enrichment engine (LinkedIn, Designation, Location).</p>
                      </div>
                      
                      <div className="h-px w-full bg-slate-200/60 my-2"></div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                            <Facebook className="w-3.5 h-3.5 text-blue-500" />
                            Meta App ID
                          </label>
                          <input
                            type="text"
                            value={systemSettings.metaAppId}
                            onChange={(e) => setSystemSettings({...systemSettings, metaAppId: e.target.value})}
                            placeholder="1439047481212574"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                            <Key className="w-3.5 h-3.5 text-blue-500" />
                            Meta App Secret
                          </label>
                          <input
                            type="password"
                            value={systemSettings.metaAppSecret}
                            onChange={(e) => setSystemSettings({...systemSettings, metaAppSecret: e.target.value})}
                            placeholder="c8ea2e5543..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 font-medium">Required for authenticating client Facebook Pages and Webhooks.</p>
                      
                      <div className="h-px w-full bg-slate-200/60 my-2"></div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                          Global Support Email
                        </label>
                        <input
                          type="email"
                          value={systemSettings.supportEmail}
                          onChange={(e) => setSystemSettings({...systemSettings, supportEmail: e.target.value})}
                          placeholder="support@mintagemarkcomm.com"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all shadow-sm"
                        />
                      </div>

                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={handleSaveSystemSettings}
                        disabled={savingSettings}
                        className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
                      >
                        {savingSettings ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Configurations
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Client Modal */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200/60">
              <h3 className="text-xl font-extrabold text-slate-800">Provision Workspace</h3>
              <button 
                onClick={() => {
                  setIsAddClientModalOpen(false);
                  setCompanyName(''); setAdminEmail(''); setAdminPassword('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-8 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company / Workspace Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all text-sm font-medium"
                  placeholder="e.g. Mintage CRM"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Password</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all text-sm font-medium"
                  minLength={6}
                />
                <p className="mt-2 text-[10px] font-bold text-slate-400">Must be at least 6 characters.</p>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingClient}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-[#74ebd5]/30 disabled:opacity-50 flex justify-center items-center"
                >
                  {addingClient ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create Client'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal CSS for custom scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
}