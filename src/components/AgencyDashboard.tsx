import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { 
  Users, LayoutDashboard, Settings, Palette, Plus, Search, 
  MoreVertical, Edit2, Trash2, ShieldCheck, Activity, Zap, 
  LogOut, CheckCircle2, XCircle, Globe, UploadCloud, Save, AlertTriangle
} from 'lucide-react';

interface SubClient {
  id: string;
  companyName: string;
  adminEmail: string;
  plan: string;
  status: string;
  joinedOn: any;
}

interface AgencyData {
  agencyName: string;
  package: string;
  maxClients: number;
  customDomain?: string;
  logoUrl?: string;
}

export default function AgencyDashboard() {
  const { user, logout } = useAuth();
  const { logoUrl: globalLogo } = useBranding();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'customers' | 'billing' | 'whitelabel'>('customers');
  const [customerFilter, setCustomerFilter] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data State
  const [agencyData, setAgencyData] = useState<AgencyData | null>(null);
  const [subClients, setSubClients] = useState<SubClient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null); // ✨ NEW: Custom Delete State
  
  // Loading States
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // ✨ NEW: Delete loading state
  
  // Forms
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');
  
  // Edit & Branding Forms
  const [editingClient, setEditingClient] = useState<SubClient | null>(null);
  const [brandDomain, setBrandDomain] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  useEffect(() => {
    const fetchAgencyDashboardData = async () => {
      if (!user?.uid) return;
      try {
        const agencyDoc = await getDoc(doc(db, 'agencies', user.uid));
        if (agencyDoc.exists()) {
          const data = agencyDoc.data() as AgencyData;
          setAgencyData(data);
          setBrandDomain(data.customDomain || '');
          setBrandLogo(data.logoUrl || '');
        }

        const q = query(collection(db, 'clients'), where('agencyId', '==', user.uid));
        const snapshot = await getDocs(q);
        const clientsData: SubClient[] = [];
        snapshot.forEach(doc => {
          clientsData.push({ id: doc.id, ...doc.data() } as SubClient);
        });
        
        clientsData.sort((a, b) => (b.joinedOn?.toMillis?.() || 0) - (a.joinedOn?.toMillis?.() || 0));
        setSubClients(clientsData);
      } catch (error) {
        console.error("Error fetching agency data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgencyDashboardData();
  }, [user?.uid]);

  // ✨ CREATE CLIENT ✨
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyData || subClients.length >= agencyData.maxClients) {
      alert("You have reached your maximum client limit. Please upgrade your plan."); // Could also be made into a custom modal!
      return;
    }
    setIsCreating(true);
    try {
      const createClientFn = httpsCallable(functions, 'createSubClientWorkspace');
      const result = await createClientFn({
        agencyId: user?.uid, companyName: newClientName, adminEmail: newClientEmail, password: newClientPassword, plan: agencyData.package
      });

      setSubClients([{ id: (result.data as any).clientId, companyName: newClientName, adminEmail: newClientEmail, plan: agencyData.package, status: 'active', joinedOn: { toDate: () => new Date() } }, ...subClients]);
      setIsCreateModalOpen(false);
      setNewClientName(''); setNewClientEmail(''); setNewClientPassword('');
    } catch (error: any) { alert(error.message || "Failed to create client workspace."); } 
    finally { setIsCreating(false); }
  };

  // ✨ EDIT CLIENT ✨
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsCreating(true);
    try {
      await updateDoc(doc(db, 'clients', editingClient.id), { companyName: editingClient.companyName });
      setSubClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c));
      setIsEditModalOpen(false);
      setEditingClient(null);
    } catch (error) { alert("Failed to update client."); } 
    finally { setIsCreating(false); }
  };

  // ✨ ENTERPRISE DEEP DELETE CLIENT ✨
  const executeDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      const deleteClientFn = httpsCallable(functions, 'deleteSubClientWorkspace');
      await deleteClientFn({ clientId: clientToDelete });
      
      // Instantly remove from UI
      setSubClients(prev => prev.filter(c => c.id !== clientToDelete));
      setClientToDelete(null);
    } catch (error: any) { 
      alert(error.message || "Failed to delete client workspace."); 
    } finally {
      setIsDeleting(false);
    }
  };

  // ✨ SAVE WHITE-LABEL BRANDING ✨
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setIsSavingBrand(true);
    try {
      await updateDoc(doc(db, 'agencies', user.uid), { customDomain: brandDomain, logoUrl: brandLogo });
      setAgencyData(prev => prev ? { ...prev, customDomain: brandDomain, logoUrl: brandLogo } : null);
      // We removed the native alert here for a smoother UX!
    } catch (error) { alert("Failed to save branding settings."); } 
    finally { setIsSavingBrand(false); }
  };

  const filteredClients = subClients.filter(c => {
    if (customerFilter === 'active' && c.status !== 'active') return false;
    if (customerFilter === 'suspended' && c.status === 'active') return false;
    if (searchQuery && !c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.adminEmail.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      
      {/* ✨ LEFT SIDEBAR ✨ */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <img src={agencyData?.logoUrl || globalLogo || '/leadspot.png'} alt="Agency Logo" className="h-8 object-contain" />
        </div>
        
        <div className="p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Partner Portal</p>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Users className="w-5 h-5" /> Manage Customers
            </button>
            <button onClick={() => setActiveTab('whitelabel')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'whitelabel' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <Palette className="w-5 h-5" /> Branding & Domain
            </button>
            <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <ShieldCheck className="w-5 h-5" /> Subscription Plan
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ✨ MAIN CONTENT ✨ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-2xl font-extrabold text-slate-800">
            {activeTab === 'customers' ? 'Manage Customers' : activeTab === 'whitelabel' ? 'White-Label Branding' : 'Subscription & Billing'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-sm font-bold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> System Operational
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              {agencyData?.agencyName.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* ✨ QUOTA CARDS ✨ */}
            {(activeTab === 'customers' || activeTab === 'billing') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><Users className="w-8 h-8" /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Licenses</p>
                    <p className="text-3xl font-black text-slate-800">{subClients.length}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><CheckCircle2 className="w-8 h-8" /></div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Remaining Licenses</p>
                    <p className="text-3xl font-black text-slate-800">{(agencyData?.maxClients || 0) - subClients.length}</p>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-lg border border-slate-700 flex items-center justify-between text-white">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Current Plan</p>
                    <p className="text-2xl font-black">{agencyData?.package || 'Starter Plan'}</p>
                  </div>
                  <Zap className="w-10 h-10 text-amber-400 opacity-80" />
                </div>
              </div>
            )}

            {/* ✨ TAB: CUSTOMERS TABLE ✨ */}
            {activeTab === 'customers' && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 space-y-4">
                  <div className="flex gap-6 border-b border-slate-100">
                    <button onClick={() => setCustomerFilter('active')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${customerFilter === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Active Customers</button>
                    <button onClick={() => setCustomerFilter('suspended')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${customerFilter === 'suspended' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Suspended</button>
                  </div>
                  
                  <div className="flex justify-between items-center gap-4 pt-2">
                    <div className="relative w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" />
                    </div>
                    <button onClick={() => setIsCreateModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Add Customer
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4 text-center">Plan</th>
                        <th className="px-6 py-4">Joined On</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-indigo-600">{client.companyName}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600">{client.adminEmail}</td>
                          <td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">{client.plan}</span></td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-500">{client.joinedOn?.toDate ? client.joinedOn.toDate().toLocaleDateString() : 'Today'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => { setEditingClient(client); setIsEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                              
                              {/* ✨ TRIGGER CUSTOM MODAL INSTEAD OF NATIVE CONFIRM ✨ */}
                              <button onClick={() => setClientToDelete(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredClients.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">No customers found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ✨ TAB: WHITE-LABEL BRANDING ✨ */}
            {activeTab === 'whitelabel' && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden max-w-3xl">
                <div className="p-8 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Your Custom Branding</h3>
                  <p className="text-slate-500 text-sm mt-1">Personalize the CRM experience for your clients. They will never see the Leadspot brand.</p>
                </div>
                <form onSubmit={handleSaveBranding} className="p-8 space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-500"/> Custom Domain</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl shadow-sm">https://</span>
                      <input type="text" value={brandDomain} onChange={(e) => setBrandDomain(e.target.value)} placeholder="crm.youragency.com" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium shadow-sm" />
                    </div>
                  </div>
                  <div className="pt-4">
                    <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-2"><UploadCloud className="w-4 h-4 text-indigo-500"/> Agency Logo URL</label>
                    <input type="url" value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} placeholder="https://yourwebsite.com/logo.png" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium shadow-sm" />
                    {brandLogo && (
                      <div className="mt-4 p-6 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800 relative overflow-hidden">
                         <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-10"></div>
                        <img src={brandLogo} alt="Agency Logo Preview" className="h-10 object-contain relative z-10" />
                      </div>
                    )}
                  </div>
                  <div className="pt-4 flex justify-end border-t border-slate-100">
                    <button type="submit" disabled={isSavingBrand} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center gap-2">
                      {isSavingBrand ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4"/> {brandDomain ? 'Saved!' : 'Save Branding'}</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ✨ TAB: BILLING ✨ */}
            {activeTab === 'billing' && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden max-w-3xl p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">You are on the {agencyData?.package || 'Standard'}</h3>
                <p className="text-slate-500 font-medium mb-8">Your account allows up to {agencyData?.maxClients || 0} active client workspaces.</p>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                    <span className="text-sm font-bold text-slate-600">Base Subscription</span>
                    <span className="text-sm font-black text-slate-900">Active</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-slate-600">Need more licenses?</span>
                    <button className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">Contact Support</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ✨ CUSTOM ENTERPRISE DELETE MODAL ✨ */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Delete Workspace
              </h3>
              <button onClick={() => setClientToDelete(null)} className="p-2 text-red-400 hover:bg-white hover:shadow-sm rounded-full transition-all"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-800 font-medium leading-relaxed">
                  <strong>CRITICAL WARNING:</strong> Are you sure you want to permanently delete this workspace and wipe all associated user logins?
                </p>
                <p className="text-xs text-red-600 mt-2 font-bold uppercase tracking-wide">This action cannot be undone.</p>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 border-t border-slate-100 bg-slate-50">
              <button type="button" onClick={() => setClientToDelete(null)} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all shadow-sm">
                Cancel
              </button>
              <button type="button" onClick={executeDeleteClient} disabled={isDeleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 shadow-md shadow-red-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isDeleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4"/> Yes, Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ CREATE MODAL ✨ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add New Customer</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleCreateClient} className="p-6 space-y-5">
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company Name</label><input type="text" required value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label><input type="email" required value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Temporary Password</label><input type="password" required value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium" minLength={6} /></div>
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex justify-center items-center">{isCreating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✨ EDIT MODAL ✨ */}
      {isEditModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Edit Customer</h3>
              <button onClick={() => { setIsEditModalOpen(false); setEditingClient(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company Name</label>
                <input type="text" required value={editingClient.companyName} onChange={(e) => setEditingClient({ ...editingClient, companyName: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm font-medium" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email (Read Only)</label>
                <input type="email" readOnly value={editingClient.adminEmail} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl outline-none text-sm font-medium cursor-not-allowed" />
              </div>
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingClient(null); }} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm flex justify-center items-center">{isCreating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}