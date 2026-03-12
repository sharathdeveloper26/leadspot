import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, setDoc, onSnapshot, orderBy, limit, startAfter, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, LogOut, LayoutDashboard, Building2, UserCircle2, Mail, Calendar, Phone, Home, X, Link2, Copy, Check, Globe, Facebook, Search, Zap, List, KanbanSquare, UserPlus, UserCog, Edit2, Trash2, XCircle, ChevronDown, ChevronUp, Menu } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LeadDetailsModal, { Lead } from './LeadDetailsModal';
import AddLeadModal from './AddLeadModal';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: any;
}

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

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

export default function ClientDashboard() {
  const { user, clientId, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'leads' | 'integrations' | 'team' | 'reports'>('leads');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('pipeline');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const [addingAgent, setAddingAgent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState("");
  const [isSavingOutboundWebhook, setIsSavingOutboundWebhook] = useState(false);
  const [isTestingOutboundWebhook, setIsTestingOutboundWebhook] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [lastVisibleLead, setLastVisibleLead] = useState<any>(null);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);
  const [realTimeLeads, setRealTimeLeads] = useState<Lead[]>([]);
  const [olderLeads, setOlderLeads] = useState<Lead[]>([]);

  const [fbUserToken, setFbUserToken] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const leads = useMemo(() => {
    const combined = [...realTimeLeads, ...olderLeads];
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [realTimeLeads, olderLeads]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectProperty, setProjectProperty] = useState('');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('');
  const [subSource, setSubSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [inlineEditingAgentId, setInlineEditingAgentId] = useState<string | null>(null);
  const [inlineEditingName, setInlineEditingName] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All');
  const [leadsStartDate, setLeadsStartDate] = useState('');
  const [leadsEndDate, setLeadsEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);

  const [fbPages, setFbPages] = useState<any[]>([]);
  const [linkedPages, setLinkedPages] = useState<any[]>([]);
  const [isLoadingLinkedPages, setIsLoadingLinkedPages] = useState(true);
  const [isLoadingFb, setIsLoadingFb] = useState(false);

  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);

  const [assignmentRules, setAssignmentRules] = useState<{id: string, sourceName: string, agentId: string, agentName: string}[]>([]);
  const [newRuleSource, setNewRuleSource] = useState('');
  const [newRuleAgentId, setNewRuleAgentId] = useState('');
  const [addingRule, setAddingRule] = useState(false);

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

  const webhookUrl = `https://us-central1-mintage-crm.cloudfunctions.net/incomingLeadWebhook?clientId=${user?.clientId}`;

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert('Session expired due to inactivity');
        logout();
      }, 900000);
    };
    resetTimer();
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => {
      resetTimer();
    };
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [logout]);

  useEffect(() => {
    if (!user?.clientId) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'leads'),
      where('clientId', '==', user.clientId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: Lead[] = [];
      snapshot.forEach((doc) => {
        fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead);
      });
      
      setRealTimeLeads(fetchedLeads);
      
      if (!lastVisibleLead && snapshot.docs.length > 0) {
        setLastVisibleLead(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreLeads(snapshot.docs.length === 50);
      }
      
      setLoading(false);
    }, (error) => {
      console.error("Error in onSnapshot:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.clientId]);

  const loadMoreLeads = async () => {
    if (!user?.clientId || !lastVisibleLead || loadingMoreLeads || !hasMoreLeads) return;
    setLoadingMoreLeads(true);
    try {
      const q = query(
        collection(db, 'leads'),
        where('clientId', '==', user.clientId),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleLead),
        limit(50)
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedLeads: Lead[] = [];
      querySnapshot.forEach((doc) => {
        fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead);
      });
      
      if (fetchedLeads.length > 0) {
        setOlderLeads(prev => [...prev, ...fetchedLeads]);
        setLastVisibleLead(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMoreLeads(fetchedLeads.length === 50);
      } else {
        setHasMoreLeads(false);
      }
    } catch (error) {
      console.error("Error loading more leads:", error);
    } finally {
      setLoadingMoreLeads(false);
    }
  };

  const fetchTeamMembers = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'users'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const fetchedTeam: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        fetchedTeam.push({ id: doc.id, name: doc.data().name || doc.data().email });
      });
      fetchedTeam.sort((a, b) => a.name.localeCompare(b.name));
      setTeamMembers(fetchedTeam);
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const fetchAgents = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(
        collection(db, 'users'),
        where('clientId', '==', user.clientId),
        where('role', '==', 'client_agent')
      );
      const snapshot = await getDocs(q);
      const fetchedAgents: Agent[] = [];
      snapshot.forEach(doc => {
        fetchedAgents.push({ id: doc.id, ...doc.data() } as Agent);
      });
      setAgents(fetchedAgents);
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  };

  const fetchLinkedPages = async () => {
    if (!user?.clientId) return;
    setIsLoadingLinkedPages(true);
    try {
      const q = query(
        collection(db, 'facebook_integrations'),
        where('clientId', '==', user.clientId)
      );
      const snapshot = await getDocs(q);
      const pages: any[] = [];
      snapshot.forEach(doc => {
        pages.push({ id: doc.id, ...doc.data() });
      });
      setLinkedPages(pages);
    } catch (error) {
      console.error("Error fetching linked pages:", error);
    } finally {
      setIsLoadingLinkedPages(false);
    }
  };

  const fetchLeadSources = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'lead_sources'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const fetched: {id: string, name: string}[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, name: doc.data().name });
      });
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSources(fetched);
      if (fetched.length > 0) {
        setSource(fetched[0].name);
      }

      const qSub = query(collection(db, 'lead_sub_sources'), where('clientId', '==', user.clientId));
      const snapshotSub = await getDocs(qSub);
      const fetchedSub: {id: string, name: string}[] = [];
      snapshotSub.forEach(doc => {
        fetchedSub.push({ id: doc.id, name: doc.data().name });
      });
      fetchedSub.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSubSources(fetchedSub);
    } catch (error) {
      console.error("Error fetching lead sources:", error);
    }
  };

  const fetchAssignmentRules = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'lead_assignment_rules'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const fetched: {id: string, sourceName: string, agentId: string, agentName: string}[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as any);
      });
      setAssignmentRules(fetched);
    } catch (error) {
      console.error("Error fetching assignment rules:", error);
    }
  };

  const handleAddAssignmentRule = async () => {
    if (!user?.clientId || !newRuleSource || !newRuleAgentId) return;
    setAddingRule(true);
    try {
      const agent = teamMembers.find(m => m.id === newRuleAgentId);
      if (!agent) return;
      const docRef = await addDoc(collection(db, 'lead_assignment_rules'), {
        clientId: user.clientId,
        sourceName: newRuleSource,
        agentId: newRuleAgentId,
        agentName: agent.name,
        createdAt: serverTimestamp()
      });
      setAssignmentRules([...assignmentRules, {
        id: docRef.id,
        sourceName: newRuleSource,
        agentId: newRuleAgentId,
        agentName: agent.name
      }]);
      setNewRuleSource('');
      setNewRuleAgentId('');
    } catch (error) {
      console.error("Error adding assignment rule:", error);
      alert("Failed to add rule.");
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!ruleId) return;
    try {
      await deleteDoc(doc(db, 'lead_assignment_rules', ruleId));
      setAssignmentRules(prevRules => prevRules.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error("Error deleting assignment rule:", error);
      alert("Failed to delete rule. Check console for details.");
    }
  };

  const fetchOutboundWebhook = async () => {
    if (!user?.clientId) return;
    try {
      const docRef = doc(db, 'outbound_integrations', user.clientId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOutboundWebhookUrl(docSnap.data().webhookUrl || "");
      }
    } catch (error) {
      console.error("Error fetching outbound webhook:", error);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchTeamMembers();
    fetchLinkedPages();
    fetchLeadSources();
    fetchAssignmentRules();
    fetchOutboundWebhook();
  }, [user?.clientId]);

  const handleLeadUpdated = (updatedLead: Lead) => {
    setRealTimeLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setOlderLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
  };

  const openLeadDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.clientId) return;
    setAddingLead(true);
    try {
      const assignedUser = teamMembers.find(m => m.id === assignedTo);
      const assignedToName = assignedUser ? assignedUser.name : (assignedTo === user.uid ? user.email : '');

      await addDoc(collection(db, 'leads'), {
        clientId: user.clientId,
        firstName,
        lastName,
        email,
        phone,
        projectProperty,
        status,
        source: source || 'Manual',
        subSource: subSource || '',
        assignedTo: assignedTo || user?.uid,
        assignedToId: assignedTo || user?.uid,
        assignedToName: assignedToName,
        createdAt: serverTimestamp()
      });
      
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setProjectProperty('');
      setStatus('New');
      setSubSource('');
      setAssignedTo('');
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("Failed to add lead. Check console for details.");
    } finally {
      setAddingLead(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAgent(true);
    try {
      const createAgentFn = httpsCallable(functions, 'createAgent');
      await createAgentFn({ email: agentEmail, password: agentPassword, name: agentName });
      setAgentName(''); setAgentEmail(''); setAgentPassword('');
      setIsAgentModalOpen(false);
      await fetchAgents();
      alert("Agent created successfully.");
    } catch (error: any) {
      console.error("Error saving agent:", error);
      alert(error.message || "Failed to save agent.");
    } finally {
      setAddingAgent(false);
    }
  };

  const handleEditAgent = async (agent: Agent) => {
    setInlineEditingAgentId(agent.id);
    setInlineEditingName(agent.name);
  };

  const handleSaveInlineEdit = async (agentId: string) => {
    if (!inlineEditingName || inlineEditingName.trim() === '') {
      setInlineEditingAgentId(null);
      return;
    }
    try {
      const updateAgentFn = httpsCallable(functions, 'updateAgent');
      await updateAgentFn({ agentId, name: inlineEditingName.trim() });
      await fetchAgents();
      setInlineEditingAgentId(null);
      alert("Agent updated successfully.");
    } catch (error: any) {
      console.error("Error updating agent:", error);
      alert(error.message || "Failed to update agent.");
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const deleteAgentFn = httpsCallable(functions, 'deleteAgent');
      await deleteAgentFn({ agentId });
      await fetchAgents();
      alert("Agent deleted successfully.");
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      alert(error.message || "Failed to delete agent.");
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAssignLead = async (leadId: string, agentId: string) => {
    try {
      const assignedUser = teamMembers.find(m => m.id === agentId);
      const assignedToName = assignedUser ? assignedUser.name : '';
      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, assignedTo: agentId, assignedToId: agentId, assignedToName: assignedToName } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, assignedTo: agentId, assignedToId: agentId, assignedToName: assignedToName } : lead));
      await updateDoc(doc(db, 'leads', leadId), { assignedTo: agentId, assignedToId: agentId, assignedToName: assignedToName });
    } catch (error) {
      console.error("Error assigning lead:", error);
    }
  };

  useEffect(() => {
    if (window.FB) return;
    window.fbAsyncInit = function() {
      window.FB.init({ appId: '1439047481212574', cookie: true, xfbml: true, version: 'v19.0' });
    };
    (function(d, s, id){
       var js, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) {return;}
       js = d.createElement(s) as any; js.id = id;
       (js as any).src = "https://connect.facebook.net/en_US/sdk.js";
       if (fjs && fjs.parentNode) {
         fjs.parentNode.insertBefore(js, fjs);
       } else {
         d.head.appendChild(js);
       }
     }(document, 'script', 'facebook-jssdk'));
  }, []);

  const handleConnectFacebook = () => {
    setIsLoadingFb(true);
    window.FB.login((response: any) => {
      if (response.authResponse) {
        setFbUserToken(response.authResponse.accessToken); 
        window.FB.api('/me/accounts', (apiResponse: any) => {
          if (apiResponse && !apiResponse.error) {
            setFbPages(apiResponse.data || []);
          } else {
            console.error('Error fetching pages:', apiResponse.error);
            alert('Failed to fetch Facebook Pages.');
          }
          setIsLoadingFb(false);
        });
      } else {
        console.log('User cancelled login or did not fully authorize.');
        setIsLoadingFb(false);
      }
    }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval' });
  };

  const handleLinkPage = async (page: any) => {
    if (!user?.clientId || !fbUserToken) return;
    setIsLinking(true);
    try {
      const q = query(collection(db, 'facebook_integrations'), where('pageId', '==', page.id));
      const querySnapshot = await getDocs(q);
      let isConnectedToOtherClient = false;
      querySnapshot.forEach((docSnap) => {
        if (docSnap.data().clientId !== user.clientId) isConnectedToOtherClient = true;
      });
      if (isConnectedToOtherClient) {
        alert('Error: This Facebook Page is already connected to another client workspace.');
        setIsLinking(false); return;
      }
      const linkFn = httpsCallable(functions, 'secureLinkFacebookPage');
      await linkFn({ shortLivedUserToken: fbUserToken, pageId: page.id, pageName: page.name });
      fetchLinkedPages();
      setFbPages([]); 
    } catch (error) {
      console.error('Error linking page:', error);
      alert('Failed to securely link page.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleDisconnectPage = async (pageId: string) => {
    if (!user?.clientId) return;
    try {
      await deleteDoc(doc(db, 'facebook_integrations', user.clientId));
      fetchLinkedPages();
    } catch (error) {
      console.error("Error disconnecting Facebook page:", error);
      alert("Failed to disconnect. Please try again.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveOutboundWebhook = async () => {
    if (!user?.clientId) return;
    setIsSavingOutboundWebhook(true);
    try {
      const docRef = doc(db, 'outbound_integrations', user.clientId);
      await setDoc(docRef, { clientId: user.clientId, webhookUrl: outboundWebhookUrl, updatedAt: serverTimestamp() });
      alert('Outbound webhook configuration saved successfully.');
    } catch (error) {
      console.error('Error saving outbound webhook:', error);
      alert('Failed to save outbound webhook configuration.');
    } finally {
      setIsSavingOutboundWebhook(false);
    }
  };

  const handleTestOutboundWebhook = async () => {
    if (!outboundWebhookUrl) { alert('Please enter a webhook URL first.'); return; }
    setIsTestingOutboundWebhook(true);
    try {
      const testPayload = {
        id: 'test-lead-123', name: 'John Doe', email: 'john.doe@example.com', phone: '+1234567890',
        source: 'Test Webhook', status: 'new', createdAt: new Date().toISOString(), clientId: user?.clientId
      };
      const response = await fetch(outboundWebhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testPayload),
      });
      if (response.ok) { alert('Test lead sent successfully!'); } 
      else { alert(`Failed to send test lead. Server responded with status: ${response.status}`); }
    } catch (error) {
      console.error('Error sending test lead:', error);
      alert('Failed to send test lead. Please check the URL and try again.');
    } finally {
      setIsTestingOutboundWebhook(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    let matches = true;
    if (leadSourceFilter !== 'All') {
      const source = lead.source || '';
      if (!source.toLowerCase().includes(leadSourceFilter.toLowerCase())) matches = false;
    }
    if (startDate) {
      const leadDate = lead.createdAt?.toDate();
      if (leadDate && leadDate < new Date(startDate)) matches = false;
    }
    if (endDate) {
      const leadDate = lead.createdAt?.toDate();
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      if (leadDate && leadDate >= end) matches = false;
    }
    return matches;
  });

  const sourceDataMap = new Map<string, number>();
  filteredLeads.forEach(lead => {
    const source = lead.source || 'Manual';
    sourceDataMap.set(source, (sourceDataMap.get(source) || 0) + 1);
  });
  const dynamicSourceData = Array.from(sourceDataMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const PIE_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#84cc16'];

  const statusDataMap = new Map<string, number>();
  filteredLeads.forEach(lead => {
    const status = lead.status || 'New';
    statusDataMap.set(status, (statusDataMap.get(status) || 0) + 1);
  });
  const dynamicStatusData = Array.from(statusDataMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => {
      const indexA = PIPELINE_STATUSES.indexOf(a.name);
      const indexB = PIPELINE_STATUSES.indexOf(b.name);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return b.count - a.count;
    });

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let icon = <Globe className="w-3 h-3" />;
    let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
    let label = source || 'Manual';

    if (s.includes('facebook')) { icon = <Facebook className="w-3 h-3" />; colorClass = "bg-blue-50 text-blue-700 border-blue-200"; } 
    else if (s.includes('google')) { icon = <Search className="w-3 h-3" />; colorClass = "bg-amber-50 text-amber-700 border-amber-200"; } 
    else if (s.includes('website')) { icon = <Globe className="w-3 h-3" />; colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200"; }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
        {icon} {label} {subSource ? `/ ${subSource}` : ''}
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Attempted Contact': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Connected / Warm': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Site Visit Scheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Site Visit Completed': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Negotiation': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Closed Won': return 'bg-slate-900 text-white border-slate-700 shadow-md';
      case 'Closed Lost': return 'bg-red-50 text-red-700 border-red-200';
      case 'Junk / Invalid': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredLeadsView = leads.filter(lead => {
    let matches = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      if (!fullName.includes(query) && !lead.email?.toLowerCase().includes(query) && !lead.phone?.toLowerCase().includes(query)) matches = false;
    }
    if (leadsViewSourceFilter !== 'All') { if (lead.source !== leadsViewSourceFilter) matches = false; }
    if (leadsStartDate || leadsEndDate) {
      const leadDate = lead.createdAt ? lead.createdAt.toDate() : new Date();
      leadDate.setHours(0, 0, 0, 0);
      if (leadsStartDate) { const start = new Date(leadsStartDate); start.setHours(0, 0, 0, 0); if (leadDate < start) matches = false; }
      if (leadsEndDate) { const end = new Date(leadsEndDate); end.setHours(23, 59, 59, 999); if (leadDate > end) matches = false; }
    }
    return matches;
  });

  const totalPages = Math.ceil(filteredLeadsView.length / leadsPerPage);
  const paginatedLeads = filteredLeadsView.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) { setSelectedLeads(paginatedLeads.map(l => l.id)); } 
    else { setSelectedLeads([]); }
  };

  const handleSelectLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;
    try {
      for (const id of selectedLeads) { await deleteDoc(doc(db, 'leads', id)); }
      setSelectedLeads([]);
      setOlderLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
    } catch (error) {
      console.error("Error deleting leads:", error);
      alert("Failed to delete some leads.");
    }
  };

  const toggleExpandLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      
      {/* ✨ UI UPGRADE: Pinterest-style background mesh gradient blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-emerald-100/40 to-teal-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-purple-100/30 to-pink-50/30 blur-3xl opacity-70 mix-blend-multiply" />
      </div>

      <div className="md:hidden relative z-20 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white p-4 shrink-0 shadow-sm">
        <img src="/mintage-logo.png" alt="Mintage" className="h-10 w-auto" />
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900 focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* ✨ UI UPGRADE: Sidebar converted to frosted glassmorphism with its own subtle vertical gradient */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white/90 via-emerald-50/40 to-slate-50/80 backdrop-blur-2xl border-r border-white/80 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.03)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* ✨ UI UPGRADE: Taller, more breathable header area for the logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100/50 bg-white/40">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg tracking-tight">
            <img src="/mintage-logo.png" alt="Mintage" className="h-8 w-auto drop-shadow-sm" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* ✨ UI UPGRADE: Gradient Text for Workspace label */}
        <div className="px-6 py-6 text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-500 uppercase tracking-[0.2em]">
          Workspace
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5">
          {/* ✨ UI UPGRADE: Active states use sleek gradients, soft text colors, and subtle inner borders */}
          <button 
            onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'leads' 
                ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-800 font-bold border-l-4 border-emerald-500 rounded-l-none shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-emerald-700 hover:shadow-sm'
            }`}
          >
            <Users className="w-5 h-5" />
            Leads
          </button>
          {user?.role === 'client_admin' && (
            <>
              <button 
                onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
                  activeTab === 'team' 
                    ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-800 font-bold border-l-4 border-emerald-500 rounded-l-none shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]' 
                    : 'text-slate-600 font-medium hover:bg-white/60 hover:text-emerald-700 hover:shadow-sm'
                }`}
              >
                <UserCog className="w-5 h-5" />
                Team
              </button>
              <button 
                onClick={() => { setActiveTab('integrations'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
                  activeTab === 'integrations' 
                    ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-800 font-bold border-l-4 border-emerald-500 rounded-l-none shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]' 
                    : 'text-slate-600 font-medium hover:bg-white/60 hover:text-emerald-700 hover:shadow-sm'
                }`}
              >
                <Link2 className="w-5 h-5" />
                Integrations
              </button>
            </>
          )}
          <button 
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'reports' 
                ? 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-800 font-bold border-l-4 border-emerald-500 rounded-l-none shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-emerald-700 hover:shadow-sm'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Reports
          </button>
        </nav>

        <div className="p-5 border-t border-slate-100/50 bg-white/20">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-600 font-medium hover:bg-red-50/80 hover:text-red-600 hover:shadow-sm transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* ✨ UI UPGRADE: Header frosted glass */}
        <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-white flex items-center justify-between px-4 md:px-8 shrink-0 hidden md:flex shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            {activeTab === 'leads' ? 'Leads Management' : activeTab === 'team' ? 'Team Management' : activeTab === 'reports' ? 'Analytics Dashboard' : 'Integrations'}
          </h1>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white/80 border border-white px-4 py-2 rounded-full shadow-sm">
            <UserCircle2 className="w-4 h-4 text-emerald-600" />
            {user?.email}
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-auto overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full flex flex-col min-w-[800px] md:min-w-0">
            
            {activeTab === 'leads' ? (
              <>
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-8 shrink-0">
                  <div>
                    {/* ✨ UI UPGRADE: Gradient Text Header */}
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Leads</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage and track your prospective customers.</p>
                  </div>
                  {/* ✨ UI UPGRADE: Gradient Button with hover lift and colored shadow */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-500/25 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:-translate-y-0.5 whitespace-nowrap border border-emerald-400/50"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Lead
                  </button>
                </div>

                {/* Filters & Controls */}
                {/* ✨ UI UPGRADE: Glassmorphism Control Bar */}
                <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8 shrink-0">
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-3 py-1.5 h-10 shadow-sm">
                    <input
                      type="date"
                      value={leadsStartDate}
                      onChange={(e) => setLeadsStartDate(e.target.value)}
                      className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer"
                    />
                    <span className="text-slate-300 text-sm font-light">|</span>
                    <input
                      type="date"
                      value={leadsEndDate}
                      onChange={(e) => setLeadsEndDate(e.target.value)}
                      className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer"
                    />
                    {(leadsStartDate || leadsEndDate) && (
                      <button 
                        onClick={() => { setLeadsStartDate(''); setLeadsEndDate(''); }}
                        className="ml-2 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-4 py-1.5 h-10 flex-1 min-w-[200px] shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent w-full outline-none placeholder:font-normal"
                    />
                  </div>
                  <select
                    value={leadsViewSourceFilter}
                    onChange={(e) => setLeadsViewSourceFilter(e.target.value)}
                    className="text-sm font-medium border border-slate-100 rounded-xl px-4 py-1.5 h-10 text-slate-600 bg-white/80 shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                  >
                    <option value="All">All Sources</option>
                    {combinedSources.map(sourceName => (
                      <option key={sourceName} value={sourceName}>{sourceName}</option>
                    ))}
                  </select>
                  <div className="flex items-center bg-white/80 border border-slate-100 rounded-xl p-1 h-10 shadow-sm">
                    <button
                      onClick={() => setViewMode('pipeline')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${
                        viewMode === 'pipeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <KanbanSquare className="w-4 h-4" />
                      Pipeline
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${
                        viewMode === 'table' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      Table
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 flex justify-center">
                    <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-16 text-center flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                      <Users className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No leads found</h3>
                    <p className="text-slate-500 text-sm max-w-sm">Your pipeline is empty. Get started by adding a new lead manually or checking your integrations.</p>
                  </div>
                ) : viewMode === 'table' ? (
                  /* Table View */
                  // ✨ UI UPGRADE: Glassmorphism Table Container
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden shrink-0">
                    {selectedLeads.length > 0 && (
                      <div className="bg-red-50/90 backdrop-blur-md px-6 py-3 border-b border-red-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-red-800">
                          {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-2 py-1.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Selected
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                      <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-xl shadow-sm">
                          <tr className="text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200/60">
                            <th className="px-6 py-4 w-10">
                              <input 
                                type="checkbox" 
                                className="rounded-md border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                                checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                                onChange={handleSelectAll}
                              />
                            </th>
                            <th className="px-6 py-4 w-10"></th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Contact</th>
                            <th className="px-6 py-4">Source</th>
                            <th className="px-6 py-4">Tags</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Project</th>
                            <th className="px-6 py-4">Assignee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 bg-transparent">
                          {paginatedLeads.map((lead) => (
                            <React.Fragment key={lead.id}>
                              <tr 
                                onClick={() => openLeadDetails(lead)}
                                className="hover:bg-white/60 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded-md border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                                    checked={selectedLeads.includes(lead.id)}
                                    onChange={(e) => handleSelectLead(lead.id, e as any)}
                                  />
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap" onClick={(e) => toggleExpandLead(lead.id, e)}>
                                  <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                    {expandedLeads.includes(lead.id) ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500">
                                  {lead.createdAt ? new Date(lead.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="font-bold text-slate-800">
                                    {lead.firstName} {lead.lastName}
                                    {lead.isDuplicate && (
                                      <span className="ml-2.5 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-700 uppercase tracking-widest">
                                        Duplicate
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex flex-col gap-1 text-sm text-slate-600 font-medium">
                                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{lead.phone || '-'}</div>
                                    {lead.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" />{lead.email}</div>}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  {getSourceBadge(lead.source, lead.subSource)}
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex flex-wrap gap-1.5 max-w-[160px]">
                                    {lead.tags?.map(tag => (
                                      <span key={tag} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shadow-sm uppercase tracking-wider">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadgeClass(lead.status)}`}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
                                    <Home className="w-4 h-4 text-slate-400" />
                                    {lead.projectProperty || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  {user?.role === 'client_admin' ? (
                                    <select
                                      value={lead.assignedToId || lead.assignedTo || ''}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleAssignLead(lead.id, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-sm font-medium bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-emerald-500/20 outline-none shadow-sm cursor-pointer"
                                    >
                                      <option value="">Unassigned</option>
                                      {teamMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                                      {lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                              
                              {/* 👇 FULLY UPGRADED EXPANDED ROW DATA 👇 */}
                              {expandedLeads.includes(lead.id) && (
                                <tr className="bg-slate-50/50 backdrop-blur-sm border-b border-slate-200/50">
                                  <td colSpan={10} className="px-6 py-5">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm bg-white/60 p-4 rounded-xl border border-white">
                                      
                                      {/* Apollo Enrichment Data */}
                                      {(lead.designation && lead.designation !== "Unknown") && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Designation</span>
                                          <span className="text-slate-700 font-medium flex items-center gap-1.5">💼 {lead.designation}</span>
                                        </div>
                                      )}
                                      {(lead.location && lead.location !== "Unknown") && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Location</span>
                                          <span className="text-slate-700 font-medium flex items-center gap-1.5">📍 {lead.location}</span>
                                        </div>
                                      )}
                                      {lead.linkedin && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">LinkedIn</span>
                                          <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-bold flex items-center gap-1">🔗 View Profile</a>
                                        </div>
                                      )}

                                      {/* Truecaller Verified Data */}
                                      {(lead.truecallerName && lead.truecallerName !== "Unknown") && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Truecaller Record</span>
                                          <span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.3"/><path d="M10 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/></svg>
                                            {lead.truecallerName}
                                          </span>
                                        </div>
                                      )}

                                      {/* Facebook Meta Marketing Data */}
                                      {lead.adName && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ad Name</span>
                                          <span className="text-slate-700 font-medium">{lead.adName}</span>
                                        </div>
                                      )}
                                      {lead.campaignName && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Campaign Name</span>
                                          <span className="text-slate-700 font-medium">{lead.campaignName}</span>
                                        </div>
                                      )}
                                      {lead.formId && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Form ID</span>
                                          <span className="text-slate-700 font-mono text-xs bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{lead.formId}</span>
                                        </div>
                                      )}
                                      {lead.adId && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ad ID</span>
                                          <span className="text-slate-700 font-mono text-xs bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{lead.adId}</span>
                                        </div>
                                      )}
                                      {lead.campaignId && (
                                        <div>
                                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Campaign ID</span>
                                          <span className="text-slate-700 font-mono text-xs bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">{lead.campaignId}</span>
                                        </div>
                                      )}

                                      {/* Empty State Fallback */}
                                      {!lead.designation && !lead.adName && !lead.formId && !lead.campaignId && !lead.adId && !lead.truecallerName && (
                                        <div className="col-span-4 text-slate-400 font-medium italic text-xs py-2">
                                          No extended marketing or enrichment data available for this lead.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {/* 👆 EXPANDED ROW END 👆 */}

                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-slate-100 bg-white/50 backdrop-blur-md flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-500">
                          Showing <span className="font-bold text-slate-900">{((currentPage - 1) * leadsPerPage) + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * leadsPerPage, filteredLeadsView.length)}</span> of <span className="font-bold text-slate-900">{filteredLeadsView.length}</span> leads
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-slate-600 px-2 bg-white border border-slate-200 py-1.5 rounded-lg shadow-sm">
                              {currentPage} / {totalPages}
                            </span>
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Pipeline View */
                  <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar">
                    <div className="flex gap-6 h-full min-w-max px-1 pt-1">
                      {PIPELINE_STATUSES.map(status => (
                        // ✨ UI UPGRADE: Glass Pipeline Columns
                        <div key={status} className="w-[340px] flex flex-col bg-white/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden shrink-0">
                          <div className="p-5 border-b border-white/60 bg-white/40 flex items-center justify-between shrink-0">
                            <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{status}</h3>
                            <span className="bg-white/80 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm border border-slate-100">
                              {filteredLeadsView.filter(l => l.status === status).length}
                            </span>
                          </div>
                          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                            {filteredLeadsView.filter(l => l.status === status).map(lead => (
                              // ✨ UI UPGRADE: Glass Lead Cards with hover lifts
                              <div 
                                key={lead.id} 
                                onClick={() => openLeadDetails(lead)}
                                className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 cursor-pointer relative group"
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div className="font-bold text-slate-900 text-base leading-tight pr-2">{lead.firstName} {lead.lastName}</div>
                                  {getSourceBadge(lead.source, lead.subSource)}
                                </div>
                                
                                {((lead.designation && lead.designation !== "Unknown") || (lead.location && lead.location !== "Unknown")) && (
                                  <div className="mb-4 text-xs font-medium text-slate-500 space-y-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                    {lead.designation && lead.designation !== "Unknown" && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px]">💼</span> <span className="truncate">{lead.designation}</span>
                                      </div>
                                    )}
                                    {lead.location && lead.location !== "Unknown" && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px]">📍</span> <span className="truncate">{lead.location}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {lead.linkedin && (
                                  <div className="mb-4">
                                    <a 
                                      href={lead.linkedin} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 w-fit"
                                      onClick={(e) => e.stopPropagation()} 
                                    >
                                      🔗 View LinkedIn
                                    </a>
                                  </div>
                                )}
                                
                                <div className="space-y-2 mb-5">
                                  <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600">
                                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Phone className="w-3.5 h-3.5 shrink-0" /></div>
                                    <span className="truncate">{lead.phone || 'No phone'}</span>
                                    
                                    {/* 👇 TRUECALLER VERIFIED BADGE (Pipeline Card) 👇 */}
                                    {lead.truecallerName && lead.truecallerName !== "Unknown" && (
                                      <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 shrink-0">
                                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.3"/>
                                          <path d="M10 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>
                                        </svg>
                                        Verified
                                      </span>
                                    )}
                                    {/* 👆 TRUECALLER VERIFIED BADGE 👆 */}

                                  </div>
                                  <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600">
                                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Home className="w-3.5 h-3.5 shrink-0" /></div>
                                    <span className="truncate">{lead.projectProperty || 'No project'}</span>
                                  </div>
                                </div>

                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-5">
                                    {lead.tags.map(tag => (
                                      <span key={tag} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                                  <select
                                    value={lead.status}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(lead.id, e.target.value);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer hover:bg-white transition-colors"
                                  >
                                    {PIPELINE_STATUSES.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                  {user?.role === 'client_admin' ? (
                                    <select
                                      value={lead.assignedToId || lead.assignedTo || ''}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleAssignLead(lead.id, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none cursor-pointer hover:bg-white transition-colors"
                                    >
                                      <option value="">Unassigned</option>
                                      {teamMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="text-[11px] font-bold text-slate-500 px-1 text-center bg-slate-50 py-1.5 rounded-xl border border-slate-100">
                                      Agent: {lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {hasMoreLeads && leads.length > 0 && (
                  <div className="mt-6 flex justify-center pb-8">
                    <button
                      onClick={loadMoreLeads}
                      disabled={loadingMoreLeads}
                      className="flex items-center gap-2 px-8 py-3 bg-white/80 backdrop-blur-md border border-white rounded-2xl text-sm font-bold text-slate-700 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {loadingMoreLeads ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 text-emerald-500" />
                          Load More Leads
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === 'team' ? (
              /* Team View */
              <div className="max-w-6xl mx-auto space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Team</h2>
                      <p className="text-slate-500 text-sm font-medium">Manage your sales agents and their access.</p>
                    </div>
                    {user?.role === 'client_admin' && (
                      <button
                        onClick={() => setIsAgentModalOpen(true)}
                        className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-emerald-500/25 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all hover:-translate-y-0.5 border border-emerald-400/50"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add New Agent
                      </button>
                    )}
                  </div>

                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
                    {agents.length === 0 ? (
                      <div className="p-16 text-center flex flex-col items-center">
                        <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                          <Users className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No agents found</h3>
                        <p className="text-slate-500 text-sm">Get started by adding a new agent to your team.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200/60 text-xs uppercase tracking-wider text-slate-500 font-bold">
                              <th className="px-6 py-4">Name</th>
                              <th className="px-6 py-4">Email</th>
                              <th className="px-6 py-4">Role</th>
                              <th className="px-6 py-4">Date Added</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/60">
                            {agents.map((agent) => (
                              <tr key={agent.id} className="hover:bg-white/60 transition-colors group">
                                <td className="px-6 py-5 whitespace-nowrap">
                                  {inlineEditingAgentId === agent.id ? (
                                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
                                      <input
                                        type="text"
                                        value={inlineEditingName}
                                        onChange={(e) => setInlineEditingName(e.target.value)}
                                        className="px-3 py-1.5 text-sm font-medium border-none rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none w-48"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveInlineEdit(agent.id)}
                                        className="text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setInlineEditingAgentId(null)}
                                        className="text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="font-bold text-slate-800">
                                      {agent.name}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Mail className="w-3.5 h-3.5" /></div>
                                    {agent.email}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                                    Agent
                                  </span>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    {agent.createdAt ? new Date(agent.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                                  </div>
                                </td>
                                <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleEditAgent(agent)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mr-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAgent(agent.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lead Auto-Assignment Rules */}
                {user?.role === 'client_admin' && (
                  <div>
                    <div className="flex items-center justify-between mb-6 mt-12">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Auto-Assignment Rules</h2>
                        <p className="text-slate-500 text-sm font-medium">Automatically route incoming leads based on their source.</p>
                      </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
                      <div className="p-6 border-b border-white/80 bg-white/40">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Create New Rule</h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                          <div className="flex-1 w-full">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Lead Source</label>
                            <select
                              value={newRuleSource}
                              onChange={(e) => setNewRuleSource(e.target.value)}
                              className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                            >
                              <option value="">Select a source...</option>
                              {leadSources.map(source => (
                                <option key={source.id} value={source.name}>{source.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 w-full">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Assign To Agent</label>
                            <select
                              value={newRuleAgentId}
                              onChange={(e) => setNewRuleAgentId(e.target.value)}
                              className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all cursor-pointer"
                            >
                              <option value="">Select an agent...</option>
                              {teamMembers.map(member => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={handleAddAssignmentRule}
                            disabled={!newRuleSource || !newRuleAgentId || addingRule}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-slate-900/10 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          >
                            {addingRule ? (
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                            Add Rule
                          </button>
                        </div>
                      </div>

                      {assignmentRules.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm font-medium">
                          No auto-assignment rules configured yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-200/60 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                <th className="px-6 py-4">Lead Source</th>
                                <th className="px-6 py-4">Assigned Agent</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/60">
                              {assignmentRules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-white/60 transition-colors">
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="font-bold text-slate-800 flex items-center gap-3">
                                      <div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Globe className="w-4 h-4" /></div>
                                      {rule.sourceName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                      <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-400"><UserCircle2 className="w-4 h-4" /></div>
                                      {rule.agentName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap text-right">
                                    <button
                                      onClick={() => handleDeleteRule(rule.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Rule"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'reports' ? (
              /* Reports View */
              <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Analytics Dashboard</h2>
                    <p className="text-slate-500 text-sm font-medium">Overview of your lead performance and team metrics.</p>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-4 bg-white/70 backdrop-blur-xl p-2.5 rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="flex items-center gap-2 px-3 bg-white border border-slate-100 rounded-xl py-1.5 shadow-sm">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none"
                      />
                      <span className="text-slate-300 font-light">|</span>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none"
                      />
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                    <select 
                      value={leadSourceFilter}
                      onChange={(e) => setLeadSourceFilter(e.target.value)}
                      className="text-sm font-bold border border-slate-100 rounded-xl px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 text-slate-700 cursor-pointer outline-none transition-all"
                    >
                      <option value="All">All Sources</option>
                      {combinedSources.map(sourceName => (
                        <option key={sourceName} value={sourceName}>{sourceName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Leads</h3>
                      <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500 shadow-inner">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{filteredLeads.length}</p>
                  </div>
                  
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">New Leads</h3>
                      <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-500 shadow-inner">
                        <Zap className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">
                      {filteredLeads.filter(l => l.status === 'New').length}
                    </p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Site Visits</h3>
                      <div className="p-2.5 bg-purple-50 rounded-xl text-purple-500 shadow-inner">
                        <Building2 className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">
                      {filteredLeads.filter(l => l.status === 'Site Visit Scheduled' || l.status === 'Site Visit Completed').length}
                    </p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Closed Won</h3>
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-500 shadow-inner">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">
                      {filteredLeads.filter(l => l.status === 'Closed Won').length}
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-8">Leads by Status</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dynamicStatusData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dx={-10} />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600 }}
                          />
                          <Bar dataKey="count" fill="url(#colorUv)" radius={[6, 6, 0, 0]} maxBarSize={45}>
                            {/* SVG Gradient definition for the bars */}
                            <defs>
                              <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={1}/>
                                <stop offset="95%" stopColor="#059669" stopOpacity={0.8}/>
                              </linearGradient>
                            </defs>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                    <h3 className="text-lg font-bold text-slate-800 mb-8">Leads by Source</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dynamicSourceData}
                            cx="50%"
                            cy="45%"
                            innerRadius={85}
                            outerRadius={125}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                            stroke="none"
                          >
                            {dynamicSourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgb(0 0 0 / 0.1)', fontWeight: 600 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 mt-4">
                        {dynamicSourceData.map((source, index) => (
                          <div key={source.name} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            {source.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Performance Table */}
                <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40">
                    <h3 className="text-lg font-bold text-slate-800">Agent Performance</h3>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                          <th className="px-8 py-5">Agent Name</th>
                          <th className="px-8 py-5">Total Assigned</th>
                          <th className="px-8 py-5">New</th>
                          <th className="px-8 py-5">In Progress</th>
                          <th className="px-8 py-5">Closed Won</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {teamMembers.map(agent => {
                          const agentLeads = filteredLeads.filter(l => (l.assignedToId || l.assignedTo) === agent.id);
                          return (
                            <tr key={agent.id} className="hover:bg-white/60 transition-colors">
                              <td className="px-8 py-5 whitespace-nowrap">
                                <div className="font-bold text-slate-800 flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-white shadow-sm flex items-center justify-center text-indigo-700 text-xs font-black">
                                    {agent.name.charAt(0).toUpperCase()}
                                  </div>
                                  {agent.name}
                                </div>
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap font-bold text-slate-600">
                                {agentLeads.length}
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap font-medium text-emerald-600">
                                {agentLeads.filter(l => l.status === 'New').length}
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap font-medium text-blue-600">
                                {agentLeads.filter(l => ['Contacted', 'Site Visit', 'Negotiation'].includes(l.status)).length}
                              </td>
                              <td className="px-8 py-5 whitespace-nowrap font-bold text-amber-500">
                                {agentLeads.filter(l => l.status === 'Closed Won').length}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Unassigned row */}
                        <tr className="bg-slate-50/30">
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="font-bold text-slate-400 italic">Unassigned Leads</div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap font-bold text-slate-400">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo)).length}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap font-medium text-slate-400">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo) && l.status === 'New').length}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap font-medium text-slate-400">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo) && ['Contacted', 'Site Visit', 'Negotiation'].includes(l.status)).length}
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap font-medium text-slate-400">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo) && l.status === 'Closed Won').length}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Integrations View */
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">External Integrations</h2>
                  <p className="text-slate-500 text-sm font-medium">Connect your Facebook Ads, Google Ads, or Website to capture leads automatically.</p>
                </div>

                <div className="space-y-6">
                  {/* Meta / Facebook Ads Card */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/30">
                            <Facebook className="w-8 h-8" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Meta / Facebook Ads</h3>
                              {isLoadingLinkedPages ? (
                                <div className="h-6 w-24 bg-slate-200 rounded-lg animate-pulse"></div>
                              ) : linkedPages.length > 0 ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                                  Connected
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest">
                                  Not Connected
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-sm font-medium">
                              Automatically sync leads from your Facebook Lead Ads directly into your CRM.
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <button
                            onClick={handleConnectFacebook}
                            disabled={isLoadingFb}
                            className="px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-bold transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                          >
                            {isLoadingFb ? 'Connecting...' : 'Connect Facebook'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Linked Pages List */}
                      {linkedPages.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Connected Pages</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {linkedPages.map(page => (
                              <div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500"><Globe className="w-5 h-5"/></div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{page.pageName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.pageId}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDisconnectPage(page.id)}
                                  className="text-[11px] font-bold text-red-600 hover:text-white px-3 py-1.5 bg-red-50 hover:bg-red-500 rounded-lg transition-colors border border-red-100 hover:border-red-500"
                                >
                                  Disconnect
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Pages to Link */}
                      {fbPages.length > 0 && linkedPages.length === 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Available Pages to Link</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {fbPages.map(page => {
                              const isLinked = linkedPages.some(lp => lp.pageId === page.id);
                              return (
                                <div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Facebook className="w-5 h-5"/></div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">{page.name}</p>
                                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.id}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleLinkPage(page)}
                                    disabled={isLinked || isLinking}
                                    className={`text-[11px] font-bold px-4 py-2 rounded-lg transition-all ${
                                      isLinked || isLinking 
                                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 hover:border-blue-600 shadow-sm'
                                    }`}
                                  >
                                    {isLinking ? 'Securing...' : isLinked ? 'Linked' : 'Link Page'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Webhook URL Card */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Your Unique Webhook URL</h3>
                          <p className="text-slate-500 text-sm font-medium mt-1">Use this endpoint to send leads from any external platform.</p>
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-inner relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <code className="text-sm text-emerald-400 break-all font-mono font-medium relative z-10">
                          {webhookUrl}
                        </code>
                        <button
                          onClick={handleCopy}
                          className="shrink-0 p-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all shadow-sm relative z-10 border border-slate-700"
                          title="Copy to clipboard"
                        >
                          {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-200/60">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            <Facebook className="w-4 h-4 text-blue-500" />
                            Facebook Ads
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Connect via Zapier or Pabbly Connect using this webhook URL to capture leads from Facebook Lead Forms.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            <Search className="w-4 h-4 text-amber-500" />
                            Google Ads
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Paste this URL into your Google Ads Lead Form extension settings to receive leads in real-time.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                            <Globe className="w-4 h-4 text-emerald-500" />
                            Website Forms
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Send a POST request from your website's contact form directly to this endpoint.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export Leads (Outbound Webhook) Card */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                          <Link2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Export Leads (Outbound Webhook)</h3>
                          <p className="text-slate-500 text-sm font-medium mt-1">Send incoming leads to external tools like Google Sheets via Pabbly or Make.com.</p>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Webhook URL</label>
                            <input
                              type="url"
                              value={outboundWebhookUrl}
                              onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                              placeholder="https://hook.us1.make.com/..."
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              onClick={handleSaveOutboundWebhook}
                              disabled={isSavingOutboundWebhook}
                              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
                            >
                              {isSavingOutboundWebhook ? 'Saving...' : 'Save Configuration'}
                            </button>
                            <button
                              onClick={handleTestOutboundWebhook}
                              disabled={isTestingOutboundWebhook || !outboundWebhookUrl}
                              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
                            >
                              {isTestingOutboundWebhook ? 'Sending...' : 'Send Test Lead'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documentation Card */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden p-8">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-3">Payload Format</h3>
                    <p className="text-sm font-medium text-slate-500 mb-6">Your external source should send a JSON POST request with the following fields:</p>
                    <div className="bg-[#0f172a] rounded-2xl p-6 overflow-x-auto relative shadow-inner border border-slate-800">
                      <button
                        onClick={() => {
                          const payloadObject = {
                            "firstName": "Ravi",
                            "lastName": "Kumar",
                            "email": "ravi.kumar@example.com",
                            "phone": "+919876543210",
                            "project": "Neopolis Luxury Villas",
                            "source": "WEBSITE",
                            "subSource": "Contact Us Form",
                            "message": "I am interested in a 4BHK villa."
                          };
                          navigator.clipboard.writeText(JSON.stringify(payloadObject, null, 2));
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                      >
                        {isCopied ? 'Copied!' : 'Copy JSON'}
                      </button>
                      <pre className="text-sm text-emerald-400 font-mono leading-relaxed">
{`{
  "firstName": "Ravi",
  "lastName": "Kumar",
  "email": "ravi.kumar@example.com",
  "phone": "+919876543210",
  "project": "Neopolis Luxury Villas",
  "source": "WEBSITE",
  "subSource": "Contact Us Form",
  "message": "I am interested in a 4BHK villa."
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Modals stay above the glass backdrop */}
      <LeadDetailsModal 
        lead={selectedLead}
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false);
          setSelectedLead(null);
        }}
        onLeadUpdated={handleLeadUpdated}
        teamMembers={teamMembers}
      />

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0">
              <h3 className="text-xl font-extrabold text-slate-800">Add New Lead</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form id="add-lead-form" onSubmit={handleAddLead} className="p-8 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Project / Property</label>
                <input
                  type="text"
                  value={projectProperty}
                  onChange={(e) => setProjectProperty(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                  placeholder="e.g. Sunset Villas"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none cursor-pointer"
                  >
                    {PIPELINE_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none cursor-pointer"
                  >
                    {leadSources.length === 0 && <option value="Manual">Manual</option>}
                    {leadSources.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Sub-Source</label>
                  <select
                    value={subSource}
                    onChange={(e) => setSubSource(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none cursor-pointer"
                  >
                    <option value="">None</option>
                    {leadSubSources.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {user?.role === 'client_admin' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Assign To</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </form>

            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-lead-form"
                disabled={addingLead}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl hover:from-emerald-500 hover:to-teal-400 transition-all font-bold text-sm shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex justify-center items-center min-w-[120px]"
              >
                {addingLead ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Save Lead'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200/60">
              <h3 className="text-xl font-extrabold text-slate-800">Add New Agent</h3>
              <button 
                onClick={() => {
                  setIsAgentModalOpen(false);
                  setAgentName('');
                  setAgentEmail('');
                  setAgentPassword('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAgent} className="p-8 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  required
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={agentPassword}
                  onChange={(e) => setAgentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm font-medium outline-none"
                  minLength={6}
                />
                <p className="mt-2 text-[11px] font-medium text-slate-400">Must be at least 6 characters long.</p>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAgentModalOpen(false);
                    setAgentName('');
                    setAgentEmail('');
                    setAgentPassword('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingAgent}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl hover:from-emerald-500 hover:to-teal-400 transition-all font-bold text-sm shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex justify-center items-center"
                >
                  {addingAgent ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create Agent'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal CSS for custom scrollbars to match the premium theme */}
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