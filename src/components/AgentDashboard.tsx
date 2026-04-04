import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, onSnapshot, orderBy, limit, startAfter, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, LogOut, LayoutDashboard, UserCircle2, Mail, Calendar, Phone, Home, X, Search, Zap, List, KanbanSquare, ChevronDown, ChevronUp, Menu, MessageSquare, TrendingUp, Activity, Target, Clock, Bell, AlertCircle, CheckCircle2, Info, XCircle, BellRing, CheckSquare, Check, Globe, Facebook } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
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

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

export default function AgentDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('pipeline');
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [lastVisibleLead, setLastVisibleLead] = useState<any>(null);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);
  const [realTimeLeads, setRealTimeLeads] = useState<Lead[]>([]);
  const [olderLeads, setOlderLeads] = useState<Lead[]>([]);

  // Dialog State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean; type: 'alert' | 'confirm' | 'success' | 'error'; title: string; message: string; onConfirm?: () => void; onCloseAction?: () => void;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showDialog = (type: 'alert' | 'confirm' | 'success' | 'error', title: string, message: string, onConfirm?: () => void, onCloseAction?: () => void) => {
    setDialogState({ isOpen: true, type, title, message, onConfirm, onCloseAction });
  };

  const closeDialog = () => {
    if (dialogState.onCloseAction && dialogState.type !== 'confirm') dialogState.onCloseAction();
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  // Notifications
  const isInitialMount = useRef(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [toastData, setToastData] = useState<{show: boolean, title: string, message: string, color?: string} | null>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setIsNotificationOpen(false);
  };

  // Only show leads assigned to THIS agent
  const leads = useMemo(() => {
    const combined = [...realTimeLeads, ...olderLeads];
    const uniqueLeads = Array.from(new Map(combined.map(item => [item.id, item])).values());
    return uniqueLeads.filter(lead => lead.assignedToId === user?.uid || lead.assignedTo === user?.uid);
  }, [realTimeLeads, olderLeads, user?.uid]);

  // Task Engine Scanner
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const alertedTasks = useRef<Set<string>>(new Set());
// ✨ LEVEL 5 SECURITY: 15-Minute Inactivity Auto-Logout ✨
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => { 
        showDialog('alert', 'Session Expired', 'Your session has expired due to 15 minutes of inactivity.', undefined, () => { logout(); }); 
      }, 900000); // 900000ms = 15 minutes
    };
    
    resetTimer();
    
    // Listen for any sign that the user is still at their desk
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();
    
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    
    // Cleanup listeners when component unmounts
    return () => { 
      if (timeoutRef.current) clearTimeout(timeoutRef.current); 
      events.forEach(event => window.removeEventListener(event, handleActivity)); 
    };
  }, [logout]);
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

