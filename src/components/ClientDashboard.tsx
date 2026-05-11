import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, setDoc, onSnapshot, orderBy, limit, startAfter, getDoc, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, LogOut, LayoutDashboard, Building2, UserCircle2, Mail, Calendar, Phone, Home, X, Link2, Copy, Check, Globe, Facebook, Search, Zap, List, KanbanSquare, UserPlus, UserCog, Edit2, Trash2, ChevronDown, ChevronUp, Menu, Download, MessageSquare, TrendingUp, Activity, Target, Clock, Bell, Upload, AlertCircle, CheckCircle2, Info, XCircle, BarChart2, BellRing, CheckSquare, Send, MessageCircle, Save, Medal, MoreVertical, Image as ImageIcon, Megaphone, RefreshCw, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import LeadDetailsModal, { Lead } from './LeadDetailsModal';
import { useBranding } from '../contexts/BrandingContext';
interface Agent { id: string; name: string; email: string; role: string; createdAt: any; designation?: string; location?: string; linkedin?: string; formId?: string; adId?: string; adName?: string; campaignId?: string; campaignName?: string; }
const PIPELINE_STATUSES = ['New', 'Attempted Contact', 'Connected / Warm', 'Site Visit Scheduled', 'Site Visit Completed', 'Negotiation', 'Closed Won', 'Closed Lost', 'Junk / Invalid'];
declare global { interface Window { FB: any; fbAsyncInit: any; } }
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

const normalizePhone = (phone?: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) cleaned = `91${cleaned}`;
  return cleaned;
};

export default function ClientDashboard() {
  const { user, logout } = useAuth(); 
  const { logoUrl, companyName } = useBranding();
  // ✨ NEW: User Dropdown Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuRef]);

  /// ✨ LEVEL 5 SECURITY: Real-Time Workspace Status Monitor
  const [workspaceStatus, setWorkspaceStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'LOADING'>('LOADING');

  useEffect(() => {
    if (!user?.clientId) return;
    
    const unsubStatus = onSnapshot(doc(db, 'clients', user.clientId), 
      (docSnap) => {
        if (docSnap.exists()) {
          setWorkspaceStatus(docSnap.data().status || 'ACTIVE');
        }
      },
      (error) => {
        // ✨ LEVEL 5 FIX: If Firebase actively denies permission to read the status, 
        // aggressively lock the gates to protect the system.
        console.error("Status check blocked by Firebase:", error);
        setWorkspaceStatus('SUSPENDED'); 
      }
    );
    
    return () => unsubStatus();
  }, [user?.clientId]);
  const [greeting, setGreeting] = useState({ text: 'Welcome back', emoji: '👋' });

  useEffect(() => {
    const getISTGreeting = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istDate = new Date(utc + (3600000 * 5.5)); 
      const hour = istDate.getHours();
      // ✨ Fixed Emojis ✨
      if (hour >= 4 && hour < 12) return { text: 'Good morning', emoji: '🌅' };
      if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '☀️' };
      if (hour >= 17 && hour < 22) return { text: 'Good evening', emoji: '🌙' };
      return { text: 'Working late', emoji: '🦉' };
    };
    setGreeting(getISTGreeting());
    const interval = setInterval(() => setGreeting(getISTGreeting()), 3600000);
    return () => clearInterval(interval);
  }, []);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'feedback' | 'inbox' | 'campaigns' | 'integrations' | 'team' | 'reports'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

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
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [outboundHeaders, setOutboundHeaders] = useState<{key: string, value: string}[]>([]);
  const [alertEmails, setAlertEmails] = useState("");
  const [emailInput, setEmailInput] = useState("");
  
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [isSavingSheets, setIsSavingSheets] = useState(false);
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [isSavingCRM, setIsSavingCRM] = useState(false);
  const [isTestingCRM, setIsTestingCRM] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [lastVisibleLead, setLastVisibleLead] = useState<any>(null);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);
  const [realTimeLeads, setRealTimeLeads] = useState<Lead[]>([]);
  const [olderLeads, setOlderLeads] = useState<Lead[]>([]);

  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [activeChatLeadId, setActiveChatLeadId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [campaignViewTab, setCampaignViewTab] = useState<'templates' | 'history'>('templates');
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);

  const [dialogState, setDialogState] = useState<{ isOpen: boolean; type: 'alert' | 'confirm' | 'success' | 'error'; title: string; message: string; onConfirm?: () => void; onCloseAction?: () => void; }>({ isOpen: false, type: 'alert', title: '', message: '' });
  const showDialog = (type: 'alert' | 'confirm' | 'success' | 'error', title: string, message: string, onConfirm?: () => void, onCloseAction?: () => void) => { setDialogState({ isOpen: true, type, title, message, onConfirm, onCloseAction }); };
  const closeDialog = () => { if (dialogState.onCloseAction && dialogState.type !== 'confirm') dialogState.onCloseAction(); setDialogState(prev => ({ ...prev, isOpen: false })); };

  const isInitialMount = useRef(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [toastData, setToastData] = useState<{show: boolean, title: string, message: string, color?: string} | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fbUserToken, setFbUserToken] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [isLinkingWhatsApp, setIsLinkingWhatsApp] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [whatsappNumberId, setWhatsappNumberId] = useState<string>('');

const leads = useMemo(() => {
    const combined = [...realTimeLeads, ...olderLeads];
    
    // 1. Deduplicate by Firebase Document ID (prevents overlapping pagination glitches)
    const uniqueById = Array.from(new Map(combined.map(item => [item.id, item])).values());
    
    // 2. Sort from Oldest to Newest so we accurately know which lead came "first"
    const sortedOldestFirst = uniqueById.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt as any).getTime() : Date.now());
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt as any).getTime() : Date.now());
      return timeA - timeB;
    });

    // 3. Setup memory trackers for unique identifiers
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    // 4. Evaluate each lead and flag the newer duplicates
    const evaluatedLeads = sortedOldestFirst.map(lead => {
      let isDup = false;
      const cleanPhone = lead.phone ? String(lead.phone).replace(/[^0-9]/g, '') : '';
      const cleanEmail = lead.email ? String(lead.email).trim().toLowerCase() : '';

      // If we have seen this phone or email before, flag it!
      if ((cleanPhone && seenPhones.has(cleanPhone)) || (cleanEmail && seenEmails.has(cleanEmail))) {
        isDup = true;
      }

      // Add to our trackers for future iterations
      if (cleanPhone) seenPhones.add(cleanPhone);
      if (cleanEmail) seenEmails.add(cleanEmail);

      return { ...lead, isDuplicate: isDup };
    });

    // 5. Reverse the array back to "Newest First" for your Dashboard UI
    return evaluatedLeads.reverse();
  }, [realTimeLeads, olderLeads]);

  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const alertedTasks = useRef<Set<string>>(new Set());

 const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => { showDialog('alert', 'Session Expired', 'Your session has expired due to 15 minutes of inactivity.', undefined, () => { logout(); }); }, 900000); 
    };
    resetTimer();
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); events.forEach(event => window.removeEventListener(event, handleActivity)); };
  }, [logout]);

  useEffect(() => { if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") { Notification.requestPermission(); } }, []);

  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'whatsapp_messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: any[] = [];
      snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      setWaMessages(msgs);
    }, (err) => console.error("WhatsApp sync error:", err));
    return () => unsub();
  }, [user?.clientId]);

  useEffect(() => {
    if (activeTab === 'inbox' && activeChatLeadId) {
      const activeLead = leads.find(l => l.id === activeChatLeadId);
      if (activeLead && activeLead.phone) {
        const normalizedPhone = normalizePhone(activeLead.phone);
        setWaMessages(prev => prev.map(m => (m.senderPhone === normalizedPhone && m.direction === 'inbound' && !m.isRead) ? { ...m, isRead: true } : m));
        const unreadMsgs = waMessages.filter(m => m.senderPhone === normalizedPhone && m.direction === 'inbound' && !m.isRead);
        if (unreadMsgs.length > 0) { unreadMsgs.forEach(msg => { updateDoc(doc(db, 'whatsapp_messages', msg.id), { isRead: true }).catch(console.error); }); }
      }
    }
  }, [activeChatLeadId, activeTab, leads]);

  const unreadWhatsAppCount = useMemo(() => { return waMessages.filter(m => m.direction === 'inbound' && !m.isRead).length; }, [waMessages]);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const markAllAsRead = () => { setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); setIsNotificationOpen(false); };

  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'whatsapp_campaigns'), where('clientId', '==', user.clientId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const camps: any[] = [];
      snap.forEach(doc => camps.push({ id: doc.id, ...doc.data() }));
      setCampaignsList(camps);
    }, (err) => console.error("Campaign sync error:", err));
    return () => unsub();
  }, [user?.clientId]);

  useEffect(() => { if (activeTab === 'inbox' && messagesEndRef.current) { messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); } }, [waMessages, activeChatLeadId, activeTab]);

  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'reminders'), where('clientId', '==', user.clientId), where('status', '==', 'Pending'));
    const unsub = onSnapshot(q, (snap) => {
      const tasks: any[] = [];
      snap.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
      tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setPendingTasks(tasks);
    }, (err) => console.error("Task sync error:", err));
    return () => unsub();
  }, [user?.clientId]);

  const myPendingTasks = useMemo(() => {
    if (user?.role === 'client_admin') return pendingTasks;
    return pendingTasks.filter(t => t.agentId === user?.uid);
  }, [pendingTasks, user?.uid, user?.role]);

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date().getTime();
      myPendingTasks.forEach(task => {
        const dueTime = new Date(task.dueDate).getTime();
        const timeDiff = dueTime - now;
        if (timeDiff <= 120000 && timeDiff > -86400000 && !alertedTasks.current.has(task.id)) {
          const isOverdue = timeDiff < 0;
          const title = isOverdue ? "Task Overdue!" : "Task Due Soon!";
          const bodyMsg = `${task.type} for ${task.leadName}`;
          setToastData({ show: true, title: title, message: bodyMsg, color: isOverdue ? "from-red-500 to-rose-600" : "from-amber-400 to-orange-500" });
          notificationSound.play().catch(e => console.log("Audio auto-play blocked by browser.", e));
          if ("Notification" in window && Notification.permission === "granted") { new Notification(`Leadspot CRM: ${title}`, { body: bodyMsg, icon: '/leadspot.png' }); }
          setNotifications(prev => {
            if (prev.some(n => n.id.includes(task.id))) return prev;
            return [{ id: `task-${task.id}-${Date.now()}`, leadId: task.leadId, title: isOverdue ? `Overdue: ${task.type}` : `Due Soon: ${task.type}`, message: `Action required for ${task.leadName}.`, time: new Date(), isRead: false }, ...prev].slice(0, 30);
          });
          alertedTasks.current.add(task.id);
          setTimeout(() => setToastData(null), 8000); 
        }
      });
    };
    checkTasks(); 
    const interval = setInterval(checkTasks, 10000); 
    return () => clearInterval(interval);
  }, [myPendingTasks]);

  const handleOpenTaskLead = async (leadId: string) => {
    let leadToOpen = leads.find(l => l.id === leadId);
    if (leadToOpen) { openLeadDetails(leadToOpen); } 
    else {
      try {
        const docSnap = await getDoc(doc(db, 'leads', leadId));
        if (docSnap.exists()) { openLeadDetails({ id: docSnap.id, ...docSnap.data() } as Lead); } 
        else { showDialog('error', 'Not Found', 'Lead data could not be found.'); }
      } catch (err) { console.error("Error fetching lead:", err); }
    }
  };

  const completeTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'reminders', taskId), { status: 'Completed' });
      setToastData({ show: true, title: "Task Completed", message: "Great job checking that off!", color: "from-emerald-400 to-teal-500" });
      setTimeout(() => setToastData(null), 3000);
    } catch (err) { console.error('Error completing task:', err); }
  };

  const dashboardStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 6);
    let todaysLeadsCount = 0; let activePipelineCount = 0; let closedWonCount = 0;
    const todaysSources = new Map<string, number>();
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
      if (leadDate >= today) {
        todaysLeadsCount++;
        const source = lead.source || 'Manual';
        todaysSources.set(source, (todaysSources.get(source) || 0) + 1);
      }
      if (leadDate >= sevenDaysAgo) {
        const dayStr = leadDate.toLocaleDateString('en-US', { weekday: 'short' });
        if (trendDataMap.has(dayStr)) trendDataMap.set(dayStr, trendDataMap.get(dayStr)! + 1);
      }
    });

    const todaysSourceChart = Array.from(todaysSources.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const trendChart = Array.from(trendDataMap.entries()).map(([name, count]) => ({ name, count }));
    const conversionRate = leads.length > 0 ? Math.round((closedWonCount / leads.length) * 100) : 0;
    return { todaysLeadsCount, activePipelineCount, conversionRate, todaysSourceChart, trendChart };
  }, [leads]);

  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [projectProperty, setProjectProperty] = useState(''); const [status, setStatus] = useState('New'); const [source, setSource] = useState(''); const [subSource, setSubSource] = useState(''); const [assignedTo, setAssignedTo] = useState('');
  const [agentName, setAgentName] = useState(''); const [agentEmail, setAgentEmail] = useState(''); const [agentPassword, setAgentPassword] = useState(''); const [inlineEditingAgentId, setInlineEditingAgentId] = useState<string | null>(null); const [inlineEditingName, setInlineEditingName] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All'); 
  const [leadsProjectFilter, setLeadsProjectFilter] = useState('All'); // ✨ LEVEL 5 FIX: Project Filter State
  const [leadsStartDate, setLeadsStartDate] = useState(''); const [leadsEndDate, setLeadsEndDate] = useState('');
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [leadSourceFilter, setLeadSourceFilter] = useState('All');
  const [feedbackStartDate, setFeedbackStartDate] = useState(''); const [feedbackEndDate, setFeedbackEndDate] = useState(''); const [feedbackSourceFilter, setFeedbackSourceFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1); const leadsPerPage = 10; const [selectedLeads, setSelectedLeads] = useState<string[]>([]); const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [fbPages, setFbPages] = useState<any[]>([]); const [linkedPages, setLinkedPages] = useState<any[]>([]); const [isLoadingLinkedPages, setIsLoadingLinkedPages] = useState(true); const [isLoadingFb, setIsLoadingFb] = useState(false);
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]); const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<{id: string, sourceName?: string, projectName?: string, agentId: string, agentName: string}[]>([]); const [newRuleType, setNewRuleType] = useState('project'); const [newRuleValue, setNewRuleValue] = useState(''); const [newRuleAgentId, setNewRuleAgentId] = useState(''); const [addingRule, setAddingRule] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false); const [campaignTab, setCampaignTab] = useState<'email' | 'whatsapp'>('whatsapp'); const [emailSubject, setEmailSubject] = useState(''); const [emailBody, setEmailBody] = useState(''); const [isSendingCampaign, setIsSendingCampaign] = useState(false); const [whatsappTemplate, setWhatsappTemplate] = useState('project_launch_01');

  const combinedSources = useMemo(() => {
    const sourcesSet = new Set<string>();
    leadSources.forEach(s => { if (s.name) sourcesSet.add(s.name); });
    leads.forEach(lead => { if (lead.source) sourcesSet.add(lead.source); });
    return Array.from(sourcesSet).sort((a, b) => a.localeCompare(b));
  }, [leadSources, leads]);
const uniqueProjects = useMemo(() => {
    const projSet = new Set<string>(); 
    
    leads.forEach(lead => { 
      let cleanProjectName = lead.projectProperty;

      // ✨ LEVEL 5 FIX: Dig into the Form Questions to find the clean project name
      if (lead.customAnswers) {
        // Look for any custom question that contains the word "project"
        const projectKey = Object.keys(lead.customAnswers).find(k => k.toLowerCase().includes('project'));
        if (projectKey && lead.customAnswers[projectKey]) {
          cleanProjectName = lead.customAnswers[projectKey];
        }
      }

      if (cleanProjectName) {
        projSet.add(cleanProjectName); 
      }
    });
    
    return Array.from(projSet).sort((a, b) => a.localeCompare(b));
  }, [leads]);
  // ✅ NEW CODE
