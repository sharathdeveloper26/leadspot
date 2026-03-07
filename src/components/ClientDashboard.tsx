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

  // Combined leads for display
  const leads = useMemo(() => {
    const combined = [...realTimeLeads, ...olderLeads];
    // Remove duplicates by ID
    return Array.from(new Map(combined.map(item => [item.id, item])).values());
  }, [realTimeLeads, olderLeads]);

  // Lead Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectProperty, setProjectProperty] = useState('');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('');
  const [subSource, setSubSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Agent Form State
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [inlineEditingAgentId, setInlineEditingAgentId] = useState<string | null>(null);
  const [inlineEditingName, setInlineEditingName] = useState('');

  // Report Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('All');

  // Leads View Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All');
  const [leadsStartDate, setLeadsStartDate] = useState('');
  const [leadsEndDate, setLeadsEndDate] = useState('');

  // Pagination & Table State
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);

  // Facebook Integration State
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [linkedPages, setLinkedPages] = useState<any[]>([]);
  const [isLoadingLinkedPages, setIsLoadingLinkedPages] = useState(true);
  const [isLoadingFb, setIsLoadingFb] = useState(false);

  // Lead Sources State
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);

  // Assignment Rules State
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

  // Idle Timeout Logic
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutes = 900,000 ms
      timeoutId = setTimeout(() => {
        alert('Session expired due to inactivity');
        logout();
      }, 900000);
    };

    // Initialize the timer
    resetTimer();

    // Event listeners for user activity
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
    if (!ruleId) {
      console.error("No ruleId provided to delete");
      return;
    }
    try {
      console.log("Deleting rule with ID:", ruleId);
      await deleteDoc(doc(db, 'lead_assignment_rules', ruleId));
      setAssignmentRules(prevRules => prevRules.filter(r => r.id !== ruleId));
      console.log("Rule deleted successfully");
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
      await createAgentFn({
        email: agentEmail,
        password: agentPassword,
        name: agentName
      });
      
      setAgentName('');
      setAgentEmail('');
      setAgentPassword('');
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
    console.log('Button clicked!', agent.id);
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
    console.log('Button clicked!', agentId);
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
      // Optimistic update
      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus } : lead));
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      // Revert on error
    }
  };

  const handleAssignLead = async (leadId: string, agentId: string) => {
    try {
      const assignedUser = teamMembers.find(m => m.id === agentId);
      const assignedToName = assignedUser ? assignedUser.name : '';
      
      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { 
        ...lead, 
        assignedTo: agentId,
        assignedToId: agentId,
        assignedToName: assignedToName
      } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { 
        ...lead, 
        assignedTo: agentId,
        assignedToId: agentId,
        assignedToName: assignedToName
      } : lead));
      
      await updateDoc(doc(db, 'leads', leadId), { 
        assignedTo: agentId,
        assignedToId: agentId,
        assignedToName: assignedToName
      });
    } catch (error) {
      console.error("Error assigning lead:", error);
    }
  };

  useEffect(() => {
    if (window.FB) return;
    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : '1439047481212574',
        cookie     : true,
        xfbml      : true,
        version    : 'v19.0'
      });
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
        window.FB.api('/me/accounts', async (apiResponse: any) => {
          if (apiResponse && !apiResponse.error) {
            const pages = apiResponse.data || [];
            setFbPages(pages);
            
            // Explicit Save Logic: When the Meta SDK successfully returns the Page token and details
            if (pages.length > 0 && user?.clientId) {
              const page = pages[0];
              try {
                // Subscribe the page to the app's webhook
                const subscribeResponse = await fetch(`https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    subscribed_fields: 'leadgen',
                    access_token: page.access_token,
                  }),
                });
                
                const subscribeData = await subscribeResponse.json();
                
                if (subscribeData.success) {
                  const pageRef = doc(db, 'facebook_integrations', user.clientId);
                  await setDoc(pageRef, {
                    clientId: user.clientId,
                    pageId: page.id,
                    pageName: page.name,
                    pageAccessToken: page.access_token,
                    status: 'active',
                    createdAt: serverTimestamp()
                  });
                  console.log('Successfully saved Facebook integration');
                  fetchLinkedPages();
                } else {
                  console.error('Failed to subscribe page:', subscribeData);
                  alert('Failed to subscribe Facebook Page to webhook.');
                }
              } catch (saveError) {
                console.error('Firebase rejected the save or subscription failed:', saveError);
              }
            }
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
    if (!user?.clientId) return;
    try {
      // Page Exclusivity Check
      const q = query(
        collection(db, 'facebook_integrations'),
        where('pageId', '==', page.id)
      );
      const querySnapshot = await getDocs(q);
      
      let isConnectedToOtherClient = false;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.clientId !== user.clientId) {
          isConnectedToOtherClient = true;
        }
      });

      if (isConnectedToOtherClient) {
        alert('Error: This Facebook Page is already connected to another client workspace.');
        return;
      }

      // Subscribe the page to the app's webhook
      const subscribeResponse = await fetch(`https://graph.facebook.com/v19.0/${page.id}/subscribed_apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          subscribed_fields: 'leadgen',
          access_token: page.access_token,
        }),
      });
      
      const subscribeData = await subscribeResponse.json();
      
      if (!subscribeData.success) {
        console.error('Failed to subscribe page:', subscribeData);
        alert('Failed to subscribe Facebook Page to webhook.');
        return;
      }

      // Strict Document ID Isolation
      const pageRef = doc(db, 'facebook_integrations', user.clientId);
      
      try {
        await setDoc(pageRef, {
          clientId: user.clientId,
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
          status: 'active',
          createdAt: serverTimestamp()
        });
      } catch (saveError) {
        console.error("Firebase rejected the save:", saveError);
        throw saveError;
      }
      
      fetchLinkedPages();
    } catch (error) {
      console.error('Error linking page:', error);
      alert('Failed to link page.');
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
      await setDoc(docRef, {
        clientId: user.clientId,
        webhookUrl: outboundWebhookUrl,
        updatedAt: serverTimestamp()
      });
      alert('Outbound webhook configuration saved successfully.');
    } catch (error) {
      console.error('Error saving outbound webhook:', error);
      alert('Failed to save outbound webhook configuration.');
    } finally {
      setIsSavingOutboundWebhook(false);
    }
  };

  const handleTestOutboundWebhook = async () => {
    if (!outboundWebhookUrl) {
      alert('Please enter a webhook URL first.');
      return;
    }
    setIsTestingOutboundWebhook(true);
    try {
      const testPayload = {
        id: 'test-lead-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        source: 'Test Webhook',
        status: 'new',
        createdAt: new Date().toISOString(),
        clientId: user?.clientId
      };

      const response = await fetch(outboundWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        alert('Test lead sent successfully!');
      } else {
        alert(`Failed to send test lead. Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending test lead:', error);
      alert('Failed to send test lead. Please check the URL and try again.');
    } finally {
      setIsTestingOutboundWebhook(false);
    }
  };

  // Filtered Leads for Reports
  const filteredLeads = leads.filter(lead => {
    let matches = true;
    
    if (leadSourceFilter !== 'All') {
      const source = lead.source || '';
      if (!source.toLowerCase().includes(leadSourceFilter.toLowerCase())) {
        matches = false;
      }
    }
    
    if (startDate) {
      const leadDate = lead.createdAt?.toDate();
      if (leadDate && leadDate < new Date(startDate)) matches = false;
    }
    if (endDate) {
      const leadDate = lead.createdAt?.toDate();
      // Add 1 day to end date to include the whole day
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      if (leadDate && leadDate >= end) matches = false;
    }
    
    return matches;
  });

  // Calculate dynamic source data for PieChart
  const sourceDataMap = new Map<string, number>();
  filteredLeads.forEach(lead => {
    const source = lead.source || 'Manual';
    sourceDataMap.set(source, (sourceDataMap.get(source) || 0) + 1);
  });
  const dynamicSourceData = Array.from(sourceDataMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const PIE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  // Calculate dynamic status data for BarChart
  const statusDataMap = new Map<string, number>();
  filteredLeads.forEach(lead => {
    const status = lead.status || 'New';
    statusDataMap.set(status, (statusDataMap.get(status) || 0) + 1);
  });
  const dynamicStatusData = Array.from(statusDataMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
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
    let colorClass = "bg-slate-100 text-slate-600";
    let label = source || 'Manual';

    if (s.includes('facebook')) {
      icon = <Facebook className="w-3 h-3" />;
      colorClass = "bg-blue-100 text-blue-700";
    } else if (s.includes('google')) {
      icon = <Search className="w-3 h-3" />;
      colorClass = "bg-amber-100 text-amber-700";
    } else if (s.includes('website')) {
      icon = <Globe className="w-3 h-3" />;
      colorClass = "bg-emerald-100 text-emerald-700";
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
        {icon} {label} {subSource ? `/ ${subSource}` : ''}
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'bg-emerald-100 text-emerald-700';
      case 'Attempted Contact': return 'bg-blue-50 text-blue-600';
      case 'Connected / Warm': return 'bg-blue-100 text-blue-700';
      case 'Site Visit Scheduled': return 'bg-purple-50 text-purple-600';
      case 'Site Visit Completed': return 'bg-purple-100 text-purple-700';
      case 'Negotiation': return 'bg-amber-100 text-amber-700';
      case 'Closed Won': return 'bg-slate-800 text-white';
      case 'Closed Lost': return 'bg-red-100 text-red-700';
      case 'Junk / Invalid': return 'bg-slate-200 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
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
    
    // Date Range Filter
    if (leadsStartDate || leadsEndDate) {
      const leadDate = lead.createdAt ? lead.createdAt.toDate() : new Date();
      // Reset time for comparison
      leadDate.setHours(0, 0, 0, 0);
      
      if (leadsStartDate) {
        const start = new Date(leadsStartDate);
        start.setHours(0, 0, 0, 0);
        if (leadDate < start) matches = false;
      }
      if (leadsEndDate) {
        const end = new Date(leadsEndDate);
        end.setHours(23, 59, 59, 999);
        if (leadDate > end) matches = false;
      }
    }
    
    return matches;
  });

  // Pagination & Bulk Delete Logic
  const totalPages = Math.ceil(filteredLeadsView.length / leadsPerPage);
  const paginatedLeads = filteredLeadsView.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(paginatedLeads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;
    
    try {
      for (const id of selectedLeads) {
        await deleteDoc(doc(db, 'leads', id));
      }
      setSelectedLeads([]);
      setOlderLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
    } catch (error) {
      console.error("Error deleting leads:", error);
      alert("Failed to delete some leads.");
    }
  };

  const toggleExpandLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLeads(prev => 
      prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 shrink-0">
        <img src="/mintage-logo.png" alt="Mintage" className="h-10 w-auto" />
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900 focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-lg tracking-tight">
            <img src="/mintage-logo.png" alt="Mintage" className="h-8 w-auto" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 py-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Workspace
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <button 
            onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              activeTab === 'leads' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Users className="w-5 h-5" />
            Leads
          </button>
          {user?.role === 'client_admin' && (
            <>
              <button 
                onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
                  activeTab === 'team' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <UserCog className="w-5 h-5" />
                Team
              </button>
              <button 
                onClick={() => { setActiveTab('integrations'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
                  activeTab === 'integrations' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-5 h-5" />
                Integrations
              </button>
            </>
          )}
          <button 
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors ${
              activeTab === 'reports' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Reports
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 hidden md:flex">
          <h1 className="text-xl font-semibold tracking-tight">
            {activeTab === 'leads' ? 'Leads Management' : activeTab === 'team' ? 'Team Management' : activeTab === 'reports' ? 'Analytics Dashboard' : 'Integrations'}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <UserCircle2 className="w-4 h-4" />
            {user?.email}
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-auto overflow-y-auto">
          <div className="max-w-7xl mx-auto h-full flex flex-col min-w-[800px] md:min-w-0">
            
            {activeTab === 'leads' ? (
              <>
                {/* Header Actions */}
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">Your Leads</h2>
                    <p className="text-slate-500 text-sm">Manage and track your prospective customers.</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 py-2.5 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Lead
                  </button>
                </div>

                {/* Filters & Controls */}
                <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 shadow-sm mb-6 shrink-0">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 h-10">
                    <input
                      type="date"
                      value={leadsStartDate}
                      onChange={(e) => setLeadsStartDate(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent outline-none"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <input
                      type="date"
                      value={leadsEndDate}
                      onChange={(e) => setLeadsEndDate(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent outline-none"
                    />
                    {(leadsStartDate || leadsEndDate) && (
                      <button 
                        onClick={() => { setLeadsStartDate(''); setLeadsEndDate(''); }}
                        className="ml-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded-md transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 h-10 flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent w-full outline-none"
                    />
                  </div>
                  <select
                    value={leadsViewSourceFilter}
                    onChange={(e) => setLeadsViewSourceFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 h-10 text-slate-600 bg-slate-50 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                  >
                    <option value="All">All Sources</option>
                    {combinedSources.map(sourceName => (
                      <option key={sourceName} value={sourceName}>{sourceName}</option>
                    ))}
                  </select>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 h-10">
                    <button
                      onClick={() => setViewMode('pipeline')}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors h-full ${
                        viewMode === 'pipeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <KanbanSquare className="w-4 h-4" />
                      Pipeline
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors h-full ${
                        viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      Table
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 flex justify-center">
                    <div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No leads found</h3>
                    <p className="text-slate-500 text-sm">Get started by adding a new lead.</p>
                  </div>
                ) : viewMode === 'table' ? (
                  /* Table View */
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                    {selectedLeads.length > 0 && (
                      <div className="bg-red-50 px-6 py-3 border-b border-red-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-red-800">
                          {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-2 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Selected
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
                      <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                            <th className="px-6 py-4 w-10 bg-slate-50">
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                                checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                                onChange={handleSelectAll}
                              />
                            </th>
                            <th className="px-6 py-4 w-10 bg-slate-50"></th>
                            <th className="px-6 py-4 bg-slate-50">Date</th>
                            <th className="px-6 py-4 bg-slate-50">Name</th>
                            <th className="px-6 py-4 bg-slate-50">Phone</th>
                            <th className="px-6 py-4 bg-slate-50">Email</th>
                            <th className="px-6 py-4 bg-slate-50">Source</th>
                            <th className="px-6 py-4 bg-slate-50">Tags</th>
                            <th className="px-6 py-4 bg-slate-50">Status</th>
                            <th className="px-6 py-4 bg-slate-50">Project / Property</th>
                            <th className="px-6 py-4 bg-slate-50">Assigned To</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {paginatedLeads.map((lead) => (
                            <React.Fragment key={lead.id}>
                              <tr 
                                onClick={() => openLeadDetails(lead)}
                                className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                                    checked={selectedLeads.includes(lead.id)}
                                    onChange={(e) => handleSelectLead(lead.id, e as any)}
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => toggleExpandLead(lead.id, e)}>
                                  <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                    {expandedLeads.includes(lead.id) ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  {lead.createdAt ? new Date(lead.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium text-slate-900">
                                    {lead.firstName} {lead.lastName}
                                    {lead.isDuplicate && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 uppercase tracking-wider">
                                        Duplicate
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Phone className="w-3.5 h-3.5" />
                                    {lead.phone || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Mail className="w-3.5 h-3.5" />
                                    {lead.email || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getSourceBadge(lead.source, lead.subSource)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                                    {lead.tags?.map(tag => (
                                      <span key={tag} className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tighter">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(lead.status)}`}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                                    <Home className="w-4 h-4 text-slate-400" />
                                    {lead.projectProperty || '-'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {user?.role === 'client_admin' ? (
                                    <select
                                      value={lead.assignedToId || lead.assignedTo || ''}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleAssignLead(lead.id, e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                                    >
                                      <option value="">Unassigned</option>
                                      {teamMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm text-slate-600">
                                      {lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {expandedLeads.includes(lead.id) && (
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                  <td colSpan={11} className="px-6 py-4">
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                      {lead.formId && (
                                        <div>
                                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Form ID</span>
                                          <span className="text-slate-700 font-mono text-xs">{lead.formId}</span>
                                        </div>
                                      )}
                                      {lead.campaignId && (
                                        <div>
                                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Campaign ID</span>
                                          <span className="text-slate-700 font-mono text-xs">{lead.campaignId}</span>
                                        </div>
                                      )}
                                      {lead.adsetId && (
                                        <div>
                                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Adset ID</span>
                                          <span className="text-slate-700 font-mono text-xs">{lead.adsetId}</span>
                                        </div>
                                      )}
                                      {lead.adId && (
                                        <div>
                                          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ad ID</span>
                                          <span className="text-slate-700 font-mono text-xs">{lead.adId}</span>
                                        </div>
                                      )}
                                      {!lead.formId && !lead.campaignId && !lead.adsetId && !lead.adId && (
                                        <div className="col-span-4 text-slate-500 italic text-xs">
                                          No extended marketing data available for this lead.
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
                        <div className="text-sm text-slate-500">
                          Showing <span className="font-medium text-slate-900">{((currentPage - 1) * leadsPerPage) + 1}</span> to <span className="font-medium text-slate-900">{Math.min(currentPage * leadsPerPage, filteredLeadsView.length)}</span> of <span className="font-medium text-slate-900">{filteredLeadsView.length}</span> leads
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                          >
                            Previous
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-slate-500 px-2">
                              Page {currentPage} of {totalPages}
                            </span>
                          </div>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Pipeline View */
                  <div className="flex-1 overflow-x-auto pb-4">
                    <div className="flex gap-6 h-full min-w-max">
                      {PIPELINE_STATUSES.map(status => (
                        <div key={status} className="w-80 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200/60 overflow-hidden shrink-0">
                          <div className="p-4 border-b border-slate-200/60 bg-slate-100/80 flex items-center justify-between shrink-0">
                            <h3 className="font-semibold text-slate-800">{status}</h3>
                            <span className="bg-white text-slate-500 text-xs font-medium px-2 py-1 rounded-full shadow-sm border border-slate-200">
                              {filteredLeadsView.filter(l => l.status === status).length}
                            </span>
                          </div>
                          <div className="flex-1 p-3 overflow-y-auto space-y-3">
                            {filteredLeadsView.filter(l => l.status === status).map(lead => (
                              <div 
                                key={lead.id} 
                                onClick={() => openLeadDetails(lead)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="font-medium text-slate-900 leading-tight">{lead.firstName} {lead.lastName}</div>
                                  {getSourceBadge(lead.source, lead.subSource)}
                                </div>
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{lead.phone || 'No phone'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Home className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{lead.projectProperty || 'No project'}</span>
                                  </div>
                                </div>
                                {lead.tags && lead.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-4">
                                    {lead.tags.map(tag => (
                                      <span key={tag} className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tighter">
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
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
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
                                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                                    >
                                      <option value="">Unassigned</option>
                                      {teamMembers.map(member => (
                                        <option key={member.id} value={member.id}>{member.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="text-xs text-slate-500 px-1">
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

                {/* Load More Button */}
                {hasMoreLeads && leads.length > 0 && (
                  <div className="mt-6 flex justify-center pb-8">
                    <button
                      onClick={loadMoreLeads}
                      disabled={loadingMoreLeads}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMoreLeads ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
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
                      <h2 className="text-2xl font-semibold tracking-tight mb-1">Your Team</h2>
                      <p className="text-slate-500 text-sm">Manage your sales agents and their access.</p>
                    </div>
                    {user?.role === 'client_admin' && (
                      <button
                        onClick={() => setIsAgentModalOpen(true)}
                        className="flex items-center gap-2 py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add New Agent
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {agents.length === 0 ? (
                      <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No agents found</h3>
                        <p className="text-slate-500 text-sm">Get started by adding a new agent to your team.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                              <th className="px-6 py-4">Name</th>
                              <th className="px-6 py-4">Email</th>
                              <th className="px-6 py-4">Role</th>
                              <th className="px-6 py-4">Date Added</th>
                              <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {agents.map((agent) => (
                              <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {inlineEditingAgentId === agent.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={inlineEditingName}
                                        onChange={(e) => setInlineEditingName(e.target.value)}
                                        className="px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveInlineEdit(agent.id)}
                                        className="text-emerald-600 hover:text-emerald-700 font-medium text-xs"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setInlineEditingAgentId(null)}
                                        className="text-slate-500 hover:text-slate-700 font-medium text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="font-medium text-slate-900">
                                      {agent.name}
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Mail className="w-3.5 h-3.5" />
                                    {agent.email}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                    Agent
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {agent.createdAt ? new Date(agent.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleEditAgent(agent)}
                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAgent(agent.id)}
                                    className="text-red-600 hover:text-red-900"
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
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight mb-1">Lead Auto-Assignment Rules</h2>
                        <p className="text-slate-500 text-sm">Automatically assign incoming leads to specific agents based on their source.</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-6 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-sm font-semibold text-slate-900 mb-4">Create New Rule</h3>
                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Lead Source</label>
                            <select
                              value={newRuleSource}
                              onChange={(e) => setNewRuleSource(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white shadow-sm focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                            >
                              <option value="">Select a source...</option>
                              {leadSources.map(source => (
                                <option key={source.id} value={source.name}>{source.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 w-full">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Assign To Agent</label>
                            <select
                              value={newRuleAgentId}
                              onChange={(e) => setNewRuleAgentId(e.target.value)}
                              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white shadow-sm focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
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
                            className="w-full sm:w-auto flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="p-8 text-center text-slate-500 text-sm">
                          No auto-assignment rules configured yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                <th className="px-6 py-4">Lead Source</th>
                                <th className="px-6 py-4">Assigned Agent</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {assignmentRules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-slate-900 flex items-center gap-2">
                                      <Globe className="w-4 h-4 text-slate-400" />
                                      {rule.sourceName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2 text-slate-600">
                                      <UserCircle2 className="w-4 h-4 text-slate-400" />
                                      {rule.agentName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <button
                                      onClick={() => handleDeleteRule(rule.id)}
                                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
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
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">Analytics Dashboard</h2>
                    <p className="text-slate-500 text-sm">Overview of your lead performance and team metrics.</p>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 px-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent cursor-pointer"
                      />
                      <span className="text-slate-400">-</span>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent cursor-pointer"
                      />
                    </div>
                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                    <select 
                      value={leadSourceFilter}
                      onChange={(e) => setLeadSourceFilter(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent cursor-pointer"
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
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500">Total Leads</h3>
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">{filteredLeads.length}</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500">New Leads</h3>
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <Zap className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">
                      {filteredLeads.filter(l => l.status === 'New').length}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500">Site Visits</h3>
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Building2 className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">
                      {filteredLeads.filter(l => l.status === 'Site Visit').length}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500">Closed Won</h3>
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">
                      {filteredLeads.filter(l => l.status === 'Closed Won').length}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500">Duplicate Leads</h3>
                      <div className="p-2 bg-red-50 rounded-lg text-red-600">
                        <XCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">
                      {filteredLeads.filter(l => l.isDuplicate).length}
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-6">Leads by Status</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dynamicStatusData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dx={-10} />
                          <Tooltip 
                            cursor={{ fill: '#f3f4f6' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-6">Leads by Source</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dynamicSourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                          >
                            {dynamicSourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {dynamicSourceData.map((source, index) => (
                          <div key={source.name} className="flex items-center gap-2 text-sm text-slate-600">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            {source.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent Performance Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900">Agent Performance</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                          <th className="px-6 py-4">Agent Name</th>
                          <th className="px-6 py-4">Total Assigned</th>
                          <th className="px-6 py-4">New</th>
                          <th className="px-6 py-4">In Progress</th>
                          <th className="px-6 py-4">Closed Won</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {teamMembers.map(agent => {
                          const agentLeads = filteredLeads.filter(l => (l.assignedToId || l.assignedTo) === agent.id);
                          return (
                            <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{agent.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {agentLeads.length}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {agentLeads.filter(l => l.status === 'New').length}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {agentLeads.filter(l => ['Contacted', 'Site Visit', 'Negotiation'].includes(l.status)).length}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                {agentLeads.filter(l => l.status === 'Closed Won').length}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Unassigned row */}
                        <tr className="hover:bg-slate-50/50 transition-colors bg-slate-50/30">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-slate-500 italic">Unassigned</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo)).length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo) && l.status === 'New').length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                            {filteredLeads.filter(l => !(l.assignedToId || l.assignedTo) && ['Contacted', 'Site Visit', 'Negotiation'].includes(l.status)).length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500">
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
              <div className="max-w-3xl">
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold tracking-tight mb-1">External Integrations</h2>
                  <p className="text-slate-500 text-sm">Connect your Facebook Ads, Google Ads, or Website to capture leads automatically.</p>
                </div>

                <div className="space-y-6">
                  {/* Meta / Facebook Ads Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <Facebook className="w-8 h-8" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-slate-900">Meta / Facebook Ads</h3>
                              {isLoadingLinkedPages ? (
                                <div className="h-5 w-20 bg-slate-200 rounded-full animate-pulse"></div>
                              ) : linkedPages.length > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                  Connected
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                  Not Connected
                                </span>
                              )}
                            </div>
                            <p className="text-slate-500 text-sm">
                              Automatically sync leads from your Facebook Lead Ads directly into your CRM.
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <button
                            onClick={handleConnectFacebook}
                            disabled={isLoadingFb}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isLoadingFb ? 'Connecting...' : 'Connect Facebook'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Linked Pages List */}
                      {linkedPages.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                          <h4 className="text-sm font-semibold text-slate-900 mb-4">Connected Pages</h4>
                          <div className="space-y-3">
                            {linkedPages.map(page => (
                              <div key={page.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{page.pageName}</p>
                                  <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {page.pageId}</p>
                                </div>
                                <button
                                  onClick={() => handleDisconnectPage(page.id)}
                                  className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                  Disconnect
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Available Pages to Link */}
                      {fbPages.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                          <h4 className="text-sm font-semibold text-slate-900 mb-4">Available Pages to Link</h4>
                          <div className="space-y-3">
                            {fbPages.map(page => {
                              const isLinked = linkedPages.some(lp => lp.pageId === page.id);
                              return (
                                <div key={page.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{page.name}</p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {page.id}</p>
                                  </div>
                                  <button
                                    onClick={() => handleLinkPage(page)}
                                    disabled={isLinked}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                      isLinked 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                    }`}
                                  >
                                    {isLinked ? 'Linked' : 'Link Page'}
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
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 sm:p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Your Unique Webhook URL</h3>
                          <p className="text-slate-500 text-sm">Use this URL to send leads from external platforms.</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                        <code className="text-xs text-slate-600 break-all font-mono">
                          {webhookUrl}
                        </code>
                        <button
                          onClick={handleCopy}
                          className="shrink-0 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Copy to clipboard"
                        >
                          {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Facebook className="w-4 h-4 text-blue-600" />
                            Facebook Ads
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Connect via Zapier or Pabbly Connect using this webhook URL to capture leads from Facebook Lead Forms.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Search className="w-4 h-4 text-amber-500" />
                            Google Ads
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Paste this URL into your Google Ads Lead Form extension settings to receive leads in real-time.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Globe className="w-4 h-4 text-emerald-600" />
                            Website Forms
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Send a POST request from your website's contact form directly to this endpoint.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export Leads (Outbound Webhook) Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 sm:p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <Globe className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Export Leads (Outbound Webhook)</h3>
                          <p className="text-slate-500 text-sm">Send incoming leads to external tools like Google Sheets via Pabbly or Make.com.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                          <input
                            type="url"
                            value={outboundWebhookUrl}
                            onChange={(e) => setOutboundWebhookUrl(e.target.value)}
                            placeholder="https://hook.us1.make.com/..."
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleSaveOutboundWebhook}
                            disabled={isSavingOutboundWebhook}
                            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            {isSavingOutboundWebhook ? 'Saving...' : 'Save Configuration'}
                          </button>
                          <button
                            onClick={handleTestOutboundWebhook}
                            disabled={isTestingOutboundWebhook || !outboundWebhookUrl}
                            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                          >
                            {isTestingOutboundWebhook ? 'Sending...' : 'Send Test Lead'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documentation Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Payload Format</h3>
                    <p className="text-sm text-slate-500 mb-4">Your external source should send a JSON POST request with the following fields:</p>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto relative">
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
                            "message": "I am interested in a 4BHK villa.",
                            "utm_source": "google",
                            "utm_medium": "cpc",
                            "utm_campaign": "summer_monsoon_sale",
                            "utm_term": "luxury villas in hyderabad",
                            "utm_content": "banner_ad_v2"
                          };
                          navigator.clipboard.writeText(JSON.stringify(payloadObject, null, 2));
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1 px-2 rounded transition-colors"
                      >
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <pre className="text-xs text-emerald-400 font-mono">
{`{
  "firstName": "Ravi",
  "lastName": "Kumar",
  "email": "ravi.kumar@example.com",
  "phone": "+919876543210",
  "project": "Neopolis Luxury Villas",
  "source": "WEBSITE",
  "subSource": "Contact Us Form",
  "message": "I am interested in a 4BHK villa.",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_monsoon_sale",
  "utm_term": "luxury villas in hyderabad",
  "utm_content": "banner_ad_v2"
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

      {/* Modals */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 shrink-0">
              <h3 className="text-lg font-semibold text-slate-900">Add New Lead</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form id="add-lead-form" onSubmit={handleAddLead} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project / Property</label>
                <input
                  type="text"
                  value={projectProperty}
                  onChange={(e) => setProjectProperty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                  placeholder="e.g. Sunset Villas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
                >
                  {PIPELINE_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
                >
                  {leadSources.length === 0 && <option value="Manual">Manual</option>}
                  {leadSources.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Source</label>
                <select
                  value={subSource}
                  onChange={(e) => setSubSource(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
                >
                  <option value="">None</option>
                  {leadSubSources.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              {user?.role === 'client_admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
              )}

              </form>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-lead-form"
                  disabled={addingLead}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 flex justify-center items-center"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Add New Agent</h3>
              <button 
                onClick={() => {
                  setIsAgentModalOpen(false);
                  setAgentName('');
                  setAgentEmail('');
                  setAgentPassword('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAgent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={agentPassword}
                  onChange={(e) => setAgentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                  minLength={6}
                />
                <p className="mt-1 text-xs text-slate-500">Must be at least 6 characters.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAgentModalOpen(false);
                    setAgentName('');
                    setAgentEmail('');
                    setAgentPassword('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingAgent}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 flex justify-center items-center"
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

    </div>
  );
}

