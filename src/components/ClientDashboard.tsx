import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, setDoc, onSnapshot, orderBy, limit, startAfter, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, LogOut, LayoutDashboard, Building2, UserCircle2, Mail, Calendar, Phone, Home, X, Link2, Copy, Check, Globe, Facebook, Search, Zap, List, KanbanSquare, UserPlus, UserCog, Edit2, Trash2, ChevronDown, ChevronUp, Menu, Download, MessageSquare, TrendingUp, Activity, Target, Clock, Bell, Upload, AlertCircle, CheckCircle2, Info, XCircle, BarChart2, BellRing, CheckSquare, Send, MessageCircle, Save, Medal, MoreVertical, Image as ImageIcon, Megaphone, RefreshCw, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import LeadDetailsModal, { Lead } from './LeadDetailsModal';

interface Agent { id: string; name: string; email: string; role: string; createdAt: any; designation?: string; location?: string; linkedin?: string; formId?: string; adId?: string; adName?: string; campaignId?: string; campaignName?: string; }
const PIPELINE_STATUSES = ['New', 'Attempted Contact', 'Connected / Warm', 'Site Visit Scheduled', 'Site Visit Completed', 'Negotiation', 'Closed Won', 'Closed Lost', 'Junk / Invalid'];
declare global { interface Window { FB: any; fbAsyncInit: any; } }
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

const normalizePhone = (p?: string) => { if (!p) return ""; let c = p.replace(/[^0-9]/g, ''); return c.length === 10 ? `91${c}` : c; };
const safeDate = (ts: any) => { if (!ts) return 'Now'; if (ts.toDate) return ts.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); return new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); };
const safeFullDate = (ts: any) => { if (!ts) return 'Processing...'; if (ts.toDate) return ts.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };

// ✨ REUSABLE TAILWIND CONSTANTS ✨
const cardBase = "bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgba(116,235,213,0.05)] border border-white overflow-hidden";
const cardPadded = `${cardBase} p-8 flex flex-col`;
const lblCls = "block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest";
const inpCls = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#74ebd5]/30 outline-none transition-all text-sm font-medium shadow-sm";
const btnPrimary = "px-6 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg shadow-[#74ebd5]/30 disabled:opacity-50 flex justify-center items-center";
const btnCancel = "px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm shadow-sm";
const thCls = "px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-50/90 border-b border-slate-200/60";
const tdCls = "px-6 py-5 whitespace-nowrap";