const webhookUrl = `https://us-central1-leadspot-crm-52ab4.cloudfunctions.net/incomingLeadWebhook?clientId=${user?.clientId}`;

  useEffect(() => {
    if (!user?.clientId) return;
    setLoading(true);
    // Reset local memory so old data doesn't mix when you change calendar dates
    setOlderLeads([]); 
    setLastVisibleLead(null);
    isInitialMount.current = true;

    // 1. Build the dynamic server query
    const queryConstraints: any[] = [
      where('clientId', '==', user.clientId)
    ];

    // 2. 🚨 Inject Server-Side Date Boundaries! 🚨
    // This forces Firebase to hunt through the entire database for your old leads!
    if (leadsStartDate) {
      const start = new Date(leadsStartDate);
      start.setHours(0, 0, 0, 0);
      queryConstraints.push(where('createdAt', '>=', Timestamp.fromDate(start)));
    }
    if (leadsEndDate) {
      const end = new Date(leadsEndDate);
      end.setHours(23, 59, 59, 999);
      queryConstraints.push(where('createdAt', '<=', Timestamp.fromDate(end)));
    }

    // 3. Add sorting and bandwidth limits
    queryConstraints.push(orderBy('createdAt', 'desc'));
    queryConstraints.push(limit(50));
    const q = query(collection(db, 'leads'), ...queryConstraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: Lead[] = [];
      snapshot.forEach((doc) => fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead));
      setRealTimeLeads(fetchedLeads);
      if (!isInitialMount.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newLead = change.doc.data() as Lead;
            const cleanLastName = newLead.lastName === 'Lead' ? '' : newLead.lastName;
            const leadName = `${newLead.firstName} ${cleanLastName}`.trim() || 'Someone';
            setToastData({ show: true, title: "New Lead Captured!", message: `${leadName} just arrived via ${newLead.source || 'Direct Entry'}.` });
            setNotifications(prev => [{ id: change.doc.id + Date.now(), leadId: change.doc.id, leadRef: newLead, title: "New Lead", message: `${leadName} - ${newLead.projectProperty || 'General Inquiry'}`, time: new Date(), isRead: false }, ...prev].slice(0, 30));
            setTimeout(() => setToastData(null), 5000);
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
    }, (error) => { console.error("Error in onSnapshot:", error); setLoading(false); });
    return () => unsubscribe();
  }, [user?.clientId,leadsStartDate, leadsEndDate]);

  const loadMoreLeads = async () => {
    if (!user?.clientId || !lastVisibleLead || loadingMoreLeads || !hasMoreLeads) return;
    setLoadingMoreLeads(true);
    try {
      const q = query(collection(db, 'leads'), where('clientId', '==', user.clientId), orderBy('createdAt', 'desc'), startAfter(lastVisibleLead), limit(50));
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
// ✨ LEVEL 5 ENTERPRISE UPGRADE: Debounced Server-Side Deep Search
  useEffect(() => {
    const performDeepServerSearch = async () => {
      // Only trigger if they type at least 3 characters to save database read costs
      if (searchQuery.trim().length < 3 || !user?.clientId) return;
      
      const qStr = searchQuery.trim();
      const qStrLower = qStr.toLowerCase();
      // Capitalize first letter for strict Firebase Name matching
      const qStrTitle = qStr.charAt(0).toUpperCase() + qStr.slice(1).toLowerCase();

      try {
        // 1. Hunt for exact Phone Number match in the deep database
        const phoneQ = query(collection(db, 'leads'), where('clientId', '==', user.clientId), where('phone', '==', qStr));
        
        // 2. Hunt for exact Email match
        const emailQ = query(collection(db, 'leads'), where('clientId', '==', user.clientId), where('email', '==', qStrLower));
        
        // 3. Hunt for First Name Prefix match (e.g. typing "Aru" finds "Arun")
        const nameQ = query(collection(db, 'leads'), where('clientId', '==', user.clientId), where('firstName', '>=', qStrTitle), where('firstName', '<=', qStrTitle + '\uf8ff'));

        // Fire all 3 queries simultaneously for lightning-fast performance
        const [phoneSnap, emailSnap, nameSnap] = await Promise.all([getDocs(phoneQ), getDocs(emailQ), getDocs(nameQ)]);
        
        const newlyFoundLeads: Lead[] = [];
        
        // Helper function to safely inject missing leads without creating duplicates
        const safelyInjectLeads = (snap: any) => {
          snap.forEach((doc: any) => {
            // Check if the lead is ALREADY in our local memory to prevent table duplication bugs
            if (!leads.some(l => l.id === doc.id)) { 
              newlyFoundLeads.push({ id: doc.id, ...doc.data() } as Lead);
            }
          });
        };

        safelyInjectLeads(phoneSnap);
        safelyInjectLeads(emailSnap);
        safelyInjectLeads(nameSnap);

        // If we found old leads, inject them directly into the "olderLeads" state array!
        // Your local search bar will INSTANTLY pick them up and display them!
        if (newlyFoundLeads.length > 0) {
          setOlderLeads(prev => [...prev, ...newlyFoundLeads]);
        }
        
      } catch (e) {
        console.error("Deep server search failed:", e);
      }
    };

    // DEBOUNCE: Wait 800ms after the user stops typing before hitting the database
    const debounceTimer = setTimeout(performDeepServerSearch, 800); 
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, user?.clientId]); // This effect triggers every time the search bar changes!
  const fetchTeamMembers = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'users'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const fetchedTeam: {id: string, name: string}[] = [];
      snapshot.forEach(doc => fetchedTeam.push({ id: doc.id, name: doc.data().name || doc.data().email }));
      fetchedTeam.sort((a, b) => a.name.localeCompare(b.name));
      setTeamMembers(fetchedTeam);
    } catch (error) { console.error("Error fetching team members:", error); }
  };

  const fetchAgents = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'users'), where('clientId', '==', user.clientId), where('role', '==', 'client_agent'));
      const snapshot = await getDocs(q);
      const fetchedAgents: Agent[] = [];
      snapshot.forEach(doc => fetchedAgents.push({ id: doc.id, ...doc.data() } as Agent));
      setAgents(fetchedAgents);
    } catch (error) { console.error("Error fetching agents:", error); }
  };

  const fetchLinkedPages = async () => {
    if (!user?.clientId) return;
    setIsLoadingLinkedPages(true);
    try {
      const q = query(collection(db, 'facebook_integrations'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const pages: any[] = [];
      snapshot.forEach(doc => pages.push({ id: doc.id, ...doc.data() }));
      setLinkedPages(pages);
    } catch (error) { console.error("Error fetching linked pages:", error); } finally { setIsLoadingLinkedPages(false); }
  };

  const fetchWhatsAppIntegration = async () => {
    if (!user?.clientId) return;
    try {
      const waDoc = await getDoc(doc(db, 'whatsapp_integrations', user.clientId));
      if (waDoc.exists()) { setWhatsappConnected(true); setWhatsappNumberId(waDoc.data().phoneNumberId); }
    } catch (error) { console.error("Error fetching WA status", error); }
  };

  const fetchLeadSources = async () => {
    if (!user?.clientId) return;
    try {
      const fetched: {id: string, name: string}[] = [];
      const q = query(collection(db, 'lead_sources'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => fetched.push({ id: doc.id, name: doc.data().name }));
      const globalQ = collection(db, 'global_lead_sources');
      const globalSnapshot = await getDocs(globalQ);
      globalSnapshot.forEach(doc => { if (!fetched.some(s => s.name.toLowerCase() === doc.data().name.toLowerCase())) { fetched.push({ id: doc.id, name: doc.data().name }); } });
      fetched.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSources(fetched);
      if (fetched.length > 0) setSource(fetched[0].name);

      const qSub = query(collection(db, 'lead_sub_sources'), where('clientId', '==', user.clientId));
      const snapshotSub = await getDocs(qSub);
      const fetchedSub: {id: string, name: string}[] = [];
      snapshotSub.forEach(doc => fetchedSub.push({ id: doc.id, name: doc.data().name }));
      fetchedSub.sort((a, b) => a.name.localeCompare(b.name));
      setLeadSubSources(fetchedSub);
    } catch (error) { console.error("Error fetching lead sources:", error); }
  };

  const fetchAssignmentRules = async () => {
    if (!user?.clientId) return;
    try {
      const q = query(collection(db, 'lead_assignment_rules'), where('clientId', '==', user.clientId));
      const snapshot = await getDocs(q);
      const fetched: {id: string, sourceName: string, agentId: string, agentName: string}[] = [];
      snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() } as any));
      setAssignmentRules(fetched);
    } catch (error) { console.error("Error fetching assignment rules:", error); }
  };

