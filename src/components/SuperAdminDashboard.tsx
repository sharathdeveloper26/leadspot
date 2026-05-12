import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, LayoutDashboard, Globe, Shield, Search, 
  Plus, LogOut, Settings, Trash2, CheckCircle2, Users, XCircle
} from 'lucide-react';

interface Agency {
  id: string;
  agencyName: string;
  adminEmail: string;
  package: string;
  maxClients: number;
  customDomain: string;
  logoUrl: string;
  status: string;
  createdAt: any;
}

interface DirectClient {
  id: string;
  companyName: string;
  adminEmail: string;
  plan: string;
  status: string;
  joinedOn: any;
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  
  // ✨ NEW: Added 'direct_clients' tab ✨
  const [activeTab, setActiveTab] = useState<'agencies' | 'direct_clients' | 'settings'>('agencies');
  
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [directClients, setDirectClients] = useState<DirectClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Forms State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPlan, setFormPlan] = useState('Growth Plan');
  const [formMaxClients, setFormMaxClients] = useState(10);
  const [customDomain, setCustomDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const handlePlanChange = (selectedPlan: string) => {
    setFormPlan(selectedPlan);
    if (selectedPlan === 'Starter Plan') setFormMaxClients(3);
    else if (selectedPlan === 'Growth Plan') setFormMaxClients(10);
    else setFormMaxClients(999);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Agencies
        const agencyQ = query(collection(db, 'agencies'), orderBy('createdAt', 'desc'));
        const agencySnap = await getDocs(agencyQ);
        const agenciesData: Agency[] = [];
        agencySnap.forEach(doc => agenciesData.push({ id: doc.id, ...doc.data() } as Agency));
        setAgencies(agenciesData);

        // Fetch Direct Clients (Tagged to 'leadspot_direct')
        const clientQ = query(collection(db, 'clients'), where('agencyId', '==', 'leadspot_direct'));
        const clientSnap = await getDocs(clientQ);
        const clientsData: DirectClient[] = [];
        clientSnap.forEach(doc => clientsData.push({ id: doc.id, ...doc.data() } as DirectClient));
        // Sort manually since we used a 'where' clause
        clientsData.sort((a, b) => (b.joinedOn?.toMillis?.() || 0) - (a.joinedOn?.toMillis?.() || 0));
        setDirectClients(clientsData);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ✨ CREATE RESELLER AGENCY ✨
  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const createAgencyFn = httpsCallable(functions, 'createAgencyAccount');
      const result = await createAgencyFn({
        agencyName: formName, email: formEmail, password: formPassword, plan: formPlan, maxClients: formMaxClients, domain: customDomain, logoUrl: logoUrl
      });
      setAgencies([{ id: (result.data as any).agencyId, agencyName: formName, adminEmail: formEmail, package: formPlan, maxClients: formMaxClients, customDomain, logoUrl, status: 'ACTIVE', createdAt: { toDate: () => new Date() } }, ...agencies]);
      setIsAgencyModalOpen(false);
      resetForms();
    } catch (error: any) { alert(error.message || "Failed to create agency."); } 
    finally { setIsCreating(false); }
  };

  // ✨ CREATE DIRECT CLIENT ✨
  const handleCreateDirectClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const createClientFn = httpsCallable(functions, 'createSubClientWorkspace');
      const result = await createClientFn({
        agencyId: 'leadspot_direct', // Master tag for direct clients!
        companyName: formName, adminEmail: formEmail, password: formPassword, plan: formPlan
      });
      setDirectClients([{ id: (result.data as any).clientId, companyName: formName, adminEmail: formEmail, plan: formPlan, status: 'active', joinedOn: { toDate: () => new Date() } }, ...directClients]);
      setIsClientModalOpen(false);
      resetForms();
    } catch (error: any) { alert(error.message || "Failed to create direct client."); } 
    finally { setIsCreating(false); }
  };

  const resetForms = () => { setFormName(''); setFormEmail(''); setFormPassword(''); setCustomDomain(''); setLogoUrl(''); };

  const filteredAgencies = agencies.filter(a => a.agencyName.toLowerCase().includes(searchQuery.toLowerCase()) || a.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredClients = directClients.filter(c => c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || c.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));