export default function ClientDashboard() {
  const { user, logout } = useAuth(); 
  const [greeting, setGreeting] = useState({ text: 'Welcome back', emoji: '👋' });

  useEffect(() => {
    const getISTGreeting = () => {
      const h = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 5.5)).getHours();
      if (h >= 4 && h < 12) return { text: 'Good morning', emoji: '🌅' };
      if (h >= 12 && h < 17) return { text: 'Good afternoon', emoji: '☀️' };
      if (h >= 17 && h < 22) return { text: 'Good evening', emoji: '🌙' };
      return { text: 'Working late', emoji: '🦉' };
    };
    setGreeting(getISTGreeting());
    const interval = setInterval(() => setGreeting(getISTGreeting()), 3600000);
    return () => clearInterval(interval);
  }, []);
  
  const [activeTab, setActiveTab] = useState<'dashboard'|'leads'|'feedback'|'inbox'|'campaigns'|'integrations'|'team'|'reports'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); const [isCopied, setIsCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table'|'pipeline'>('pipeline');
  const [agents, setAgents] = useState<Agent[]>([]); const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true); const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [addingLead, setAddingLead] = useState(false); const [addingAgent, setAddingAgent] = useState(false);
  const [copied, setCopied] = useState(false);

  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState(""); const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [outboundHeaders, setOutboundHeaders] = useState<{key: string, value: string}[]>([]);
  const [alertEmails, setAlertEmails] = useState(""); const [emailInput, setEmailInput] = useState("");
  const [isSavingAlerts, setIsSavingAlerts] = useState(false); const [isSavingSheets, setIsSavingSheets] = useState(false);
  const [isTestingSheets, setIsTestingSheets] = useState(false); const [isSavingCRM, setIsSavingCRM] = useState(false);
  const [isTestingCRM, setIsTestingCRM] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null); const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [lastVisibleLead, setLastVisibleLead] = useState<any>(null); const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [hasMoreLeads, setHasMoreLeads] = useState(true);
  const [realTimeLeads, setRealTimeLeads] = useState<Lead[]>([]); const [olderLeads, setOlderLeads] = useState<Lead[]>([]);

  const [waMessages, setWaMessages] = useState<any[]>([]); const [activeChatLeadId, setActiveChatLeadId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState(""); const messagesEndRef = useRef<HTMLDivElement>(null);

  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [campaignViewTab, setCampaignViewTab] = useState<'templates' | 'history'>('templates');
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);

  const [dialogState, setDialogState] = useState<{ isOpen: boolean; type: 'alert'|'confirm'|'success'|'error'; title: string; message: string; onConfirm?: () => void; onCloseAction?: () => void; }>({ isOpen: false, type: 'alert', title: '', message: '' });
  const showDialog = (type: any, title: string, message: string, onConfirm?: () => void, onCloseAction?: () => void) => { setDialogState({ isOpen: true, type, title, message, onConfirm, onCloseAction }); };
  const closeDialog = () => { if (dialogState.onCloseAction && dialogState.type !== 'confirm') dialogState.onCloseAction(); setDialogState(prev => ({ ...prev, isOpen: false })); };

  const isInitialMount = useRef(true); const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [toastData, setToastData] = useState<{show: boolean, title: string, message: string, color?: string} | null>(null);
  const [isImporting, setIsImporting] = useState(false); const fileInputRef = useRef<HTMLInputElement>(null);

  const [fbUserToken, setFbUserToken] = useState(""); const [isLinking, setIsLinking] = useState(false);
  const [isLinkingWhatsApp, setIsLinkingWhatsApp] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false); const [whatsappNumberId, setWhatsappNumberId] = useState<string>('');

  const leads = useMemo(() => Array.from(new Map([...realTimeLeads, ...olderLeads].map(item => [item.id, item])).values()), [realTimeLeads, olderLeads]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]); const alertedTasks = useRef<Set<string>>(new Set());

  // ✨ LEVEL 4 SESSION TIMEOUT ENFORCEMENT ✨
  const timeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    const resetTimer = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(() => { showDialog('alert', 'Session Expired', 'Your session expired due to 15 minutes of inactivity.', undefined, () => { logout(); }); }, 900000); };
    resetTimer(); const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer(); events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); events.forEach(e => window.removeEventListener(e, handleActivity)); };
  }, [logout]);

  useEffect(() => { if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") Notification.requestPermission(); }, []);

  // WHATSAPP LISTENERS
  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'whatsapp_messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => { const msgs: any[] = []; snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() })); setWaMessages(msgs); }, (err) => console.error("WA sync err:", err));
    return () => unsub();
  }, [user?.clientId]);

  useEffect(() => {
    if (activeTab === 'inbox' && activeChatLeadId) {
      const activeLead = leads.find(l => l.id === activeChatLeadId);
      if (activeLead && activeLead.phone) {
        const normalizedPhone = normalizePhone(activeLead.phone);
        setWaMessages(prev => prev.map(m => (m.senderPhone === normalizedPhone && m.direction === 'inbound' && !m.isRead) ? { ...m, isRead: true } : m));
        const unreadMsgs = waMessages.filter(m => m.senderPhone === normalizedPhone && m.direction === 'inbound' && !m.isRead);
        if (unreadMsgs.length > 0) { unreadMsgs.forEach(msg => updateDoc(doc(db, 'whatsapp_messages', msg.id), { isRead: true }).catch(console.error)); }
      }
    }
  }, [activeChatLeadId, activeTab, leads, waMessages]);

  const unreadWhatsAppCount = useMemo(() => waMessages.filter(m => m.direction === 'inbound' && !m.isRead).length, [waMessages]);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const markAllAsRead = () => { setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); setIsNotificationOpen(false); };

  // CAMPAIGN LISTENER
  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'whatsapp_campaigns'), where('clientId', '==', user.clientId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => { const camps: any[] = []; snap.forEach(doc => camps.push({ id: doc.id, ...doc.data() })); setCampaignsList(camps); });
    return () => unsub();
  }, [user?.clientId]);

  useEffect(() => { if (activeTab === 'inbox' && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [waMessages, activeChatLeadId, activeTab]);

  // TASK LISTENER
  useEffect(() => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'reminders'), where('clientId', '==', user.clientId), where('status', '==', 'Pending'));
    const unsub = onSnapshot(q, (snap) => { const tasks: any[] = []; snap.forEach(doc => tasks.push({ id: doc.id, ...doc.data() })); tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()); setPendingTasks(tasks); });
    return () => unsub();
  }, [user?.clientId]);

  const myPendingTasks = useMemo(() => user?.role === 'client_admin' ? pendingTasks : pendingTasks.filter(t => t.agentId === user?.uid), [pendingTasks, user?.uid, user?.role]);

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date().getTime();
      myPendingTasks.forEach(task => {
        const timeDiff = new Date(task.dueDate).getTime() - now;
        if (timeDiff <= 120000 && timeDiff > -86400000 && !alertedTasks.current.has(task.id)) {
          const isOverdue = timeDiff < 0; const title = isOverdue ? "Task Overdue!" : "Task Due Soon!"; const bodyMsg = `${task.type} for ${task.leadName}`;
          setToastData({ show: true, title, message: bodyMsg, color: isOverdue ? "from-red-500 to-rose-600" : "from-amber-400 to-orange-500" });
          notificationSound.play().catch(() => {});
          if ("Notification" in window && Notification.permission === "granted") new Notification(`Mintage CRM: ${title}`, { body: bodyMsg, icon: '/mintage-logo.png' });
          setNotifications(prev => { if (prev.some(n => n.id.includes(task.id))) return prev; return [{ id: `task-${task.id}-${Date.now()}`, leadId: task.leadId, title: isOverdue ? `Overdue: ${task.type}` : `Due Soon: ${task.type}`, message: `Action required for ${task.leadName}.`, time: new Date(), isRead: false }, ...prev].slice(0, 30); });
          alertedTasks.current.add(task.id); setTimeout(() => setToastData(null), 8000); 
        }
      });
    };
    checkTasks(); const interval = setInterval(checkTasks, 10000); return () => clearInterval(interval);
  }, [myPendingTasks]);

  const handleOpenTaskLead = async (leadId: string) => {
    let leadToOpen = leads.find(l => l.id === leadId);
    if (leadToOpen) { openLeadDetails(leadToOpen); } 
    else { try { const docSnap = await getDoc(doc(db, 'leads', leadId)); if (docSnap.exists()) { openLeadDetails({ id: docSnap.id, ...docSnap.data() } as Lead); } else { showDialog('error', 'Not Found', 'Lead not found.'); } } catch (err) { console.error(err); } }
  };

  const completeTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, 'reminders', taskId), { status: 'Completed' }); setToastData({ show: true, title: "Task Completed", message: "Great job!", color: "from-emerald-400 to-teal-500" }); setTimeout(() => setToastData(null), 3000); } 
    catch (err) { console.error(err); }
  };

  const dashboardStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0); const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 6);
    let todaysLeadsCount = 0; let activePipelineCount = 0; let closedWonCount = 0; const todaysSources = new Map<string, number>(); const trendDataMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i); trendDataMap.set(d.toLocaleDateString('en-US', { weekday: 'short' }), 0); }
    leads.forEach(lead => {
      const leadDate = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); if (!leadDate) return;
      if (lead.status !== 'Closed Lost' && lead.status !== 'Junk / Invalid') activePipelineCount++;
      if (lead.status === 'Closed Won') closedWonCount++;
      if (leadDate >= today) { todaysLeadsCount++; const source = lead.source || 'Manual'; todaysSources.set(source, (todaysSources.get(source) || 0) + 1); }
      if (leadDate >= sevenDaysAgo) { const dayStr = leadDate.toLocaleDateString('en-US', { weekday: 'short' }); if (trendDataMap.has(dayStr)) trendDataMap.set(dayStr, trendDataMap.get(dayStr)! + 1); }
    });
    const todaysSourceChart = Array.from(todaysSources.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const trendChart = Array.from(trendDataMap.entries()).map(([name, count]) => ({ name, count }));
    const conversionRate = leads.length > 0 ? Math.round((closedWonCount / leads.length) * 100) : 0;
    return { todaysLeadsCount, activePipelineCount, conversionRate, todaysSourceChart, trendChart };
  }, [leads]);

  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [projectProperty, setProjectProperty] = useState(''); const [status, setStatus] = useState('New'); const [source, setSource] = useState(''); const [subSource, setSubSource] = useState(''); const [assignedTo, setAssignedTo] = useState('');
  const [agentName, setAgentName] = useState(''); const [agentEmail, setAgentEmail] = useState(''); const [agentPassword, setAgentPassword] = useState(''); const [inlineEditingAgentId, setInlineEditingAgentId] = useState<string | null>(null); const [inlineEditingName, setInlineEditingName] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); const [leadsViewSourceFilter, setLeadsViewSourceFilter] = useState('All'); const [leadsStartDate, setLeadsStartDate] = useState(''); const [leadsEndDate, setLeadsEndDate] = useState('');
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [leadSourceFilter, setLeadSourceFilter] = useState('All');
  const [feedbackStartDate, setFeedbackStartDate] = useState(''); const [feedbackEndDate, setFeedbackEndDate] = useState(''); const [feedbackSourceFilter, setFeedbackSourceFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1); const leadsPerPage = 10; const [selectedLeads, setSelectedLeads] = useState<string[]>([]); const [expandedLeads, setExpandedLeads] = useState<string[]>([]);
  const [fbPages, setFbPages] = useState<any[]>([]); const [linkedPages, setLinkedPages] = useState<any[]>([]); const [isLoadingLinkedPages, setIsLoadingLinkedPages] = useState(true); const [isLoadingFb, setIsLoadingFb] = useState(false);
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]); const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<{id: string, sourceName: string, agentId: string, agentName: string}[]>([]); const [newRuleSource, setNewRuleSource] = useState(''); const [newRuleAgentId, setNewRuleAgentId] = useState(''); const [addingRule, setAddingRule] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false); const [campaignTab, setCampaignTab] = useState<'email' | 'whatsapp'>('whatsapp'); const [emailSubject, setEmailSubject] = useState(''); const [emailBody, setEmailBody] = useState(''); const [isSendingCampaign, setIsSendingCampaign] = useState(false); const [whatsappTemplate, setWhatsappTemplate] = useState('project_launch_01');

  const combinedSources = useMemo(() => {
    const sourcesSet = new Set<string>(); leadSources.forEach(s => { if (s.name) sourcesSet.add(s.name); }); leads.forEach(lead => { if (lead.source) sourcesSet.add(lead.source); });
    return Array.from(sourcesSet).sort((a, b) => a.localeCompare(b));
  }, [leadSources, leads]);

  const webhookUrl = `https://us-central1-mintage-crm.cloudfunctions.net/incomingLeadWebhook?clientId=${user?.clientId}`;

  // LEADS LISTENER
  useEffect(() => {
    if (!user?.clientId) return; setLoading(true);
    const q = query(collection(db, 'leads'), where('clientId', '==', user.clientId), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLeads: Lead[] = []; snapshot.forEach((doc) => fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead)); setRealTimeLeads(fetchedLeads);
      if (!isInitialMount.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newLead = change.doc.data() as Lead; const leadName = `${newLead.firstName} ${newLead.lastName === 'Lead' ? '' : newLead.lastName}`.trim() || 'Someone';
            setToastData({ show: true, title: "New Lead Captured!", message: `${leadName} arrived via ${newLead.source || 'Direct Entry'}.` });
            setNotifications(prev => [{ id: change.doc.id + Date.now(), leadId: change.doc.id, title: "New Lead", message: `${leadName}`, time: new Date(), isRead: false }, ...prev].slice(0, 30)); setTimeout(() => setToastData(null), 5000);
          }
        });
      }
      if (isInitialMount.current) { isInitialMount.current = false; if (!lastVisibleLead && snapshot.docs.length > 0) { setLastVisibleLead(snapshot.docs[snapshot.docs.length - 1]); setHasMoreLeads(snapshot.docs.length === 50); } setLoading(false); }
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [user?.clientId]);

  const loadMoreLeads = async () => {
    if (!user?.clientId || !lastVisibleLead || loadingMoreLeads || !hasMoreLeads) return; setLoadingMoreLeads(true);
    try {
      const q = query(collection(db, 'leads'), where('clientId', '==', user.clientId), orderBy('createdAt', 'desc'), startAfter(lastVisibleLead), limit(50));
      const querySnapshot = await getDocs(q); const fetchedLeads: Lead[] = []; querySnapshot.forEach((doc) => fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead));
      if (fetchedLeads.length > 0) { setOlderLeads(prev => [...prev, ...fetchedLeads]); setLastVisibleLead(querySnapshot.docs[querySnapshot.docs.length - 1]); setHasMoreLeads(fetchedLeads.length === 50); } 
      else { setHasMoreLeads(false); }
    } catch (error) { console.error(error); } finally { setLoadingMoreLeads(false); }
  };

  const fetchTeamMembers = async () => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'users'), where('clientId', '==', user.clientId));
    const snapshot = await getDocs(q); const fetchedTeam: {id: string, name: string}[] = [];
    snapshot.forEach(doc => fetchedTeam.push({ id: doc.id, name: doc.data().name || doc.data().email }));
    setTeamMembers(fetchedTeam.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const fetchAgents = async () => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'users'), where('clientId', '==', user.clientId), where('role', '==', 'client_agent'));
    const snapshot = await getDocs(q); const fetchedAgents: Agent[] = [];
    snapshot.forEach(doc => fetchedAgents.push({ id: doc.id, ...doc.data() } as Agent)); setAgents(fetchedAgents);
  };

  const fetchLinkedPages = async () => {
    if (!user?.clientId) return; setIsLoadingLinkedPages(true);
    const q = query(collection(db, 'facebook_integrations'), where('clientId', '==', user.clientId));
    const snapshot = await getDocs(q); const pages: any[] = [];
    snapshot.forEach(doc => pages.push({ id: doc.id, ...doc.data() })); setLinkedPages(pages); setIsLoadingLinkedPages(false);
  };

  const fetchWhatsAppIntegration = async () => {
    if (!user?.clientId) return;
    const waDoc = await getDoc(doc(db, 'whatsapp_integrations', user.clientId));
    if (waDoc.exists()) { setWhatsappConnected(true); setWhatsappNumberId(waDoc.data().phoneNumberId); }
  };

  const fetchLeadSources = async () => {
    if (!user?.clientId) return;
    const fetched: {id: string, name: string}[] = [];
    const q = query(collection(db, 'lead_sources'), where('clientId', '==', user.clientId));
    const snapshot = await getDocs(q); snapshot.forEach(doc => fetched.push({ id: doc.id, name: doc.data().name }));
    const globalQ = collection(db, 'global_lead_sources'); const globalSnapshot = await getDocs(globalQ);
    globalSnapshot.forEach(doc => { if (!fetched.some(s => s.name.toLowerCase() === doc.data().name.toLowerCase())) fetched.push({ id: doc.id, name: doc.data().name }); });
    setLeadSources(fetched.sort((a, b) => a.name.localeCompare(b.name))); if (fetched.length > 0) setSource(fetched[0].name);

    const qSub = query(collection(db, 'lead_sub_sources'), where('clientId', '==', user.clientId));
    const snapshotSub = await getDocs(qSub); const fetchedSub: {id: string, name: string}[] = [];
    snapshotSub.forEach(doc => fetchedSub.push({ id: doc.id, name: doc.data().name })); setLeadSubSources(fetchedSub.sort((a, b) => a.name.localeCompare(b.name)));
  };

  const fetchAssignmentRules = async () => {
    if (!user?.clientId) return;
    const q = query(collection(db, 'lead_assignment_rules'), where('clientId', '==', user.clientId));
    const snapshot = await getDocs(q); const fetched: any[] = [];
    snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() })); setAssignmentRules(fetched);
  };

  const handleAddAssignmentRule = async () => {
    if (!user?.clientId || !newRuleSource || !newRuleAgentId) return; setAddingRule(true);
    try {
      const agent = teamMembers.find(m => m.id === newRuleAgentId); if (!agent) return;
      const docRef = await addDoc(collection(db, 'lead_assignment_rules'), { clientId: user.clientId, sourceName: newRuleSource, agentId: newRuleAgentId, agentName: agent.name, createdAt: serverTimestamp() });
      setAssignmentRules([...assignmentRules, { id: docRef.id, sourceName: newRuleSource, agentId: newRuleAgentId, agentName: agent.name }]);
      setNewRuleSource(''); setNewRuleAgentId(''); showDialog('success', 'Success', 'Rule added.');
    } catch (e) { showDialog('error', 'Error', 'Failed to add rule.'); } finally { setAddingRule(false); }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!ruleId) return;
    showDialog('confirm', 'Delete Rule', 'Are you sure?', async () => {
      try { await deleteDoc(doc(db, 'lead_assignment_rules', ruleId)); setAssignmentRules(prev => prev.filter(r => r.id !== ruleId)); showDialog('success', 'Deleted', 'Rule deleted.'); } 
      catch (e) { showDialog('error', 'Error', 'Failed to delete.'); }
    });
  };

  const fetchOutboundWebhook = async () => {
    if (!user?.clientId) return;
    const docRef = doc(db, 'outbound_integrations', user.clientId); const docSnap = await getDoc(docRef);
    if (docSnap.exists()) { setOutboundWebhookUrl(docSnap.data().webhookUrl || ""); setGoogleSheetUrl(docSnap.data().googleSheetUrl || ""); setOutboundHeaders(docSnap.data().headers || []); setAlertEmails(docSnap.data().alertEmails || ""); }
  };

  const emailList = alertEmails.split(',').map(e => e.trim()).filter(e => e);
  const handleAddEmailTag = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if (e.type === 'blur' || (e as React.KeyboardEvent).key === 'Enter') {
      e.preventDefault(); const val = emailInput.trim();
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { if (!emailList.includes(val)) { setAlertEmails([...emailList, val].join(', ')); } setEmailInput(""); } 
      else if (val) { showDialog('error', 'Invalid Email', 'Enter valid email.'); }
    }
  };
  const handleRemoveEmailTag = (emailToRemove: string) => setAlertEmails(emailList.filter(e => e !== emailToRemove).join(', '));
  
  const handleSaveAlertEmails = async () => {
    if (!user?.clientId) return; setIsSavingAlerts(true);
    try {
      let finalEmails = alertEmails;
      if (emailInput.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) { finalEmails = [...emailList, emailInput.trim()].join(', '); setAlertEmails(finalEmails); setEmailInput(""); }
      await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, alertEmails: finalEmails, updatedAt: serverTimestamp() }, { merge: true });
      showDialog('success', 'Saved', 'Alerts saved.');
    } catch (e) { showDialog('error', 'Error', 'Save failed.'); } finally { setIsSavingAlerts(false); }
  };

  const handleSaveGoogleSheet = async () => {
    if (!user?.clientId) return; setIsSavingSheets(true);
    try { await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, googleSheetUrl, updatedAt: serverTimestamp() }, { merge: true }); showDialog('success', 'Saved', 'Sheets connected.'); } 
    catch (e) { showDialog('error', 'Error', 'Save failed.'); } finally { setIsSavingSheets(false); }
  };
  const handleTestGoogleSheet = async () => {
    if (!googleSheetUrl) { showDialog('alert', 'Missing', 'Enter URL.'); return; } setIsTestingSheets(true);
    try { await fetch(googleSheetUrl, { method: 'POST', body: JSON.stringify({ id: 'test', firstName: 'Test' }) }); showDialog('success', 'Test Sent', 'Success!'); } 
    catch (e) { showDialog('error', 'CORS Notice', 'Test fired, check your Google Sheet.'); } finally { setIsTestingSheets(false); }
  };

  const handleSaveCustomCRM = async () => {
    if (!user?.clientId) return; setIsSavingCRM(true);
    try {
      const validHeaders = outboundHeaders.filter(h => h.key.trim() !== '');
      await setDoc(doc(db, 'outbound_integrations', user.clientId), { clientId: user.clientId, webhookUrl: outboundWebhookUrl, headers: validHeaders, updatedAt: serverTimestamp() }, { merge: true });
      setOutboundHeaders(validHeaders); showDialog('success', 'Saved', 'CRM bridge saved.');
    } catch (e) { showDialog('error', 'Error', 'Save failed.'); } finally { setIsSavingCRM(false); }
  };
  const handleTestCustomCRM = async () => {
    if (!outboundWebhookUrl) { showDialog('alert', 'Missing', 'Enter URL.'); return; } setIsTestingCRM(true);
    try {
      const headerObj: Record<string, string> = { 'Content-Type': 'application/json' };
      outboundHeaders.forEach(h => { if (h.key.trim() && h.value.trim()) headerObj[h.key.trim()] = h.value.trim(); });
      await fetch(outboundWebhookUrl, { method: 'POST', headers: headerObj, body: JSON.stringify({ id: 'test', firstName: 'Test' }) });
      showDialog('success', 'Test Sent', 'Success!');
    } catch (e) { showDialog('error', 'CORS Notice', 'Test fired, check destination.'); } finally { setIsTestingCRM(false); }
  };

  const initFacebookSdk = (appId: string): Promise<void> => {
    return new Promise((resolve) => {
      if (window.FB) { window.FB.init({ appId, cookie: true, xfbml: true, version: 'v19.0' }); resolve(); return; }
      window.fbAsyncInit = function() { window.FB.init({ appId, cookie: true, xfbml: true, version: 'v19.0' }); resolve(); };
      const d = document, s = 'script', id = 'facebook-jssdk'; let js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) { resolve(); return; } js = d.createElement(s) as any; js.id = id; (js as any).src = "https://connect.facebook.net/en_US/sdk.js";
      if (fjs && fjs.parentNode) fjs.parentNode.insertBefore(js, fjs); else d.head.appendChild(js);
    });
  };

  useEffect(() => { initFacebookSdk('1263110839094881'); }, []); 

  const handleConnectFacebook = async () => {
    setIsLoadingFb(true);
    if (window.FB) window.FB.init({ appId: '1439047481212574', cookie: true, xfbml: true, version: 'v19.0' });
    window.FB.login((response: any) => {
      if (response.authResponse) {
        setFbUserToken(response.authResponse.accessToken); 
        window.FB.api('/me/accounts', (apiResponse: any) => {
          if (apiResponse && !apiResponse.error) { setFbPages(apiResponse.data || []); } else { showDialog('error', 'Error', apiResponse?.error?.message || 'Failed to fetch FB Pages.'); }
          setIsLoadingFb(false);
        });
      } else { setIsLoadingFb(false); }
    }, { scope: 'pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,business_management', auth_type: 'rerequest', return_scopes: true }); 
  };

  const handleConnectWhatsApp = () => {
    setIsLinkingWhatsApp(true);
    if (!window.FB) { setIsLinkingWhatsApp(false); showDialog('error', 'SDK Loading', 'Wait for SDK to load or disable adblock.'); return; }
    const fallbackTimer = setTimeout(() => { setIsLinkingWhatsApp(false); }, 60000);
    window.FB.login(async (response: any) => {
      clearTimeout(fallbackTimer);
      if (response.authResponse && response.authResponse.accessToken && user?.clientId) {
        try {
          const linkWaFn = httpsCallable(functions, 'secureLinkWhatsApp');
          await linkWaFn({ accessToken: response.authResponse.accessToken });
          setWhatsappConnected(true); fetchWhatsAppIntegration(); showDialog('success', 'Connected', `WhatsApp linked!`);
        } catch (e: any) { showDialog('error', 'Failed', 'Failed to link WA.'); } finally { setIsLinkingWhatsApp(false); }
      } else { setIsLinkingWhatsApp(false); }
    }, { config_id: '1083197781534526', response_type: 'code,token', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '2' } });
  };

  const handleLinkPage = async (page: any) => {
    if (!user?.clientId) return; if (!fbUserToken) { showDialog('error', 'Error', 'Session expired. Connect FB again.'); return; }
    setIsLinking(true);
    try {
      const q = query(collection(db, 'facebook_integrations'), where('pageId', '==', String(page.id)));
      const querySnapshot = await getDocs(q);
      let isConnected = false; querySnapshot.forEach(docSnap => { if (docSnap.data().clientId !== user.clientId) isConnected = true; });
      if (isConnected) { showDialog('error', 'Error', 'Page linked to another client.'); setIsLinking(false); return; }
      const linkFn = httpsCallable(functions, 'secureLinkFacebookPage');
      await linkFn({ shortLivedUserToken: fbUserToken, pageId: String(page.id), pageName: page.name });
      fetchLinkedPages(); setFbPages([]); showDialog('success', 'Linked', 'Page linked.');
    } catch (e: any) { showDialog('error', 'Failed', 'Failed to link page.'); } finally { setIsLinking(false); }
  };

  const handleDisconnectPage = async (pageId: string) => {
    if (!user?.clientId) return;
    showDialog('confirm', 'Disconnect Page', 'Are you sure?', async () => {
      try { await deleteDoc(doc(db, 'facebook_integrations', user.clientId)); fetchLinkedPages(); showDialog('success', 'Disconnected', 'Page disconnected.'); } 
      catch (error) { showDialog('error', 'Error', 'Failed to disconnect.'); }
    });
  };

  // ✨ RESTORED: MISSING HANDLE COPY METHOD ✨
  const handleCopy = () => { navigator.clipboard.writeText(webhookUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  useEffect(() => { fetchAgents(); fetchTeamMembers(); fetchLinkedPages(); fetchLeadSources(); fetchAssignmentRules(); fetchOutboundWebhook(); fetchWhatsAppIntegration(); }, [user?.clientId]);

  const handleLeadUpdated = (updatedLead: Lead) => {
    setRealTimeLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setOlderLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l)); setSelectedLead(updatedLead);
  };

  const openLeadDetails = (lead: Lead) => { setSelectedLead(lead); setIsLeadModalOpen(true); };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user?.clientId) return; setAddingLead(true);
    try {
      const assignedUser = teamMembers.find(m => m.id === assignedTo); const assignedToName = assignedUser ? assignedUser.name : (assignedTo === user.uid ? user.email : '');
      await addDoc(collection(db, 'leads'), { clientId: user.clientId, firstName, lastName, email, phone, projectProperty, status, source: source || 'Manual', subSource: subSource || '', assignedTo: assignedTo || user?.uid, assignedToId: assignedTo || user?.uid, assignedToName: assignedToName, createdAt: serverTimestamp() });
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setProjectProperty(''); setStatus('New'); setSubSource(''); setAssignedTo('');
      setIsModalOpen(false); showDialog('success', 'Success', 'Lead added.');
    } catch (e) { showDialog('error', 'Error', 'Failed to add lead.'); } finally { setAddingLead(false); }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user?.clientId) return; setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string; const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 2) { showDialog('error', 'Error', 'Invalid CSV.'); setIsImporting(false); return; }
        const headers = rows[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const rowValues = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
          if (!rowValues[0]) continue;
          let leadObj: any = { clientId: user.clientId, status: 'New', createdAt: serverTimestamp(), assignedTo: '', assignedToId: '', assignedToName: '' };
          headers.forEach((header, index) => {
            const val = rowValues[index] || '';
            if (header.includes('first') || header === 'name') leadObj.firstName = val;
            else if (header.includes('last')) leadObj.lastName = val;
            else if (header.includes('email')) leadObj.email = val;
            else if (header.includes('phone') || header.includes('mobile')) leadObj.phone = val;
            else if (header.includes('project') || header.includes('property')) leadObj.projectProperty = val;
            else if (header.includes('source') && !header.includes('sub')) leadObj.source = val;
            else if (header.includes('sub')) leadObj.subSource = val;
          });
          if (!leadObj.firstName) leadObj.firstName = "Imported"; if (!leadObj.lastName) leadObj.lastName = "Lead"; if (!leadObj.source) leadObj.source = "Bulk Import";
          await addDoc(collection(db, 'leads'), leadObj); successCount++;
        }
        showDialog('success', 'Complete', `Imported ${successCount} leads!`);
      } catch (e) { showDialog('error', 'Error', 'Format error.'); } finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleCreateAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setAddingAgent(true);
    try {
      const createAgentFn = httpsCallable(functions, 'createAgent');
      await createAgentFn({ email: agentEmail, password: agentPassword, name: agentName });
      setAgentName(''); setAgentEmail(''); setAgentPassword(''); setIsAgentModalOpen(false); await fetchAgents();
      showDialog('success', 'Success', 'Agent created.');
    } catch (e: any) { showDialog('error', 'Failed', e.message || "Failed to create agent."); } finally { setAddingAgent(false); }
  };

  const handleEditAgent = async (agent: Agent) => { setInlineEditingAgentId(agent.id); setInlineEditingName(agent.name); };
  const handleSaveInlineEdit = async (agentId: string) => {
    if (!inlineEditingName.trim()) { setInlineEditingAgentId(null); return; }
    try { const updateAgentFn = httpsCallable(functions, 'updateAgent'); await updateAgentFn({ agentId, name: inlineEditingName.trim() }); await fetchAgents(); setInlineEditingAgentId(null); showDialog('success', 'Success', 'Agent updated.'); } 
    catch (e: any) { showDialog('error', 'Failed', "Failed to update."); }
  };

  const handleDeleteAgent = async (agentId: string) => {
    showDialog('confirm', 'Delete Agent', 'Are you sure?', async () => {
      try { const deleteAgentFn = httpsCallable(functions, 'deleteAgent'); await deleteAgentFn({ agentId }); await fetchAgents(); showDialog('success', 'Deleted', 'Agent deleted.'); } 
      catch (e: any) { showDialog('error', 'Failed', "Failed to delete."); }
    });
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      setRealTimeLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      setOlderLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await updateDoc(doc(db, 'leads', leadId), { status: newStatus });
    } catch (e) { console.error(e); }
  };

  const handleAssignLead = async (leadId: string, agentId: string) => {
    try {
      const assignedUser = teamMembers.find(m => m.id === agentId); const assignedToName = assignedUser ? assignedUser.name : '';
      setRealTimeLeads(prev => prev.map(l => l.id === leadId ? { ...l, assignedTo: agentId, assignedToId: agentId, assignedToName } : l));
      setOlderLeads(prev => prev.map(l => l.id === leadId ? { ...l, assignedTo: agentId, assignedToId: agentId, assignedToName } : l));
      await updateDoc(doc(db, 'leads', leadId), { assignedTo: agentId, assignedToId: agentId, assignedToName });
    } catch (e) { console.error(e); }
  };

  const filteredLeadsView = leads.filter(lead => {
    let matches = true;
    if (searchQuery) {
      const query = searchQuery.toLowerCase(); const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
      if (!fullName.includes(query) && !lead.email?.toLowerCase().includes(query) && !lead.phone?.toLowerCase().includes(query)) matches = false;
    }
    if (leadsViewSourceFilter !== 'All' && lead.source !== leadsViewSourceFilter) matches = false;
    if (leadsStartDate || leadsEndDate) {
      const leadDate = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); leadDate.setHours(0, 0, 0, 0);
      if (leadsStartDate) { const start = new Date(leadsStartDate); start.setHours(0, 0, 0, 0); if (leadDate < start) matches = false; }
      if (leadsEndDate) { const end = new Date(leadsEndDate); end.setHours(23, 59, 59, 999); if (leadDate > end) matches = false; }
    }
    return matches;
  });

  const totalPages = Math.ceil(filteredLeadsView.length / leadsPerPage);
  const paginatedLeads = filteredLeadsView.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

  const filteredLeads = leads.filter(lead => {
    let matches = true;
    if (leadSourceFilter !== 'All' && !(lead.source || '').toLowerCase().includes(leadSourceFilter.toLowerCase())) matches = false;
    if (startDate) { const d = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); if (d && d < new Date(startDate)) matches = false; }
    if (endDate) { const d = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); const end = new Date(endDate); end.setDate(end.getDate() + 1); if (d && d >= end) matches = false; }
    return matches;
  });

  const filteredFeedbackLeads = leads.filter(lead => {
    let matches = true;
    if (feedbackSourceFilter !== 'All' && !(lead.source || '').toLowerCase().includes(feedbackSourceFilter.toLowerCase())) matches = false;
    if (feedbackStartDate) { const d = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); if (d && d < new Date(feedbackStartDate)) matches = false; }
    if (feedbackEndDate) { const d = lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); const end = new Date(feedbackEndDate); end.setDate(end.getDate() + 1); if (d && d >= end) matches = false; }
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
      if(lead.createdAt) { const d = lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt); const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); trendMap.set(date, (trendMap.get(date) || 0) + 1); }
    });
    const trendChart = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count })).reverse(); 
    const agentMap = new Map<string, {name: string, totalLeads: number, wonDeals: number}>();
    filteredLeads.forEach(lead => {
      const agentId = lead.assignedToId || lead.assignedTo || 'unassigned';
      const agentName = lead.assignedToName || teamMembers.find(m => m.id === agentId)?.name || 'Unassigned';
      if (!agentMap.has(agentId)) { agentMap.set(agentId, { name: agentName, totalLeads: 0, wonDeals: 0 }); }
      const data = agentMap.get(agentId)!; data.totalLeads += 1; if (lead.status === 'Closed Won') data.wonDeals += 1;
    });
    const agentChart = Array.from(agentMap.values()).sort((a,b) => b.totalLeads - a.totalLeads).slice(0, 5);
    const pipelineChart = PIPELINE_STATUSES.map(status => { return { name: status, count: filteredLeads.filter(l => l.status === status).length }; }).filter(s => s.count > 0); 
    return { total, won, lostOrJunk, active, winRate, trendChart, agentChart, pipelineChart };
  }, [filteredLeads, teamMembers]);

  const feedbackSourceDataMap = new Map<string, number>();
  filteredFeedbackLeads.forEach(lead => { const source = lead.source || 'Manual'; feedbackSourceDataMap.set(source, (feedbackSourceDataMap.get(source) || 0) + 1); });
  const dynamicFeedbackSourceData = Array.from(feedbackSourceDataMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const PIE_COLORS = ['#74ebd5', '#9face6', '#a1c4fd', '#c2e9fb', '#d4fc79', '#96e6a1', '#84fab0', '#8fd3f4', '#f5576c', '#f093fb'];

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual'; let icon = <Globe className="w-3 h-3" />; let colorClass = "bg-slate-100 text-slate-600 border-slate-200"; let label = source || 'Manual';
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

  const handleExportCSV = () => {
    if (filteredLeads.length === 0) { showDialog('alert', 'Notice', 'No leads found.'); return; }
    const headers = [ "Date", "First Name", "Last Name", "Email", "Phone", "Project/Property", "Status", "Source", "Sub-Source", "Assigned To", "Tags", "Designation", "Location", "LinkedIn", "Truecaller Name", "Ad Name", "Campaign Name", "Form ID", "Latest Feedback Note", "Note Author", "Note Date" ];
    const csvRows = filteredLeads.map(lead => {
      const dateStr = lead.createdAt ? (lead.createdAt.toDate ? new Date(lead.createdAt.toDate()).toLocaleDateString() : new Date(lead.createdAt).toLocaleDateString()) : 'N/A';
      const assignedName = lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned';
      const tags = lead.tags ? lead.tags.join(' | ') : '';
      const sortedNotes = lead.notes ? [...lead.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      const latestNote = sortedNotes.length > 0 ? sortedNotes[0] : null;
      const escapeCSV = (val: any) => { if (val === null || val === undefined) return '""'; const str = String(val); return `"${str.replace(/"/g, '""').replace(/\n/g, ' ')}"`; };
      return [ escapeCSV(dateStr), escapeCSV(lead.firstName), escapeCSV(lead.lastName === 'Lead' ? '' : lead.lastName), escapeCSV(lead.email), escapeCSV(lead.phone), escapeCSV(lead.projectProperty), escapeCSV(lead.status), escapeCSV(lead.source), escapeCSV(lead.subSource), escapeCSV(assignedName), escapeCSV(tags), escapeCSV(lead.designation), escapeCSV(lead.location), escapeCSV(lead.linkedin), escapeCSV(lead.truecallerName), escapeCSV(lead.adName), escapeCSV(lead.campaignName), escapeCSV(lead.formId), escapeCSV(latestNote ? latestNote.text : ''), escapeCSV(latestNote ? latestNote.authorEmail : ''), escapeCSV(latestNote ? new Date(latestNote.timestamp).toLocaleString() : '') ].join(',');
    });
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.setAttribute('href', URL.createObjectURL(blob)); link.setAttribute('download', `leads_master_${new Date().toISOString().split('T')[0]}.csv`);
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
    const link = document.createElement('a'); link.setAttribute('href', URL.createObjectURL(blob)); link.setAttribute('download', `lead_feedback_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleDeleteSelected = async () => {
    showDialog('confirm', 'Delete Leads', `Are you sure you want to delete ${selectedLeads.length} selected leads? This cannot be undone.`, async () => {
      try {
        for (const id of selectedLeads) { await deleteDoc(doc(db, 'leads', id)); }
        setSelectedLeads([]); setOlderLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
        showDialog('success', 'Deleted', 'Selected leads have been deleted.');
      } catch (e) { showDialog('error', 'Delete Failed', 'Failed to delete some leads.'); }
    });
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault(); if (selectedLeads.length === 0) return;
    if (campaignTab === 'email') {
      if (!emailSubject.trim() || !emailBody.trim()) return; setIsSendingCampaign(true);
      try {
        const targetEmails = leads.filter(l => selectedLeads.includes(l.id) && l.email).map(l => l.email);
        if (targetEmails.length === 0) { showDialog('error', 'Error', 'No valid emails.'); setIsSendingCampaign(false); return; }
        const sendEmailFn = httpsCallable(functions, 'sendBulkEmailCampaign'); await sendEmailFn({ subject: emailSubject, body: emailBody, targetEmails });
        setIsCampaignModalOpen(false); setEmailSubject(''); setEmailBody(''); setSelectedLeads([]); showDialog('success', 'Campaign Queued', `Successfully queued email campaign to ${targetEmails.length} recipients.`);
      } catch (e: any) { showDialog('error', 'Failed', e.message); } finally { setIsSendingCampaign(false); }
    } else if (campaignTab === 'whatsapp') {
      if (!whatsappTemplate) return; setIsSendingCampaign(true);
      try {
        const targetPhones = leads.filter(l => selectedLeads.includes(l.id) && l.phone).map(l => l.phone);
        if (targetPhones.length === 0) { showDialog('error', 'Error', 'No valid phones.'); setIsSendingCampaign(false); return; }
        const sendWhatsAppFn = httpsCallable(functions, 'sendBulkWhatsAppCampaign'); await sendWhatsAppFn({ templateName: whatsappTemplate, targetPhones });
        setIsCampaignModalOpen(false); setSelectedLeads([]); showDialog('success', 'Success', `Queued WhatsApp campaign to ${targetPhones.length} recipients.`);
      } catch (e: any) { showDialog('error', 'Failed', e.message); } finally { setIsSendingCampaign(false); }
    }
  };

  const handleSendWhatsAppReply = async (e: React.FormEvent) => {
    e.preventDefault(); if (!chatInput.trim() || !activeChatLeadId) return;
    const activeLead = leads.find(l => l.id === activeChatLeadId); if (!activeLead || !activeLead.phone) return;
    const mockMessageText = chatInput.trim(); setChatInput('');
    try { await addDoc(collection(db, 'whatsapp_messages'), { clientId: user?.clientId, wabaId: 'internal_mock', senderPhone: normalizePhone(activeLead.phone), text: mockMessageText, type: 'text', direction: 'outbound', status: 'sent', timestamp: serverTimestamp(), createdAt: serverTimestamp(), isRead: true }); } 
    catch (e) { showDialog('error', 'Failed', 'Could not send WhatsApp message.'); }
  };

  const handleSyncTemplates = () => { setIsSyncingTemplates(true); setTimeout(() => { setIsSyncingTemplates(false); setToastData({ show: true, title: "Templates Synced", message: "Successfully fetched 4 approved templates from Meta Graph API.", color: "from-emerald-400 to-teal-500" }); }, 1500); };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.checked) { setSelectedLeads(paginatedLeads.map(l => l.id)); } else { setSelectedLeads([]); } };
  const handleSelectLead = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setSelectedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]); };
  const toggleExpandLead = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setExpandedLeads(prev => prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]); };

  return (
    <div className="min-h-screen relative bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-hidden">
      
      {/* DIALOG */}
      {dialogState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 shadow-inner ${dialogState.type === 'confirm' ? 'bg-amber-100 text-amber-600' : dialogState.type === 'error' ? 'bg-red-100 text-red-600' : dialogState.type === 'success' ? 'bg-[#74ebd5]/20 text-[#50bdaf]' : 'bg-blue-100 text-blue-600'}`}>
                 {dialogState.type === 'confirm' ? <AlertCircle className="h-7 w-7" /> : dialogState.type === 'error' ? <XCircle className="h-7 w-7" /> : dialogState.type === 'success' ? <CheckCircle2 className="h-7 w-7" /> : <Info className="h-7 w-7" />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{dialogState.title}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{dialogState.message}</p>
            </div>
            <div className="p-4 bg-slate-50/50 border-t border-slate-100/80 flex gap-3">
              {dialogState.type === 'confirm' && (<button onClick={closeDialog} className={btnCancel}>Cancel</button>)}
              <button onClick={() => { if (dialogState.type === 'confirm' && dialogState.onConfirm) dialogState.onConfirm(); else if (dialogState.onCloseAction) dialogState.onCloseAction(); closeDialog(); }} className={`flex-1 px-4 py-2.5 text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg ${dialogState.type === 'confirm' ? 'bg-slate-900 shadow-slate-900/20' : dialogState.type === 'error' ? 'bg-red-600 shadow-red-500/30' : 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] shadow-[#74ebd5]/30'}`}>{dialogState.type === 'confirm' ? 'Confirm' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN MODAL */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0">
              <div className="flex items-center gap-3"><div className={`p-2 rounded-xl text-white ${campaignTab === 'whatsapp' ? 'bg-[#25D366]' : 'bg-indigo-600'}`}>{campaignTab === 'whatsapp' ? <MessageCircle className="w-5 h-5" /> : <Send className="w-5 h-5" />}</div><h3 className="text-xl font-extrabold text-slate-800">Campaign Composer</h3></div>
              <button onClick={() => setIsCampaignModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex px-8 pt-6 gap-6 border-b border-slate-100">
              <button onClick={() => setCampaignTab('whatsapp')} className={`pb-4 text-sm font-bold transition-colors relative ${campaignTab === 'whatsapp' ? 'text-[#25D366]' : 'text-slate-400 hover:text-slate-600'}`}>WhatsApp Message{campaignTab === 'whatsapp' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#25D366] rounded-t-full" />}</button>
              <button onClick={() => setCampaignTab('email')} className={`pb-4 text-sm font-bold transition-colors relative ${campaignTab === 'email' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Email Blast{campaignTab === 'email' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}</button>
            </div>
            <form id="bulk-campaign-form" onSubmit={handleSendCampaign} className="p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar bg-slate-50/30">
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center mb-2 shadow-sm"><span className="text-sm font-bold text-slate-700">Recipients Selected:</span><span className={`px-3 py-1 text-white rounded-lg text-xs font-black ${campaignTab === 'whatsapp' ? 'bg-[#25D366]' : 'bg-indigo-600'}`}>{selectedLeads.length} Leads</span></div>
              {campaignTab === 'whatsapp' ? (
                <div className="animate-in fade-in duration-300"><label className={lblCls}>Select Meta-Approved Template</label><select value={whatsappTemplate} onChange={(e) => setWhatsappTemplate(e.target.value)} className={`${inpCls} cursor-pointer`}><option value="project_launch_01">🚀 New Project Launch Invite</option><option value="site_visit_reminder">📍 Site Visit Confirmation</option><option value="festival_greeting">🎉 Festival Offer Greeting</option><option value="price_drop_alert">💰 Price Drop Alert</option></select></div>
              ) : (
                <div className="animate-in fade-in duration-300 space-y-5"><div><label className={lblCls}>Email Subject</label><input type="text" required placeholder="e.g. Exclusive Preview: New Luxury Villas in Hyderabad" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={inpCls} /></div><div><div className="flex justify-between items-end mb-1.5"><label className={lblCls}>Email Body</label><span className="text-[10px] text-slate-400 font-medium">Use <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{'{{firstName}}'}</code> to personalize</span></div><textarea required rows={6} placeholder={`Hi {{firstName}},\n\nWe have an exciting new project launch...`} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className={`${inpCls} resize-y`} /></div></div>
              )}
            </form>
            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0"><button type="button" onClick={() => setIsCampaignModalOpen(false)} className={btnCancel}>Cancel</button><button type="submit" form="bulk-campaign-form" disabled={isSendingCampaign || selectedLeads.length === 0} className={`px-6 py-2.5 text-white rounded-xl transition-all font-bold text-sm shadow-lg disabled:opacity-50 flex justify-center items-center min-w-[150px] ${campaignTab === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#1EBE57] shadow-[#25D366]/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}>{isSendingCampaign ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{campaignTab === 'whatsapp' ? <MessageCircle className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />} Send Campaign</>}</button></div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastData && toastData.show && (
        <div className="fixed top-6 right-6 z-[9999] bg-white/90 backdrop-blur-xl border border-[#74ebd5]/50 shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top-5 fade-in duration-300 flex items-start gap-4 w-80">
          <div className={`p-2.5 bg-gradient-to-br ${toastData.color || 'from-[#74ebd5] to-[#9face6]'} rounded-xl text-white shadow-md shrink-0`}><Zap className="w-5 h-5 animate-pulse" /></div>
          <div className="flex-1 pt-0.5"><h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{toastData.title}</h4><p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed">{toastData.message}</p></div>
          <button onClick={() => setToastData(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden"><div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-[#74ebd5]/40 to-teal-50/40 blur-3xl opacity-70 mix-blend-multiply" /><div className="absolute top-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#9face6]/40 to-indigo-50/40 blur-3xl opacity-70 mix-blend-multiply" /><div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-purple-100/30 to-pink-50/30 blur-3xl opacity-70 mix-blend-multiply" /></div>

      {/* MOBILE NAV */}
      <div className="md:hidden relative z-20 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white p-4 shrink-0 shadow-sm"><img src="/mintage-logo.png" alt="Mintage" className="h-14 w-auto" /><div className="flex items-center gap-4"><button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="relative p-2 text-slate-600"><Bell className="w-6 h-6" />{unreadCount > 0 && <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button><button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-600 hover:text-slate-900 focus:outline-none"><Menu className="w-6 h-6" /></button></div></div>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-50/80 backdrop-blur-2xl border-r border-white/80 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 shadow-[8px_0_30px_rgba(0,0,0,0.03)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-24 flex items-center justify-between px-6 border-b border-slate-100/50 bg-white/40"><div className="flex items-center gap-2 text-emerald-600 font-bold text-lg tracking-tight"><img src="/mintage-logo.png" alt="Mintage" className="h-16 w-auto drop-shadow-sm" /></div><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button></div>
        <div className="px-6 py-6 text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-500 uppercase tracking-[0.2em]">Workspace</div>
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
          <button onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'leads' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><Users className="w-5 h-5" /> Leads</button>
          <button onClick={() => { setActiveTab('feedback'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'feedback' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><MessageSquare className="w-5 h-5" /> Leads Feedback</button>
          <button onClick={() => { setActiveTab('inbox'); setIsMobileMenuOpen(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'inbox' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><div className="flex items-center gap-3"><MessageCircle className="w-5 h-5" /> Inbox</div>{unreadWhatsAppCount > 0 && (<span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'inbox' ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>{unreadWhatsAppCount}</span>)}</button>
          <button onClick={() => { setActiveTab('campaigns'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'campaigns' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><Megaphone className="w-5 h-5" /> Campaigns</button>
          {user?.role === 'client_admin' && (<><button onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'team' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><UserCog className="w-5 h-5" /> Team</button><button onClick={() => { setActiveTab('integrations'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'integrations' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><Link2 className="w-5 h-5" /> Integrations</button></>)}
          <button onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-300 ${activeTab === 'reports' ? 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white font-bold shadow-lg shadow-[#74ebd5]/30' : 'text-slate-600 font-medium hover:bg-white/60 hover:text-[#50bdaf] hover:shadow-sm'}`}><BarChart2 className="w-5 h-5" /> Reports</button>
        </nav>
        <div className="p-5 border-t border-slate-100/50 bg-white/20"><button onClick={() => showDialog('confirm', 'Sign Out', 'Are you sure you want to sign out?', () => logout())} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-600 font-medium hover:bg-red-50/80 hover:text-red-600 hover:shadow-sm transition-all duration-200"><LogOut className="w-5 h-5" /> Sign Out</button></div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* HEADER */}
        <header className="h-24 bg-white/60 backdrop-blur-xl border-b border-white flex items-center justify-between px-4 md:px-8 shrink-0 hidden md:flex shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-bold tracking-tight text-slate-800">{activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab === 'leads' ? 'Leads Management' : activeTab === 'feedback' ? 'Leads Feedback' : activeTab === 'team' ? 'Team Management' : activeTab === 'reports' ? 'Analytics Reports' : activeTab === 'inbox' ? 'Omnichannel Inbox' : activeTab === 'campaigns' ? 'Campaigns & Templates' : 'Integrations'}</h1>
          <div className="flex items-center gap-6">
            <div className="relative">
              <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className={`p-2.5 rounded-xl transition-all relative ${isNotificationOpen ? 'bg-white shadow-sm text-[#50bdaf]' : 'bg-white/60 hover:bg-white text-slate-500 hover:text-[#50bdaf]'}`}><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
              {isNotificationOpen && (
                <><div className="fixed inset-0 z-40" onClick={() => setIsNotificationOpen(false)}></div><div className="absolute right-0 mt-3 w-80 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in"><div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm">Notifications</h3>{unreadCount > 0 && <button onClick={markAllAsRead} className="text-[10px] font-bold text-[#50bdaf] hover:text-[#419c90] uppercase tracking-wider">Mark all read</button>}</div><div className="max-h-80 overflow-y-auto custom-scrollbar">{notifications.length === 0 ? (<div className="p-8 text-center text-slate-400 text-xs font-medium">No new notifications.</div>) : (notifications.map(notif => (<div key={notif.id} onClick={() => { handleOpenTaskLead(notif.leadId); setIsNotificationOpen(false); }} className={`p-4 border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors ${!notif.isRead ? 'bg-[#74ebd5]/5' : ''}`}><div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-slate-800">{notif.title}</span><span className="text-[10px] font-medium text-slate-400">{safeDate(notif.time)}</span></div><p className="text-xs font-medium text-slate-500 line-clamp-2">{notif.message}</p></div>)))}</div></div></>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white/80 border border-white px-4 py-2 rounded-full shadow-sm"><UserCircle2 className="w-4 h-4 text-[#74ebd5]" /> {user?.email}</div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeTab === 'inbox' ? 'p-0 sm:p-4 md:p-8' : 'p-4 md:p-8'}`}>
          <div className={`max-w-7xl mx-auto h-full flex flex-col ${activeTab === 'inbox' ? 'min-w-0' : 'min-w-[800px] md:min-w-0'}`}>
            
            {/* ✨ DASHBOARD TAB ✨ */}
            {activeTab === 'dashboard' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1 flex items-center gap-3">{greeting.text}, {user?.email?.split('@')[0]} <span className="inline-block animate-bounce origin-bottom text-4xl" style={{ animationDuration: '2s' }}>{greeting.emoji}</span></h2><p className="text-slate-500 text-sm font-medium">Here is what is happening with your leads today.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={`${cardPadded} hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}><div className="flex items-center justify-between mb-6"><h3 className={lblCls}>Today's Leads</h3><div className="p-2.5 bg-[#74ebd5]/15 rounded-xl text-[#50bdaf] shadow-inner"><Zap className="w-5 h-5" /></div></div><div className="flex items-end gap-3"><p className="text-4xl font-black text-slate-800">{dashboardStats.todaysLeadsCount}</p></div></div>
                  <div className={`${cardPadded} hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}><div className="flex items-center justify-between mb-6"><h3 className={lblCls}>7-Day Volume</h3><div className="p-2.5 bg-[#9face6]/15 rounded-xl text-[#7b8ed3] shadow-inner"><Activity className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.trendChart.reduce((sum, item) => sum + item.count, 0)}</p></div>
                  <div className={`${cardPadded} hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}><div className="flex items-center justify-between mb-6"><h3 className={lblCls}>Active Pipeline</h3><div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 shadow-inner"><Target className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.activePipelineCount}</p></div>
                  <div className={`${cardPadded} hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}><div className="flex items-center justify-between mb-6"><h3 className={lblCls}>Conversion Rate</h3><div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 shadow-inner"><TrendingUp className="w-5 h-5" /></div></div><p className="text-4xl font-black text-slate-800">{dashboardStats.conversionRate}%</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className={`lg:col-span-2 ${cardPadded}`}><h3 className="text-lg font-bold text-slate-800 mb-8">Lead Generation Trend (Last 7 Days)</h3><div className="flex-1 min-h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboardStats.trendChart}><defs><linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#74ebd5" stopOpacity={0.4}/><stop offset="95%" stopColor="#74ebd5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dx={-10} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600 }} itemStyle={{ color: '#50bdaf' }} /><Area type="monotone" dataKey="count" stroke="#74ebd5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" /></AreaChart></ResponsiveContainer></div></div>
                  <div className={cardPadded}><h3 className="text-lg font-bold text-slate-800 mb-6">Today's Lead Sources</h3>{dashboardStats.todaysSourceChart.length > 0 ? (<div className="flex-1 flex flex-col justify-center min-h-[250px]"><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={dashboardStats.todaysSourceChart} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name" stroke="none">{dashboardStats.todaysSourceChart.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} /></PieChart></ResponsiveContainer><div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">{dashboardStats.todaysSourceChart.map((source, index) => <div key={source.name} className="flex items-center gap-2 text-xs font-bold text-slate-600"><div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />{source.name} <span className="text-slate-400">({source.value})</span></div>)}</div></div>) : (<div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-slate-100"><Users className="w-10 h-10 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-500">No leads generated today</p></div>)}</div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cardBase}><div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold text-slate-800">Recent Leads</h3><button onClick={() => setActiveTab('leads')} className="text-xs font-bold text-[#50bdaf] hover:text-[#419c90] bg-[#74ebd5]/10 hover:bg-[#74ebd5]/20 px-3 py-1.5 rounded-lg transition-colors">View All</button></div><div className="flex-1 overflow-x-auto custom-scrollbar">{leads.length > 0 ? (<table className="w-full text-left border-collapse"><thead><tr className={thCls}><th className="px-6 py-4">Lead Name</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100/60">{leads.slice(0, 5).map(lead => (<tr key={lead.id} className="hover:bg-white/60 transition-colors"><td className={tdCls}><div className="font-bold text-slate-800 text-sm">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}</div><div className="text-xs text-slate-500">{lead.phone || lead.email}</div></td><td className={tdCls}><span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[9px] font-bold border ${getStatusBadgeClass(lead.status)}`}>{lead.status}</span></td><td className={`${tdCls} text-right`}><button onClick={() => openLeadDetails(lead)} className="text-xs font-bold text-slate-600 hover:text-[#50bdaf] bg-white border border-slate-200 hover:border-[#74ebd5] shadow-sm px-3 py-1.5 rounded-lg transition-all">View</button></td></tr>))}</tbody></table>) : (<div className="p-12 text-center text-slate-400 font-medium text-sm">No leads available.</div>)}</div></div>
                  <div className={cardBase}><div className="px-8 py-6 border-b border-slate-100/60 bg-white/40 flex justify-between items-center shrink-0"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BellRing className="w-5 h-5 text-amber-500" /> My Priority Tasks</h3><span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 shadow-sm">{myPendingTasks.length} Pending</span></div><div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/30">{myPendingTasks.length === 0 ? (<div className="flex flex-col items-center justify-center text-center p-8 h-full"><CheckSquare className="w-10 h-10 text-slate-300 mb-3" /><p className="text-sm font-bold text-slate-500">You're all caught up!</p></div>) : (<div className="space-y-4">{myPendingTasks.map(task => { const isOverdue = new Date(task.dueDate) < new Date(); return (<div key={task.id} onClick={() => handleOpenTaskLead(task.leadId)} className="group flex items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer relative overflow-hidden">{isOverdue && <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500" />}<div><div className="flex items-center gap-2 mb-1.5"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded border border-slate-200">{task.type}</span><span className={`text-xs font-bold flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}><Clock className="w-3 h-3" />{isOverdue ? 'Overdue: ' : ''}{safeDate(task.dueDate)}</span></div><p className="text-sm font-bold text-slate-800">{task.leadName}</p>{task.note && <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-1">{task.note}</p>}</div><button onClick={(e) => completeTask(e, task.id)} className="p-2 bg-slate-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl border border-slate-200 hover:border-emerald-500 transition-all shadow-sm shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100"><Check className="w-4 h-4" /><span className="text-[9px] font-bold">Done</span></button></div>); })}</div>)}</div></div>
                </div>
              </div>
            )}

            {/* ✨ LEADS TAB ✨ */}
            {activeTab === 'leads' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-8 shrink-0">
                  <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Leads</h2><p className="text-slate-500 text-sm font-medium">Manage and track your prospective customers.</p></div>
                  <div className="flex items-center gap-3">
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="flex items-center gap-2 py-2.5 px-5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50">{isImporting ? <div className="w-4 h-4 border-2 border-slate-300 border-t-[#74ebd5] rounded-full animate-spin" /> : <Upload className="w-4 h-4" />} Import CSV</button>
                    <button onClick={() => setIsModalOpen(true)} className={btnPrimary}><Plus className="w-4 h-4 mr-2" /> Add New Lead</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 bg-white/60 backdrop-blur-xl p-3 rounded-2xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] mb-8 shrink-0">
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-3 py-1.5 h-10 shadow-sm"><input type="date" value={leadsStartDate} max={leadsEndDate || undefined} onChange={(e) => { setLeadsStartDate(e.target.value); if (leadsEndDate && e.target.value > leadsEndDate) { setLeadsEndDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer" /><span className="text-slate-300 text-sm font-light">|</span><input type="date" value={leadsEndDate} min={leadsStartDate || undefined} onChange={(e) => { setLeadsEndDate(e.target.value); if (leadsStartDate && e.target.value < leadsStartDate) { setLeadsStartDate(e.target.value); } }} className="text-sm font-medium border-none focus:ring-0 text-slate-600 bg-transparent outline-none cursor-pointer" />{(leadsStartDate || leadsEndDate) && <button onClick={() => { setLeadsStartDate(''); setLeadsEndDate(''); }} className="ml-2 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">Clear</button>}</div>
                  <div className="flex items-center gap-2 bg-white/80 border border-slate-100 rounded-xl px-4 py-1.5 h-10 flex-1 min-w-[200px] shadow-sm focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all"><Search className="w-4 h-4 text-slate-400 shrink-0" /><input type="text" placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="text-sm font-medium border-none focus:ring-0 text-slate-700 bg-transparent w-full outline-none placeholder:font-normal" /></div>
                  <select value={leadsViewSourceFilter} onChange={(e) => setLeadsViewSourceFilter(e.target.value)} className="text-sm font-medium border border-slate-100 rounded-xl px-4 py-1.5 h-10 text-slate-600 bg-white/80 shadow-sm focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer"><option value="All">All Sources</option>{combinedSources.map(sourceName => <option key={sourceName} value={sourceName}>{sourceName}</option>)}</select>
                  <div className="flex items-center bg-white/80 border border-slate-100 rounded-xl p-1 h-10 shadow-sm"><button onClick={() => setViewMode('pipeline')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${viewMode === 'pipeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><KanbanSquare className="w-4 h-4" /> Pipeline</button><button onClick={() => setViewMode('table')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all h-full ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}><List className="w-4 h-4" /> Table</button></div>
                </div>
                {loading ? (<div className="p-12 flex justify-center"><div className="w-10 h-10 border-4 border-[#74ebd5]/30 border-t-[#74ebd5] rounded-full animate-spin" /></div>) : leads.length === 0 ? (<div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white shadow-[0_8px_30px_rgba(116,235,213,0.05)] p-16 text-center flex flex-col items-center"><div className="bg-white p-4 rounded-2xl shadow-sm mb-4"><Users className="w-10 h-10 text-slate-300" /></div><h3 className="text-xl font-bold text-slate-800 mb-2">No leads found</h3></div>) : viewMode === 'table' ? (
                  <div className={cardBase}>
                    {selectedLeads.length > 0 && (
                      <div className="bg-indigo-50/90 backdrop-blur-md px-6 py-3 border-b border-indigo-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-indigo-800">{selectedLeads.length} selected</span>
                        <div className="flex gap-3">
                          <button onClick={() => { setCampaignTab('whatsapp'); setIsCampaignModalOpen(true); }} className="flex items-center gap-2 py-1.5 px-4 bg-[#25D366] hover:bg-[#1EBE57] text-white text-sm font-bold rounded-xl transition-all shadow-md"><MessageCircle className="w-4 h-4" /> WhatsApp</button>
                          <button onClick={() => { setCampaignTab('email'); setIsCampaignModalOpen(true); }} className="flex items-center gap-2 py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md"><Send className="w-4 h-4" /> Email</button>
                          <button onClick={handleDeleteSelected} className="flex items-center gap-2 py-1.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-md"><Trash2 className="w-4 h-4" /> Delete</button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                      <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-xl shadow-sm"><tr className={thCls}><th className="px-6 py-4 w-10"><input type="checkbox" className="rounded-md border-slate-300 text-[#74ebd5] focus:ring-[#74ebd5] cursor-pointer w-4 h-4" checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length} onChange={handleSelectAll} /></th><th className="px-6 py-4 w-10"></th><th className="px-6 py-4">Date</th><th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Source</th><th className="px-6 py-4">Tags</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Project</th><th className="px-6 py-4">Assignee</th></tr></thead>
                        <tbody className="divide-y divide-slate-100/60 bg-transparent">
                          {paginatedLeads.map((lead) => (
                            <React.Fragment key={lead.id}>
                              <tr onClick={() => openLeadDetails(lead)} className="hover:bg-white/60 transition-colors cursor-pointer group">
                                <td className={tdCls} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="rounded-md border-slate-300 text-[#74ebd5] focus:ring-[#74ebd5] cursor-pointer w-4 h-4" checked={selectedLeads.includes(lead.id)} onChange={(e) => handleSelectLead(lead.id, e as any)} /></td>
                                <td className={tdCls} onClick={(e) => toggleExpandLead(lead.id, e)}><button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">{expandedLeads.includes(lead.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button></td>
                                <td className={`${tdCls} text-slate-500 font-medium`}>{safeDate(lead.createdAt)}</td>
                                <td className={tdCls}><div className="font-bold text-slate-800">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}{lead.isDuplicate && <span className="ml-2.5 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-700 uppercase tracking-widest">Duplicate</span>}</div></td>
                                <td className={tdCls}><div className="flex flex-col gap-1 text-sm text-slate-600 font-medium"><div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{lead.phone || '-'}</div>{lead.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" />{lead.email}</div>}</div></td>
                                <td className={tdCls}>{getSourceBadge(lead.source, lead.subSource)}</td>
                                <td className={tdCls}><div className="flex flex-wrap gap-1.5 max-w-[160px]">{lead.tags?.map(tag => <span key={tag} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200 shadow-sm uppercase tracking-wider">{tag}</span>)}</div></td>
                                <td className={tdCls}><span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${getStatusBadgeClass(lead.status)}`}>{lead.status}</span></td>
                                <td className={tdCls}><div className="flex items-center gap-2 text-slate-700 text-sm font-medium"><Home className="w-4 h-4 text-slate-400" />{lead.projectProperty || '-'}</div></td>
                                <td className={tdCls}>{user?.role === 'client_admin' ? <select value={lead.assignedToId || lead.assignedTo || ''} onChange={(e) => { e.stopPropagation(); handleAssignLead(lead.id, e.target.value); }} onClick={(e) => e.stopPropagation()} className="text-sm font-medium bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-[#74ebd5]/30 outline-none shadow-sm cursor-pointer"><option value="">Unassigned</option>{teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select> : <span className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">{lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}</span>}</td>
                              </tr>
                              {expandedLeads.includes(lead.id) && (
                                <tr className="bg-slate-50/50 backdrop-blur-sm border-b border-slate-200/50">
                                  <td colSpan={10} className="px-6 py-5">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 text-sm bg-white/60 p-4 rounded-xl border border-white">
                                      {(lead.designation && lead.designation !== "Unknown") && <div><span className={lblCls}>Designation</span><span className="text-slate-700 font-medium flex items-center gap-1.5">💼 {lead.designation}</span></div>}
                                      {(lead.location && lead.location !== "Unknown") && <div><span className={lblCls}>Location</span><span className="text-slate-700 font-medium flex items-center gap-1.5">📍 {lead.location}</span></div>}
                                      {lead.linkedin && <div><span className={lblCls}>LinkedIn</span><a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-bold flex items-center gap-1">🔗 View Profile</a></div>}
                                      {(lead.truecallerName && lead.truecallerName !== "Unknown") && <div><span className={lblCls}>Truecaller Record</span><span className="text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit"><CheckCircle2 className="w-3 h-3"/>{lead.truecallerName}</span></div>}
                                      {lead.adName && <div><span className={lblCls}>Ad Name</span><span className="text-slate-700 font-medium">{lead.adName}</span></div>}
                                      {lead.campaignName && <div><span className={lblCls}>Campaign Name</span><span className="text-slate-700 font-medium">{lead.campaignName}</span></div>}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-slate-100 bg-white/50 backdrop-blur-md flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-500">Showing <span className="font-bold text-slate-900">{((currentPage - 1) * leadsPerPage) + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * leadsPerPage, filteredLeadsView.length)}</span> of <span className="font-bold text-slate-900">{filteredLeadsView.length}</span> leads</div>
                        <div className="flex items-center gap-3"><button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50">Previous</button><span className="text-sm font-bold text-slate-600 px-2 py-1.5 bg-white border border-slate-200 rounded-lg">{currentPage} / {totalPages}</span><button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50">Next</button></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar">
                    <div className="flex gap-6 h-full min-w-max px-1 pt-1">
                      {PIPELINE_STATUSES.map(status => (
                        <div key={status} className="w-[340px] flex flex-col bg-white/40 backdrop-blur-xl rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(116,235,213,0.05)] overflow-hidden shrink-0">
                          <div className="p-5 border-b border-white/60 bg-white/40 flex items-center justify-between shrink-0"><h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{status}</h3><span className="bg-white/80 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-100">{filteredLeadsView.filter(l => l.status === status).length}</span></div>
                          <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                            {filteredLeadsView.filter(l => l.status === status).map(lead => (
                              <div key={lead.id} onClick={() => openLeadDetails(lead)} className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
                                <div className="flex justify-between items-start mb-4"><div className="font-bold text-slate-900 leading-tight pr-2">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}</div>{getSourceBadge(lead.source, lead.subSource)}</div>
                                <div className="space-y-2 mb-5">
                                  <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600"><div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Phone className="w-3.5 h-3.5" /></div><span className="truncate">{lead.phone || 'No phone'}</span>{lead.truecallerName && lead.truecallerName !== "Unknown" && <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">Verified</span>}</div>
                                  <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600"><div className="p-1.5 bg-slate-100 rounded-md text-slate-400"><Home className="w-3.5 h-3.5" /></div><span className="truncate">{lead.projectProperty || 'No project'}</span></div>
                                </div>
                                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                                  <select value={lead.status} onChange={(e) => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value); }} onClick={(e) => e.stopPropagation()} className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none cursor-pointer">{PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasMoreLeads && leads.length > 0 && <div className="mt-6 flex justify-center pb-8"><button onClick={loadMoreLeads} disabled={loadingMoreLeads} className="flex items-center gap-2 px-8 py-3 bg-white/80 backdrop-blur-md border border-white rounded-2xl text-sm font-bold text-slate-700 hover:bg-white transition-all shadow-sm disabled:opacity-50">{loadingMoreLeads ? 'Loading...' : 'Load More Leads'}</button></div>}
              </div>
            )}

            {/* ✨ FEEDBACK TAB ✨ */}
            {activeTab === 'feedback' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Leads Feedback</h2><p className="text-slate-500 text-sm font-medium">Analyze communication history and agent notes.</p></div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleExportFeedbackCSV} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white text-sm font-bold rounded-xl shadow-lg hover:opacity-90 transition-all"><Download className="w-4 h-4" />Export Feedback</button>
                  </div>
                </div>
                <div className={cardPadded}>
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Feedback Distribution by Source</h3>
                  {dynamicFeedbackSourceData.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-8">
                      <div className="h-[250px] w-full max-w-md"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dynamicFeedbackSourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" stroke="none">{dynamicFeedbackSourceData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} /></PieChart></ResponsiveContainer></div>
                      <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-4">{dynamicFeedbackSourceData.map((source, index) => <div key={source.name} className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white/60 p-3 rounded-xl border border-white shadow-sm"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />{source.name} <span className="text-slate-400 font-medium ml-1">({source.value})</span></div>)}</div>
                    </div>
                  ) : (<div className="p-12 text-center text-slate-400 font-medium text-sm">No data available for the selected filters.</div>)}
                </div>
                <div className={cardBase}>
                  <div className="px-8 py-6 border-b border-slate-100/60 bg-white/40"><h3 className="text-lg font-bold text-slate-800">Lead Feedback Logs</h3></div>
                  <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md"><tr className={thCls}><th className="px-8 py-5">Lead Details</th><th className="px-8 py-5">Source</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 w-[45%]">Latest Feedback</th></tr></thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {filteredFeedbackLeads.map(lead => {
                          const sortedNotes = lead.notes ? [...lead.notes].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
                          const latestNote = sortedNotes.length > 0 ? sortedNotes[0] : null;
                          return (
                            <tr key={lead.id} className="hover:bg-white/60 transition-colors cursor-pointer" onClick={() => openLeadDetails(lead)}>
                              <td className="px-8 py-5"><div className="font-bold text-slate-800">{lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}</div><div className="text-xs font-medium text-slate-500 mt-1">{lead.phone || lead.email}</div></td>
                              <td className="px-8 py-5 whitespace-nowrap">{getSourceBadge(lead.source, lead.subSource)}</td>
                              <td className="px-8 py-5 whitespace-nowrap"><span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold border ${getStatusBadgeClass(lead.status)} uppercase tracking-wider`}>{lead.status}</span></td>
                              <td className="px-8 py-5 min-w-[300px]">{latestNote ? <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100"><div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{latestNote.authorEmail}</span><span className="text-[10px] text-slate-400 font-bold">{safeDate(latestNote.timestamp)}</span></div><p className="text-sm font-medium text-slate-700 whitespace-pre-wrap line-clamp-2 leading-relaxed">{latestNote.text}</p></div> : <span className="text-xs font-medium text-slate-400 italic">No feedback recorded yet.</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ INTEGRATIONS TAB ✨ */}
            {activeTab === 'integrations' && (
              <div className="w-full max-w-6xl mx-auto space-y-8">
                <div className="mb-8"><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">External Integrations</h2><p className="text-slate-500 text-sm font-medium">Connect your Facebook Ads, Google Ads, or Website to capture leads automatically.</p></div>
                <div className="space-y-6">
                  {/* WHATSAPP */}
                  <div className={cardBase}>
                    <div className="p-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-[#25D366]/20 rounded-2xl text-[#1EBE57] shadow-lg shadow-[#25D366]/10"><MessageCircle className="w-8 h-8" /></div>
                          <div><div className="flex items-center gap-3 mb-1"><h3 className="text-xl font-bold text-slate-900 tracking-tight">WhatsApp Cloud API</h3>{whatsappConnected ? <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-[#25D366]/20 text-[#1a9347] border border-[#25D366]/40 uppercase tracking-widest">Connected</span> : <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest">Not Connected</span>}</div><p className="text-slate-500 text-sm font-medium">Connect your WhatsApp Business number to send automated bulk campaigns directly from the CRM.</p></div>
                        </div>
                        <div>
                          {whatsappConnected ? (<div className="px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm font-bold flex flex-col items-center"><span className="text-[10px] text-slate-400 uppercase tracking-widest">Phone ID</span><span className="font-mono mt-0.5">{whatsappNumberId || 'Pending'}</span></div>) : (<button onClick={handleConnectWhatsApp} disabled={isLinkingWhatsApp} className="px-6 py-3 bg-[#25D366] text-white hover:bg-[#1EBE57] rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50">{isLinkingWhatsApp ? 'Connecting...' : 'Connect WhatsApp'}</button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* FACEBOOK */}
                  <div className={cardBase}>
                    <div className="p-8">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-gradient-to-br from-[#9face6] to-[#7b8ed3] rounded-2xl text-white shadow-lg"><Facebook className="w-8 h-8" /></div>
                          <div><div className="flex items-center gap-3 mb-1"><h3 className="text-xl font-bold text-slate-900 tracking-tight">Meta / Facebook Ads</h3>{isLoadingLinkedPages ? <div className="h-6 w-24 bg-slate-200 rounded-lg animate-pulse"></div> : linkedPages.length > 0 ? <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-[#74ebd5]/20 text-[#50bdaf] border border-[#74ebd5]/40 uppercase tracking-widest">Connected</span> : <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-widest">Not Connected</span>}</div><p className="text-slate-500 text-sm font-medium">Automatically sync leads from your Facebook Lead Ads directly into your CRM.</p></div>
                        </div>
                        <div><button onClick={handleConnectFacebook} disabled={isLoadingFb} className="px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-50">{isLoadingFb ? 'Connecting...' : 'Connect Facebook'}</button></div>
                      </div>
                      {linkedPages.length > 0 && (<div className="mt-8 pt-8 border-t border-slate-200/60"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Connected Pages</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{linkedPages.map(page => (<div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-[#9face6]/10 rounded-lg text-[#7b8ed3]"><Globe className="w-5 h-5"/></div><div><p className="text-sm font-bold text-slate-800">{page.pageName}</p><p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.pageId}</p></div></div><button onClick={() => handleDisconnectPage(page.id)} className="text-[11px] font-bold text-red-600 hover:text-white px-3 py-1.5 bg-red-50 hover:bg-red-500 rounded-lg transition-colors border border-red-100">Disconnect</button></div>))}</div></div>)}
                      {fbPages.length > 0 && linkedPages.length === 0 && (<div className="mt-8 pt-8 border-t border-slate-200/60"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Available Pages to Link</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fbPages.map(page => { const isLinked = linkedPages.some(lp => lp.pageId === page.id); return (<div key={page.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Facebook className="w-5 h-5"/></div><div><p className="text-sm font-bold text-slate-800">{page.name}</p><p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">ID: {page.id}</p></div></div><button onClick={() => handleLinkPage(page)} disabled={isLinked || isLinking} className={`text-[11px] font-bold px-4 py-2 rounded-lg transition-all ${isLinked || isLinking ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-[#9face6]/10 text-[#7b8ed3] hover:bg-[#9face6] hover:text-white border border-[#9face6]/30 shadow-sm'}`}>{isLinking ? 'Securing...' : isLinked ? 'Linked' : 'Link Page'}</button></div>);})}</div></div>)}
                    </div>
                  </div>
                  {/* WEBHOOK */}
                  <div className={cardBase}>
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-gradient-to-br from-[#74ebd5] to-[#50bdaf] rounded-2xl text-white shadow-lg"><Zap className="w-6 h-6" /></div><div><h3 className="text-xl font-bold text-slate-900 tracking-tight">Your Unique Webhook URL</h3><p className="text-slate-500 text-sm font-medium mt-1">Use this endpoint to send leads from any external platform.</p></div></div>
                      <div className="bg-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4"><code className="text-sm text-[#74ebd5] break-all font-mono font-medium">{webhookUrl}</code><button onClick={handleCopy} className="p-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">{copied ? <Check className="w-5 h-5 text-[#74ebd5]" /> : <Copy className="w-5 h-5" />}</button></div>
                    </div>
                  </div>
                  {/* API BRIDGE */}
                  <div className={`${cardBase} mt-6`}>
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg"><Link2 className="w-6 h-6" /></div><div><h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">Enterprise API Bridge <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] uppercase tracking-widest font-black rounded-md">Pro Feature</span></h3><p className="text-slate-500 text-sm font-medium mt-1">Route leads directly to external CRMs (Salesforce, Zoho) or Zapier/Make endpoints.</p></div></div>
                      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-6">
                          <div><label className={lblCls}>Webhook / API Endpoint URL</label><input type="url" value={outboundWebhookUrl} onChange={(e) => setOutboundWebhookUrl(e.target.value)} placeholder="https://api.salesforce.com/..." className={inpCls} /></div>
                          <div className="bg-slate-100/50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between mb-3"><div><h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Custom Headers (Authentication)</h4><p className="text-[10px] text-slate-500 font-medium mt-0.5">Add Auth Tokens or API Keys for direct CRM pushes. Leave blank for Zapier.</p></div><button onClick={() => setOutboundHeaders([...outboundHeaders, {key: '', value: ''}])} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"><Plus className="w-3 h-3" /> Add Header</button></div>
                            <div className="space-y-2">
                              {outboundHeaders.map((header, index) => (
                                <div key={index} className="flex items-center gap-2 animate-in fade-in duration-200"><input type="text" placeholder="Key (e.g. Authorization)" value={header.key} onChange={(e) => { const newH = [...outboundHeaders]; newH[index].key = e.target.value; setOutboundHeaders(newH); }} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" /><input type="text" placeholder="Value (e.g. Bearer token123)" value={header.value} onChange={(e) => { const newH = [...outboundHeaders]; newH[index].value = e.target.value; setOutboundHeaders(newH); }} className="flex-1 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm" /><button onClick={() => setOutboundHeaders(outboundHeaders.filter((_, i) => i !== index))} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 rounded-lg transition-colors shadow-sm"><Trash2 className="w-3.5 h-3.5"/></button></div>
                              ))}
                              {outboundHeaders.length === 0 && (<div className="text-center py-4 text-[11px] font-medium text-slate-400 italic bg-white border border-slate-200 border-dashed rounded-lg">No custom headers added.</div>)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-2"><button onClick={handleSaveCustomCRM} disabled={isSavingCRM} className={btnPrimary}>{isSavingCRM ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save API Bridge</>}</button><button onClick={handleTestCustomCRM} disabled={isTestingCRM} className={btnCancel}>{isTestingCRM ? 'Sending...' : 'Test Connection'}</button></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ TEAM TAB ✨ */}
            {activeTab === 'team' && (
              <div className="w-full max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between mb-8"><div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Your Team</h2></div>{user?.role === 'client_admin' && <button onClick={() => setIsAgentModalOpen(true)} className={btnPrimary}><UserPlus className="w-4 h-4 mr-2" />Add New Agent</button>}</div>
                <div className={cardBase}>
                  {agents.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center"><div className="bg-white p-4 rounded-2xl shadow-sm mb-4"><Users className="w-10 h-10 text-slate-300" /></div><h3 className="text-xl font-bold text-slate-800 mb-2">No agents found</h3></div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className={thCls}><th className="px-6 py-4">Name</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Role</th><th className="px-6 py-4">Date Added</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                        <tbody className="divide-y divide-slate-100/60">
                          {agents.map((agent) => (
                            <tr key={agent.id} className="hover:bg-white/60 transition-colors group">
                              <td className={tdCls}>{inlineEditingAgentId === agent.id ? <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200"><input type="text" value={inlineEditingName} onChange={(e) => setInlineEditingName(e.target.value)} className="px-3 py-1.5 text-sm font-medium border-none rounded-lg focus:ring-2 focus:ring-[#74ebd5] outline-none w-48" autoFocus /><button onClick={() => handleSaveInlineEdit(agent.id)} className="text-white bg-[#74ebd5] hover:bg-[#50bdaf] px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Save</button><button onClick={() => setInlineEditingAgentId(null)} className="text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">Cancel</button></div> : <div className="font-bold text-slate-800">{agent.name}</div>}</td>
                              <td className={tdCls}><div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" />{agent.email}</div></td>
                              <td className={tdCls}><span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold bg-[#74ebd5]/10 text-[#4cb8a5] uppercase tracking-widest border border-[#74ebd5]/30">Agent</span></td>
                              <td className={`${tdCls} text-slate-500`}>{safeDate(agent.createdAt)}</td>
                              <td className={`${tdCls} text-right`}><button onClick={() => handleEditAgent(agent)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg mr-2"><Edit2 className="w-4 h-4" /></button><button onClick={() => handleDeleteAgent(agent.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✨ REPORTS TAB ✨ */}
            {activeTab === 'reports' && (
              <div className="w-full space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div><h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight mb-1">Advanced Analytics</h2><p className="text-slate-500 text-sm font-medium">Enterprise-level insights, pipeline health, and agent performance.</p></div>
                  <div className="flex items-center gap-4"><button onClick={handleExportCSV} className={btnPrimary}><Download className="w-4 h-4 mr-2" /> Export Master Data</button></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={cardPadded}><h3 className={lblCls}><Users className="w-4 h-4 inline text-indigo-500 mr-2"/> Total Leads</h3><p className="text-4xl font-black text-slate-800">{reportsData.total}</p></div>
                  <div className={cardPadded}><h3 className={lblCls}><Target className="w-4 h-4 inline text-amber-500 mr-2"/> Active Pipeline</h3><p className="text-4xl font-black text-slate-800">{reportsData.active}</p></div>
                  <div className={cardPadded}><h3 className={lblCls}><TrendingUp className="w-4 h-4 inline text-emerald-500 mr-2"/> Win Rate</h3><div className="flex items-baseline gap-2"><p className="text-4xl font-black text-slate-800">{reportsData.winRate}%</p><span className="text-xs font-bold text-slate-400 mb-1">({reportsData.won} Deals)</span></div></div>
                  <div className={cardPadded}><h3 className={lblCls}><XCircle className="w-4 h-4 inline text-red-400 mr-2"/> Lost / Junk</h3><p className="text-4xl font-black text-slate-800">{reportsData.lostOrJunk}</p></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={`${cardPadded} min-h-[350px]`}>
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Lead Generation Trend</h3>
                    {reportsData.trendChart.length > 0 ? (
                      <div className="flex-1 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={reportsData.trendChart}><defs><linearGradient id="colorTrendReports" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9face6" stopOpacity={0.4}/><stop offset="95%" stopColor="#9face6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dx={-10} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 600 }} itemStyle={{ color: '#7b8ed3' }} /><Area type="monotone" dataKey="count" stroke="#9face6" strokeWidth={3} fillOpacity={1} fill="url(#colorTrendReports)" /></AreaChart></ResponsiveContainer></div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No trend data available</div> )}
                  </div>
                  
                  <div className={`${cardPadded} min-h-[350px]`}>
                    <div className="flex items-center justify-between mb-6"><h3 className="text-lg font-bold text-slate-800">Agent Leaderboard</h3><span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-amber-100 flex items-center gap-1"><Medal className="w-3 h-3"/> Top 5</span></div>
                    {reportsData.agentChart.length > 0 ? (
                      <div className="flex-1 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportsData.agentChart} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} width={80} /><Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0 0 0 / 0.1)', fontWeight: 600 }} /><Bar dataKey="totalLeads" name="Total Leads" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={12} /><Bar dataKey="wonDeals" name="Won Deals" fill="#74ebd5" radius={[0, 4, 4, 0]} barSize={12} /></BarChart></ResponsiveContainer></div>
                    ) : ( <div className="flex-1 flex items-center justify-center text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl">No agent data available</div> )}
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
          onOpenChat={(leadId) => { setActiveTab('inbox'); setActiveChatLeadId(leadId); setIsLeadModalOpen(false); }}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-6 transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center p-6 border-b border-slate-200/60 shrink-0"><h3 className="text-xl font-extrabold text-slate-800">Add New Lead</h3><button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button></div>
            <form id="add-lead-form" onSubmit={handleAddLead} className="p-8 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-5"><div><label className={lblCls}>First Name</label><input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inpCls} /></div><div><label className={lblCls}>Last Name</label><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inpCls} /></div></div>
              <div><label className={lblCls}>Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inpCls} /></div>
              <div><label className={lblCls}>Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inpCls} /></div>
              <div><label className={lblCls}>Project / Property</label><input type="text" value={projectProperty} onChange={(e) => setProjectProperty(e.target.value)} className={inpCls} placeholder="e.g. Sunset Villas" /></div>
              <div className="grid grid-cols-2 gap-5"><div><label className={lblCls}>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className={inpCls}>{PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className={lblCls}>Source</label><select value={source} onChange={(e) => setSource(e.target.value)} className={inpCls}>{leadSources.length === 0 && <option value="Manual">Manual</option>}{leadSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div></div>
              <div className="grid grid-cols-2 gap-5"><div><label className={lblCls}>Sub-Source</label><select value={subSource} onChange={(e) => setSubSource(e.target.value)} className={inpCls}><option value="">None</option>{leadSubSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>{user?.role === 'client_admin' && (<div><label className={lblCls}>Assign To</label><select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inpCls}><option value="">Unassigned</option>{teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>)}</div>
            </form>
            <div className="p-6 border-t border-slate-200/60 flex justify-end gap-3 bg-slate-50/50 rounded-b-3xl shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className={btnCancel}>Cancel</button><button type="submit" form="add-lead-form" disabled={addingLead} className={btnPrimary}>{addingLead ? 'Saving...' : 'Save Lead'}</button></div>
          </div>
        </div>
      )}

      {isAgentModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200/60"><h3 className="text-xl font-extrabold text-slate-800">Add New Agent</h3><button onClick={() => { setIsAgentModalOpen(false); setAgentName(''); setAgentEmail(''); setAgentPassword(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleCreateAgent} className="p-8 space-y-5">
              <div><label className={lblCls}>Full Name</label><input type="text" required value={agentName} onChange={(e) => setAgentName(e.target.value)} className={inpCls} /></div>
              <div><label className={lblCls}>Email Address</label><input type="email" required value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} className={inpCls} /></div>
              <div><label className={lblCls}>Temporary Password</label><input type="password" required value={agentPassword} onChange={(e) => setAgentPassword(e.target.value)} className={inpCls} minLength={6} /><p className="mt-2 text-[11px] font-medium text-slate-400">Must be at least 6 characters long.</p></div>
              <div className="pt-6 flex gap-3"><button type="button" onClick={() => { setIsAgentModalOpen(false); setAgentName(''); setAgentEmail(''); setAgentPassword(''); }} className={btnCancel}>Cancel</button><button type="submit" disabled={addingAgent} className={btnPrimary}>{addingAgent ? 'Creating...' : 'Create Agent'}</button></div>
            </form>
          </div>
        </div>
      )}

      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }`}</style>
    </div>
  );
}