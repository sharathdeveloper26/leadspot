import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Home, Calendar, Globe, Facebook, Search, Clock, Send, Tag, Plus, UserCircle2, HelpCircle, BellRing, CheckSquare, MessageCircle, FileText, Activity, CheckCircle2 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export interface LeadNote {
  text: string;
  authorEmail: string;
  authorRole: string;
  timestamp: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  projectProperty: string;
  status: string;
  source?: string;
  subSource?: string;
  assignedTo?: string;
  assignedToId?: string;
  assignedToName?: string;
  botStatus?: string;
  isDuplicate?: boolean;
  createdAt: any;
  notes?: LeadNote[];
  tags?: string[];
  [key: string]: any; 
  designation?: string;
  location?: string;
  linkedin?: string;
  truecallerName?: string;
  truecallerBusiness?: string;
  truecallerEmail?: string;
  formId?: string;
  adId?: string;
  adName?: string;
  campaignId?: string;
  campaignName?: string;
  customAnswers?: Record<string, string>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: (updatedLead: Lead) => void;
  teamMembers: {id: string, name: string}[];
  onOpenChat?: (leadId: string) => void; 
}

const PIPELINE_STATUSES = [
  'New', 'Attempted Contact', 'Connected / Warm', 'Site Visit Scheduled', 
  'Site Visit Completed', 'Negotiation', 'Closed Won', 'Closed Lost', 'Junk / Invalid'
];

const REMINDER_TYPES = ['Follow-up Call', 'Site Visit Scheduled', 'Post-Visit Feedback', 'Document/Payment Collection', 'General To-Do'];