//  const handleAddAssignmentRule = async () => {
//     if (!user?.clientId || !newRuleProject || !newRuleAgentId) return; setAddingRule(true);
//     try {
//       const agent = teamMembers.find(m => m.id === newRuleAgentId); if (!agent) return;
//       const docRef = await addDoc(collection(db, 'lead_assignment_rules'), { clientId: user.clientId, projectName: newRuleProject, agentId: newRuleAgentId, agentName: agent.name, createdAt: serverTimestamp() });
//       setAssignmentRules([...assignmentRules, { id: docRef.id, projectName: newRuleProject, agentId: newRuleAgentId, agentName: agent.name }]);
//       setNewRuleProject(''); setNewRuleAgentId(''); showDialog('success', 'Success', 'Project routing rule added.');
//     } catch (e) { showDialog('error', 'Error', 'Failed to add rule.'); } finally { setAddingRule(false); }
//   };

  const handleDeleteRule = async (ruleId: string) => {
    if (!ruleId) return;
    showDialog('confirm', 'Delete Rule', 'Are you sure you want to delete this auto-assignment rule?', async () => {
      try {
        await deleteDoc(doc(db, 'lead_assignment_rules', ruleId));
        setAssignmentRules(prevRules => prevRules.filter(r => r.id !== ruleId));
        showDialog('success', 'Deleted', 'The rule has been deleted.');
      } catch (error) { showDialog('error', 'Error', 'Failed to delete rule.'); }
    });
  };

  const fetchOutboundWebhook = async () => {
    if (!user?.clientId) return;
    try {
      const docRef = doc(db, 'outbound_integrations', user.clientId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) { 
        setOutboundWebhookUrl(docSnap.data().webhookUrl || ""); setGoogleSheetUrl(docSnap.data().googleSheetUrl || ""); setOutboundHeaders(docSnap.data().headers || []); setAlertEmails(docSnap.data().alertEmails || ""); 
      }
    } catch (error) { console.error("Error fetching outbound configs:", error); }
  };

  const emailList = alertEmails.split(',').map(e => e.trim()).filter(e => e);
  const handleAddEmailTag = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if (e.type === 'blur' || (e as React.KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      const val = emailInput.trim();
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        if (!emailList.includes(val)) { setAlertEmails([...emailList, val].join(', ')); }
        setEmailInput("");
      } else if (val) { showDialog('error', 'Invalid Email', 'Please enter a valid email address before saving.'); }
    }
  };
  const handleRemoveEmailTag = (emailToRemove: string) => { setAlertEmails(emailList.filter(e => e !== emailToRemove).join(', ')); };

  const handleSaveAlertEmails = async () => {
    if (!user?.clientId) return;
    setIsSavingAlerts(true);
    try {
      let finalEmails = alertEmails;
      if (emailInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
        finalEmails = [...emailList, emailInput.trim()].join(', ');
        setAlertEmails(finalEmails); setEmailInput("");
      }
      await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, alertEmails: finalEmails, updatedAt: serverTimestamp() }, { merge: true });
      showDialog('success', 'Alerts Saved', 'Lead notification emails updated successfully.');
    } catch (error) { showDialog('error', 'Save Failed', 'Failed to save email alert config.'); } finally { setIsSavingAlerts(false); }
  };

  const handleSaveGoogleSheet = async () => {
    if (!user?.clientId) return;
    setIsSavingSheets(true);
    try {
      await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, googleSheetUrl: googleSheetUrl, updatedAt: serverTimestamp() }, { merge: true });
      showDialog('success', 'Saved', 'Google Sheets pipeline connected successfully.');
    } catch (error) { showDialog('error', 'Save Failed', 'Failed to save Google Sheets config.'); } finally { setIsSavingSheets(false); }
  };

  const handleTestGoogleSheet = async () => {
    if (!googleSheetUrl) { showDialog('alert', 'Missing URL', 'Please enter your Apps Script URL first.'); return; }
    setIsTestingSheets(true);
    try {
      await fetch(googleSheetUrl, { method: 'POST', body: JSON.stringify({ id: 'test-123', firstName: 'Test', lastName: 'Lead', email: 'test@example.com', phone: '+919876543210', source: 'Test Webhook', status: 'New', createdAt: new Date().toISOString(), clientId: user?.clientId, projectProperty: 'Test Project' }) });
      showDialog('success', 'Test Sent', 'Test lead fired to Google Sheets!');
    } catch (error) { showDialog('error', 'CORS Notice', 'Test fired, but browser security blocked response view. Check your Google Sheet.'); } finally { setIsTestingSheets(false); }
  };

  const handleSaveCustomCRM = async () => {
    if (!user?.clientId) return;
    setIsSavingCRM(true);
    try {
      const validHeaders = outboundHeaders.filter(h => h.key.trim() !== '');
      await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, webhookUrl: outboundWebhookUrl, headers: validHeaders, updatedAt: serverTimestamp() }, { merge: true });
      setOutboundHeaders(validHeaders);
      showDialog('success', 'Saved', 'Enterprise CRM API bridge configured successfully.');
    } catch (error) { showDialog('error', 'Save Failed', 'Failed to save CRM API configuration.'); } finally { setIsSavingCRM(false); }
  };

  const handleTestCustomCRM = async () => {
    if (!outboundWebhookUrl) { showDialog('alert', 'Missing URL', 'Please enter your destination API URL first.'); return; }
    setIsTestingCRM(true);
    try {
      const testPayload = { id: 'test-123', firstName: 'Test', lastName: 'Lead', email: 'test@example.com', phone: '+919876543210', source: 'Test Webhook', status: 'New', createdAt: new Date().toISOString(), clientId: user?.clientId, projectProperty: 'Test Project' };
      const headerObj: Record<string, string> = { 'Content-Type': 'application/json' };
      outboundHeaders.forEach(h => { if (h.key.trim() !== '' && h.value.trim() !== '') { headerObj[h.key.trim()] = h.value.trim(); } });
      await fetch(outboundWebhookUrl, { method: 'POST', headers: headerObj, body: JSON.stringify(testPayload) });
      showDialog('success', 'Test Sent', 'Test lead fired to your Custom CRM!');
    } catch (error) { showDialog('error', 'CORS Notice', 'Test fired, but browser security blocked response view. Check destination CRM.'); } finally { setIsTestingCRM(false); }
  };

 

  const handleConnectFacebook = () => {
    showDialog(
      'confirm', 
      'Adding a New Page?', 
      'If you have connected to this CRM before, Meta will try to skip the page checklist.\n\n🚨 CRITICAL: When the Facebook popup opens, DO NOT just click "Continue". You MUST click "Edit Settings" to check the box for your new page!', 
      () => {
        setIsLoadingFb(true);
        
        // ✨ Uses your Environment Variable! Defaults to localhost for testing.
        const authHubUrl = import.meta.env.VITE_AUTH_HUB_URL || 'http://localhost:3000';
        
        // 1. Open the Centralized Auth Hub
        const popup = window.open(`${authHubUrl}/meta-auth.html`, 'MetaAuth', 'width=600,height=700');

        // 2. Listen for the token to come back from the Hub
        const messageListener = (event: MessageEvent) => {
          if (event.data?.type === 'META_AUTH_SUCCESS' && event.data?.token) {
            window.removeEventListener('message', messageListener);
            setFbUserToken(event.data.token); 

            // 3. Fetch the Facebook Pages directly using the Graph API
            fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${event.data.token}`)
              .then(res => res.json())
              .then(apiResponse => {
                if (apiResponse.data) { 
                  const fetchedPages = apiResponse.data || [];
                  setFbPages(fetchedPages); 
                  
                  if (fetchedPages.length === 0) {
                     showDialog('error', 'No Pages Found', 'Meta returned 0 pages. You forgot to click "Edit Settings" in the popup to check the new page.');
                  } else {
                     showDialog('success', 'Pages Found', 'Please scroll down to the "Available Pages" section and click Link on the one you want.');
                  }
                } else { 
                  showDialog('error', 'Facebook API Error', apiResponse?.error?.message || 'Failed to fetch Facebook Pages.'); 
                }
                setIsLoadingFb(false);
              })
              .catch(err => {
                console.error("Graph API Error:", err);
                setIsLoadingFb(false);
              });
          }
        };

        window.addEventListener('message', messageListener);

        // Fail-safe: Detect if the user closes the popup manually
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed || popup.closed === undefined) {
            clearInterval(checkPopup);
            window.removeEventListener('message', messageListener);
            setIsLoadingFb(false);
          }
        }, 1000);
      }
    );
  };
const handleConnectWhatsApp = () => {
    setIsLinkingWhatsApp(true);
    
    // Use the Auth Hub, just like Facebook Ads does!
    const authHubUrl = import.meta.env.VITE_AUTH_HUB_URL || 'http://localhost:3000';
    
    // ✨ Notice we pass '?type=whatsapp' so the Hub knows which login config to use
    const popup = window.open(`${authHubUrl}/meta-auth.html?type=whatsapp`, 'MetaAuth', 'width=600,height=700');

    const messageListener = (event: MessageEvent) => {
      // Check for success from the popup
      if (event.data?.type === 'META_AUTH_SUCCESS' && event.data?.token) {
        window.removeEventListener('message', messageListener);
        
        if (user?.clientId) {
          const linkWaFn = httpsCallable(functions, 'secureLinkWhatsApp');
          
          linkWaFn({ accessToken: event.data.token })
            .then(() => {
              setWhatsappConnected(true); 
              fetchWhatsAppIntegration(); 
              showDialog('success', 'Connected', 'WhatsApp linked successfully!');
            })
            .catch((e: any) => {
              console.error("Link Error:", e);
              showDialog('error', 'Connection Failed', 'Failed to link WA account. Please try again.');
            })
            .finally(() => {
              setIsLinkingWhatsApp(false); 
            });
        }
      }
    };

    window.addEventListener('message', messageListener);

    // Fail-safe if they close the window early
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed || popup.closed === undefined) {
        clearInterval(checkPopup);
        window.removeEventListener('message', messageListener);
        setIsLinkingWhatsApp(false);
      }
    }, 1000);
  };
  const handleLinkPage = async (page: any) => {
    if (!user?.clientId) return;
    if (!fbUserToken) { showDialog('error', 'Token Missing', 'Your Facebook session expired. Please click "Connect Facebook" again.'); return; }
    setIsLinking(true);
    try {
      const q = query(collection(db, 'facebook_integrations'), where('pageId', '==', String(page.id)));
      const querySnapshot = await getDocs(q);
      let isConnectedToOtherClient = false;
      querySnapshot.forEach((docSnap) => { if (docSnap.data().clientId !== user.clientId) isConnectedToOtherClient = true; });
      if (isConnectedToOtherClient) { showDialog('error', 'Link Error', 'This Facebook Page is already connected to another client workspace.'); setIsLinking(false); return; }
      
      const linkFn = httpsCallable(functions, 'secureLinkFacebookPage');
      await linkFn({ shortLivedUserToken: fbUserToken, pageId: String(page.id), pageName: page.name });
      fetchLinkedPages(); setFbPages([]); showDialog('success', 'Page Linked', 'Facebook page successfully linked to your CRM.');
    } catch (error: any) { showDialog('error', 'Link Failed', error?.message || 'Failed to securely link the page. Check your Facebook permissions.'); } finally { setIsLinking(false); }
  };

  const handleDisconnectPage = async (integrationDocId: string) => {
    if (!user?.clientId) return;
    showDialog('confirm', 'Disconnect Page', 'Are you sure you want to disconnect this Facebook page?', async () => {
      try { 
        // ✨ LEVEL 5 FIX: We safely delete the specific integration Document ID!
        // This makes TypeScript happy AND protects your multi-tenant data.
        await deleteDoc(doc(db, 'facebook_integrations', integrationDocId)); 
        fetchLinkedPages(); 
        showDialog('success', 'Disconnected', 'Facebook page disconnected.'); 
      } 
      catch (error) { showDialog('error', 'Error', 'Failed to disconnect. Please try again.'); }
    });
  };

  useEffect(() => {
    fetchAgents(); fetchTeamMembers(); fetchLinkedPages(); fetchLeadSources(); fetchAssignmentRules(); fetchOutboundWebhook(); fetchWhatsAppIntegration();
  }, [user?.clientId]);

  const handleLeadUpdated = (updatedLead: Lead) => {
    setRealTimeLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setOlderLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
  };

  const openLeadDetails = (lead: Lead) => { setSelectedLead(lead); setIsLeadModalOpen(true); };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.clientId) return;
    setAddingLead(true);
    try {
      const assignedUser = teamMembers.find(m => m.id === assignedTo);
      const assignedToName = assignedUser ? assignedUser.name : (assignedTo === user.uid ? user.email : '');
      await addDoc(collection(db, 'leads'), { clientId: user.clientId, firstName, lastName, email, phone, projectProperty, status, source: source || 'Manual', subSource: subSource || '', assignedTo: assignedTo || user?.uid, assignedToId: assignedTo || user?.uid, assignedToName: assignedToName, createdAt: serverTimestamp() });
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setProjectProperty(''); setStatus('New'); setSubSource(''); setAssignedTo('');
      setIsModalOpen(false); showDialog('success', 'Lead Added', 'The lead was manually added successfully.');
    } catch (error) { showDialog('error', 'Error', 'Failed to add lead.'); } finally { setAddingLead(false); }
  };
  // 🧹 TEMPORARY SCRIPT: One-Time Data Migration to fix "Facebook" names
  const fixLegacyFacebookLeads = async () => {
    if (!user?.clientId) return;
    showDialog('alert', 'Processing...', 'Scanning database and fixing names. Please wait.');
    
    let fixedCount = 0;
    
    try {
      // Loop through all the leads currently loaded in your dashboard
      for (const lead of leads) {
        // ✨ LEVEL 5 FIX: Cast to 'any' to bypass TS strictness so we can read the broken DB fields
        const leadData = lead as any; 
        
        // Check if the lead is suffering from the "Facebook" name bug
        if (leadData.name === 'Facebook' || leadData.firstName === 'Facebook' || leadData.name === 'FB Lead' || (leadData.name && leadData.name.includes('Facebook'))) {
          let realFirstName = '';
          
          // Dig into the customAnswers to find the real name
          if (lead.customAnswers) {
            const keys = Object.keys(lead.customAnswers);
            // Look for keys like "FIRST NAME", "first_name", "Name", etc.
            const nameKey = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('first'));
            
            if (nameKey && lead.customAnswers[nameKey]) {
              realFirstName = lead.customAnswers[nameKey];
            }
          }
          
          // If we successfully dug up the real name, update the Firestore document!
          if (realFirstName) {
            await updateDoc(doc(db, 'leads', lead.id), {
              name: realFirstName,
              firstName: realFirstName,
              lastName: '' // Clear out the broken last name
            });
            fixedCount++;
          }
        }
      }
      showDialog('success', 'Cleanup Complete', `Successfully recovered and fixed ${fixedCount} leads!`);
    } catch (error) {
      console.error("Error fixing leads:", error);
      showDialog('error', 'Error', 'Something went wrong during cleanup.');
    }
  };
 // ✨ LEVEL 5 FIX: Enterprise Historical Data & Attribution Importer
// ✨ LEVEL 5 FIX: Enterprise Historical Data Importer (With Strict Timestamp Indexing)
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.clientId) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length < 2) { 
          showDialog('error', 'Invalid CSV', 'CSV file must contain headers and at least one row of data.'); 
          setIsImporting(false); 
          return; 
        }
        
        // Strip invisible Excel BOM characters and normalize headers
        const headers = rows[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim().toLowerCase());
        
        let successCount = 0;
        
        for (let i = 1; i < rows.length; i++) {
          const rowValues = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
          if (rowValues.length === 0 || !rowValues[0]) continue;
          
          let parsedDate: Date | null = null;
          
          let leadObj: any = { 
            clientId: user.clientId, 
            status: 'New', 
            assignedTo: '', 
            assignedToId: '', 
            assignedToName: '',
            customAnswers: {} 
          };

          headers.forEach((header, index) => {
            const val = rowValues[index] || '';
            if (!val) return; 

            // ✨ LEVEL 5 STRICT DATE PARSER
            if (header.includes('date') || header.includes('created') || header === 'timestamp') {
              let d = new Date(val);
              
              // Force strict parsing for YYYY-MM-DD or DD-MM-YYYY to avoid Timezone bugs
              if (val.includes('-') || val.includes('/')) {
                const parts = val.split(/[-/]/);
                if (parts.length === 3) {
                  // If year is last (e.g. 01-04-2026)
                  if (parts[2].length === 4) {
                    d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T12:00:00Z`);
                  } 
                  // If year is first (e.g. 2026-04-01)
                  else if (parts[0].length === 4) {
                    d = new Date(`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}T12:00:00Z`);
                  }
                }
              }
              
              if (!isNaN(d.getTime())) {
                parsedDate = d;
              }
            }
            // Standard Field Mapping
            else if (header.includes('first') || header === 'name') leadObj.firstName = val;
            else if (header.includes('last')) leadObj.lastName = val;
            else if (header.includes('email')) leadObj.email = val;
            else if (header.includes('phone') || header.includes('mobile')) leadObj.phone = val;
            else if (header.includes('project') || header.includes('property')) leadObj.projectProperty = val;
            else if (header.includes('source') && !header.includes('sub')) leadObj.source = val;
            else if (header.includes('sub')) leadObj.subSource = val;
            
            // Marketing Attribution Mapping
            else if (header.includes('campaign')) leadObj.campaignName = val;
            else if (header === 'ad name' || header === 'adname') leadObj.adName = val;
            else if (header === 'form id' || header === 'formid') leadObj.formId = val;
            else if (header === 'ad id' || header === 'adid') leadObj.adId = val;
            
            // Custom Fields (Infinite Scaling)
            else {
              leadObj.customAnswers[rows[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)[index].replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim()] = val;
            }
          });

          // ✨ LEVEL 5 FIX: Force native Firestore Timestamp object to preserve sorting indexes!
          leadObj.createdAt = parsedDate ? Timestamp.fromDate(parsedDate) : serverTimestamp();
          
          // Fallbacks
          if (!leadObj.firstName) leadObj.firstName = "Imported";
          if (!leadObj.lastName) leadObj.lastName = "Lead";
          if (!leadObj.source) leadObj.source = "Bulk Import";
          
          await addDoc(collection(db, 'leads'), leadObj);
          successCount++;
        }
        
        // ✨ LEVEL 5 MEMORY RESET: Force a page reload so the pagination cursors reset and fetch the old data!
        showDialog('success', 'Import Complete', `Successfully imported ${successCount} historical leads!`, undefined, () => {
          window.location.reload(); 
        });

      } catch (error) { 
        console.error("CSV Import Error:", error);
        showDialog('error', 'Import Failed', 'Failed to import leads. Please check your CSV format.'); 
      } finally { 
        setIsImporting(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    
    reader.readAsText(file);
  };

  const handleCreateAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setAddingAgent(true);
    try {
      const createAgentFn = httpsCallable(functions, 'createAgent');
      await createAgentFn({ email: agentEmail, password: agentPassword, name: agentName });
      setAgentName(''); setAgentEmail(''); setAgentPassword(''); setIsAgentModalOpen(false); await fetchAgents();
      showDialog('success', 'Agent Created', 'Agent was created successfully.');
    } catch (error: any) { showDialog('error', 'Creation Failed', error.message || "Failed to save agent."); } finally { setAddingAgent(false); }
  };

  const handleEditAgent = async (agent: Agent) => { setInlineEditingAgentId(agent.id); setInlineEditingName(agent.name); };
  const handleSaveInlineEdit = async (agentId: string) => {
    if (!inlineEditingName || inlineEditingName.trim() === '') { setInlineEditingAgentId(null); return; }
    try {
      const updateAgentFn = httpsCallable(functions, 'updateAgent');
      await updateAgentFn({ agentId, name: inlineEditingName.trim() });
      await fetchAgents(); setInlineEditingAgentId(null);
      showDialog('success', 'Updated', 'Agent updated successfully.');
    } catch (error: any) { showDialog('error', 'Update Failed', error.message || "Failed to update agent."); }
  };

  const handleDeleteAgent = async (agentId: string) => {
    showDialog('confirm', 'Delete Agent', 'Are you sure you want to delete this agent? This cannot be undone.', async () => {
      try {
        const deleteAgentFn = httpsCallable(functions, 'deleteAgent');
        await deleteAgentFn({ agentId }); await fetchAgents(); showDialog('success', 'Deleted', 'Agent deleted successfully.');
      } catch (error: any) { showDialog('error', 'Delete Failed', error.message || "Failed to delete agent."); }
    });
  };

 // ✨ LEVEL 5 FIX: Auto-Logging Status Changes
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

  // ✨ LEVEL 5 FIX: Auto-Logging Lead Assignments
  const handleAssignLead = async (leadId: string, agentId: string) => {
    try {
      const assignedUser = teamMembers.find(m => m.id === agentId);
      const assignedToName = assignedUser ? assignedUser.name : 'Unassigned';
      
      const systemNote = {
        text: `System: Lead assigned to ${assignedToName}`,
        authorEmail: user?.email || 'System',
        authorRole: 'System',
        timestamp: new Date().toISOString()
      };

      setRealTimeLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, assignedTo: agentId, assignedToId: agentId, assignedToName: assignedToName, notes: [...(lead.notes || []), systemNote] } : lead));
      setOlderLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, assignedTo: agentId, assignedToId: agentId, assignedToName: assignedToName, notes: [...(lead.notes || []), systemNote] } : lead));
      
      await updateDoc(doc(db, 'leads', leadId), { 
        assignedTo: agentId, 
        assignedToId: agentId, 
        assignedToName: assignedToName,
        notes: arrayUnion(systemNote)
      });
    } catch (error) { console.error("Error assigning lead:", error); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

// ✨ LEVEL 5 FIX: Bulletproof Search Engine
  const filteredLeadsView = leads.filter(lead => {
    let matches = true;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      
      // Safely handle nulls and force everything to String to prevent fatal TypeErrors!
      const safeFirstName = (lead.firstName || '').toLowerCase();
      const safeLastName = (lead.lastName === 'Lead' ? '' : (lead.lastName || '')).toLowerCase();
      const safeFullName = `${safeFirstName} ${safeLastName}`.trim();
      const safeEmail = String(lead.email || '').toLowerCase();
      const safePhone = String(lead.phone || '').toLowerCase();
      
      if (!safeFullName.includes(query) && !safeEmail.includes(query) && !safePhone.includes(query)) {
        matches = false;
      }
    }
    
    if (leadsViewSourceFilter !== 'All') { 
      if (lead.source !== leadsViewSourceFilter) matches = false; 
    }
    // ✨ LEVEL 5 FIX: Apply the Project Filter safely extracting from both standard and custom fields
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
      if (leadsStartDate) { 
        const start = new Date(leadsStartDate); start.setHours(0, 0, 0, 0); 
        if (leadDate < start) matches = false; 
      }
      if (leadsEndDate) { 
        const end = new Date(leadsEndDate); end.setHours(23, 59, 59, 999); 
        if (leadDate > end) matches = false; 
      }
    }
    return matches;
  });

  const totalPages = Math.ceil(filteredLeadsView.length / leadsPerPage);
  const paginatedLeads = filteredLeadsView.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  const filteredLeads = leads.filter(lead => {
    let matches = true;
    if (leadSourceFilter !== 'All') {
      const source = lead.source || '';
      if (!source.toLowerCase().includes(leadSourceFilter.toLowerCase())) matches = false;
    }
    if (startDate) { const leadDate = lead.createdAt?.toDate(); if (leadDate && leadDate < new Date(startDate)) matches = false; }
    if (endDate) { const leadDate = lead.createdAt?.toDate(); const end = new Date(endDate); end.setDate(end.getDate() + 1); if (leadDate && leadDate >= end) matches = false; }
    return matches;
  });

  const filteredFeedbackLeads = leads.filter(lead => {
    let matches = true;
    if (feedbackSourceFilter !== 'All') {
      const source = lead.source || '';
      if (!source.toLowerCase().includes(feedbackSourceFilter.toLowerCase())) matches = false;
    }
    if (feedbackStartDate) { const leadDate = lead.createdAt?.toDate(); if (leadDate && leadDate < new Date(feedbackStartDate)) matches = false; }
    if (feedbackEndDate) { const leadDate = lead.createdAt?.toDate(); const end = new Date(feedbackEndDate); end.setDate(end.getDate() + 1); if (leadDate && leadDate >= end) matches = false; }
    return matches;
  });

  const reportsData = useMemo(() => {
    const total = filteredLeads.length;
    const won = filteredLeads.filter(l => l.status === 'Closed Won').length;
    const lostOrJunk = filteredLeads.filter(l => l.status === 'Closed Lost' || l.status === 'Junk / Invalid').length;
    const active = total - won - lostOrJunk;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
    const trendMap = new Map<string, number>();
    filteredLeads.forEach(lead => {
      if(lead.createdAt) { const date = new Date(lead.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); trendMap.set(date, (trendMap.get(date) || 0) + 1); }
    });
    const trendChart = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count })).reverse(); 
    const agentMap = new Map<string, {name: string, totalLeads: number, wonDeals: number}>();
    filteredLeads.forEach(lead => {
      const agentId = lead.assignedToId || lead.assignedTo || 'unassigned';
      const agentName = lead.assignedToName || teamMembers.find(m => m.id === agentId)?.name || 'Unassigned';
      if (!agentMap.has(agentId)) { agentMap.set(agentId, { name: agentName, totalLeads: 0, wonDeals: 0 }); }
      const data = agentMap.get(agentId)!;
      data.totalLeads += 1;
      if (lead.status === 'Closed Won') data.wonDeals += 1;
    });
    const agentChart = Array.from(agentMap.values()).sort((a,b) => b.totalLeads - a.totalLeads).slice(0, 5);
    const pipelineChart = PIPELINE_STATUSES.map(status => { return { name: status, count: filteredLeads.filter(l => l.status === status).length }; }).filter(s => s.count > 0); 
    return { total, won, lostOrJunk, active, winRate, trendChart, agentChart, pipelineChart };
  }, [filteredLeads, teamMembers]);

  const feedbackSourceDataMap = new Map<string, number>();
  filteredFeedbackLeads.forEach(lead => { const source = lead.source || 'Manual'; feedbackSourceDataMap.set(source, (feedbackSourceDataMap.get(source) || 0) + 1); });
  const dynamicFeedbackSourceData = Array.from(feedbackSourceDataMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) { showDialog('alert', 'Notice', 'No leads found.'); return; }
    const headers = [ "Date", "First Name", "Last Name", "Email", "Phone", "Project/Property", "Status", "Source", "Sub-Source", "Assigned To", "Tags", "Designation", "Location", "LinkedIn", "Truecaller Name", "Ad Name", "Campaign Name", "Form ID", "Latest Feedback Note", "Note Author", "Note Date" ];
    const csvRows = filteredLeads.map(lead => {
      const dateStr = lead.createdAt ? new Date(lead.createdAt.toDate()).toLocaleDateString() : 'N/A';
      const assignedName = lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned';
      const tags = lead.tags ? lead.tags.join(' | ') : '';
      const sortedNotes = lead.notes ? [...lead.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      const latestNote = sortedNotes.length > 0 ? sortedNotes[0] : null;
      const escapeCSV = (val: any) => { if (val === null || val === undefined) return '""'; const str = String(val); return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`; };
      return [ escapeCSV(dateStr), escapeCSV(lead.firstName), escapeCSV(lead.lastName === 'Lead' ? '' : lead.lastName), escapeCSV(lead.email), escapeCSV(lead.phone), escapeCSV(lead.projectProperty), escapeCSV(lead.status), escapeCSV(lead.source), escapeCSV(lead.subSource), escapeCSV(assignedName), escapeCSV(tags), escapeCSV(lead.designation), escapeCSV(lead.location), escapeCSV(lead.linkedin), escapeCSV(lead.truecallerName), escapeCSV(lead.adName), escapeCSV(lead.campaignName), escapeCSV(lead.formId), escapeCSV(latestNote ? latestNote.text : ''), escapeCSV(latestNote ? latestNote.authorEmail : ''), escapeCSV(latestNote ? new Date(latestNote.timestamp).toLocaleString() : '') ].join(',');
    });
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `leads_master_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportFeedbackCSV = () => {
    if (filteredFeedbackLeads.length === 0) { showDialog('alert', 'Notice', 'No leads found.'); return; }
    const headers = [ "Lead Name", "Phone", "Email", "Status", "Source", "Assigned To", "Feedback Note", "Note Author", "Note Date" ];
    const csvRows: string[] = [];
    filteredFeedbackLeads.forEach(lead => {
      const assignedName = lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned';
      const escapeCSV = (val: any) => { if (val === null || val === undefined) return '""'; return `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ')}"`; };
      const baseRow = [ escapeCSV(`${lead.firstName} ${lead.lastName === 'Lead' ? '' : lead.lastName}`.trim()), escapeCSV(lead.phone), escapeCSV(lead.email), escapeCSV(lead.status), escapeCSV(lead.source), escapeCSV(assignedName) ];
      if (lead.notes && lead.notes.length > 0) {
        const sortedNotes = [...lead.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        sortedNotes.forEach(note => { csvRows.push([ ...baseRow, escapeCSV(note.text), escapeCSV(note.authorEmail), escapeCSV(new Date(note.timestamp).toLocaleString()) ].join(',')); });
      } else { csvRows.push([ ...baseRow, '""', '""', '""' ].join(',')); }
    });
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `lead_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const sourceDataMap = new Map<string, number>();
  filteredLeads.forEach(lead => { const source = lead.source || 'Manual'; sourceDataMap.set(source, (sourceDataMap.get(source) || 0) + 1); });
  const dynamicSourceData = Array.from(sourceDataMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const PIE_COLORS = ['#74ebd5', '#9face6', '#a1c4fd', '#c2e9fb', '#d4fc79', '#96e6a1', '#84fab0', '#8fd3f4', '#f5576c', '#f093fb'];

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let icon = <Globe className="w-3 h-3" />; let colorClass = "bg-slate-100 text-slate-600 border-slate-200"; let label = source || 'Manual';
    if (s.includes('facebook')) { icon = <Facebook className="w-3 h-3" />; colorClass = "bg-[#74ebd5]/10 text-[#4cb8a5] border-[#74ebd5]/30"; } 
    else if (s.includes('google')) { icon = <Search className="w-3 h-3" />; colorClass = "bg-amber-50 text-amber-700 border-amber-200"; } 
    else if (s.includes('website')) { icon = <Globe className="w-3 h-3" />; colorClass = "bg-[#9face6]/10 text-[#7a8ece] border-[#9face6]/30"; }
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>{icon} {label} {subSource ? `/ ${subSource}` : ''}</span>;
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.checked) { setSelectedLeads(paginatedLeads.map(l => l.id)); } else { setSelectedLeads([]); } };
  const handleSelectLead = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSelectedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]); };
  const toggleExpandLead = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]); };

  const handleDeleteSelected = async () => {
    showDialog('confirm', 'Delete Leads', `Are you sure you want to delete ${selectedLeads.length} selected leads? This cannot be undone.`, async () => {
      try {
        for (const id of selectedLeads) { await deleteDoc(doc(db, 'leads', id)); }
        setSelectedLeads([]); setOlderLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
        showDialog('success', 'Deleted', 'Selected leads have been deleted.');
      } catch (error) { showDialog('error', 'Delete Failed', 'Failed to delete some leads.'); }
    });
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeads.length === 0) return;

    if (campaignTab === 'email') {
      if (!emailSubject.trim() || !emailBody.trim()) return;
      setIsSendingCampaign(true);
      try {
        const targetEmails = leads.filter(l => selectedLeads.includes(l.id) && l.email).map(l => l.email);
        if (targetEmails.length === 0) { showDialog('error', 'No Valid Emails', 'None of the selected leads have an email address.'); setIsSendingCampaign(false); return; }
        const sendEmailFn = httpsCallable(functions, 'sendBulkEmailCampaign');
        await sendEmailFn({ subject: emailSubject, body: emailBody, targetEmails: targetEmails });
        setIsCampaignModalOpen(false); setEmailSubject(''); setEmailBody(''); setSelectedLeads([]);
        showDialog('success', 'Campaign Queued', `Successfully queued email campaign to ${targetEmails.length} recipients.`);
      } catch (error: any) { showDialog('error', 'Campaign Failed', error.message || 'Failed to send email campaign.'); } finally { setIsSendingCampaign(false); }
    } else if (campaignTab === 'whatsapp') {
      if (!whatsappTemplate) return;
      setIsSendingCampaign(true);
      try {
        const targetPhones = leads.filter(l => selectedLeads.includes(l.id) && l.phone).map(l => l.phone);
        if (targetPhones.length === 0) { showDialog('error', 'No Valid Phones', 'None of the selected leads have a phone number.'); setIsSendingCampaign(false); return; }
        const sendWhatsAppFn = httpsCallable(functions, 'sendBulkWhatsAppCampaign');
        await sendWhatsAppFn({ templateName: whatsappTemplate, targetPhones: targetPhones });
        setIsCampaignModalOpen(false); setSelectedLeads([]);
        showDialog('success', 'Campaign Queued', `Successfully queued WhatsApp campaign to ${targetPhones.length} recipients.`);
      } catch (error: any) { showDialog('error', 'Campaign Failed', error.message || 'Failed to send WhatsApp campaign.'); } finally { setIsSendingCampaign(false); }
    }
  };

  const handleSendWhatsAppReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeChatLeadId) return;
    const activeLead = leads.find(l => l.id === activeChatLeadId);
    if (!activeLead || !activeLead.phone) return;
    const mockMessageText = chatInput.trim();
    setChatInput('');
    try {
      await addDoc(collection(db, 'whatsapp_messages'), { clientId: user?.clientId, wabaId: 'internal_mock', senderPhone: normalizePhone(activeLead.phone), text: mockMessageText, type: 'text', direction: 'outbound', status: 'sent', timestamp: serverTimestamp(), createdAt: serverTimestamp(), isRead: true });
    } catch (error) { console.error("Failed to save mock reply:", error); showDialog('error', 'Send Failed', 'Could not dispatch WhatsApp message.'); }
  };

  const handleSyncTemplates = () => { setIsSyncingTemplates(true); setTimeout(() => { setIsSyncingTemplates(false); setToastData({ show: true, title: "Templates Synced", message: "Successfully fetched 4 approved templates from Meta Graph API.", color: "from-emerald-400 to-teal-500" }); }, 1500); };
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
  // ✨ LEVEL 5 SECURITY: The Iron Gate UI Lock
  if (workspaceStatus === 'SUSPENDED') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-[#74ebd5] selection:text-slate-900 z-[9999] relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-red-500/10 blur-3xl opacity-50 mix-blend-screen" />
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-orange-500/10 blur-3xl opacity-50 mix-blend-screen" />
        </div>
        <div className="bg-white/10 backdrop-blur-2xl p-10 rounded-3xl border border-white/10 shadow-2xl max-w-lg w-full text-center relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30 shadow-inner">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Service Suspended</h1>
          <p className="text-slate-300 font-medium mb-8 leading-relaxed">
            Your workspace has been temporarily deactivated. Access to the CRM, incoming webhooks, and automation services are currently paused.
          </p>
          <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 mb-8">
            <p className="text-sm text-slate-400 font-medium">To restore service and reactivate your workspace, please contact your system administrator.</p>
          </div>
          <button onClick={logout} className="w-full py-3.5 bg-white text-slate-900 font-bold rounded-xl shadow-lg hover:bg-slate-100 transition-all hover:-translate-y-0.5">
            Return to Login
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 shadow-inner ${dialogState.type === 'confirm' ? 'bg-amber-100 text-amber-600' : dialogState.type === 'error' ? 'bg-red-100 text-red-600' : dialogState.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                 {dialogState.type === 'confirm' ? <AlertCircle className="h-7 w-7" /> : dialogState.type === 'error' ? <XCircle className="h-7 w-7" /> : dialogState.type === 'success' ? <CheckCircle2 className="h-7 w-7" /> : <Info className="h-7 w-7" />}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{dialogState.title}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{dialogState.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              {dialogState.type === 'confirm' && (<button onClick={closeDialog} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-all font-bold text-sm shadow-sm">Cancel</button>)}
              <button onClick={() => { if (dialogState.type === 'confirm' && dialogState.onConfirm) dialogState.onConfirm(); else if (dialogState.onCloseAction) dialogState.onCloseAction(); closeDialog(); }} className={`flex-1 px-4 py-2.5 text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg ${dialogState.type === 'confirm' ? 'bg-slate-900 shadow-slate-900/20' : dialogState.type === 'error' ? 'bg-red-600 shadow-red-500/30' : 'bg-slate-900 shadow-slate-900/20'}`}>{dialogState.type === 'confirm' ? 'Confirm' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}

      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${campaignTab === 'whatsapp' ? 'bg-[#25D366]' : 'bg-indigo-600'}`}><MessageCircle className="w-5 h-5" /></div>
                <h3 className="text-xl font-extrabold text-slate-800">Campaign Composer</h3>
              </div>
              <button onClick={() => setIsCampaignModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex px-8 pt-6 gap-6 border-b border-slate-100">
              <button onClick={() => setCampaignTab('whatsapp')} className={`pb-4 text-sm font-bold transition-colors relative ${campaignTab === 'whatsapp' ? 'text-[#25D366]' : 'text-slate-400 hover:text-slate-600'}`}>WhatsApp Message{campaignTab === 'whatsapp' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#25D366] rounded-t-full" />}</button>
              <button onClick={() => setCampaignTab('email')} className={`pb-4 text-sm font-bold transition-colors relative ${campaignTab === 'email' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Email Blast{campaignTab === 'email' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}</button>
            </div>

            <form id="bulk-campaign-form" onSubmit={handleSendCampaign} className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-slate-50/30">
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center mb-2 shadow-sm">
                <span className="text-sm font-bold text-slate-700">Recipients Selected:</span>
                <span className={`px-3 py-1 text-white rounded-lg text-xs font-black ${campaignTab === 'whatsapp' ? 'bg-[#25D366]' : 'bg-indigo-600'}`}>{selectedLeads.length} Leads</span>
              </div>

              {campaignTab === 'whatsapp' ? (
                <div className="animate-in fade-in duration-300">
                  <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Select Meta-Approved Template</label>
                  <select value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/30 outline-none transition-all text-sm font-bold shadow-sm cursor-pointer">
                    <option value="project_launch_01">🚀 New Project Launch Invite</option>
                    <option value="site_visit_reminder">📍 Site Visit Confirmation</option>
                    <option value="festival_greeting">🎉 Festival Offer Greeting</option>
                    <option value="price_drop_alert">💰 Price Drop Alert</option>
                  </select>
                </div>
              ) : (
                <div className="animate-in fade-in duration-300 space-y-5">
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Subject</label><input type="text" required placeholder="e.g. Exclusive Preview: New Luxury Villas in Hyderabad" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm font-medium shadow-sm" /></div>
                  <div><div className="flex justify-between items-end mb-1.5"><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Email Body</label><span className="text-[10px] text-slate-400 font-medium">Use <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{'{{firstName}}'}</code> to personalize</span></div><textarea required rows={6} placeholder={`Hi {{firstName}},\n\nWe have an exciting new project launch...`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm font-medium shadow-sm resize-y" /></div>
                </div>
              )}
            </form>
            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0">
              <button type="button" onClick={() => setIsCampaignModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm">Cancel</button>
              <button type="submit" form="bulk-campaign-form" disabled={isSendingCampaign || selectedLeads.length === 0} className={`px-6 py-2.5 text-white rounded-xl transition-all font-bold text-sm shadow-lg disabled:opacity-50 flex justify-center items-center min-w-[150px] ${campaignTab === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#1EBE57] shadow-[#25D366]/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}>{isSendingCampaign ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{campaignTab === 'whatsapp' ? <MessageCircle className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />} Send Campaign</>}</button>
            </div>
          </div>
        </div>
      )}

      {toastData && toastData.show && (
        <div className="fixed top-6 right-6 z-[9999] bg-white/90 backdrop-blur-xl border border-[#74ebd5]/50 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-5 fade-in duration-300 flex items-start gap-4 w-80">
          <div className={`p-2.5 bg-gradient-to-br ${toastData.color || 'from-[#74ebd5] to-[#9face6]'} rounded-xl text-white shadow-md shrink-0`}><Zap className="w-5 h-5 animate-pulse" /></div>
          <div className="flex-1 pt-0.5"><h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{toastData.title}</h4><p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{toastData.message}</p></div>
          <button onClick={() => setToastData(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-slate-200/40 blur-3xl opacity-50 mix-blend-multiply" />
        <div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-amber-100/30 blur-3xl opacity-50 mix-blend-multiply" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-slate-200/40 blur-3xl opacity-50 mix-blend-multiply" />
      </div>

      <div className="md:hidden relative z-20 flex items-center justify-between bg-slate-900 border-b border-slate-800 p-4 shrink-0 shadow-sm">
        <img src={logoUrl} alt={companyName} className="h-10 w-auto brightness-0 invert opacity-90 object-contain" />
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="relative p-2 text-slate-300 hover:text-white">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>}
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-300 hover:text-white focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* ✨ SIDEBAR: Midnight Slate Theme (Collapsible Gmail Style) ✨ */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-all duration-300 md:static md:translate-x-0 shadow-2xl md:shadow-none ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        
        {/* Top Branding & Hamburger */}
        <div className={`h-24 flex items-center border-b border-slate-800 transition-all duration-300 ${isSidebarExpanded ? 'px-5 justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
              <Menu className="w-5 h-5" />
            </button>
            {isSidebarExpanded && (
              <img src={logoUrl} alt={companyName} className="h-8 w-auto brightness-0 invert opacity-90 object-contain animate-in fade-in" />
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className={`py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] transition-all duration-300 ${isSidebarExpanded ? 'px-6 text-left' : 'text-center text-[9px] px-1'}`}>
          {isSidebarExpanded ? 'Workspace' : 'W/S'}
        </div>
        
        <nav className="flex-1 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'leads', icon: Users, label: 'Leads' },
            { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
            { id: 'inbox', icon: MessageCircle, label: 'Inbox', badge: unreadWhatsAppCount },
            { id: 'campaigns', icon: Megaphone, label: 'Campaigns' },
            ...(user?.role === 'client_admin' ? [
              { id: 'team', icon: UserCog, label: 'Team' },
              { id: 'integrations', icon: Link2, label: 'Integrations' }
            ] : []),
            { id: 'reports', icon: BarChart2, label: 'Reports' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }} 
              title={!isSidebarExpanded ? item.label : undefined}
              className={`flex items-center w-full transition-all duration-200 group ${isSidebarExpanded ? 'px-4 py-3 justify-start rounded-xl' : 'py-3 justify-center rounded-2xl mx-auto w-12'} ${activeTab === item.id ? 'bg-slate-800 text-white font-bold border-r-4 border-amber-500' : 'text-slate-400 font-medium hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              <div className="relative flex items-center justify-center">
                <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-amber-500' : 'group-hover:text-amber-400 transition-colors'}`} />
                {item.badge ? (
                  <span className={`absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black border border-slate-900 ${activeTab === item.id ? 'bg-amber-500 text-slate-900' : 'bg-red-500 text-white'}`}>
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {isSidebarExpanded && (
                <span className="ml-3 truncate">{item.label}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-slate-50/50">
      <header className="relative z-40 h-24 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 hidden md:flex shadow-sm">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab === 'leads' ? 'Leads Management' : activeTab === 'feedback' ? 'Leads Feedback' : activeTab === 'team' ? 'Team Management' : activeTab === 'reports' ? 'Analytics Reports' : activeTab === 'inbox' ? 'Omnichannel Inbox' : activeTab === 'campaigns' ? 'Campaigns & Templates' : 'Integrations'}
          </h1>
          <div className="flex items-center gap-6">
            <div className="relative">
              <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className={`p-2.5 rounded-xl transition-all relative ${isNotificationOpen ? 'bg-slate-100 shadow-sm text-amber-500' : 'bg-white/60 hover:bg-white text-slate-500 hover:text-amber-500'}`}><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
              {isNotificationOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm">Notifications</h3>{unreadCount > 0 && <button onClick={markAllAsRead} className="text-[10px] font-bold text-amber-500 hover:text-amber-600 uppercase tracking-wider">Mark all read</button>}</div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs font-medium">No new notifications.</div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} onClick={() => { handleOpenTaskLead(notif.leadId); setIsNotificationOpen(false); }} className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.isRead ? 'bg-amber-50' : ''}`}>
                            <div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-slate-800">{notif.title}</span><span className="text-[10px] font-medium text-slate-400">{notif.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                            <p className="text-xs font-medium text-slate-500 line-clamp-2">{notif.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* ✨ TOP RIGHT SIGN OUT DROPDOWN ✨ */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white/80 hover:bg-white border border-slate-200 px-4 py-2.5 rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <UserCircle2 className="w-5 h-5 text-amber-500" /> 
                {user?.email}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-slate-50 mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signed in as</p>
                    <p className="text-xs font-medium text-slate-900 truncate">{user?.email}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      showDialog('confirm', 'Sign Out', 'Are you sure you want to sign out?', () => logout());
                    }} 
                    className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeTab === 'inbox' ? 'p-0 sm:p-4 md:p-8' : 'p-4 md:p-8'}`}>
          <div className={`max-w-7xl mx-auto h-full flex flex-col ${activeTab === 'inbox' ? 'min-w-0' : 'min-w-[800px] md:min-w-0'}`}>
            {/* ✨ INBOX TAB ✨ */}
            {activeTab === 'inbox' && (
              <div className="flex h-[calc(100vh-140px)] bg-white/80 backdrop-blur-2xl sm:rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden animate-in fade-in duration-300">
                <div className={`w-full sm:w-[320px] md:w-[360px] border-r border-slate-100 flex flex-col bg-slate-50/50 shrink-0 ${activeChatLeadId ? 'hidden sm:flex' : 'flex'}`}>
                  <div className="p-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-md sticky top-0 z-10"><h2 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#25D366]"/> Messages</h2><div className="mt-3 relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search chats..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#25D366]/30 outline-none shadow-sm" /></div></div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {(() => {
                      const leadsWithChats = leads.filter(l => l.phone).map(l => {
                        const normalizedPhone = normalizePhone(l.phone);
                        const msgsForLead = waMessages.filter(m => m.senderPhone === normalizedPhone);
                        return { ...l, msgs: msgsForLead, lastMsg: msgsForLead[msgsForLead.length - 1] };
                      }).filter(l => l.msgs.length > 0 || l.id === activeChatLeadId).sort((a, b) => {
                        const timeA = a.lastMsg ? (a.lastMsg.timestamp?.toMillis ? a.lastMsg.timestamp.toMillis() : new Date(a.lastMsg.timestamp).getTime()) : 0;
                        const timeB = b.lastMsg ? (b.lastMsg.timestamp?.toMillis ? b.lastMsg.timestamp.toMillis() : new Date(b.lastMsg.timestamp).getTime()) : 0;
                        return timeB - timeA;
                      });

                      if (leadsWithChats.length === 0) return (<div className="text-center p-6 mt-10"><MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" /><p className="text-sm font-bold text-slate-500">No messages yet</p><p className="text-xs text-slate-400 mt-1">When leads reply, they will appear here.</p></div>);

                      return leadsWithChats.map(l => {
                        const unreadC = l.msgs.filter(m => m.direction === 'inbound' && !m.isRead).length;
                        return (
                          <button key={l.id} onClick={() => setActiveChatLeadId(l.id)} className={`w-full text-left p-3 rounded-2xl transition-all flex gap-3 items-center ${activeChatLeadId === l.id ? 'bg-white shadow-md border border-slate-200' : 'hover:bg-slate-100/80 border border-transparent'}`}>
                            <div className="relative"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#74ebd5]/20 to-[#9face6]/20 text-[#50bdaf] flex items-center justify-center font-bold shadow-inner">{l.firstName.charAt(0)}</div>{unreadC > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full"></span>}</div>
                            <div className="flex-1 min-w-0"><div className="flex justify-between items-center mb-0.5"><h4 className="text-sm font-bold text-slate-800 truncate">{l.firstName} {l.lastName === 'Lead' ? '' : l.lastName}</h4><span className="text-[10px] font-bold text-slate-400 shrink-0">{(l.lastMsg && l.lastMsg.timestamp) ? new Date(l.lastMsg.timestamp.toDate ? l.lastMsg.timestamp.toDate() : l.lastMsg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span></div><p className={`text-xs truncate ${unreadC > 0 ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium'}`}>{l.lastMsg ? (l.lastMsg.direction === 'outbound' ? `You: ${l.lastMsg.text}` : l.lastMsg.text) : 'No messages'}</p></div>
                          </button>
                        )
                      });
                    })()}
                  </div>
                </div>

                <div className={`flex-1 flex flex-col bg-slate-50 relative ${!activeChatLeadId ? 'hidden sm:flex items-center justify-center' : 'flex'}`}>
                  {!activeChatLeadId ? (
                    <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-md"><div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><MessageCircle className="w-8 h-8 text-[#25D366]" /></div><h3 className="text-xl font-bold text-slate-800 mb-2">LeadSpot Omnichannel</h3><p className="text-sm text-slate-500 font-medium">Select a conversation from the left to start chatting securely with your leads.</p></div>
                  ) : (
                    <>
                      {(() => {
                        const activeLead = leads.find(l => l.id === activeChatLeadId); if (!activeLead) return null;
                        return (
                          <div className="h-16 px-4 border-b border-slate-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shrink-0 shadow-sm">
                            <div className="flex items-center gap-3"><button onClick={() => setActiveChatLeadId(null)} className="sm:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><ChevronDown className="w-5 h-5 rotate-90" /></button><div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#74ebd5]/20 to-[#9face6]/20 text-[#50bdaf] flex items-center justify-center font-bold">{activeLead.firstName.charAt(0)}</div><div><h3 className="text-sm font-bold text-slate-800">{activeLead.firstName} {activeLead.lastName === 'Lead' ? '' : activeLead.lastName}</h3><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border mt-0.5 ${getStatusBadgeClass(activeLead.status)}`}>{activeLead.status}</span></div></div>
                            <div className="flex items-center gap-2"><button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><Phone className="w-4 h-4"/></button><button onClick={() => openLeadDetails(activeLead)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Open Full Details"><MoreVertical className="w-4 h-4"/></button></div>
                          </div>
                        );
                      })()}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center bg-fixed bg-opacity-10 custom-scrollbar">
                        {(() => {
                          const activeLead = leads.find(l => l.id === activeChatLeadId); if (!activeLead) return null;
                          const normalizedPhone = normalizePhone(activeLead.phone);
                          const msgs = waMessages.filter(m => m.senderPhone === normalizedPhone);
                          if (msgs.length === 0) return (<div className="bg-white/80 backdrop-blur border border-slate-100 text-slate-500 text-xs font-bold p-3 rounded-xl mx-auto w-fit shadow-sm mt-4">This is the start of your conversation with {activeLead.firstName}.</div>);
                          return msgs.map((msg) => {
                            const isOutbound = msg.direction === 'outbound';
                            return (
                              <div key={msg.id} className={`flex w-full ${isOutbound ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`max-w-[75%] sm:max-w-[60%] rounded-2xl px-4 py-2.5 shadow-sm relative ${isOutbound ? 'bg-[#D9FDD3] text-slate-800 rounded-tr-sm border border-[#25D366]/20' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'}`}>
                                  {msg.type === 'image' && (<div className="mb-2 bg-black/5 rounded-xl h-32 flex items-center justify-center border border-black/10"><ImageIcon className="w-6 h-6 text-slate-400" /></div>)}
                                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                                  <div className={`flex justify-end items-center gap-1 mt-1 ${isOutbound ? 'text-green-800/60' : 'text-slate-400'}`}><span className="text-[9px] font-bold">{(msg.timestamp) ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}</span>{isOutbound && (<Check className={`w-3 h-3 ${msg.status === 'read' ? 'text-blue-500' : ''}`} />)}</div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="p-4 bg-white border-t border-slate-200/60 shrink-0">
                        <form onSubmit={handleSendWhatsAppReply} className="flex items-end gap-2">
                          <button type="button" className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"><Plus className="w-5 h-5" /></button>
                          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-[#25D366]/30 focus-within:border-[#25D366] transition-all flex items-center shadow-inner min-h-[50px]"><textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendWhatsAppReply(e); } }} placeholder="Type a message..." className="w-full bg-transparent border-none focus:ring-0 resize-none outline-none text-sm font-medium text-slate-800 max-h-[120px] custom-scrollbar py-1.5" rows={1} /></div>
                          <button type="submit" disabled={!chatInput.trim()} className="p-3 bg-[#25D366] text-white rounded-xl hover:bg-[#1EBE57] transition-all shadow-md disabled:opacity-50 disabled:transform-none hover:-translate-y-0.5 shrink-0 flex items-center justify-center w-[50px] h-[50px]"><Send className="w-5 h-5 ml-1" /></button>
                        </form>
                      </div>
                    </>
                  )}
                </div>

                {activeChatLeadId && (
                  <div className="w-[300px] border-l border-slate-100 bg-white/50 backdrop-blur-xl hidden lg:flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300">
                    {(() => {
                      const activeLead = leads.find(l => l.id === activeChatLeadId); if (!activeLead) return null;
                      return (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                          <div className="text-center pb-6 border-b border-slate-200/60"><div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#74ebd5] to-[#9face6] text-white flex items-center justify-center text-3xl font-black shadow-lg shadow-[#74ebd5]/20 mb-4">{activeLead.firstName.charAt(0)}</div><h3 className="text-lg font-extrabold text-slate-900">{activeLead.firstName} {activeLead.lastName === 'Lead' ? '' : activeLead.lastName}</h3><p className="text-sm font-bold text-slate-500 mt-1">{activeLead.phone || 'No Phone'}</p></div>
                          <div className="space-y-3">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Project Inquiry</p><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Home className="w-4 h-4 text-amber-500"/>{activeLead.projectProperty || 'General'}</p></div>
                            {activeLead.truecallerName && activeLead.truecallerName !== "Unknown" && (<div className="bg-blue-50/50 p-4 rounded-2xl shadow-sm border border-blue-100"><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Truecaller Verified</p><p className="text-sm font-bold text-blue-900">{activeLead.truecallerName}</p></div>)}
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lead Source</p>{getSourceBadge(activeLead.source, activeLead.subSource)}</div>
                          </div>
                          <button onClick={() => openLeadDetails(activeLead)} className="w-full py-3 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><LayoutDashboard className="w-4 h-4"/> Open Full Profile</button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            {/* ✨ DASHBOARD TAB ✨ */}
            {activeTab === 'dashboard' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 flex items-center gap-3">
  {greeting.text}, {user?.email?.split('@')[0]} 
  <span className="inline-block animate-bounce origin-bottom text-4xl" style={{ animationDuration: '2s', WebkitTextFillColor: 'initial', color: 'initial' }}>{greeting.emoji}</span>
</h2>
                  <p className="text-slate-500 text-sm font-medium">Here is what is happening with your leads today.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300"><div className="flex items-center justify-between mb-6"><h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Today's Leads</h3><div className="p-2.5 bg-[#74ebd5]/15 rounded-xl text-[#50bdaf] shadow-inner"><Zap className="w-5 h-5" /></div></div><div className="flex items-end gap-3"><p className="text-4xl font-black text-slate-800">{dashboardStats.todaysLeadsCount}</p></div></div>
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300"><div className="flex items-center justify-between mb-6"><h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">7-Day Volume</h3><div className="p-2.5 bg-[#9face6]/15 rounded-xl text-[#7b8ed3] shadow-inner"><Activity className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.trendChart.reduce((sum, item) => sum + item.count, 0)}</p></div>
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300"><div className="flex items-center justify-between mb-6"><h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Pipeline</h3><div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 shadow-inner"><Target className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.activePipelineCount}</p></div>
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.08)] border border-white hover:-translate-y-1 hover:shadow-lg transition-all duration-300"><div className="flex items-center justify-between mb-6"><h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Conversion Rate</h3><div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shadow-inner"><TrendingUp className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.conversionRate}%</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-8">Lead Generation Trend (Last 7 Days)</h3>
                    <div className="flex-1 min-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardStats.trendChart}>
                          <defs><linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#74ebd5" stopOpacity={0.4}/><stop offset="95%" stopColor="#74ebd5" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dx={-10} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600 }} itemStyle={{ color: '#50bdaf' }} />
                          <Area type="monotone" dataKey="count" stroke="#74ebd5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Today's Lead Sources</h3>
                    {dashboardStats.todaysSourceChart.length > 0 ? (
                      <div className="flex-1 flex flex-col justify-center min-h-[250px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={dashboardStats.todaysSourceChart} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name" stroke="none">{dashboardStats.todaysSourceChart.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">{dashboardStats.todaysSourceChart.map((source, index) => <div key={source.name} className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />{source.name} <span className="text-slate-400">({source.value})</span></div>)}</div>
                      </div>
                    ) : (<div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-slate-100"><Users className="w-10 h-10 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-500">No leads generated today</p><p className="text-xs text-slate-400 mt-1">Incoming leads will appear here.</p></div>)}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden flex flex-col">
                    <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold text-slate-800">Recent Leads</h3><button onClick={() => setActiveTab('leads')} className="text-xs font-bold text-[#50bdaf] hover:text-[#419c90] bg-[#74ebd5]/10 hover:bg-[#74ebd5]/20 px-3 py-1.5 rounded-lg transition-colors">View All</button></div>
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                      {leads.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                          <thead><tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500 font-bold"><th className="px-6 py-4">Lead Name</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
                          <tbody className="divide-y divide-slate-100/60">
                            {leads.slice(0, 5).map(lead => (
                              <tr key={lead.id} className="hover:bg-white/60 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap"><div className="font-bold text-slate-800 text-sm">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}</div><div className="text-xs text-slate-500">{lead.phone || lead.email}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold border ${getStatusBadgeClass(lead.status)}`}>{lead.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right"><button onClick={() => openLeadDetails(lead)} className="text-xs font-bold text-slate-600 hover:text-[#50bdaf] bg-white border border-slate-200 hover:border-[#74ebd5] shadow-sm px-3 py-1.5 rounded-lg transition-all">View</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (<div className="p-12 text-center text-slate-400 font-medium text-sm">No leads available to display.</div>)}
                    </div>
                  </div>
                  <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden flex flex-col">
                    <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BellRing className="w-5 h-5 text-amber-500" /> My Priority Tasks</h3><span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">{myPendingTasks.length} Pending</span></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/30">
                      {myPendingTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center p-8 h-full"><CheckSquare className="w-10 h-10 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-500">You're all caught up!</p><p className="text-xs text-slate-400 mt-1">Schedule new tasks from inside a Lead's profile.</p></div>
                      ) : (
                        <div className="space-y-4">
                          {myPendingTasks.map(task => {
                            const isOverdue = new Date(task.dueDate) < new Date();
                            return (
                              <div key={task.id} onClick={() => handleOpenTaskLead(task.leadId)} className="group flex items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer relative overflow-hidden">
                                {isOverdue && <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500"></div>}
                                <div><div className="flex items-center gap-2 mb-1.5"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded border border-slate-200">{task.type}</span><span className={`text-xs font-bold flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}><Clock className="w-3 h-3" />{isOverdue ? 'Overdue: ' : ''}{new Date(task.dueDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span></div><p className="text-sm font-bold text-slate-800">{task.leadName}</p>{task.note && <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1">{task.note}</p>}</div>
                                <button onClick={(e) => completeTask(e, task.id)} className="p-2 bg-slate-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl border border-slate-200 hover:border-emerald-500 transition-all shadow-sm shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100" title="Mark as Completed"><Check className="w-4 h-4" /><span className="text-[9px] font-bold">Done</span></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ LEADS TAB ✨ */}
            {activeTab === 'leads' && (
              <>
                <div className="flex justify-between items-center mb-8 shrink-0">
                  <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Leads</h2><p className="text-slate-500 text-sm font-medium">Manage and track your prospective customers.</p></div>
                  <div className="flex items-center gap-3">
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
                  
                  
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50" title="Upload a CSV with First Name, Last Name, Phone, Email, and Source">{isImporting ? <div className="w-4 h-4 border-2 border-slate-300 border-t-[#74ebd5] rounded-full animate-spin" /> : <Upload className="w-4 h-4" />} Import CSV</button>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-[#74ebd5]/30 text-sm font-bold text-white bg-gradient-to-r from-[#74ebd5] to-[#9face6] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#74ebd5] transition-all hover:-translate-y-0.5 whitespace-nowrap"><Plus className="w-4 h-4" /> Add New Lead</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] mb-8 shrink-0">
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-3 py-1.5 h-10 shadow-sm"><input type="date" value={leadsStartDate} max={leadsEndDate || undefined} onChange={(e) => { setLeadsStartDate(e.target.value); if (leadsEndDate && e.target.value > leadsEndDate) { setLeadsEndDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer" /><span className="text-slate-300 text-sm font-light">|</span><input type="date" value={leadsEndDate} min={leadsStartDate || undefined} onChange={(e) => { setLeadsEndDate(e.target.value); if (leadsStartDate && e.target.value < leadsStartDate) { setLeadsStartDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer" />{(leadsStartDate || leadsEndDate) && <button onClick={() => { setLeadsStartDate(''); setLeadsEndDate(''); }} className="ml-2 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">Clear</button>}</div>
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-4 py-1.5 h-10 flex-1 min-w-[200px] shadow-sm focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all"><Search className="w-4 h-4 text-slate-400 shrink-0" /><input type="text" placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => { 
  setSearchQuery(e.target.value); 
  setCurrentPage(1); // ✨ LEVEL 5 FIX: Instantly resets to Page 1 so results are never hidden!
}} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent w-full outline-none placeholder:font-normal" /></div>
                  <select value={leadsViewSourceFilter} onChange={(e) => setLeadsViewSourceFilter(e.target.value)} className="text-sm font-medium border border-slate-100 rounded-xl px-4 py-1.5 h-10 text-slate-600 bg-white/80 shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer"><option value="All">All Sources</option>{combinedSources.map(sourceName => <option key={sourceName} value={sourceName}>{sourceName}</option>)}</select>
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
                  <div className="flex items-center bg-white/80 border border-slate-100 rounded-xl p-1 h-10 shadow-sm"><button onClick={() => setViewMode('pipeline')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${viewMode === 'pipeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><KanbanSquare className="w-4 h-4" /> Pipeline</button><button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><List className="w-4 h-4" /> Table</button></div>
                </div>
                {loading ? (<div className="p-12 flex justify-center"><div className="w-10 h-10 border-4 border-[#74ebd5]/30 border-t-[#74ebd5] rounded-full animate-spin" /></div>) : leads.length === 0 ? (<div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] p-16 text-center flex flex-col items-center"><div className="bg-white p-4 rounded-2xl shadow-sm mb-4"><Users className="w-10 h-10 text-slate-300" /></div><h3 className="text-xl font-bold text-slate-800 mb-2">No leads found</h3><p className="text-slate-500 text-sm max-w-sm">Your pipeline is empty. Get started by adding a new lead manually or checking your integrations.</p></div>) : viewMode === 'table' ? (
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden shrink-0">
                    {selectedLeads.length > 0 && (
                      <div className="bg-indigo-50/90 backdrop-blur-md px-6 py-3 border-b border-indigo-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-indigo-800">{selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected</span>
                        <div className="flex gap-3">
                          <button onClick={() => { setCampaignTab('whatsapp'); setIsCampaignModalOpen(true); }} className="flex items-center gap-2 py-1.5 px-4 bg-[#25D366] hover:bg-[#1EBE57] text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-[#25D366]/20"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
                          <button onClick={() => { setCampaignTab('email'); setIsCampaignModalOpen(true); }} className="flex items-center gap-2 py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"><Send className="w-4 h-4" /> Email</button>
                          <button onClick={handleDeleteSelected} className="flex items-center gap-2 py-1.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/20"><Trash2 className="w-4 h-4" /> Delete</button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                      <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-xl shadow-sm"><tr className="text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200/60"><th className="px-6 py-4 w-10"><input type="checkbox" className="rounded-md border-slate-300 text-[#74ebd5] focus:ring-[#74ebd5] cursor-pointer w-4 h-4" checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length} onChange={handleSelectAll} /></th><th className="px-6 py-4 w-10"></th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Source</th><th className="px-6 py-4">Tags</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Project</th><th className="px-6 py-4">Assignee</th></tr></thead>
                      <tbody className="divide-y divide-slate-100/60 bg-transparent">
                          {paginatedLeads.map((lead) => {
                            // Extract initials and color styles just like the Kanban board!
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
                                  
                                  {/* ✨ LEVEL 5 FIX: Avatar & Typography Hierarchy */}
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
                                  
                                  {/* ✨ LEVEL 5 FIX: Icon Hover Glows */}
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
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    {user?.role === 'client_admin' ? (
                                      <select 
                                        value={lead.assignedToId || lead.assignedTo || ''} 
                                        onChange={(e) => { e.stopPropagation(); handleAssignLead(lead.id, e.target.value); }} 
                                        onClick={(e) => e.stopPropagation()} 
                                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:ring-2 focus:ring-[#74ebd5]/30 outline-none shadow-sm cursor-pointer group-hover:bg-white transition-colors"
                                      >
                                        <option value="">Unassigned</option>
                                        {teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                                      </select>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                                        {lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                
                                {/* Expanded Row Content */}
                                {expandedLeads.includes(lead.id) && (
                                  <tr className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200/50 shadow-inner">
                                    <td colSpan={10} className="px-6 py-5">
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
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-slate-100 bg-white/50 backdrop-blur-md flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-500">Showing <span className="font-bold text-slate-900">{((currentPage - 1) * leadsPerPage) + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * leadsPerPage, filteredLeadsView.length)}</span> of <span className="font-bold text-slate-900">{filteredLeadsView.length}</span> leads</div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">Previous</button>
                          <div className="flex items-center gap-1"><span className="text-sm font-bold text-slate-600 px-2 bg-white border border-slate-200 py-1.5 rounded-lg shadow-sm">{currentPage} / {totalPages}</span></div>
                          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ✨ LEVEL 5 ENTERPRISE PIPELINE VIEW ✨ */
                  <div className="flex-1 overflow-x-auto pb-6 pt-2 custom-scrollbar">
                    <div className="flex gap-5 h-full min-w-max px-2">
                      {PIPELINE_STATUSES.map(status => {
                        const colStyle = COLUMN_STYLES[status] || COLUMN_STYLES['New'];
                        const colLeads = filteredLeadsView.filter(l => l.status === status);
                        
                        return (
                          <div key={status} className={`w-[320px] flex flex-col bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.03)] overflow-hidden shrink-0 relative group`}>
                            {/* Accent Top Border */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 ${colStyle.dot} opacity-80`}></div>
                            
                            <div className="p-4 border-b border-slate-100/60 flex items-center justify-between shrink-0 mt-1">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-2.5 h-2.5 rounded-full ${colStyle.dot} shadow-sm`}></div>
                                <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{status}</h3>
                              </div>
                              <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border shadow-sm ${colStyle.bg} ${colStyle.text} ${colStyle.border}`}>
                                {colLeads.length}
                              </span>
                            </div>
                            
                            <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/30 hover:bg-slate-50/50 transition-colors">
                              {colLeads.map(lead => {
                                const agentName = lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned';
                                const initials = agentName !== 'Unassigned' ? agentName.substring(0, 2).toUpperCase() : '?';
                                const leadInitials = (lead.firstName.charAt(0) + (lead.lastName === 'Lead' ? '' : lead.lastName.charAt(0) || '')).toUpperCase() || 'L';

                                return (
                                  <div 
                                    key={lead.id} 
                                    onClick={() => openLeadDetails(lead)}
                                    className="bg-white rounded-xl p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_8px_25px_-5px_rgba(116,235,213,0.25)] hover:border-[#74ebd5]/50 transition-all duration-300 cursor-pointer relative"
                                  >
                                    {/* Top Row: Avatar, Name & Source */}
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex gap-3 items-center w-full min-w-0 pr-2">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 border ${colStyle.bg} ${colStyle.text} ${colStyle.border}`}>
                                          {leadInitials}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-[13px] font-extrabold text-slate-900 leading-tight truncate">
                                            {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
                                          </h4>
                                          <div className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5 uppercase flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {lead.createdAt ? new Date(lead.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'New'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Middle Row: Contact & Project */}
                                    <div className="space-y-1.5 mb-4 pl-[48px]">
                                      {lead.projectProperty && (
                                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium bg-slate-50 border border-slate-100 px-2 py-1 rounded-md w-fit max-w-full truncate">
                                          <Home className="w-3 h-3 text-slate-400 shrink-0"/> <span className="truncate">{lead.projectProperty}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" /> <span className="truncate">{lead.phone || 'No phone'}</span>
                                      </div>
                                    </div>

                                    {/* Bottom Row: Tags, Status Changer & Agent Avatar */}
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                                      <select
                                        value={lead.status}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(lead.id, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`text-[10px] font-extrabold rounded-lg px-2 py-1.5 cursor-pointer transition-all outline-none border shadow-sm ${colStyle.bg} ${colStyle.text} ${colStyle.border} hover:opacity-80`}
                                      >
                                        {PIPELINE_STATUSES.map(s => (
                                          <option key={s} value={s} className="bg-white text-slate-700">{s}</option>
                                        ))}
                                      </select>
                                      
                                      <div className="flex items-center gap-2">
                                        {lead.source && (
                                          <div className="scale-75 origin-right">
                                            {getSourceBadge(lead.source, undefined)}
                                          </div>
                                        )}
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500 shadow-sm" title={`Assigned to: ${agentName}`}>
                                          {initials}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {colLeads.length === 0 && (
                                <div className="h-24 border-2 border-dashed border-slate-200/50 rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Drag leads here
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {hasMoreLeads && leads.length > 0 && <div className="mt-6 flex justify-center pb-8"><button onClick={loadMoreLeads} disabled={loadingMoreLeads} className="flex items-center gap-2 px-8 py-3 bg-white/80 backdrop-blur-md border border-white rounded-2xl text-sm font-bold text-slate-700 hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">{loadingMoreLeads ? <><div className="w-4 h-4 border-2 border-slate-300 border-t-[#74ebd5] rounded-full animate-spin" />Loading...</> : <><Search className="w-4 h-4 text-[#74ebd5]" />Load More Leads</>}</button></div>}
              </>
            )}

            {/* ✨ FEEDBACK TAB ✨ */}
            {activeTab === 'feedback' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Leads Feedback</h2><p className="text-slate-500 text-sm font-medium">Analyze communication history and agent notes.</p></div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleExportFeedbackCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#74ebd5]/30 hover:opacity-90 hover:-translate-y-0.5 transition-all border border-transparent"><Download className="w-4 h-4" />Export Feedback</button>
                    <div className="flex flex-wrap items-center gap-4 bg-white/70 backdrop-blur-xl p-2.5 rounded-2xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)]">
                      <div className="flex items-center gap-2 px-3 bg-white border border-slate-100 rounded-xl py-1.5 shadow-sm"><Calendar className="w-4 h-4 text-[#74ebd5]" /><input type="date" value={feedbackStartDate} max={feedbackEndDate || undefined} onChange={(e) => { setFeedbackStartDate(e.target.value); if (feedbackEndDate && e.target.value > feedbackEndDate) { setFeedbackEndDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none" /><span className="text-slate-300 font-light">|</span><input type="date" value={feedbackEndDate} min={feedbackStartDate || undefined} onChange={(e) => { setFeedbackEndDate(e.target.value); if (feedbackStartDate && e.target.value < feedbackStartDate) { setFeedbackStartDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none" /></div>
                      <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
                      <select value={feedbackSourceFilter} onChange={(e) => setFeedbackSourceFilter(e.target.value)} className="text-sm font-bold border border-slate-100 rounded-xl px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 text-slate-700 cursor-pointer outline-none transition-all"><option value="All">All Sources</option>{combinedSources.map(sourceName => <option key={sourceName} value={sourceName}>{sourceName}</option>)}</select>
                    </div>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Feedback Distribution by Source</h3>
                  {dynamicFeedbackSourceData.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                      <div className="h-[250px] w-full max-w-md">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={dynamicFeedbackSourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" stroke="none">{dynamicFeedbackSourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-4">{dynamicFeedbackSourceData.map((source, index) => <div key={source.name} className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white/60 p-3 rounded-xl border border-white shadow-sm"><div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />{source.name} <span className="text-slate-400 font-medium ml-1">({source.value})</span></div>)}</div>
                    </div>
                  ) : (<div className="flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 rounded-2xl border border-slate-100"><MessageSquare className="w-10 h-10 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-500">No data available for the selected filters.</p></div>)}
                </div>
                <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40"><h3 className="text-lg font-bold text-slate-800">Lead Feedback Logs</h3></div>
                  <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md"><tr className="border-b border-slate-200/60 text-[10px] uppercase tracking-widest text-slate-500 font-bold"><th className="px-8 py-5">Lead Details</th><th className="px-8 py-5">Source</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 w-[45%]">Latest Feedback</th></tr></thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {filteredFeedbackLeads.map(lead => {
                          const sortedNotes = lead.notes ? [...lead.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
                          const latestNote = sortedNotes.length > 0 ? sortedNotes[0] : null;
                          return (
                            <tr key={lead.id} className="hover:bg-white/60 transition-colors cursor-pointer" onClick={() => openLeadDetails(lead)}>
                              <td className="px-8 py-5"><div className="font-bold text-slate-800">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}</div><div className="text-xs font-medium text-slate-500 mt-1">{lead.phone || lead.email}</div></td>
                              <td className="px-8 py-5 whitespace-nowrap">{getSourceBadge(lead.source, lead.subSource)}</td>
                              <td className="px-8 py-5 whitespace-nowrap"><span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold border ${getStatusBadgeClass(lead.status)} uppercase tracking-wider`}>{lead.status}</span></td>
                              <td className="px-8 py-5 min-w-[300px]">{latestNote ? <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 shadow-sm"><div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{latestNote.authorEmail}</span><span className="text-[10px] text-slate-400 font-bold">{new Date(latestNote.timestamp).toLocaleDateString()}</span></div><p className="text-sm font-medium text-slate-700 whitespace-pre-wrap line-clamp-2 leading-relaxed">{latestNote.text}</p></div> : <span className="text-xs font-medium text-slate-400 italic">No feedback recorded yet.</span>}</td>
                            </tr>
                          );
                        })}
                        {filteredFeedbackLeads.length === 0 && <tr><td colSpan={4} className="px-8 py-10 text-center text-sm font-medium text-slate-400">No leads found for the selected filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ CAMPAIGNS TAB ✨ */}
            {activeTab === 'campaigns' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">WhatsApp Campaigns</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage your Meta templates and track bulk message deliveries.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSyncTemplates} disabled={!whatsappConnected || isSyncingTemplates} className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${isSyncingTemplates ? 'animate-spin' : ''}`} /> Sync Templates
                    </button>
                    <button onClick={() => { setSelectedLeads([]); setCampaignTab('whatsapp'); setIsCampaignModalOpen(true); }} className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-[#25D366]/30 text-sm font-bold text-white bg-[#25D366] hover:bg-[#1EBE57] transition-all hover:-translate-y-0.5 whitespace-nowrap">
                      <Megaphone className="w-4 h-4" /> New Campaign
                    </button>
                  </div>
                </div>

                {!whatsappConnected && (
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600 shrink-0"><AlertCircle className="w-5 h-5"/></div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-800">WhatsApp Not Connected</h4>
                      <p className="text-xs text-amber-700 mt-1 font-medium leading-relaxed">You must connect your Meta WhatsApp Business account in the Integrations tab before you can sync templates or send campaigns.</p>
                      <button onClick={() => setActiveTab('integrations')} className="mt-3 text-xs font-bold bg-white text-amber-700 px-4 py-2 rounded-lg border border-amber-200 shadow-sm hover:bg-amber-100 transition-colors">Go to Integrations</button>
                    </div>
                  </div>
                )}

                <div className="flex px-2 border-b border-slate-200/60">
                  <button onClick={() => setCampaignViewTab('templates')} className={`pb-4 px-4 text-sm font-bold transition-colors relative ${campaignViewTab === 'templates' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Approved Templates{campaignViewTab === 'templates' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#25D366] rounded-t-full" />}</button>
                  <button onClick={() => setCampaignViewTab('history')} className={`pb-4 px-4 text-sm font-bold transition-colors relative ${campaignViewTab === 'history' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>Campaign History Logs{campaignViewTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#25D366] rounded-t-full" />}</button>
                </div>

                {campaignViewTab === 'templates' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
                    {[
                      { id: 1, name: 'project_launch_01', type: 'MARKETING', status: 'APPROVED', lang: 'en', preview: '🚀 Exciting news! We are thrilled to announce the launch of our newest luxury property: {{1}}. Reply YES for exclusive floor plans and early-bird pricing.' },
                      { id: 2, name: 'site_visit_reminder', type: 'UTILITY', status: 'APPROVED', lang: 'en', preview: 'Hi {{1}}, this is a quick reminder for your scheduled site visit tomorrow at {{2}}. We look forward to showing you the property! 📍' },
                      { id: 3, name: 'festival_greeting', type: 'MARKETING', status: 'APPROVED', lang: 'en', preview: '✨ Wishing you and your family a very Happy {{1}}! Unlock special festive discounts of up to {{2}} on bookings made this month.' },
                      { id: 4, name: 'price_drop_alert', type: 'MARKETING', status: 'PENDING', lang: 'en', preview: 'Great news {{1}}! The price for the unit you viewed at {{2}} has just been reduced. Let me know if you would like to secure it today.' },
                    ].map(template => (
                      <div key={template.id} className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{template.name}</h4>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{template.type} • {template.lang}</span>
                          </div>
                          <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-md border ${template.status === 'APPROVED' ? 'bg-[#D9FDD3] text-green-700 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>{template.status}</span>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-inner">
                          <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{template.preview}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">Meta ID: {Math.floor(Math.random() * 1000000000)}</span>
                          <button onClick={() => { setWhatsappTemplate(template.name); setSelectedLeads([]); setCampaignTab('whatsapp'); setIsCampaignModalOpen(true); }} className="text-xs font-bold text-[#25D366] hover:text-[#1EBE57] bg-[#25D366]/10 px-3 py-1.5 rounded-lg transition-colors">Use Template</button>
                        </div>
                      </div>
                    ))}
                    <div className="bg-white/40 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center hover:bg-white/60 hover:border-slate-300 transition-colors cursor-pointer min-h-[250px]">
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3"><Plus className="w-6 h-6 text-slate-400" /></div>
                      <h4 className="text-sm font-bold text-slate-700">Create New Template</h4>
                      <p className="text-xs font-medium text-slate-500 mt-1 max-w-[200px]">Design a new message in Meta Business Manager and click sync to import it.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                    <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-slate-800">Campaign History Logs</h3>
                      {whatsappNumberId && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">WABA: {whatsappNumberId}</span>}
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                      {campaignsList.length === 0 ? (
                        <div className="p-16 text-center flex flex-col items-center">
                          <div className="bg-slate-50 p-4 rounded-2xl shadow-sm mb-4 border border-slate-100"><Megaphone className="w-10 h-10 text-slate-300" /></div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">No campaigns sent yet</h3>
                          <p className="text-slate-500 text-sm">Select leads from your Leads table and click WhatsApp to fire your first bulk campaign.</p>
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200/60 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Template Used</th>
                              <th className="px-6 py-4">Sent By</th>
                              <th className="px-6 py-4 text-center">Attempted</th>
                              <th className="px-6 py-4 text-center">Delivered</th>
                              <th className="px-6 py-4 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/60">
                            {campaignsList.map(camp => (
                              <tr key={camp.id} className="hover:bg-white/60 transition-colors">
                                <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-700">{camp.createdAt?.toDate ? camp.createdAt.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Processing...'}</td>
                                <td className="px-6 py-5 whitespace-nowrap"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><span className="text-sm font-bold text-slate-800">{camp.templateName}</span></div></td>
                                <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500">{camp.senderEmail}</td>
                                <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-black text-slate-700">{camp.totalAttempted}</td>
                                <td className="px-6 py-5 whitespace-nowrap text-center"><span className="text-sm font-black text-[#25D366] bg-[#25D366]/10 px-2 py-1 rounded-lg">{camp.successCount}</span></td>
                                <td className="px-6 py-5 whitespace-nowrap text-right"><span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border ${camp.status?.includes('Mock') ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'}`}>{camp.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

         {/* ✨ TEAM TAB ✨ */}
            {activeTab === 'team' && (
              <div className="w-full max-w-6xl mx-auto space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Team</h2>
                      <p className="text-slate-500 text-sm font-medium">Manage your sales agents and their access.</p>
                    </div>
                    {user?.role === 'client_admin' && (
                      <button onClick={() => setIsAgentModalOpen(true)} className="flex items-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-[#74ebd5]/30 text-sm font-bold text-white bg-gradient-to-r from-[#74ebd5] to-[#9face6] hover:opacity-90 transition-all hover:-translate-y-0.5 border border-transparent">
                        <UserPlus className="w-4 h-4 mr-2" />Add New Agent
                      </button>
                    )}
                  </div>
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden">
                    {agents.length === 0 ? (
                      <div className="p-16 text-center flex flex-col items-center"><div className="bg-white p-4 rounded-2xl shadow-sm mb-4"><Users className="w-10 h-10 text-slate-300" /></div><h3 className="text-xl font-bold text-slate-800 mb-2">No agents found</h3><p className="text-slate-500 text-sm">Get started by adding a new agent to your team.</p></div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead><tr className="bg-slate-100/80 border-b border-slate-200/60 text-xs uppercase tracking-wider text-slate-500 font-bold"><th className="px-6 py-4">Name</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Date Added</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                          <tbody className="divide-y divide-slate-100/60">
                            {agents.map((agent) => (
                              <tr key={agent.id} className="hover:bg-white/60 transition-colors group">
                                <td className="px-6 py-5 whitespace-nowrap">{inlineEditingAgentId === agent.id ? <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200"><input type="text" value={inlineEditingName} onChange={(e) => setInlineEditingName(e.target.value)} className="px-3 py-1.5 text-sm font-medium border-none rounded-lg focus:ring-2 focus:ring-[#74ebd5] outline-none w-48" autoFocus /><button onClick={() => handleSaveInlineEdit(agent.id)} className="text-white bg-[#74ebd5] hover:bg-[#50bdaf] px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Save</button><button onClick={() => setInlineEditingAgentId(null)} className="text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Cancel</button></div> : <div className="font-bold text-slate-800">{agent.name}</div>}</td>
                                <td className="px-6 py-5 whitespace-nowrap"><div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" />{agent.email}</div></td>
                                <td className="px-6 py-5 whitespace-nowrap"><span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold bg-[#74ebd5]/10 text-[#4cb8a5] border border-[#74ebd5]/30 uppercase tracking-widest">Agent</span></td>
                                <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-slate-500"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" />{agent.createdAt ? new Date(agent.createdAt.toDate ? agent.createdAt.toDate() : agent.createdAt).toLocaleDateString() : 'Just now'}</div></td>
                                <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium"><button onClick={() => handleEditAgent(agent)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mr-2"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteAgent(agent.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {user?.role === 'client_admin' && (
                  <div>
                    <div className="flex items-center justify-between mb-6 mt-12">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Advanced Auto-Assignment</h2>
                        <p className="text-slate-500 text-sm font-medium">Automatically route incoming leads based on specific Projects or Traffic Sources.</p>
                      </div>
                    </div>
                    <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden">
                      <div className="p-6 border-b border-white/80 bg-white/40">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Create New Routing Rule</h3>
                        
                      {/* ✨ LEVEL 5 FIX: Dynamic rule type switching and smart datalist! */}
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          if (!user?.clientId || !newRuleValue || !newRuleAgentId) return;

                          setAddingRule(true);
                          try {
                            const agent = teamMembers.find(m => m.id === newRuleAgentId);
                            if (!agent) return;
                            const payload: any = { clientId: user.clientId, agentId: newRuleAgentId, agentName: agent.name, createdAt: serverTimestamp() };
                            
                            // Save correctly based on the selected type
                            if (newRuleType === 'project') payload.projectName = newRuleValue;
                            else payload.sourceName = newRuleValue;

                            const docRef = await addDoc(collection(db, 'lead_assignment_rules'), payload);
                            setAssignmentRules(prev => [...prev, { id: docRef.id, ...payload }]);
                            
                            // Reset the form fields after successful save
                            setNewRuleValue('');
                            setNewRuleAgentId('');
                            showDialog('success', 'Success', `Rule added for ${newRuleValue}.`);
                          } catch(err) {
                            showDialog('error', 'Error', 'Failed to add rule.');
                          } finally {
                            setAddingRule(false);
                          }
                        }} className="flex flex-col sm:flex-row gap-4 items-end">
                          
                          <div className="w-full sm:w-48">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Rule Type</label>
                            <select value={newRuleType} onChange={(e) => { setNewRuleType(e.target.value); setNewRuleValue(''); }} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all cursor-pointer">
                              <option value="project">Project Name</option>
                              <option value="source">Lead Source</option>
                            </select>
                          </div>

                          <div className="flex-1 w-full">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Match Value</label>
                            {/* Placeholder changes dynamically based on selection */}
                            <input type="text" value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} list="dynamic-list" placeholder={newRuleType === 'project' ? "e.g. Your Project" : "e.g. Facebook"} required className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all" />
                            <datalist id="dynamic-list">
                              {/* Conditionally render the dropdown items! */}
                              {newRuleType === 'project' 
                                ? uniqueProjects.map(proj => <option key={`p-${proj}`} value={proj} />)
                                : combinedSources.map(src => <option key={`s-${src}`} value={src} />)
                              }
                            </datalist>
                          </div>

                          <div className="flex-1 w-full">
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Assign To Agent</label>
                            <select value={newRuleAgentId} onChange={(e) => setNewRuleAgentId(e.target.value)} required className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all cursor-pointer">
                              <option value="">Select an agent...</option>
                              {teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                            </select>
                          </div>

                          <button type="submit" disabled={!newRuleValue || !newRuleAgentId || addingRule} className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl shadow-lg shadow-slate-900/10 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                            {addingRule ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Add Rule</>}
                          </button>
                        </form>
                      </div>

                      {assignmentRules.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 text-sm font-medium">No routing rules configured yet.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-200/60 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                <th className="px-6 py-4">Trigger Condition</th>
                                <th className="px-6 py-4">Assigned Agent</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/60">
                              {assignmentRules.map((rule) => (
                                <tr key={rule.id} className="hover:bg-white/60 transition-colors">
                                  <td className="px-6 py-5 whitespace-nowrap">
                                    <div className="font-bold text-slate-800 flex items-center gap-3">
                                      {rule.projectName ? (
                                        <><div className="p-1.5 bg-amber-50 rounded-md text-amber-500"><Home className="w-4 h-4" /></div> Project: {rule.projectName}</>
                                      ) : (
                                        <><div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Globe className="w-4 h-4" /></div> Source: {rule.sourceName}</>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-5 whitespace-nowrap"><div className="flex items-center gap-3 text-sm font-medium text-slate-600"><div className="p-1.5 bg-indigo-50 rounded-md text-indigo-400"><UserCircle2 className="w-4 h-4" /></div>{rule.agentName}</div></td>
                                  <td className="px-6 py-5 whitespace-nowrap text-right"><button onClick={() => handleDeleteRule(rule.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Rule"><Trash2 className="w-4 h-4" /></button></td>
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
            )}
            {/* ✨ INTEGRATIONS TAB ✨ */}
            {activeTab === 'integrations' && (
              <div className="w-full max-w-6xl mx-auto space-y-8">
                <div className="mb-8">
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">External Integrations</h2>
                  <p className="text-slate-500 text-sm font-medium">Connect your Facebook Ads, Google Ads, or Website to capture leads automatically.</p>
                </div>

                <div className="space-y-6">
                  {/* WHATSAPP CLOUD API EMBEDDED SIGNUP CARD */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-[#25D366]/20 rounded-2xl text-[#1EBE57] shadow-lg shadow-[#25D366]/10"><MessageCircle className="w-8 h-8" /></div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold text-slate-900 tracking-tight">WhatsApp Cloud API</h3>
                              {whatsappConnected ? <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-[#25D366]/20 text-[#1a9347] border border-[#25D366]/40 uppercase tracking-widest">Connected</span> : <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest">Not Connected</span>}
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Connect your WhatsApp Business number to send automated bulk campaigns directly from the CRM.</p>
                          </div>
                        </div>
                        <div>
                          {whatsappConnected ? (
                            <div className="px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold flex flex-col items-center shadow-sm">
                              <span className="text-[10px] text-slate-400 uppercase tracking-widest">Phone ID</span>
                              <span className="font-mono mt-0.5">{whatsappNumberId || 'Pending'}</span>
                            </div>
                          ) : (
                            <button onClick={handleConnectWhatsApp} disabled={isLinkingWhatsApp} className="px-6 py-3 bg-[#25D366] text-white hover:bg-[#1EBE57] rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#25D366]/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none whitespace-nowrap">
                              {isLinkingWhatsApp ? 'Connecting...' : 'Connect WhatsApp'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FACEBOOK LEAD ADS CARD */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-start sm:items-center gap-5">
                          <div className="p-4 bg-gradient-to-br from-[#9face6] to-[#7b8ed3] rounded-2xl text-white shadow-lg shadow-[#9face6]/30 shrink-0"><Facebook className="w-8 h-8" /></div>
                          <div>
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Meta / Facebook Ads</h3>
                              {isLoadingLinkedPages ? <div className="h-6 w-24 bg-slate-200 rounded-lg animate-pulse"></div> : linkedPages.length > 0 ? <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-[#74ebd5]/20 text-[#50bdaf] border border-[#74ebd5]/40 uppercase tracking-widest">Connected</span> : <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest">Not Connected</span>}
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Automatically sync leads from your Facebook Lead Ads directly into your CRM.</p>
                            
                            {/* ✨ THE STRATEGY 2 FRAMING TEXT ✨ */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-3 mt-3 shadow-sm max-w-xl">
                              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                <span className="font-bold text-slate-700">Secure Architecture:</span> To ensure enterprise-grade API stability, your Meta authentication is securely routed through our verified infrastructure partner, <strong className="text-slate-700">Leadspot Solutions</strong>.
                              </p>
                            </div>

                          </div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                          <button onClick={handleConnectFacebook} disabled={isLoadingFb} className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-bold transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none whitespace-nowrap">
                            {isLoadingFb ? 'Connecting...' : 'Connect Facebook'}
                          </button>
                          <a href="https://www.facebook.com/settings?tab=business_tools&ref=settings" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[#7b8ed3] hover:text-indigo-600 hover:underline transition-colors sm:text-right">
                            Missing a new page? Edit Meta Permissions here.
                          </a>
                        </div>
                      </div>
                      
                      {linkedPages.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Connected Pages</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {linkedPages.map(page => (
                              <div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3"><div className="p-2 bg-[#9face6]/10 rounded-lg text-[#7b8ed3]"><Globe className="w-5 h-5"/></div><div><p className="text-sm font-bold text-slate-800">{page.pageName}</p><p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.pageId}</p></div></div>
                                <button onClick={() => handleDisconnectPage(page.id)} className="text-[11px] font-bold text-red-600 hover:text-white px-3 py-1.5 bg-red-50 hover:bg-red-500 rounded-lg transition-colors border border-red-100 hover:border-red-500">Disconnect</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {fbPages.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Available Pages to Link</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {fbPages.map(page => {
                              const isLinked = linkedPages.some(lp => lp.pageId === page.id);
                              return (
                                <div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center gap-3"><div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Facebook className="w-5 h-5"/></div><div><p className="text-sm font-bold text-slate-800">{page.name}</p><p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.id}</p></div></div>
                                  <button onClick={() => handleLinkPage(page)} disabled={isLinked || isLinking} className={`text-[11px] font-bold px-4 py-2 rounded-lg transition-all ${isLinked || isLinking ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-[#9face6]/10 text-[#7b8ed3] hover:bg-[#9face6] hover:text-white border border-[#9face6]/30 shadow-sm'}`}>{isLinking ? 'Securing...' : isLinked ? 'Linked' : 'Link Page'}</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INBOUND WEBHOOK CARD */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-gradient-to-br from-[#74ebd5] to-[#50bdaf] rounded-2xl text-white shadow-lg shadow-[#74ebd5]/30"><Zap className="w-6 h-6" /></div><div><h3 className="text-xl font-bold text-slate-900 tracking-tight">Your Unique Webhook URL</h3><p className="text-slate-500 text-sm font-medium mt-1">Use this endpoint to send leads from any external platform.</p></div></div>
                      <div className="bg-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-inner relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#74ebd5]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <code className="text-sm text-[#74ebd5] break-all font-mono font-medium relative z-10">{webhookUrl}</code>
                        <button onClick={handleCopy} className="shrink-0 p-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all shadow-sm relative z-10 border border-slate-700" title="Copy to clipboard">{copied ? <Check className="w-5 h-5 text-[#74ebd5]" /> : <Copy className="w-5 h-5" />}</button>
                      </div>
                      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-200/60">
                        <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Facebook className="w-4 h-4 text-[#7b8ed3]" />Facebook Ads</div><p className="text-xs text-slate-500 leading-relaxed font-medium">Connect via Zapier or Pabbly Connect using this webhook URL to capture leads from Facebook Lead Forms.</p></div>
                        <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Search className="w-4 h-4 text-amber-500" />Google Ads</div><p className="text-xs text-slate-500 leading-relaxed font-medium">Paste this URL into your Google Ads Lead Form extension settings to receive leads in real-time.</p></div>
                        <div className="space-y-2"><div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Globe className="w-4 h-4 text-[#50bdaf]" />Website Forms</div><p className="text-xs text-slate-500 leading-relaxed font-medium">Send a POST request from your website's contact form directly to this endpoint.</p></div>
                      </div>
                    </div>
                  </div>

                  {/* GOOGLE SHEETS PIPELINE */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30"><Globe className="w-6 h-6" /></div>
                        <div><h3 className="text-xl font-bold text-slate-900 tracking-tight">Google Sheets Sync</h3><p className="text-slate-500 text-sm font-medium mt-1">Push leads instantly to a Google Sheet using an Apps Script Web App.</p></div>
                      </div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Apps Script Web App URL</label>
                            <input type="url" value={googleSheetUrl} onChange={(e) => setGoogleSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm" />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button onClick={handleSaveGoogleSheet} disabled={isSavingSheets} className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
                              {isSavingSheets ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save Sheets Sync
                            </button>
                            <button onClick={handleTestGoogleSheet} disabled={isTestingSheets} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50">
                              {isTestingSheets ? 'Sending...' : 'Test Connection'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EMAIL ALERTS */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300 mt-6">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl text-white shadow-lg shadow-red-500/30"><Mail className="w-6 h-6" /></div>
                        <div><h3 className="text-xl font-bold text-slate-900 tracking-tight">Instant Email Alerts</h3><p className="text-slate-500 text-sm font-medium mt-1">Receive an instant HTML table breakdown in your inbox every time a lead arrives.</p></div>
                      </div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Notification Recipients</label>
                            <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all shadow-sm min-h-[52px]">
                              {emailList.map(email => (
                                <span key={email} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm animate-in zoom-in-95">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {email}
                                  <button type="button" onClick={() => handleRemoveEmailTag(email)} className="text-slate-400 hover:text-red-500 transition-colors ml-1 focus:outline-none">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                              <input 
                                type="email" 
                                value={emailInput} 
                                onChange={(e) => setEmailInput(e.target.value)} 
                                onKeyDown={handleAddEmailTag}
                                onBlur={handleAddEmailTag}
                                placeholder={emailList.length === 0 ? "sales@domain.com (Press Enter)" : "Add another email..."} 
                                className="flex-1 min-w-[200px] bg-transparent border-none focus:ring-0 text-sm font-medium outline-none px-2 py-1.5 text-slate-700 placeholder:text-slate-400" 
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-2">Type an email address and press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px]">Enter</kbd> to add it to the list.</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button onClick={handleSaveAlertEmails} disabled={isSavingAlerts} className="px-6 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center gap-2">
                              {isSavingAlerts ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save Alert Emails
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ENTERPRISE CRM API BRIDGE */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden hover:shadow-lg transition-all duration-300 mt-6">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30"><Link2 className="w-6 h-6" /></div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">Enterprise API Bridge <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] uppercase tracking-widest font-black rounded-md border border-indigo-200">Pro Feature</span></h3>
                          <p className="text-slate-500 text-sm font-medium mt-1">Route leads directly to external CRMs (Salesforce, Zoho) or Zapier/Make endpoints.</p>
                        </div>
                      </div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Webhook / API Endpoint URL</label>
                            <input type="url" value={outboundWebhookUrl} onChange={(e) => setOutboundWebhookUrl(e.target.value)} placeholder="https://api.salesforce.com/..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm" />
                          </div>
                          
                          <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Custom Headers (Authentication)</h4>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Add Auth Tokens or API Keys for direct CRM pushes. Leave blank for Zapier.</p>
                              </div>
                              <button onClick={() => setOutboundHeaders([...outboundHeaders, {key: '', value: ''}])} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm">
                                <Plus className="w-3 h-3" /> Add Header
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              {outboundHeaders.map((header, index) => (
                                <div key={index} className="flex items-center gap-2 animate-in fade-in duration-200">
                                  <input type="text" placeholder="Key (e.g. Authorization)" value={header.key} onChange={(e) => { const newH = [...outboundHeaders]; newH[index].key = e.target.value; setOutboundHeaders(newH); }} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" />
                                  <input type="text" placeholder="Value (e.g. Bearer token123)" value={header.value} onChange={(e) => { const newH = [...outboundHeaders]; newH[index].value = e.target.value; setOutboundHeaders(newH); }} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" />
                                  <button onClick={() => setOutboundHeaders(outboundHeaders.filter((_, i) => i !== index))} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors shadow-sm"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>
                              ))}
                              {outboundHeaders.length === 0 && (
                                <div className="text-center py-4 text-[11px] font-medium text-slate-400 italic bg-white border border-slate-200 border-dashed rounded-lg">No custom headers added.</div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button onClick={handleSaveCustomCRM} disabled={isSavingCRM} className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2">
                              {isSavingCRM ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save API Bridge
                            </button>
                            <button onClick={handleTestCustomCRM} disabled={isTestingCRM} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50">
                              {isTestingCRM ? 'Sending...' : 'Test Connection'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FULL PAYLOAD FORMAT CARD */}
                  <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden p-8">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-3">Payload Format</h3>
                    <p className="text-sm font-medium text-slate-500 mb-6">Your external source should send a JSON POST request with the following fields. Include UTM tracking parameters to measure campaign ROI.</p>
                    <div className="bg-[#0f172a] rounded-2xl p-6 overflow-x-auto relative shadow-inner border border-slate-800">
                      <button onClick={() => { 
                        const payloadObject = { 
                          "firstName": "Ravi", 
                          "lastName": "Kumar", 
                          "email": "ravi.kumar@example.com", 
                          "phone": "+919876543210", 
                          "projectProperty": "Project Name", 
                          "source": "Website", 
                          "subSource": "Contact Us Form", 
                          "adName": "ad Name", 
                          "campaignName": "Campaign Name", 
                          "utm_source": "google", 
                          "utm_medium": "cpc", 
                          "utm_campaign": "utm Source", 
                          "message": "I am interested in a 4BHK villa." 
                        }; 
                        navigator.clipboard.writeText(JSON.stringify(payloadObject, null, 2)); 
                        setIsCopied(true); 
                        setTimeout(() => setIsCopied(false), 2000); 
                      }} className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm z-10">
                        {isCopied ? 'Copied!' : 'Copy JSON'}
                      </button>
                      <pre className="text-sm text-[#74ebd5] font-mono leading-relaxed">{`{
  "firstName": "Ravi",
  "lastName": "Kumar",
  "email": "ravi.kumar@example.com",
  "phone": "+919876543210",
  "projectProperty": "Neopolis Luxury Villas",
  "source": "Website",
  "subSource": "Contact Us Form",
  "adName": "Summer_Promo_01",
  "campaignName": "Hyderabad_Villas_Q2",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "hyderabad_luxury",
  "message": "I am interested in a 4BHK villa."
}`}</pre>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ✨ REPORTS TAB RENDER ✨ */}
            {activeTab === 'reports' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Advanced Analytics</h2>
                    <p className="text-slate-500 text-sm font-medium">Enterprise-level insights, pipeline health, and agent performance.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#74ebd5]/30 hover:opacity-90 hover:-translate-y-0.5 transition-all border border-transparent">
                      <Download className="w-4 h-4" /> Export Master Data
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white/70 backdrop-blur-xl p-3 rounded-2xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)]">
                  <div className="flex items-center gap-2 px-3 bg-white border border-slate-100 rounded-xl py-1.5 shadow-sm">
                    <Calendar className="w-4 h-4 text-[#74ebd5]" />
                    <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); }} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none" />
                    <span className="text-slate-300 font-light">|</span>
                    <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => { setEndDate(e.target.value); if (startDate && e.target.value < startDate) setStartDate(e.target.value); }} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent cursor-pointer outline-none" />
                    {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-2 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">Clear</button>}
                  </div>
                  <select value={leadSourceFilter} onChange={(e) => setLeadSourceFilter(e.target.value)} className="text-sm font-bold border border-slate-100 rounded-xl px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 text-slate-700 cursor-pointer outline-none transition-all">
                    <option value="All">All Sources</option>
                    {combinedSources.map(sourceName => <option key={sourceName} value={sourceName}>{sourceName}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500"/> Total Leads</h3>
                    <p className="text-4xl font-black text-slate-800">{reportsData.total}</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-amber-500"/> Active Pipeline</h3>
                    <p className="text-4xl font-black text-slate-800">{reportsData.active}</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> Win Rate</h3>
                    <div className="flex items-baseline gap-2"><p className="text-4xl font-black text-slate-800">{reportsData.winRate}%</p><span className="text-xs font-bold text-slate-400 mb-1">({reportsData.won} Deals)</span></div>
                  </div>
                  <div className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><XCircle className="w-4 h-4 text-red-400"/> Lost / Junk</h3>
                    <p className="text-4xl font-black text-slate-800">{reportsData.lostOrJunk}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col min-h-[350px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Lead Generation Trend</h3>
                    {reportsData.trendChart.length > 0 ? (
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={reportsData.trendChart}>
                            <defs><linearGradient id="colorTrendReports" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9face6" stopOpacity={0.4}/><stop offset="95%" stopColor="#9face6" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dx={-10} allowDecimals={false} />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600 }} itemStyle={{ color: '#7b8ed3' }} />
                            <Area type="monotone" dataKey="count" stroke="#9face6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrendReports)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No trend data available</div> )}
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col min-h-[350px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Agent Leaderboard</h3>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-amber-100 flex items-center gap-1"><Medal className="w-3 h-3"/> Top 5</span>
                    </div>
                    {reportsData.agentChart.length > 0 ? (
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportsData.agentChart} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} width={80} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} />
                            <Bar dataKey="totalLeads" name="Total Leads" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={12} />
                            <Bar dataKey="wonDeals" name="Won Deals" fill="#74ebd5" radius={[0, 4, 4, 0]} barSize={12} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No agent data available</div> )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8 w-full">
                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col min-h-[350px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Leads by Source</h3>
                    {dynamicSourceData.length > 0 ? (
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="h-[220px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={dynamicSourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name" stroke="none">
                                {dynamicSourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">{dynamicSourceData.map((source, index) => <div key={source.name} className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />{source.name} <span className="text-slate-400">({source.value})</span></div>)}</div>
                      </div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No data available</div> )}
                  </div>

                  <div className="bg-white/80 backdrop-blur-2xl p-8 rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white flex flex-col min-h-[350px]">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Pipeline Funnel</h3>
                    {reportsData.pipelineChart.length > 0 ? (
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportsData.pipelineChart} layout="vertical" margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} width={120} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} />
                            <Bar dataKey="count" name="Leads" fill="#9face6" radius={[0, 6, 6, 0]} barSize={20}>
                              {reportsData.pipelineChart.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.name === 'Closed Won' ? '#74ebd5' : entry.name === 'Closed Lost' || entry.name === 'Junk / Invalid' ? '#f87171' : '#9face6'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No data available</div> )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* --- MODALS --- */}
      {isLeadModalOpen && selectedLead && (
        <LeadDetailsModal 
          lead={selectedLead}
          isOpen={isLeadModalOpen}
          onClose={() => { setIsLeadModalOpen(false); setSelectedLead(null); }}
          onLeadUpdated={handleLeadUpdated}
          teamMembers={teamMembers}
          onOpenChat={(leadId) => {
            setActiveTab('inbox');
            setActiveChatLeadId(leadId);
            setIsLeadModalOpen(false);
          }}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0">
              <h3 className="text-xl font-extrabold text-slate-800">Add New Lead</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form id="add-lead-form" onSubmit={handleAddLead} className="p-8 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-5">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">First Name</label><input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Last Name</label><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
              </div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Project / Property</label><input type="text" value={projectProperty} onChange={(e) => setProjectProperty(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" placeholder="e.g. Sunset Villas" /></div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer">{PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Source</label><select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer">{leadSources.length === 0 && <option value="Manual">Manual</option>}{leadSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Sub-Source</label><select value={subSource} onChange={(e) => setSubSource(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer"><option value="">None</option>{leadSubSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                {user?.role === 'client_admin' && (<div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Assign To</label><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium cursor-pointer"><option value="">Unassigned</option>{teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>)}
              </div>
            </form>
            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm">Cancel</button>
              <button type="submit" form="add-lead-form" disabled={addingLead} className="px-6 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-[#74ebd5]/30 disabled:opacity-50 flex justify-center items-center min-w-[120px]">{addingLead ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Lead'}</button>
            </div>
          </div>
        </div>
      )}

      {isAgentModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200/60"><h3 className="text-xl font-extrabold text-slate-800">Add New Agent</h3><button onClick={() => { setIsAgentModalOpen(false); setAgentName(''); setAgentEmail(''); setAgentPassword(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreateAgent} className="p-8 space-y-5">
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Full Name</label><input type="text" required value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Email Address</label><input type="email" required value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" /></div>
              <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Temporary Password</label><input type="password" required value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all sm:text-sm font-medium" minLength={6} /><p className="mt-2 text-[11px] font-medium text-slate-400">Must be at least 6 characters long.</p></div>
              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => { setIsAgentModalOpen(false); setAgentName(''); setAgentEmail(''); setAgentPassword(''); }} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm">Cancel</button>
                <button type="submit" disabled={addingAgent} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-[#74ebd5]/30 disabled:opacity-50 flex justify-center items-center">{addingAgent ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Agent'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Scrollbars & Enterprise Theme Engine */}
     <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }

        /* MAGIC OVERRIDES: Transforms Pastels into Enterprise Midnight/Copper */
        .from-\\[\\#74ebd5\\] { --tw-gradient-from: #0f172a !important; --tw-gradient-stops: var(--tw-gradient-from), #1e293b !important; color: #ffffff !important; }
        .to-\\[\\#9face6\\] { --tw-gradient-to: #1e293b !important; }
        .bg-\\[\\#74ebd5\\]\\/10, .bg-\\[\\#74ebd5\\]\\/15 { background-color: rgba(245, 158, 11, 0.1) !important; color: #d97706 !important; }
        .hover\\:bg-\\[\\#74ebd5\\]\\/20:hover { background-color: rgba(245, 158, 11, 0.2) !important; }
        .text-\\[\\#50bdaf\\], .text-\\[\\#74ebd5\\] { color: #d97706 !important; }
        .hover\\:text-\\[\\#50bdaf\\]:hover { color: #d97706 !important; }
        .shadow-\\[\\#74ebd5\\]\\/30 { box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1) !important; }
        .border-\\[\\#74ebd5\\] { border-color: #0f172a !important; }
        .border-t-\\[\\#74ebd5\\] { border-top-color: #f59e0b !important; }
        .focus\\:ring-\\[\\#74ebd5\\]\\/30:focus, .focus\\:ring-\\[\\#74ebd5\\]:focus { --tw-ring-color: rgba(245, 158, 11, 0.3) !important; }

        .bg-\\[\\#9face6\\]\\/15 { background-color: #f8fafc !important; border: 1px solid #e2e8f0; color: #64748b !important; }
        .bg-purple-50 { background-color: #f8fafc !important; border: 1px solid #e2e8f0; color: #64748b !important; }
        .text-\\[\\#7b8ed3\\], .text-purple-600 { color: #64748b !important; }
      `}</style>
    </div>
  );
}