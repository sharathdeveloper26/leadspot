import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, doc, updateDoc, where, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Mail, Lock, UserPlus, AlertCircle, CheckCircle2, LayoutDashboard, Users, Settings, LogOut, Plus, Calendar, ArrowLeft, Edit2, X, List, Trash2 } from 'lucide-react';
import { functions, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface Client {
  id: string;
  name: string;
  subscriptionPlan: string;
  status: string;
  maxAgents?: number;
  createdAt: any;
}

export default function SuperAdminDashboard() {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'clients' | 'add_client' | 'lead_sources'>('clients');
  
  // Clients List State
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit Limit State
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<number>(2);
  const [updatingLimit, setUpdatingLimit] = useState(false);

  // Lead Sources State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [leadSources, setLeadSources] = useState<{id: string, name: string, clientId: string}[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editSourceName, setEditSourceName] = useState('');

  // Lead Sub-Sources State
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string, clientId: string}[]>([]);
  const [loadingSubSources, setLoadingSubSources] = useState(false);
  const [newSubSourceName, setNewSubSourceName] = useState('');
  const [addingSubSource, setAddingSubSource] = useState(false);
  const [editingSubSourceId, setEditingSubSourceId] = useState<string | null>(null);
  const [editSubSourceName, setEditSubSourceName] = useState('');

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const q = query(collection(db, 'clients'));
      const snapshot = await getDocs(q);
      const fetched: Client[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Client);
      });
      // Sort descending by createdAt
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setClients(fetched);
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clients' || activeTab === 'lead_sources') {
      fetchClients();
    }
  }, [activeTab]);

  const fetchLeadSources = async (clientId: string) => {
    if (!clientId) {
      setLeadSources([]);
      setLeadSubSources([]);
      return;
    }
    setLoadingSources(true);
    setLoadingSubSources(true);
    try {
      const q = query(collection(db, 'lead_sources'), where('clientId', '==', clientId));
      const snapshot = await getDocs(q);
      const fetched: any[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      // Sort by name
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSources(fetched);

      const qSub = query(collection(db, 'lead_sub_sources'), where('clientId', '==', clientId));
      const snapshotSub = await getDocs(qSub);
      const fetchedSub: any[] = [];
      snapshotSub.forEach(doc => {
        fetchedSub.push({ id: doc.id, ...doc.data() });
      });
      fetchedSub.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSubSources(fetchedSub);
    } catch (err) {
      console.error("Error fetching lead sources:", err);
    } finally {
      setLoadingSources(false);
      setLoadingSubSources(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'lead_sources' && selectedClientId) {
      fetchLeadSources(selectedClientId);
    } else {
      setLeadSources([]);
    }
  }, [activeTab, selectedClientId]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newSourceName.trim()) return;
    
    setAddingSource(true);
    try {
      const docRef = await addDoc(collection(db, 'lead_sources'), {
        name: newSourceName.trim(),
        clientId: selectedClientId,
        createdAt: serverTimestamp()
      });
      
      setLeadSources([...leadSources, { id: docRef.id, name: newSourceName.trim(), clientId: selectedClientId }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSourceName('');
    } catch (error) {
      console.error("Error adding lead source:", error);
      alert("Failed to add lead source.");
    } finally {
      setAddingSource(false);
    }
  };

  const handleUpdateSource = async (sourceId: string) => {
    if (!editSourceName.trim()) return;
    try {
      const sourceRef = doc(db, 'lead_sources', sourceId);
      await updateDoc(sourceRef, { name: editSourceName.trim() });
      setLeadSources(leadSources.map(s => s.id === sourceId ? { ...s, name: editSourceName.trim() } : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingSourceId(null);
    } catch (error) {
      console.error("Error updating lead source:", error);
      alert("Failed to update lead source.");
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (window.confirm("Are you sure you want to delete this lead source?")) {
      try {
        await deleteDoc(doc(db, 'lead_sources', sourceId));
        setLeadSources(leadSources.filter(s => s.id !== sourceId));
      } catch (error) {
        console.error("Error deleting lead source:", error);
        alert("Failed to delete lead source.");
      }
    }
  };

  const handleAddSubSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !newSubSourceName.trim()) return;
    
    setAddingSubSource(true);
    try {
      const docRef = await addDoc(collection(db, 'lead_sub_sources'), {
        name: newSubSourceName.trim(),
        clientId: selectedClientId,
        createdAt: serverTimestamp()
      });
      
      setLeadSubSources([...leadSubSources, { id: docRef.id, name: newSubSourceName.trim(), clientId: selectedClientId }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSubSourceName('');
    } catch (error) {
      console.error("Error adding lead sub-source:", error);
      alert("Failed to add lead sub-source.");
    } finally {
      setAddingSubSource(false);
    }
  };

  const handleUpdateSubSource = async (sourceId: string) => {
    if (!editSubSourceName.trim()) return;
    try {
      const sourceRef = doc(db, 'lead_sub_sources', sourceId);
      await updateDoc(sourceRef, { name: editSubSourceName.trim() });
      setLeadSubSources(leadSubSources.map(s => s.id === sourceId ? { ...s, name: editSubSourceName.trim() } : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingSubSourceId(null);
    } catch (error) {
      console.error("Error updating lead sub-source:", error);
      alert("Failed to update lead sub-source.");
    }
  };

  const handleDeleteSubSource = async (sourceId: string) => {
    if (window.confirm("Are you sure you want to delete this lead sub-source?")) {
      try {
        await deleteDoc(doc(db, 'lead_sub_sources', sourceId));
        setLeadSubSources(leadSubSources.filter(s => s.id !== sourceId));
      } catch (error) {
        console.error("Error deleting lead sub-source:", error);
        alert("Failed to delete lead sub-source.");
      }
    }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const registerNewClient = httpsCallable(functions, 'registerNewClient');
      const result = await registerNewClient({ email, password, companyName });
      
      const data = result.data as any;
      setSuccess('Client registered successfully! They can now log in using their temporary password.');
      
      // Clear form on success
      setEmail('');
      setPassword('');
      setCompanyName('');
      
      // Refresh clients list in background
      fetchClients();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async (clientId: string) => {
    setUpdatingLimit(true);
    try {
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, { maxAgents: editLimitValue });
      setClients(clients.map(c => c.id === clientId ? { ...c, maxAgents: editLimitValue } : c));
      setEditingClient(null);
    } catch (err) {
      console.error("Error updating limit:", err);
      alert("Failed to update limit.");
    } finally {
      setUpdatingLimit(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex font-sans text-stone-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-stone-100">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-lg tracking-tight">
            <Building2 className="w-6 h-6" />
            <span>Mintage CRM</span>
          </div>
        </div>
        
        <div className="px-4 py-6 text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Super Admin
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <button 
            onClick={() => setActiveTab('clients')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              activeTab === 'clients' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            <Users className="w-5 h-5" />
            Clients
          </button>
          <button 
            onClick={() => setActiveTab('lead_sources')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              activeTab === 'lead_sources' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            <List className="w-5 h-5" />
            Lead Sources
          </button>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors">
            <Settings className="w-5 h-5" />
            Settings
          </a>
        </nav>

        <div className="p-4 border-t border-stone-100">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-stone-200 flex items-center px-8">
          <h1 className="text-xl font-semibold tracking-tight">Client Management</h1>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            
            {activeTab === 'clients' ? (
              /* Clients List View */
              <>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">Clients</h2>
                    <p className="text-stone-500 text-sm">Manage your clients and their workspaces.</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('add_client');
                      setSuccess('');
                      setError('');
                    }}
                    className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Client
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  {loadingClients ? (
                    <div className="p-12 flex justify-center">
                      <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="p-12 text-center">
                      <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-stone-900 mb-1">No clients found</h3>
                      <p className="text-stone-500 text-sm">Get started by adding your first client.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-semibold">
                            <th className="px-6 py-4">Company Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Agent Limit</th>
                            <th className="px-6 py-4">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {clients.map((client) => (
                            <tr key={client.id} className="hover:bg-stone-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-stone-900">
                                  {client.name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  {client.status || 'ACTIVE'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {editingClient === client.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={editLimitValue}
                                      onChange={(e) => setEditLimitValue(parseInt(e.target.value) || 1)}
                                      className="w-20 px-2 py-1 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                    />
                                    <button
                                      onClick={() => handleUpdateLimit(client.id)}
                                      disabled={updatingLimit}
                                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingClient(null)}
                                      className="p-1 text-stone-400 hover:bg-stone-100 rounded transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-stone-600 font-medium">{client.maxAgents || 2}</span>
                                    <button
                                      onClick={() => {
                                        setEditingClient(client.id);
                                        setEditLimitValue(client.maxAgents || 2);
                                      }}
                                      className="p-1 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                      title="Edit Limit"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-500">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  {client.createdAt ? new Date(client.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'lead_sources' ? (
              /* Lead Sources View */
              <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold tracking-tight mb-1">Lead Sources Management</h2>
                  <p className="text-stone-500 text-sm">Manage custom lead sources for specific clients.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-8">
                  <label className="block text-sm font-medium text-stone-700 mb-2">Select Client</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full md:w-1/2 px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm bg-white"
                  >
                    <option value="">-- Select a Client --</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>

                {selectedClientId && (
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-stone-900">Client Lead Sources</h3>
                      <form onSubmit={handleAddSource} className="flex items-center gap-3">
                        <input
                          type="text"
                          required
                          value={newSourceName}
                          onChange={(e) => setNewSourceName(e.target.value)}
                          placeholder="New Source Name"
                          className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm"
                        />
                        <button
                          type="submit"
                          disabled={addingSource || !newSourceName.trim()}
                          className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors disabled:opacity-50"
                        >
                          {addingSource ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Add Source
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {loadingSources ? (
                      <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                      </div>
                    ) : leadSources.length === 0 ? (
                      <div className="p-12 text-center">
                        <List className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-stone-900 mb-1">No lead sources found</h3>
                        <p className="text-stone-500 text-sm">Add a custom lead source for this client to get started.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-semibold">
                              <th className="px-6 py-4">Source Name</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200">
                            {leadSources.map((source) => (
                              <tr key={source.id} className="hover:bg-stone-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {editingSourceId === source.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editSourceName}
                                        onChange={(e) => setEditSourceName(e.target.value)}
                                        className="px-2 py-1 border border-stone-200 rounded text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleUpdateSource(source.id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingSourceId(null)}
                                        className="p-1 text-stone-400 hover:bg-stone-100 rounded transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="font-medium text-stone-900">
                                      {source.name}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingSourceId(source.id);
                                        setEditSourceName(source.name);
                                      }}
                                      className="p-2 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Edit Source"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSource(source.id)}
                                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Source"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {selectedClientId && (
                  <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mt-8">
                    <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-stone-900">Client Lead Sub-Sources</h3>
                      <form onSubmit={handleAddSubSource} className="flex items-center gap-3">
                        <input
                          type="text"
                          required
                          value={newSubSourceName}
                          onChange={(e) => setNewSubSourceName(e.target.value)}
                          placeholder="New Sub-Source Name"
                          className="px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm"
                        />
                        <button
                          type="submit"
                          disabled={addingSubSource || !newSubSourceName.trim()}
                          className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors disabled:opacity-50"
                        >
                          {addingSubSource ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Add Sub-Source
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {loadingSubSources ? (
                      <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                      </div>
                    ) : leadSubSources.length === 0 ? (
                      <div className="p-12 text-center">
                        <List className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-stone-900 mb-1">No lead sub-sources found</h3>
                        <p className="text-stone-500 text-sm">Add a custom lead sub-source for this client to get started.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-semibold">
                              <th className="px-6 py-4">Sub-Source Name</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200">
                            {leadSubSources.map((source) => (
                              <tr key={source.id} className="hover:bg-stone-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {editingSubSourceId === source.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editSubSourceName}
                                        onChange={(e) => setEditSubSourceName(e.target.value)}
                                        className="px-2 py-1 border border-stone-200 rounded text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleUpdateSubSource(source.id)}
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setEditingSubSourceId(null)}
                                        className="p-1 text-stone-400 hover:bg-stone-100 rounded transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-medium text-stone-900">{source.name}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingSubSourceId(source.id);
                                        setEditSubSourceName(source.name);
                                      }}
                                      className="p-2 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                      title="Edit Sub-Source"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubSource(source.id)}
                                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Sub-Source"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Add Client View */
              <div className="max-w-2xl">
                <div className="mb-8 flex items-center gap-4">
                  <button 
                    onClick={() => setActiveTab('clients')}
                    className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">Onboard New Client</h2>
                    <p className="text-stone-500 text-sm">Create a new client workspace and assign a Client Admin.</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-6 sm:p-8">
                    <form onSubmit={handleRegisterClient} className="space-y-5">
                      
                      {/* Company Name */}
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">
                          Company Name
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building2 className="h-5 w-5 text-stone-400" />
                          </div>
                          <input
                            type="text"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm"
                            placeholder="Acme Corp"
                          />
                        </div>
                      </div>

                      {/* Admin Email */}
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">
                          Client Admin Email
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-stone-400" />
                          </div>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm"
                            placeholder="admin@acmecorp.com"
                          />
                        </div>
                      </div>

                      {/* Admin Password */}
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">
                          Temporary Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-stone-400" />
                          </div>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-colors sm:text-sm"
                            placeholder="••••••••"
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-stone-500">Must be at least 6 characters long.</p>
                      </div>

                      {/* Status Messages */}
                      {error && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 text-red-800 text-sm">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <p>{error}</p>
                        </div>
                      )}

                      {success && (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 text-emerald-800 text-sm">
                          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                          <p>{success}</p>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="w-5 h-5" />
                              Register Client
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

