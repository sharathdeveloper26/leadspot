import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard, Building2, Phone, Home, Globe, Facebook, Search } from 'lucide-react';
import LeadDetailsModal, { Lead } from './LeadDetailsModal';

const PIPELINE_STATUSES = [
  'New', 
  'Attempted Contact', 
  'Connected / Warm', 
  'Site Visit Scheduled', 
  'Site Visit Completed', 
  'Negotiation', 
  'Closed Won', 
  'Closed Lost', 
  'Junk / Invalid'
];

export default function AgentDashboard() {
  const { user, clientId, logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  // Leads View Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All');
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);

  const combinedSources = useMemo(() => {
    const sourcesSet = new Set<string>();
    leadSources.forEach(s => {
      if (s.name) sourcesSet.add(s.name);
    });
    leads.forEach(lead => {
      if (lead.source) sourcesSet.add(lead.source);
    });
    return Array.from(sourcesSet).sort((a, b) => a.localeCompare(b));
  }, [leadSources, leads]);

  useEffect(() => {
    if (user && clientId) {
      fetchLeads();
      fetchLeadSources();
    }
  }, [user, clientId]);

  const fetchLeadSources = async () => {
    if (!clientId) return;
    try {
      const q = query(collection(db, 'lead_sources'), where('clientId', '==', clientId));
      const snapshot = await getDocs(q);
      const fetched: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, name: doc.data().name });
      });
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSources(fetched);
    } catch (error) {
      console.error("Error fetching lead sources:", error);
    }
  };

  const fetchLeads = async () => {
    if (!clientId || !user) return;
    try {
      const q = query(
        collection(db, 'leads'), 
        where('clientId', '==', clientId),
        where('assignedToId', '==', user.uid)
      );
      const querySnapshot = await getDocs(q);
      const leadsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      
      // Sort by createdAt descending
      leadsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setLeads(leadsData);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      // Optimistic update
      setLeads(leads.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      // Revert on error
      fetchLeads();
    }
  };

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let badge = null;
    if (s.includes('facebook')) badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase tracking-wider"><Facebook className="w-3 h-3" /> Facebook</span>;
    else if (s.includes('google')) badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wider"><Search className="w-3 h-3" /> Google Ads</span>;
    else if (s.includes('website')) badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 uppercase tracking-wider"><Globe className="w-3 h-3" /> Website</span>;
    else badge = <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 uppercase tracking-wider">Manual</span>;

    if (subSource) {
      return (
        <div className="flex flex-col items-end gap-1">
          {badge}
          <span className="text-[10px] text-stone-500 font-medium">{subSource}</span>
        </div>
      );
    }
    return badge;
  };

  // Filtered Leads for Main View
  const filteredLeadsView = leads.filter(lead => {
    let matches = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      if (!fullName.includes(query) && 
          !lead.email?.toLowerCase().includes(query) && 
          !lead.phone?.toLowerCase().includes(query)) {
        matches = false;
      }
    }
    if (leadsViewSourceFilter !== 'All') {
      if (lead.source !== leadsViewSourceFilter) {
        matches = false;
      }
    }
    return matches;
  });

  const handleLeadUpdated = (updatedLead: Lead) => {
    setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
  };

  const openLeadDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex font-sans text-stone-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-stone-100">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-lg tracking-tight">
            <Building2 className="w-6 h-6" />
            <span>Agent Portal</span>
          </div>
        </div>
        
        <div className="px-4 py-6 text-xs font-semibold text-stone-400 uppercase tracking-wider">
          Menu
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors bg-emerald-50 text-emerald-700"
          >
            <LayoutDashboard className="w-5 h-5" />
            My Leads
          </button>
        </nav>

        <div className="p-4 border-t border-stone-100">
          <div className="mb-4 px-3 py-2 rounded-xl bg-stone-50 border border-stone-100">
            <p className="text-xs text-stone-500 font-medium">Logged in as</p>
            <p className="text-sm font-semibold text-stone-900 truncate">{user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">My Leads</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Search className="w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm border-none focus:ring-0 text-stone-600 bg-transparent w-40 outline-none"
              />
            </div>
            <select
              value={leadsViewSourceFilter}
              onChange={(e) => setLeadsViewSourceFilter(e.target.value)}
              className="text-sm border border-stone-200 rounded-xl px-3 py-2 text-stone-600 bg-stone-50 shadow-sm focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
            >
              <option value="All">All Sources</option>
              {combinedSources.map(sourceName => (
                <option key={sourceName} value={sourceName}>{sourceName}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-x-auto p-8">
          <div className="flex gap-6 h-full min-w-max">
            {PIPELINE_STATUSES.map(status => (
              <div key={status} className="w-80 flex flex-col bg-stone-100/50 rounded-2xl border border-stone-200/60 overflow-hidden shrink-0">
                <div className="p-4 border-b border-stone-200/60 bg-stone-100/80 flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-stone-800">{status}</h3>
                  <span className="bg-white text-stone-500 text-xs font-medium px-2 py-1 rounded-full shadow-sm border border-stone-200">
                    {filteredLeadsView.filter(l => l.status === status).length}
                  </span>
                </div>
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {filteredLeadsView.filter(l => l.status === status).map(lead => (
                    <div 
                      key={lead.id} 
                      onClick={() => openLeadDetails(lead)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-medium text-stone-900 leading-tight">
                          {lead.firstName} {lead.lastName}
                          {lead.isDuplicate && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 uppercase tracking-wider">
                              Duplicate
                            </span>
                          )}
                        </div>
                        {getSourceBadge(lead.source, lead.subSource)}
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{lead.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <Home className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{lead.projectProperty || 'No project'}</span>
                        </div>
                      </div>
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {lead.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-tighter">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <select
                          value={lead.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusChange(lead.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                        >
                          {PIPELINE_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <LeadDetailsModal 
        lead={selectedLead}
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false);
          setSelectedLead(null);
        }}
        onLeadUpdated={handleLeadUpdated}
        teamMembers={[]}
      />
    </div>
  );
}