// ✨ DEEP DELETE AGENCY ✨
  const handleDeleteAgency = async (id: string) => {
    if (window.confirm("CRITICAL WARNING: Are you sure you want to permanently delete this Agency and their login?")) {
      try {
        const deleteAgencyFn = httpsCallable(functions, 'deleteAgencyAccount');
        await deleteAgencyFn({ agencyId: id });
        setAgencies(prev => prev.filter(a => a.id !== id));
        alert("Agency completely deleted.");
      } catch (error: any) {
        alert(error.message || "Failed to delete agency.");
      }
    }
  };

  // ✨ DEEP DELETE DIRECT CLIENT ✨
  const handleDeleteDirectClient = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this direct workspace?")) {
      try {
        const deleteClientFn = httpsCallable(functions, 'deleteSubClientWorkspace');
        await deleteClientFn({ clientId: id });
        setDirectClients(prev => prev.filter(c => c.id !== id));
        alert("Direct Client completely deleted.");
      } catch (error: any) {
        alert(error.message || "Failed to delete direct client.");
      }
    }
  };
  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      
      {/* ✨ LEFT SIDEBAR ✨ */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0 text-slate-300">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-slate-900 font-black shadow-lg shadow-amber-500/20">L</div>
            <span className="font-extrabold text-white tracking-widest uppercase text-sm">Leadspot</span>
          </div>
        </div>
        
        <div className="p-4">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
            <Shield className="w-3 h-3 text-amber-500" /> Super Admin
          </p>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('agencies')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'agencies' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'hover:bg-slate-800 hover:text-white border border-transparent'}`}>
              <Building2 className="w-5 h-5" /> Partner Agencies
            </button>
            <button onClick={() => setActiveTab('direct_clients')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'direct_clients' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'hover:bg-slate-800 hover:text-white border border-transparent'}`}>
              <Users className="w-5 h-5" /> Direct Clients
            </button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'hover:bg-slate-800 hover:text-white border border-transparent'}`}>
              <LayoutDashboard className="w-5 h-5" /> Global Settings
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-800">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ✨ MAIN CONTENT ✨ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-2xl font-extrabold text-slate-800">
            {activeTab === 'agencies' ? 'Partner Agencies' : activeTab === 'direct_clients' ? 'Direct Clients' : 'Global Settings'}
          </h1>
          <div className="px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-sm font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> System Healthy
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {activeTab === 'agencies' ? 'Reseller Partners' : 'Direct Workspaces'}
                </h2>
                <p className="text-slate-500 text-sm font-medium mt-1">
                  {activeTab === 'agencies' ? 'Manage agency accounts, limits, and white-labeling.' : 'Manage direct clients billed directly by Leadspot without white-labeling.'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all shadow-sm" />
                </div>
                {activeTab === 'agencies' ? (
                  <button onClick={() => { resetForms(); setIsAgencyModalOpen(true); }} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 shadow-md shadow-slate-900/20 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> New Agency
                  </button>
                ) : (
                  <button onClick={() => { resetForms(); setIsClientModalOpen(true); }} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> New Direct Client
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                {activeTab === 'agencies' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        <th className="px-6 py-4">Agency Details</th>
                        <th className="px-6 py-4 text-center">Plan</th>
                        <th className="px-6 py-4 text-center">Quota</th>
                        <th className="px-6 py-4">White-Label</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAgencies.map((agency) => (
                        <tr key={agency.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4"><div className="flex items-center gap-3">{agency.logoUrl ? <img src={agency.logoUrl} alt="logo" className="w-8 h-8 rounded-md border border-slate-200 object-contain bg-white p-1" /> : <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400">{agency.agencyName.charAt(0)}</div>}<div><p className="text-sm font-bold text-slate-800">{agency.agencyName}</p><p className="text-xs font-medium text-slate-500">{agency.adminEmail}</p></div></div></td>
                          <td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{agency.package}</span></td>
                          <td className="px-6 py-4 text-center text-sm font-black text-slate-700">{agency.maxClients} Clients</td>
                          <td className="px-6 py-4">{agency.customDomain ? <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 w-fit"><Globe className="w-3 h-3" /> {agency.customDomain}</div> : <span className="text-xs text-slate-400 font-medium italic">Standard</span>}</td>
                          <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><Settings className="w-4 h-4" /></button><button onClick={() => handleDeleteAgency(agency.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Agency">
  <Trash2 className="w-4 h-4" />
</button></div></td>
                        </tr>
                      ))}
                      {filteredAgencies.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">No partner agencies found.</td></tr>}
                    </tbody>
                  </table>
                )}

                {activeTab === 'direct_clients' && (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        <th className="px-6 py-4">Client Name</th>
                        <th className="px-6 py-4">Admin Email</th>
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
                          <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-2"><button className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><Settings className="w-4 h-4" /></button><button onClick={() => handleDeleteDirectClient(client.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Client">
  <Trash2 className="w-4 h-4" />
</button></div></td>
                        </tr>
                      ))}
                      {filteredClients.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">No direct clients found.</td></tr>}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ✨ MODAL: CREATE AGENCY ✨ */}
      {isAgencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-500" /> Onboard New Agency</h3>
              <button onClick={() => setIsAgencyModalOpen(false)} className="p-2 text-slate-400 hover:bg-white rounded-full transition-all"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleCreateAgency} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Agency Profile</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company Name</label><input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Mintage Media" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label><input type="email" required value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="admin@agency.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium" /></div>
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Initial Password</label><input type="password" required value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium" minLength={6} /></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Subscription Tier</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Select Package</label><select value={formPlan} onChange={(e) => handlePlanChange(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-bold"><option value="Starter Plan">Starter Plan (3 Clients)</option><option value="Growth Plan">Growth Plan (10 Clients)</option><option value="Scale / Enterprise">Enterprise (Unlimited)</option></select></div>
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Client Quota Limit</label><input type="number" required value={formMaxClients} onChange={(e) => setFormMaxClients(Number(e.target.value))} className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-black" /></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-indigo-500"/> White-Label Configuration</h4>
                <div className="space-y-4">
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Custom Domain (Optional)</label><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-2.5 rounded-xl">https://</span><input type="text" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="crm.theiragency.com" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium" /></div></div>
                  <div><label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Logo URL (Optional)</label><div className="flex items-center gap-3"><input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium" />{logoUrl && <img src={logoUrl} alt="Preview" className="w-10 h-10 object-contain border border-slate-200 rounded-lg p-1 bg-white shrink-0" />}</div></div>
                </div>
              </div>
            </form>
            <div className="px-6 py-4 flex gap-3 border-t border-slate-100 bg-slate-50 shrink-0">
              <button type="button" onClick={() => setIsAgencyModalOpen(false)} className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">Cancel</button>
              <button type="submit" onClick={handleCreateAgency} disabled={isCreating} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">{isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4"/> Create Agency</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ MODAL: CREATE DIRECT CLIENT ✨ */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> New Direct Client</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleCreateDirectClient} className="p-6 space-y-5">
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-2">
                <p className="text-xs text-indigo-800 font-medium leading-relaxed">This workspace will be assigned to Leadspot directly, bypassing all reseller agency logic and custom branding.</p>
              </div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company Name</label><input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label><input type="email" required value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Temporary Password</label><input type="password" required value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium" minLength={6} /></div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Plan</label>
                <select value={formPlan} onChange={(e) => setFormPlan(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-bold cursor-pointer text-slate-700">
                  <option value="Starter Plan">Starter Plan</option><option value="Growth Plan">Growth Plan</option><option value="Scale / Enterprise">Enterprise</option>
                </select>
              </div>
            </form>
            <div className="px-6 py-4 flex gap-3 border-t border-slate-100 bg-slate-50">
              <button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all">Cancel</button>
              <button type="submit" onClick={handleCreateDirectClient} disabled={isCreating} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">{isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4"/> Create Client</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}