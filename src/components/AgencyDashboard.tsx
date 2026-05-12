import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { 
  Users, LayoutDashboard, Settings, Palette, Plus, Search, 
  MoreVertical, Edit2, Trash2, ShieldCheck, Activity, Zap, 
  LogOut, ChevronDown, CheckCircle2, XCircle
} from 'lucide-react';

interface SubClient {
  id: string;
  companyName: string;
  adminEmail: string;
  plan: string;
  status: string;
  joinedOn: any;
  lastLogin?: any;
}

interface AgencyData {
  agencyName: string;
  package: string;
  maxClients: number;
}

export default function AgencyDashboard() {
  const { user, logout } = useAuth();
  const { logoUrl } = useBranding();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'billing' | 'whitelabel'>('customers');
  const [customerFilter, setCustomerFilter] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [agencyData, setAgencyData] = useState<AgencyData | null>(null);
  const [subClients, setSubClients] = useState<SubClient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

  // 1. Fetch Agency Quota and Sub-Clients
  useEffect(() => {
    const fetchAgencyDashboardData = async () => {
      if (!user?.uid) return;
      try {
        // Get the Agency's profile limits
        const agencyDoc = await getDoc(doc(db, 'agencies', user.uid));
        if (agencyDoc.exists()) {
          setAgencyData(agencyDoc.data() as AgencyData);
        } else {
          // Fallback for testing
          setAgencyData({ agencyName: 'My Agency', package: 'Growth Plan', maxClients: 10 });
        }

        // Get all clients "owned" by this agency
        const q = query(collection(db, 'clients'), where('agencyId', '==', user.uid));
        const snapshot = await getDocs(q);
        const clientsData: SubClient[] = [];
        snapshot.forEach(doc => {
          clientsData.push({ id: doc.id, ...doc.data() } as SubClient);
        });
        
        // Sort newest first
        clientsData.sort((a, b) => b.joinedOn?.toMillis?.() - a.joinedOn?.toMillis?.());
        setSubClients(clientsData);
      } catch (error) {
        console.error("Error fetching agency data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgencyDashboardData();
  }, [user?.uid]);

  // 2. Handle Creating a New Client Workspace
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyData || subClients.length >= agencyData.maxClients) {
      alert("You have reached your maximum client limit. Please upgrade your plan.");
      return;
    }

    setIsCreating(true);
    try {
      // We will create the Cloud Function for this in the next step!
      const createClientFn = httpsCallable(functions, 'createSubClientWorkspace');
      const result = await createClientFn({
        agencyId: user?.uid,
        companyName: newClientName,
        adminEmail: newClientEmail,
        password: newClientPassword,
        plan: agencyData.package
      });

      // Optimistically update UI
      setSubClients([{
        id: (result.data as any).clientId,
        companyName: newClientName,
        adminEmail: newClientEmail,
        plan: agencyData.package,
        status: 'active',
        joinedOn: { toDate: () => new Date() }
      }, ...subClients]);

      setIsModalOpen(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPassword('');
    } catch (error: any) {
      alert(error.message || "Failed to create client workspace.");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredClients = subClients.filter(c => {
    if (customerFilter === 'active' && c.status !== 'active') return false;
    if (customerFilter === 'suspended' && c.status !== 'suspended') return false;
    if (searchQuery && !c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) && !c.adminEmail.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      
      {/* ✨ LEFT SIDEBAR ✨ */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <img src={logoUrl || '/leadspot.png'} alt="Agency Logo" className="h-8 object-contain" />
        </div>
        
        <div className="p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Partner Portal</p>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </button>
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
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-2xl font-extrabold text-slate-800">
            {activeTab === 'customers' ? 'Manage Customers' : 'Agency Dashboard'}
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

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* ✨ QUOTA CARDS ✨ */}
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

            {/* ✨ CUSTOMERS TABLE ✨ */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
              
              {/* Table Controls */}
              <div className="p-6 border-b border-slate-100 space-y-4">
                <div className="flex gap-6 border-b border-slate-100">
                  <button onClick={() => setCustomerFilter('active')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${customerFilter === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Active Customers</button>
                  <button onClick={() => setCustomerFilter('inactive')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${customerFilter === 'inactive' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Inactive Customers</button>
                  <button onClick={() => setCustomerFilter('suspended')} className={`pb-3 text-sm font-bold transition-all border-b-2 ${customerFilter === 'suspended' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Suspended</button>
                </div>
                
                <div className="flex justify-between items-center gap-4 pt-2">
                  <div className="relative w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Search by name or email..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Customer
                  </button>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
                      <th className="px-6 py-4">Sr. No.</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4 text-center">Plan</th>
                      <th className="px-6 py-4">Joined On</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClients.map((client, index) => (
                      <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{index + 1}.</td>
                        <td className="px-6 py-4 text-sm font-bold text-indigo-600 hover:underline cursor-pointer">{client.companyName}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">{client.adminEmail}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">{client.plan}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-500">
                          {client.joinedOn?.toDate ? client.joinedOn.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            <button className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredClients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                          No customers found. Click "Add Customer" to create a new workspace.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ✨ ADD CUSTOMER MODAL ✨ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Add New Customer</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-6 space-y-5">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-2">
                <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                  This will generate a brand new, isolated CRM workspace and deduct <span className="font-bold">1 license</span> from your quota.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Company Name</label>
                <input type="text" required value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. DSR Builders" className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium shadow-sm" />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Admin Email</label>
                <input type="email" required value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="admin@dsr.com" className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium shadow-sm" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Temporary Password</label>
                <input type="password" required value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium shadow-sm" minLength={6} />
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">Cancel</button>
                <button type="submit" disabled={isCreating} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center">
                  {isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}