export default function LeadDetailsModal({ lead, isOpen, onClose, onLeadUpdated, teamMembers, onOpenChat }: LeadDetailsModalProps) {
  const { user, role } = useAuth();
  
  // ✨ LEVEL 5 UI: Action Center Tab State
  const [actionTab, setActionTab] = useState<'notes' | 'tasks'>('notes');

  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);

  // Task Engine State
  const [reminders, setReminders] = useState<any[]>([]);
  const [reminderType, setReminderType] = useState(REMINDER_TYPES[0]);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  useEffect(() => {
    const fetchLeadSources = async () => {
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
      } catch (error) {
        console.error("Error fetching lead sources:", error);
      }
    };
    if (isOpen) fetchLeadSources();
  }, [user?.clientId, isOpen]);

  useEffect(() => {
    if (!isOpen || !lead || !user?.clientId) {
      setReminders([]); 
      return;
    }

    const q = query(
      collection(db, 'reminders'),
      where('clientId', '==', user.clientId),
      where('leadId', '==', lead.id) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReminders: any[] = [];
      snapshot.forEach((doc) => {
        fetchedReminders.push({ id: doc.id, ...doc.data() });
      });
      fetchedReminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setReminders(fetchedReminders);
    }, (error) => {
      console.error("Reminders listener failed:", error);
    });

    return () => {
      unsubscribe();
      setReminders([]); 
    };
  }, [isOpen, lead?.id, user?.clientId]);

  if (!isOpen || !lead) return null;

  const handleAddTag = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tagInput.trim() || !user) return;
    const newTag = tagInput.trim();
    if (lead.tags?.includes(newTag)) { setTagInput(''); return; }

    setIsAddingTag(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), { tags: arrayUnion(newTag) });
      onLeadUpdated({ ...lead, tags: [...(lead.tags || []), newTag] });
      setTagInput('');
    } catch (error) {
      console.error('Error adding tag:', error);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'leads', lead.id), { tags: arrayRemove(tag) });
      onLeadUpdated({ ...lead, tags: (lead.tags || []).filter(t => t !== tag) });
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !user) return;
    setIsSaving(true);
    try {
      const newNote: LeadNote = {
        text: noteText.trim(),
        authorEmail: user.email || 'Unknown',
        authorRole: role || 'unknown',
        timestamp: new Date().toISOString()
      };
      await updateDoc(doc(db, 'leads', lead.id), { notes: arrayUnion(newNote) });
      onLeadUpdated({ ...lead, notes: [...(lead.notes || []), newNote] });
      setNoteText('');
    } catch (error) {
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDate || !user?.clientId) return;
    setIsSavingReminder(true);
    try {
      await addDoc(collection(db, 'reminders'), {
        clientId: user.clientId,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName === 'Lead' ? '' : lead.lastName}`.trim(),
        agentId: lead.assignedToId || lead.assignedTo || user.uid,
        type: reminderType,
        dueDate: new Date(reminderDate).toISOString(),
        note: reminderNote.trim(),
        status: 'Pending',
        createdBy: user.email,
        createdAt: serverTimestamp()
      });
      setReminderDate('');
      setReminderNote('');
      setReminderType(REMINDER_TYPES[0]);
    } catch (error) {
      console.error('Error adding reminder:', error);
      alert('Failed to schedule reminder.');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const markReminderComplete = async (reminderId: string) => {
    try {
      await updateDoc(doc(db, 'reminders', reminderId), { status: 'Completed' });
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

// ✨ LEVEL 5 FIX: Auto-Logging Modal Status Changes
  const handleStatusChange = async (newStatus: string) => {
    try {
      const systemNote: LeadNote = {
        text: `System: Status changed to ${newStatus}`,
        authorEmail: user?.email || 'System',
        authorRole: 'System',
        timestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, 'leads', lead.id), { 
        status: newStatus,
        notes: arrayUnion(systemNote)
      });
      
      onLeadUpdated({ 
        ...lead, 
        status: newStatus,
        notes: [...(lead.notes || []), systemNote]
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // ✨ LEVEL 5 FIX: Auto-Logging Modal Assignments
  const handleAssignmentChange = async (newAssignedToId: string) => {
    try {
      const assignedUser = (teamMembers || []).find(m => m.id === newAssignedToId);
      const assignedToName = assignedUser ? assignedUser.name : 'Unassigned';
      
      const systemNote: LeadNote = {
        text: `System: Lead reassigned to ${assignedToName}`,
        authorEmail: user?.email || 'System',
        authorRole: 'System',
        timestamp: new Date().toISOString()
      };

      await updateDoc(doc(db, 'leads', lead.id), { 
        assignedTo: newAssignedToId || null,
        assignedToId: newAssignedToId || null,
        assignedToName: assignedToName || null,
        notes: arrayUnion(systemNote)
      });
      
      onLeadUpdated({ 
        ...lead, 
        assignedTo: newAssignedToId || undefined,
        assignedToId: newAssignedToId || undefined,
        assignedToName: assignedToName || undefined,
        notes: [...(lead.notes || []), systemNote]
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let icon = <Globe className="w-3.5 h-3.5" />;
    let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
    let label = source || 'Manual';

    if (s.includes('facebook')) { icon = <Facebook className="w-3.5 h-3.5" />; colorClass = "bg-[#74ebd5]/10 text-[#4cb8a5] border-[#74ebd5]/30"; } 
    else if (s.includes('google')) { icon = <Search className="w-3.5 h-3.5" />; colorClass = "bg-amber-50 text-amber-700 border-amber-200"; } 
    else if (s.includes('website')) { icon = <Globe className="w-3.5 h-3.5" />; colorClass = "bg-[#9face6]/10 text-[#7a8ece] border-[#9face6]/30"; }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm border ${colorClass}`}>
        {icon} {label} {subSource ? `/ ${subSource}` : ''}
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'bg-[#74ebd5]/20 text-[#4cb8a5] border-[#74ebd5]/30';
      case 'Attempted Contact': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Connected / Warm': return 'bg-[#9face6]/20 text-[#7a8ece] border-[#9face6]/30';
      case 'Site Visit Scheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Site Visit Completed': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Negotiation': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Closed Won': return 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white border-transparent shadow-md';
      case 'Closed Lost': return 'bg-red-50 text-red-700 border-red-200';
      case 'Junk / Invalid': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Unknown';
    if (date.toDate) return new Date(date.toDate()).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  };

  const sortedNotes = [...(lead.notes || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleWhatsAppClick = () => {
    if (!lead.phone) { alert("No phone number available for this lead."); return; }
    if (onOpenChat) { onOpenChat(lead.id); return; }
    let cleanPhone = lead.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) cleanPhone = `+91${cleanPhone}`;
    cleanPhone = cleanPhone.replace('+', '');
    const leadName = lead.firstName !== "Imported" && lead.firstName !== "FB" ? lead.firstName : "there";
    const agentName = user?.email?.split('@')[0] || "Mintage";
    const projectName = lead.projectProperty || "our properties";
    const message = `Hi ${leadName}, this is ${agentName}. Thank you for your interest in ${projectName}. How can I assist you today?`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleEmailClick = () => {
    if (!lead.email) { alert("No email available for this lead."); return; }
    const leadName = lead.firstName !== "Imported" && lead.firstName !== "FB" ? lead.firstName : "";
    const projectName = lead.projectProperty || "our properties";
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(`Information regarding ${projectName}`)}&body=${encodeURIComponent(`Hi ${leadName},\n\nThank you for your interest in ${projectName}.\n\nBest regards,\n${user?.email?.split('@')[0]}`)}`;
  };

  const handleCallClick = () => {
    if (!lead.phone) { alert("No phone number available for this lead."); return; }
    window.location.href = `tel:${lead.phone}`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      {/* ✨ LEVEL 5 FIX: Expanded width to 1000px for Two-Column Layout */}
      <div className="w-full max-w-[1000px] bg-white h-full shadow-2xl border-l border-white/20 flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
        
        {/* ✨ HEADER (Full Width) */}
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
              {lead.isDuplicate && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 uppercase tracking-widest border border-rose-200 shadow-sm">Duplicate</span>
              )}
            </h2>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`hidden sm:block text-xs font-black px-3 py-1.5 rounded-lg border focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer appearance-none pr-8 bg-no-repeat bg-[right_0.5rem_center] bg-[length:1em_1em] shadow-sm ${getStatusBadgeClass(lead.status)}`}
              style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")` }}
            >
              {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ✨ TWO COLUMN LAYOUT CONTAINER */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/50">
          
          {/* ========================================== */}
          {/* LEFT COLUMN: Context & Details (Scrollable) */}
          {/* ========================================== */}
          <div className="w-full md:w-[400px] lg:w-[450px] bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar shrink-0 p-6 space-y-8">
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <button onClick={handleWhatsAppClick} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1EBE57] text-white text-xs font-bold rounded-xl shadow-md shadow-[#25D366]/20 transition-all hover:-translate-y-0.5">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={handleCallClick} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5">
                <Phone className="w-4 h-4" /> Call
              </button>
              <button onClick={handleEmailClick} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-[#50bdaf] hover:border-[#74ebd5] text-xs font-bold rounded-xl shadow-sm transition-all hover:-translate-y-0.5">
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>

            {/* Core Info */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">About This Lead</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5 text-slate-400" /></div>
                  <span className="font-bold text-slate-700">{lead.phone || 'No phone provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><Mail className="w-3.5 h-3.5 text-slate-400" /></div>
                  <span className="font-bold text-slate-700 break-all">{lead.email || 'No email provided'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><Home className="w-3.5 h-3.5 text-slate-400" /></div>
                  <span className="font-bold text-slate-700">{lead.projectProperty || 'General Inquiry'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0"><Calendar className="w-3.5 h-3.5 text-slate-400" /></div>
                  <span className="font-medium text-slate-500">Created: {formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Enrichment Data */}
            {((lead.designation && lead.designation !== "Unknown") || (lead.location && lead.location !== "Unknown") || lead.linkedin || (lead.truecallerName && lead.truecallerName !== "Unknown")) && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Enriched Profile</h3>
                {lead.truecallerName && lead.truecallerName !== "Unknown" && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <span className="block text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Truecaller Verified</span>
                    <span className="text-sm font-bold text-blue-900">{lead.truecallerName} {lead.truecallerBusiness && lead.truecallerBusiness !== "Unknown" ? '🏢' : ''}</span>
                  </div>
                )}
                {lead.designation && lead.designation !== "Unknown" && (
                  <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">💼</div><span className="font-medium text-slate-700">{lead.designation}</span></div>
                )}
                {lead.location && lead.location !== "Unknown" && (
                  <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">📍</div><span className="font-medium text-slate-700">{lead.location}</span></div>
                )}
                {lead.linkedin && (
                  <div className="flex items-center gap-3 text-sm"><div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">🔗</div><a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">LinkedIn Profile</a></div>
                )}
              </div>
            )}

            {/* Assignment & Source */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Routing & Source</h3>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Source:</span>
                {getSourceBadge(lead.source, lead.subSource)}
              </div>
              {user?.role === 'client_admin' ? (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Assigned Agent</span>
                  <select
                    value={lead.assignedToId || lead.assignedTo || ''}
                    onChange={(e) => handleAssignmentChange(e.target.value)}
                    className="w-full text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-[#74ebd5]/30 cursor-pointer outline-none shadow-sm"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers?.map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Agent:</span>
                  <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                    {lead.assignedToName || teamMembers.find(m => m.id === (lead.assignedToId || lead.assignedTo))?.name || 'Unassigned'}
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {(lead.tags || []).map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm uppercase tracking-wider">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a tag..." className="flex-1 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#74ebd5]/30 outline-none shadow-sm" />
                <button type="submit" disabled={isAddingTag || !tagInput.trim()} className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"><Plus className="w-3.5 h-3.5" /></button>
              </form>
            </div>

            {/* Custom Form Questions (If Any) */}
            {lead.customAnswers && Object.keys(lead.customAnswers).length > 0 && (
              <div className="space-y-3 bg-[#9face6]/5 p-4 rounded-2xl border border-[#9face6]/20">
                <h3 className="text-[10px] font-black text-[#7a8ece] uppercase tracking-widest flex items-center gap-1.5 mb-3"><HelpCircle className="w-3.5 h-3.5"/>Form Questions</h3>
                <div className="space-y-3">
                  {Object.entries(lead.customAnswers).map(([question, answer]) => (
                    <div key={question} className="border-b border-white/50 pb-2 last:border-0 last:pb-0">
                      <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{question.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{String(answer)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Marketing Attribution (If Any) */}
            {(lead.adName || lead.campaignName || lead.formId || lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
              <div className="space-y-3 bg-[#74ebd5]/5 p-4 rounded-2xl border border-[#74ebd5]/20">
                <h3 className="text-[10px] font-black text-[#4cb8a5] uppercase tracking-widest flex items-center gap-1.5 mb-3"><Facebook className="w-3.5 h-3.5"/>Marketing Attribution</h3>
                <div className="space-y-2">
                  {lead.campaignName && <div><span className="block text-[9px] font-bold text-slate-400 uppercase">Campaign</span><span className="text-xs font-bold text-slate-700">{lead.campaignName}</span></div>}
                  {lead.adName && <div><span className="block text-[9px] font-bold text-slate-400 uppercase">Ad Name</span><span className="text-xs font-bold text-slate-700">{lead.adName}</span></div>}
                  {lead.formId && <div><span className="block text-[9px] font-bold text-slate-400 uppercase">Form ID</span><span className="text-[10px] font-mono text-slate-500 break-all">{lead.formId}</span></div>}
                  {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                    <div className="pt-2 mt-2 border-t border-[#74ebd5]/20 flex flex-wrap gap-2">
                      {lead.utm_source && <span className="px-2 py-0.5 bg-white text-slate-500 text-[9px] font-mono border border-slate-200 rounded shadow-sm">src: {lead.utm_source}</span>}
                      {lead.utm_medium && <span className="px-2 py-0.5 bg-white text-slate-500 text-[9px] font-mono border border-slate-200 rounded shadow-sm">med: {lead.utm_medium}</span>}
                      {lead.utm_campaign && <span className="px-2 py-0.5 bg-white text-slate-500 text-[9px] font-mono border border-slate-200 rounded shadow-sm">cmp: {lead.utm_campaign}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ========================================== */}
          {/* RIGHT COLUMN: The Action Center */}
          {/* ========================================== */}
          <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative">
            
            {/* Sticky Tabs Header */}
            <div className="flex px-6 pt-5 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
              <button 
                onClick={() => setActionTab('notes')} 
                className={`pb-3 px-4 text-sm font-extrabold transition-colors relative flex items-center gap-2 ${actionTab === 'notes' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <FileText className="w-4 h-4"/> Notes & Activity
                {actionTab === 'notes' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#50bdaf] rounded-t-full" />}
              </button>
              <button 
                onClick={() => setActionTab('tasks')} 
                className={`pb-3 px-4 text-sm font-extrabold transition-colors relative flex items-center gap-2 ${actionTab === 'tasks' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <BellRing className="w-4 h-4"/> Tasks & Reminders
                {actionTab === 'tasks' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-t-full" />}
              </button>
            </div>

            {/* Tab Content Wrapper */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              
              {/* --- NOTES TAB --- */}
              {actionTab === 'notes' && (
                <div className="flex flex-col h-full animate-in fade-in duration-200">
                  {/* Sticky Note Composer */}
                  <div className="p-6 bg-slate-50/80 border-b border-slate-200 shrink-0 sticky top-0 z-10 backdrop-blur-md">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-[#74ebd5] focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Log a call, add a note, or provide feedback..."
                        className="w-full p-4 text-sm font-medium text-slate-800 placeholder-slate-400 border-none focus:ring-0 resize-none min-h-[100px] outline-none"
                      />
                      <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Posting as <span className="text-slate-700">{user?.email?.split('@')[0]}</span>
                        </span>
                        <button
                          onClick={handleSaveNote}
                          disabled={isSaving || !noteText.trim()}
                          className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md shadow-slate-900/10"
                        >
                          {isSaving ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                          Save Note
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes Timeline */}
                  <div className="flex-1 p-6 space-y-6">
                    {sortedNotes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <Activity className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm font-bold">No activity recorded yet.</p>
                        <p className="text-xs mt-1">Be the first to log a note!</p>
                      </div>
                    ) : (
                      <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {sortedNotes.map((note, idx) => {
                          const isClientAdmin = note.authorRole === 'client_admin' || note.authorRole === 'CLIENT_ADMIN';
                          const initial = note.authorEmail ? note.authorEmail.charAt(0).toUpperCase() : '?';
                          
                          return (
                            <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              {/* Timeline Icon */}
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm text-sm font-black z-10 ${isClientAdmin ? 'bg-[#e0f2fe] text-[#3b82f6]' : 'bg-white text-slate-700'}`}>
                                {initial}
                              </div>
                              {/* Note Card */}
                              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl shadow-sm border bg-white border-slate-100 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">{note.authorEmail.split('@')[0]}</span>
                                    {isClientAdmin && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-[#3b82f6]/10 text-[#3b82f6] uppercase tracking-widest">Manager</span>}
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3"/>{formatDate(note.timestamp)}</div>
                                </div>
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-slate-600">{note.text}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- TASKS TAB --- */}
              {actionTab === 'tasks' && (
                <div className="flex flex-col h-full animate-in fade-in duration-200">
                  {/* Sticky Task Composer */}
                  <div className="p-6 bg-amber-50/50 border-b border-amber-100 shrink-0 sticky top-0 z-10 backdrop-blur-md">
                    <form onSubmit={handleAddReminder} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BellRing className="w-4 h-4 text-amber-500" />
                        <h4 className="text-sm font-extrabold text-slate-800">Schedule a Follow-up</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Task Type</label>
                          <select value={reminderType} onChange={(e) => setReminderType(e.target.value)} className="w-full text-sm font-bold border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer">
                            {REMINDER_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Due Date & Time</label>
                          <input type="datetime-local" required value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input type="text" placeholder="Add a brief note about this task..." value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} className="flex-1 text-sm font-medium border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                        <button type="submit" disabled={isSavingReminder || !reminderDate} className="px-5 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-md shadow-amber-500/20 flex items-center gap-2 shrink-0">
                          {isSavingReminder ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />} Schedule
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 p-6">
                    {reminders.filter(r => r.status === 'Pending').length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center py-12 text-slate-400">
                        <CheckSquare className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm font-bold">You're all caught up!</p>
                        <p className="text-xs mt-1">No pending tasks for this lead.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reminders.filter(r => r.status === 'Pending').map(reminder => (
                          <div key={reminder.id} className="flex items-start justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition-colors">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded border border-slate-200">
                                  {reminder.type}
                                </span>
                                <span className={`text-xs font-bold flex items-center gap-1 ${new Date(reminder.dueDate) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                                  <Clock className="w-3 h-3" />
                                  {new Date(reminder.dueDate) < new Date() ? 'Overdue: ' : ''}{new Date(reminder.dueDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              {reminder.note && <p className="text-sm font-medium text-slate-700">{reminder.note}</p>}
                            </div>
                            <button 
                              onClick={() => markReminderComplete(reminder.id)}
                              className="p-2 bg-slate-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl border border-slate-200 hover:border-emerald-500 transition-all shadow-sm shrink-0 flex flex-col items-center gap-1"
                            >
                              <CheckSquare className="w-4 h-4" />
                              <span className="text-[9px] font-bold">Done</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}