// ✨ LEVEL 5 FIX: Auto-Hydrating Lead Fetcher with Strict Gatekeeper & Index Bypass
  useEffect(() => {
    // 1. CRITICAL: Wait until Firebase definitively loads BOTH the clientId AND the uid!
    if (!user?.clientId || !user?.uid) return; 

    setLoading(true);
    
    // 2. Query bypassed index requirement (assignedTo removed, filtered by useMemo above)
    const q = query(
      collection(db, 'leads'),
      where('clientId', '==', user.clientId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: Lead[] = [];
      snapshot.forEach((doc) => fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead));
      setRealTimeLeads(fetchedLeads);

      if (!isInitialMount.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newLead = change.doc.data() as Lead;
            // Level 5 Notification Fix: Only toast if it's assigned to THIS agent!
            if (newLead.assignedTo === user.uid || newLead.assignedToId === user.uid) {
              const leadName = `${newLead.firstName} ${newLead.lastName === 'Lead' ? '' : newLead.lastName}`.trim() || 'Someone';
              setToastData({ show: true, title: "New Lead Assigned!", message: `${leadName} was just assigned to you.`, color: "from-[#74ebd5] to-[#9face6]" });
              setNotifications(prev => [{ id: change.doc.id + Date.now(), leadId: change.doc.id, title: "New Lead Assigned", message: `${leadName} - ${newLead.projectProperty || 'General Inquiry'}`, time: new Date(), isRead: false }, ...prev].slice(0, 30));
              setTimeout(() => setToastData(null), 5000);
            }
          }
        });
      }
      
      if (isInitialMount.current) {
        isInitialMount.current = false;
        if (!lastVisibleLead && snapshot.docs.length > 0) {
          setLastVisibleLead(snapshot.docs[snapshot.docs.length - 1]);
          setHasMoreLeads(snapshot.docs.length === 50);
        }
        setLoading(false);
      }
    }, (error) => {
      console.error("Error in onSnapshot:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.clientId, user?.uid]);

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date().getTime();
      
      pendingTasks.forEach(task => {
        const dueTime = new Date(task.dueDate).getTime();
        const timeDiff = dueTime - now;
        
        if (timeDiff <= 120000 && timeDiff > -86400000 && !alertedTasks.current.has(task.id)) {
          const isOverdue = timeDiff < 0;
          const title = isOverdue ? "Task Overdue!" : "Task Due Soon!";
          const bodyMsg = `${task.type} for ${task.leadName}`;

          setToastData({
            show: true,
            title: title,
            message: bodyMsg,
            color: isOverdue ? "from-red-500 to-rose-600" : "from-amber-400 to-orange-500"
          });
          
          notificationSound.play().catch(e => console.log("Audio auto-play blocked.", e));

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Mintage CRM: ${title}`, { body: bodyMsg, icon: '/mintage-logo.png' });
          }
          
          setNotifications(prev => {
            if (prev.some(n => n.id.includes(task.id))) return prev;
            return [{
              id: `task-${task.id}-${Date.now()}`, leadId: task.leadId, title: isOverdue ? `Overdue: ${task.type}` : `Due Soon: ${task.type}`, message: `Action required for ${task.leadName}.`, time: new Date(), isRead: false
            }, ...prev].slice(0, 30);
          });

          alertedTasks.current.add(task.id);
          setTimeout(() => setToastData(null), 8000); 
        }
      });
    };

    checkTasks(); 
    const interval = setInterval(checkTasks, 10000); 
    return () => clearInterval(interval);
  }, [pendingTasks]);

  const completeTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'reminders', taskId), { status: 'Completed' });
      setToastData({
        show: true, title: "Task Completed", message: "Great job checking that off!", color: "from-emerald-400 to-teal-500"
      });
      setTimeout(() => setToastData(null), 3000);
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    let todaysLeadsCount = 0;
    let activePipelineCount = 0;
    let closedWonCount = 0;
    const trendDataMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      trendDataMap.set(d.toLocaleDateString('en-US', { weekday: 'short' }), 0);
    }

    leads.forEach(lead => {
      const leadDate = lead.createdAt?.toDate();
      if (!leadDate) return;

      if (lead.status !== 'Closed Lost' && lead.status !== 'Junk / Invalid') activePipelineCount++;
      if (lead.status === 'Closed Won') closedWonCount++;
      if (leadDate >= today) todaysLeadsCount++;
      if (leadDate >= sevenDaysAgo) {
        const dayStr = leadDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (trendDataMap.has(dayStr)) trendDataMap.set(dayStr, trendDataMap.get(dayStr)! + 1);
      }
    });

    const trendChart = Array.from(trendDataMap.entries()).map(([name, count]) => ({ name, count }));
    const conversionRate = leads.length > 0 ? Math.round((closedWonCount / leads.length) * 100) : 0;

    return { todaysLeadsCount, activePipelineCount, conversionRate, trendChart };
  }, [leads]);

  // Lead Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectProperty, setProjectProperty] = useState('');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('Manual');
  const [subSource, setSubSource] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All');
  const [leadsProjectFilter, setLeadsProjectFilter] = useState('All');
  const [leadsStartDate, setLeadsStartDate] = useState('');
  const [leadsEndDate, setLeadsEndDate] = useState('');
  const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;

  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);
// ✨ LEVEL 5 FIX: Smart Project Extractor (Finds all unique projects across your leads)
  const uniqueProjects = useMemo(() => {
    const projSet = new Set<string>(); 
    leads.forEach(lead => { 
      let cleanProjectName = lead.projectProperty;
      
      // Look inside form answers just in case Meta buried the project name there
      if (lead.customAnswers) {
        const projectKey = Object.keys(lead.customAnswers).find(k => k.toLowerCase().includes('project'));
        if (projectKey && lead.customAnswers[projectKey]) {
          cleanProjectName = lead.customAnswers[projectKey];
        }
      }
      
      if (cleanProjectName && cleanProjectName.trim() !== '') {
        projSet.add(cleanProjectName.trim()); 
      }
    });
    return Array.from(projSet).sort((a, b) => a.localeCompare(b));
  }, [leads]);
  const loadMoreLeads = async () => {
    if (!user?.clientId || !lastVisibleLead || loadingMoreLeads || !hasMoreLeads) return;
    setLoadingMoreLeads(true);
    try {
      // ✨ LEVEL 5 FIX: Match the bypassed index query
      const q = query(
        collection(db, 'leads'), 
        where('clientId', '==', user.clientId), 
        orderBy('createdAt', 'desc'), 
        startAfter(lastVisibleLead), 
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const fetchedLeads: Lead[] = [];
      querySnapshot.forEach((doc) => fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead));
      if (fetchedLeads.length > 0) {
        setOlderLeads(prev => [...prev, ...fetchedLeads]);
        setLastVisibleLead(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMoreLeads(fetchedLeads.length === 50);
      } else { setHasMoreLeads(false); }
    } catch (error) { console.error("Error loading more leads:", error); } finally { setLoadingMoreLeads(false); }
  };

  useEffect(() => {
    const fetchSources = async () => {
      if (!user?.clientId) return;
      try {
        const fetched: {id: string, name: string}[] = [];
        const q = query(collection(db, 'lead_sources'), where('clientId', '==', user.clientId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => fetched.push({ id: doc.id, name: doc.data().name }));

        const globalQ = collection(db, 'global_lead_sources');
        const globalSnapshot = await getDocs(globalQ);
        globalSnapshot.forEach(doc => {
          if (!fetched.some(s => s.name.toLowerCase() === doc.data().name.toLowerCase())) {
            fetched.push({ id: doc.id, name: doc.data().name });
          }
        });
        fetched.sort((a, b) => a.name.localeCompare(b.name));
        setLeadSources(fetched);

        const qSub = query(collection(db, 'lead_sub_sources'), where('clientId', '==', user.clientId));
        const snapshotSub = await getDocs(qSub);
        const fetchedSub: {id: string, name: string}[] = [];
        snapshotSub.forEach(doc => fetchedSub.push({ id: doc.id, name: doc.data().name }));
        fetchedSub.sort((a, b) => a.name.localeCompare(b.name));
        setLeadSubSources(fetchedSub);
      } catch (error) { console.error("Error fetching lead sources:", error); }
    };

    const fetchTeam = async () => {
      if (!user?.clientId) return;
      try {
        const q = query(collection(db, 'users'), where('clientId', '==', user.clientId));
        const snapshot = await getDocs(q);
        const fetchedTeam: {id: string, name: string}[] = [];
        snapshot.forEach(doc => fetchedTeam.push({ id: doc.id, name: doc.data().name || doc.data().email }));
        setTeamMembers(fetchedTeam);
      } catch (error) { console.error("Error fetching team members:", error); }
    };

    fetchSources();
    fetchTeam();
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
      await addDoc(collection(db, 'leads'), {
        clientId: user.clientId, firstName, lastName, email, phone, projectProperty, status,
        source: source || 'Manual', subSource: subSource || '',
        assignedTo: user.uid, assignedToId: user.uid, assignedToName: user.email?.split('@')[0], 
        createdAt: serverTimestamp()
      });
      
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setProjectProperty(''); setStatus('New'); setSubSource('');
      setIsModalOpen(false);
      showDialog('success', 'Lead Added', 'Your lead was added successfully.');
    } catch (error) {
      console.error("Error adding lead:", error);
      showDialog('error', 'Error', 'Failed to add lead.');
    } finally { setAddingLead(false); }
  };

 // ✨ LEVEL 5 FIX: Auto-Logging Status Changes (Agent)
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const systemNote = {
        text: `System: Status changed to ${newStatus}`,
        authorEmail: user?.email || 'System',
        authorRole: 'System',
        timestamp: new Date().toISOString()
      };

      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus, notes: [...(lead.notes || []), systemNote] } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, status: newStatus, notes: [...(lead.notes || []), systemNote] } : lead));
      
      await updateDoc(doc(db, 'leads', leadId), { 
        status: newStatus,
        notes: arrayUnion(systemNote)
      });
    } catch (error) { console.error("Error updating status:", error); }
  };

  const filteredLeadsView = leads.filter(lead => {
    let matches = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      if (!fullName.includes(query) && !lead.email?.toLowerCase().includes(query) && !lead.phone?.toLowerCase().includes(query)) matches = false;
    }
    if (leadsViewSourceFilter !== 'All') { if (lead.source !== leadsViewSourceFilter) matches = false; }
    // ✨ LEVEL 5 FIX: Apply the Project Filter
    if (leadsProjectFilter !== 'All') {
      let leadProject = lead.projectProperty;
      if (lead.customAnswers) {
        const projectKey = Object.keys(lead.customAnswers).find(k => k.toLowerCase().includes('project'));
        if (projectKey && lead.customAnswers[projectKey]) {
          leadProject = lead.customAnswers[projectKey];
        }
      }
      if (leadProject?.trim() !== leadsProjectFilter) matches = false;
    }
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

  const handleSelectLead = (id: string, e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]);
  };

  const toggleExpandLead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]);
  };

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let icon = <Globe className="w-3 h-3" />;
    let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
    let label = source || 'Manual';

    if (s.includes('facebook')) { icon = <Facebook className="w-3 h-3" />; colorClass = "bg-[#74ebd5]/10 text-[#4cb8a5] border-[#74ebd5]/30"; } 
    else if (s.includes('google')) { icon = <Search className="w-3 h-3" />; colorClass = "bg-amber-50 text-amber-700 border-amber-200"; } 

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
        {icon} {label} {subSource ? `/ ${subSource}` : ''}
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'bg-[#74ebd5]/10 text-[#4cb8a5] border-[#74ebd5]/30';
      case 'Attempted Contact': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Connected / Warm': return 'bg-[#9face6]/10 text-[#7a8ece] border-[#9face6]/30';
      case 'Site Visit Scheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Site Visit Completed': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Negotiation': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Closed Won': return 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white border-transparent shadow-md';
      case 'Closed Lost': return 'bg-red-50 text-red-700 border-red-200';
      case 'Junk / Invalid': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };
// ✨ LEVEL 5 FIX: Enterprise Kanban Color Mapping
  const COLUMN_STYLES: Record<string, { bg: string, text: string, border: string, dot: string }> = {
    'New': { bg: 'bg-blue-50/80', text: 'text-blue-700', border: 'border-blue-200/50', dot: 'bg-blue-500' },
    'Attempted Contact': { bg: 'bg-indigo-50/80', text: 'text-indigo-700', border: 'border-indigo-200/50', dot: 'bg-indigo-500' },
    'Connected / Warm': { bg: 'bg-purple-50/80', text: 'text-purple-700', border: 'border-purple-200/50', dot: 'bg-purple-500' },
    'Site Visit Scheduled': { bg: 'bg-pink-50/80', text: 'text-pink-700', border: 'border-pink-200/50', dot: 'bg-pink-500' },
    'Site Visit Completed': { bg: 'bg-rose-50/80', text: 'text-rose-700', border: 'border-rose-200/50', dot: 'bg-rose-500' },
    'Negotiation': { bg: 'bg-amber-50/80', text: 'text-amber-700', border: 'border-amber-200/50', dot: 'bg-amber-500' },
    'Closed Won': { bg: 'bg-emerald-50/80', text: 'text-emerald-700', border: 'border-emerald-200/50', dot: 'bg-emerald-500' },
    'Closed Lost': { bg: 'bg-red-50/80', text: 'text-red-700', border: 'border-red-200/50', dot: 'bg-red-500' },
    'Junk / Invalid': { bg: 'bg-slate-100/80', text: 'text-slate-600', border: 'border-slate-200/50', dot: 'bg-slate-400' },
  };
  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      
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
                <button onClick={closeDialog} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm">
                  Cancel
                </button>
              )}
              <button onClick={() => { if (dialogState.type === 'confirm' && dialogState.onConfirm) dialogState.onConfirm(); else if (dialogState.onCloseAction) dialogState.onCloseAction(); closeDialog(); }}
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

      {toastData && toastData.show && (
        <div className="fixed top-6 right-6 z-[9999] bg-white/90 backdrop-blur-xl border border-[#74ebd5]/50 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-5 fade-in duration-300 flex items-start gap-4 w-80">
          <div className={`p-2.5 bg-gradient-to-br ${toastData.color || 'from-[#74ebd5] to-[#9face6]'} rounded-xl text-white shadow-md shrink-0`}>
             <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 pt-0.5">
             <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{toastData.title}</h4>
             <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{toastData.message}</p>
          </div>
          <button onClick={() => setToastData(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Enterprise Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#74ebd5]/40 to-teal-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#9face6]/40 to-indigo-50/40 blur-3xl opacity-70 mix-blend-multiply" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-purple-100/30 to-pink-50/30 blur-3xl opacity-70 mix-blend-multiply" />
      </div>

      <div className="md:hidden relative z-20 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white p-4 shrink-0 shadow-sm">
        <img src="/mintage-logo.png" alt="Mintage" className="h-14 w-auto" />
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="relative p-2 text-slate-600">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-50/80 backdrop-blur-2xl border-r border-white/80 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.03)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-24 flex items-center justify-between px-6 border-b border-slate-100/50 bg-white/40">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg tracking-tight">
            <img src="/mintage-logo.png" alt="Mintage" className="h-16 w-auto drop-shadow-sm" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-6 text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-500 uppercase tracking-[0.2em]">
          Agent Portal
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
            My Dashboard
          </button>

          <button 
            onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${
              activeTab === 'leads' 
                ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' 
                : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'
            }`}
          >
            <Users className="w-5 h-5" />
            My Leads
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
            {activeTab === 'dashboard' ? 'My Dashboard' : 'My Leads Workspace'}
          </h1>
          <div className="flex items-center gap-6">
            
            {/* ✨ NOTIFICATION BELL DROPDOWN ✨ */}
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className={`p-2.5 rounded-xl transition-all relative ${isNotificationOpen ? 'bg-white shadow-sm text-[#50bdaf]' : 'bg-white/60 hover:bg-white text-slate-500 hover:text-[#50bdaf]'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {isNotificationOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-80 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-[10px] font-bold text-[#50bdaf] hover:text-[#419c90] uppercase tracking-wider">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs font-medium">No new notifications.</div>
                      ) : (
                        notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              const targetLead = leads.find(l => l.id === notif.leadId);
                              if (targetLead) {
                                openLeadDetails(targetLead);
                                setIsNotificationOpen(false);
                              }
                            }}
                            className={`p-4 border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors ${!notif.isRead ? 'bg-[#74ebd5]/5' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-slate-800">{notif.title}</span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {notif.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 line-clamp-2">{notif.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white/80 border border-white px-4 py-2 rounded-full shadow-sm">
              <UserCircle2 className="w-4 h-4 text-[#74ebd5]" />
              {user?.email}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-auto overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full flex flex-col min-w-[800px] md:min-w-0">
            
            {activeTab === 'dashboard' ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">
                    Welcome back, {user?.email?.split('@')[0]}
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">Here is what is happening with your pipeline today.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">My Total Leads</h3>
                      <div className="p-2.5 bg-[#74ebd5]/15 rounded-xl text-[#50bdaf] shadow-inner">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <p className="text-4xl font-black text-slate-800">{leads.length}</p>
                    </div>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">New / Untouched</h3>
                      <div className="p-2.5 bg-[#9face6]/15 rounded-xl text-[#7b8ed3] shadow-inner">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">
                      {leads.filter(l => l.status === 'New').length}
                    </p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Pipeline</h3>
                      <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 shadow-inner">
                        <Target className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{dashboardStats.activePipelineCount}</p>
                  </div>

                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">My Win Rate</h3>
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shadow-inner">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-4xl font-black text-slate-800">{dashboardStats.conversionRate}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recent Leads Widget */}
                  <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden flex flex-col">
                    <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-slate-800">Recently Assigned Leads</h3>
                      <button 
                        onClick={() => setActiveTab('leads')}
                        className="text-xs font-bold text-[#50bdaf] hover:text-[#419c90] bg-[#74ebd5]/10 hover:bg-[#74ebd5]/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View All
                      </button>
                    </div>
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                      {leads.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                              <th className="px-6 py-4">Lead Name</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/60">
                            {leads.slice(0, 5).map(lead => (
                              <tr key={lead.id} className="hover:bg-white/60 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-bold text-slate-800 text-sm">
                                    {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
                                  </div>
                                  <div className="text-xs text-slate-500">{lead.phone || lead.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold border ${getStatusBadgeClass(lead.status)}`}>
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <button 
                                    onClick={() => openLeadDetails(lead)}
                                    className="text-xs font-bold text-slate-600 hover:text-[#50bdaf] bg-white border border-slate-200 hover:border-[#74ebd5] shadow-sm px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-12 text-center text-slate-400 font-medium text-sm">
                          No leads assigned to you yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Priority Tasks Widget */}
                  <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden flex flex-col">
                    <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <BellRing className="w-5 h-5 text-amber-500" /> My Priority Tasks
                      </h3>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">
                        {pendingTasks.length} Pending
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/30">
                      {pendingTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                          <CheckSquare className="w-10 h-10 text-slate-300 mb-3" />
                          <p className="text-sm font-bold text-slate-500">You're all caught up!</p>
                          <p className="text-xs text-slate-400 mt-1">Schedule new tasks from inside a Lead's profile.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingTasks.map(task => {
                            const isOverdue = new Date(task.dueDate) < new Date();
                            return (
                              <div 
                                key={task.id} 
                                onClick={() => {
                                  const leadToOpen = leads.find(l => l.id === task.leadId);
                                  if (leadToOpen) openLeadDetails(leadToOpen);
                                }}
                                className="group flex items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer relative overflow-hidden"
                              >
                                {isOverdue && <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500"></div>}
                                <div>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded border border-slate-200">
                                      {task.type}
                                    </span>
                                    <span className={`text-xs font-bold flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                                      <Clock className="w-3 h-3" />
                                      {isOverdue ? 'Overdue: ' : ''}{new Date(task.dueDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {task.leadName}
                                  </p>
                                  {task.note && <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1">{task.note}</p>}
                                </div>
                                <button 
                                  onClick={(e) => completeTask(e, task.id)}
                                  className="p-2 bg-slate-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl border border-slate-200 hover:border-emerald-500 transition-all shadow-sm shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100"
                                  title="Mark as Completed"
                                >
                                  <Check className="w-4 h-4" />
                                  <span className="text-[9px] font-bold">Done</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-8 shrink-0">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">My Leads</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage your personal pipeline.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-[#74ebd5]/30 text-sm font-bold text-white bg-gradient-to-r from-[#74ebd5] to-[#9face6] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#74ebd5] transition-all hover:-translate-y-0.5 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Lead
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] mb-8 shrink-0">
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-4 py-1.5 h-10 flex-1 min-w-[200px] shadow-sm focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search your leads..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent w-full outline-none placeholder:font-normal"
                    />
                  </div>
                  <select
                    value={leadsViewSourceFilter}
                    onChange={(e) => setLeadsViewSourceFilter(e.target.value)}
                    className="text-sm font-medium border border-slate-100 rounded-xl px-4 py-1.5 h-10 text-slate-600 bg-white/80 shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer"
                  >
                    <option value="All">All Sources</option>
                    {leadSources.map(source => (
                      <option key={source.id} value={source.name}>{source.name}</option>
                    ))}
                  </select>
                  {/* ✨ LEVEL 5 FIX: The Dynamic Project Dropdown */}
                  <select
                    value={leadsProjectFilter}
                    onChange={(e) => { setLeadsProjectFilter(e.target.value); setCurrentPage(1); }}
                    className="text-sm font-medium border border-slate-100 rounded-xl px-4 py-1.5 h-10 text-slate-600 bg-white/80 shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="All">All Projects</option>
                    {uniqueProjects.map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
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
                    <div className="w-10 h-10 border-4 border-[#74ebd5]/30 border-t-[#74ebd5] rounded-full animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] p-16 text-center flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                      <Users className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No leads found</h3>
                    <p className="text-slate-500 text-sm max-w-sm">Your pipeline is empty.</p>
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden shrink-0">
                    <div className="overflow-x-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                     <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-xl shadow-sm">
                          <tr className="text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200/60">
                            <th className="px-6 py-4 w-10">
                              <input 
                                type="checkbox" 
                                className="rounded-md border-slate-300 text-[#74ebd5] focus:ring-[#74ebd5] cursor-pointer w-4 h-4"
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 bg-transparent">
                          {paginatedLeads.map((lead) => {
                            // ✨ Extract initials and colors
                            const leadInitials = (lead.firstName.charAt(0) + (lead.lastName === 'Lead' ? '' : lead.lastName.charAt(0) || '')).toUpperCase() || 'L';
                            const colStyle = COLUMN_STYLES[lead.status] || COLUMN_STYLES['New'];

                            return (
                              <React.Fragment key={lead.id}>
                                <tr 
                                  onClick={() => openLeadDetails(lead)}
                                  className="hover:bg-white/80 transition-all duration-200 cursor-pointer group relative"
                                >
                                  {/* ✨ LEVEL 5 FIX: Moved the hover accent INSIDE the first cell so it doesn't break the table grid! */}
                                  <td className="px-6 py-5 whitespace-nowrap relative" onClick={(e) => e.stopPropagation()}>
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#74ebd5] to-[#9face6] opacity-0 group-hover:opacity-100 transition-opacity rounded-r-full"></div>
                                    <input 
                                      type="checkbox" 
                                      className="rounded-md border-slate-300 text-[#74ebd5] focus:ring-[#74ebd5] cursor-pointer w-4 h-4 ml-1"
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
                                  
                                  <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                                    {lead.createdAt ? new Date(lead.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                                  </td>
                                  
                                  {/* ✨ LEVEL 5 UI: Table Avatars & Crisp Badges */}
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border shadow-sm ${colStyle.bg} ${colStyle.text} ${colStyle.border}`}>
                                        {leadInitials}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-extrabold text-slate-800 text-sm group-hover:text-[#50bdaf] transition-colors">
                                          {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
                                        </span>
                                        {lead.isDuplicate && (
                                          <span className="w-fit mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-widest shadow-sm">
                                            Duplicate
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  
                                  {/* ✨ LEVEL 5 UI: Glowing Icons */}
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex flex-col gap-1.5 text-xs text-slate-500 font-medium">
                                      <div className="flex items-center gap-2 group-hover:text-slate-700 transition-colors">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#50bdaf] transition-colors" />{lead.phone || '-'}
                                      </div>
                                      {lead.email && (
                                        <div className="flex items-center gap-2 group-hover:text-slate-700 transition-colors">
                                          <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#50bdaf] transition-colors" />{lead.email}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    {getSourceBadge(lead.source, lead.subSource)}
                                  </td>
                                  
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-1.5 max-w-[160px]">
                                      {lead.tags?.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-50 text-slate-600 border border-slate-200 shadow-sm uppercase tracking-wider group-hover:bg-white transition-colors">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest font-black border shadow-sm ${colStyle.bg} ${colStyle.text} ${colStyle.border}`}>
                                      {lead.status}
                                    </span>
                                  </td>
                                  
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="flex items-center gap-2 text-slate-600 text-sm font-medium group-hover:text-slate-900 transition-colors">
                                      <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-[#74ebd5]/10 transition-colors">
                                        <Home className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#50bdaf] transition-colors" />
                                      </div>
                                      {lead.projectProperty || '-'}
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Expanded Row Content */}
                                {expandedLeads.includes(lead.id) && (
                                  <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200/50 shadow-inner">
                                    <td colSpan={9} className="px-6 py-5">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm bg-white/80 p-5 rounded-2xl border border-white shadow-sm">
                                        {(lead.designation && lead.designation !== "Unknown") && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Designation</span>
                                            <span className="text-slate-700 font-bold flex items-center gap-1.5">💼 {lead.designation}</span>
                                          </div>
                                        )}
                                        {(lead.location && lead.location !== "Unknown") && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</span>
                                            <span className="text-slate-700 font-bold flex items-center gap-1.5">📍 {lead.location}</span>
                                          </div>
                                        )}
                                        {lead.linkedin && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">LinkedIn</span>
                                            <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-black flex items-center gap-1">🔗 View Profile</a>
                                          </div>
                                        )}
                                        {(lead.truecallerName && lead.truecallerName !== "Unknown") && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Truecaller Record</span>
                                            <span className="text-blue-700 font-black bg-blue-50 border border-blue-100 shadow-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-fit">
                                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.3"/><path d="M10 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/></svg>
                                              {lead.truecallerName}
                                            </span>
                                          </div>
                                        )}
                                        {lead.adName && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ad Name</span>
                                            <span className="text-slate-700 font-bold">{lead.adName}</span>
                                          </div>
                                        )}
                                        {lead.campaignName && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Campaign Name</span>
                                            <span className="text-slate-700 font-bold">{lead.campaignName}</span>
                                          </div>
                                        )}
                                        {lead.formId && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Form ID</span>
                                            <span className="text-slate-600 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm break-all">{lead.formId}</span>
                                          </div>
                                        )}
                                        {lead.adId && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ad ID</span>
                                            <span className="text-slate-600 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm break-all">{lead.adId}</span>
                                          </div>
                                        )}
                                        {lead.campaignId && (
                                          <div>
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Campaign ID</span>
                                            <span className="text-slate-600 font-mono text-[10px] bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm break-all">{lead.campaignId}</span>
                                          </div>
                                        )}
                                        {!lead.designation && !lead.adName && !lead.formId && !lead.campaignId && !lead.adId && !lead.truecallerName && (
                                          <div className="col-span-4 text-slate-400 font-medium italic text-xs py-2 flex items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                            No extended marketing or enrichment data available for this lead.
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
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
                        <div key={status} className="w-[340px] flex flex-col bg-white/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(116,235,213,0.05)] overflow-hidden shrink-0">
                          <div className="p-5 border-b border-white/60 bg-white/40 flex items-center justify-between shrink-0">
                            <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{status}</h3>
                            <span className="bg-white/80 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm border border-slate-100">
                              {filteredLeadsView.filter(l => l.status === status).length}
                            </span>
                          </div>
                          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                            {filteredLeadsView.filter(l => l.status === status).map(lead => (
                              <div 
                                key={lead.id} 
                                onClick={() => openLeadDetails(lead)}
                                className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-[0_8px_20px_rgba(116,235,213,0.15)] hover:-translate-y-1 transition-all duration-300 cursor-pointer relative group"
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div className="font-bold text-slate-900 text-base leading-tight pr-2">
                                    {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
                                  </div>
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
                                    
                                    {lead.truecallerName && lead.truecallerName !== "Unknown" && (
                                      <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 shrink-0">
                                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.3"/>
                                          <path d="M10 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>
                                        </svg>
                                        Verified
                                      </span>
                                    )}
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
                                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:ring-2 focus:ring-[#74ebd5]/30 focus:border-[#74ebd5] outline-none cursor-pointer hover:bg-white transition-colors"
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
                )}

              </>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0">
              <h3 className="text-xl font-extrabold text-slate-800">Add New Lead</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form id="add-lead-form" onSubmit={handleAddLead} className="p-8 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">First Name</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Last Name</label>
                  <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Project / Property</label>
                <input type="text" value={projectProperty} onChange={(e) => setProjectProperty(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" placeholder="e.g. Sunset Villas" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer">
                    {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Source</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer">
                    {leadSources.length === 0 && <option value="Manual">Manual</option>}
                    {leadSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Sub-Source</label>
                <select value={subSource} onChange={(e) => setSubSource(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer">
                  <option value="">None</option>
                  {leadSubSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </form>

            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm">
                Cancel
              </button>
              <button type="submit" form="add-lead-form" disabled={addingLead} className="px-6 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-[#74ebd5]/30 disabled:opacity-50 flex justify-center items-center min-w-[120px]">
                {addingLead ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }
      `}</style>
    </div>
  );
}