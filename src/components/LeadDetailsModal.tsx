import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Home, Calendar, Globe, Facebook, Search, Clock, Send, Tag, Plus, UserCircle2, HelpCircle, BellRing, CheckSquare } from 'lucide-react';
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
  isDuplicate?: boolean;
  createdAt: any;
  notes?: LeadNote[];
  tags?: string[];
  [key: string]: any; 
  designation?: string;
  location?: string;
  linkedin?: string;
  truecallerName?: string;
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
}

const PIPELINE_STATUSES = [
  'New', 'Attempted Contact', 'Connected / Warm', 'Site Visit Scheduled', 
  'Site Visit Completed', 'Negotiation', 'Closed Won', 'Closed Lost', 'Junk / Invalid'
];

const REMINDER_TYPES = ['Follow-up Call', 'Site Visit Scheduled', 'Post-Visit Feedback', 'Document/Payment Collection', 'General To-Do'];

export default function LeadDetailsModal({ lead, isOpen, onClose, onLeadUpdated, teamMembers }: LeadDetailsModalProps) {
  const { user, role } = useAuth();
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

  // 👇 BUG FIX: FETCH REMINDERS (Memory cleared, Index requirement removed) 👇
  useEffect(() => {
    if (!isOpen || !lead || !user?.clientId) {
      setReminders([]); // CLEAR MEMORY SO IT DOES NOT BLEED TO OTHER LEADS
      return;
    }

    // Removed orderBy() to bypass Firebase Index Crash. We sort manually in JS below.
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
      // Sort chronologically here!
      fetchedReminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setReminders(fetchedReminders);
    }, (error) => {
      console.error("Reminders listener failed:", error);
    });

    return () => unsubscribe();
  }, [isOpen, lead?.id, user?.clientId]);
  // 👆 END BUG FIX 👆

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

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leads', lead.id), { status: newStatus });
      onLeadUpdated({ ...lead, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAssignmentChange = async (newAssignedToId: string) => {
    try {
      const assignedUser = (teamMembers || []).find(m => m.id === newAssignedToId);
      const assignedToName = assignedUser ? assignedUser.name : '';
      await updateDoc(doc(db, 'leads', lead.id), { 
        assignedTo: newAssignedToId || null,
        assignedToId: newAssignedToId || null,
        assignedToName: assignedToName || null
      });
      onLeadUpdated({ 
        ...lead, 
        assignedTo: newAssignedToId || undefined,
        assignedToId: newAssignedToId || undefined,
        assignedToName: assignedToName || undefined
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const getSourceBadge = (source?: string, subSource?: string) => {
    const s = source?.toLowerCase() || 'manual';
    let icon = <Globe className="w-3.5 h-3.5" />;
    let colorClass = "bg-slate-100 text-slate-600";
    let label = source || 'Manual';

    if (s.includes('facebook')) {
      icon = <Facebook className="w-3.5 h-3.5" />;
      colorClass = "bg-[#74ebd5]/20 text-[#4cb8a5]";
    } else if (s.includes('google')) {
      icon = <Search className="w-3.5 h-3.5" />;
      colorClass = "bg-amber-100 text-amber-700";
    } else if (s.includes('website')) {
      icon = <Globe className="w-3.5 h-3.5" />;
      colorClass = "bg-[#9face6]/20 text-[#7a8ece]";
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm ${colorClass}`}>
        {icon} {label} {subSource ? `/ ${subSource}` : ''}
      </span>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'New': return 'bg-[#74ebd5]/20 text-[#4cb8a5]';
      case 'Attempted Contact': return 'bg-blue-50 text-blue-700';
      case 'Connected / Warm': return 'bg-[#9face6]/20 text-[#7a8ece]';
      case 'Site Visit Scheduled': return 'bg-purple-50 text-purple-700';
      case 'Site Visit Completed': return 'bg-purple-100 text-purple-800';
      case 'Negotiation': return 'bg-amber-100 text-amber-800';
      case 'Closed Won': return 'bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white shadow-md';
      case 'Closed Lost': return 'bg-red-50 text-red-700';
      case 'Junk / Invalid': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-50 text-slate-700';
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

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/30 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-white/90 backdrop-blur-2xl h-full shadow-[-8px_0_30px_rgba(0,0,0,0.05)] border-l border-white flex flex-col animate-slide-in-right">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/50 bg-white/50 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Lead Details</h2>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border-none focus:ring-2 focus:ring-[#74ebd5]/30 outline-none cursor-pointer appearance-none pr-8 bg-no-repeat bg-[right_0.5rem_center] bg-[length:1em_1em] ${getStatusBadgeClass(lead.status)}`}
              style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")` }}
            >
              {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {lead.isDuplicate && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-widest">
                Duplicate
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all shadow-sm border border-transparent hover:border-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-8">
            
            {/* Profile Section */}
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">
                    {lead.firstName} {lead.lastName === 'Lead' ? '' : lead.lastName}
                  </h1>
                  
                  {((lead.designation && lead.designation !== "Unknown") || (lead.location && lead.location !== "Unknown") || lead.linkedin || (lead.truecallerName && lead.truecallerName !== "Unknown")) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700 font-medium bg-white/60 p-2 rounded-xl border border-white shadow-sm">
                      {lead.designation && lead.designation !== "Unknown" && <div className="px-2">💼 {lead.designation}</div>}
                      {lead.location && lead.location !== "Unknown" && <div className="px-2">📍 {lead.location}</div>}
                      
                      {lead.truecallerName && lead.truecallerName !== "Unknown" && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#9face6]/10 text-[#7a8ece] rounded-lg text-xs font-bold border border-[#9face6]/30 shadow-sm">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" opacity="0.3"/><path d="M10 16l-4-4 1.41-1.41L10 13.17l6.59-6.59L18 8l-8 8z"/>
                          </svg>
                          {lead.truecallerName}
                        </div>
                      )}

                      {lead.linkedin && (
                        <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded-lg text-xs font-bold border border-blue-100 shadow-sm">🔗 LinkedIn</a>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{formatDate(lead.createdAt)}</div>
                  </div>
                </div>
                {getSourceBadge(lead.source, lead.subSource)}
              </div>

              {/* Contact Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/60 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#74ebd5]/20 to-[#9face6]/10 rounded-xl text-[#4cb8a5] shadow-inner"><Phone className="w-5 h-5" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                    <p className="text-slate-800 font-bold">{lead.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-[#9face6]/20 to-indigo-50 rounded-xl text-[#7a8ece] shadow-inner"><Mail className="w-5 h-5" /></div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                    <p className="text-slate-800 font-bold truncate" title={lead.email}>{lead.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 md:col-span-2">
                  <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-50 rounded-xl text-amber-600 shadow-inner"><Home className="w-5 h-5" /></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Project / Property</p>
                    <p className="text-slate-800 font-bold">{lead.projectProperty || 'Not specified'}</p>
                  </div>
                </div>

                {user?.role === 'client_admin' && (
                  <div className="bg-white/60 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center gap-4 md:col-span-2">
                    <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-50 rounded-xl text-purple-600 shadow-inner">
                      <UserCircle2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned To</p>
                      <select
                        value={lead.assignedToId || lead.assignedTo || ''}
                        onChange={(e) => handleAssignmentChange(e.target.value)}
                        className="w-full text-sm font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer appearance-none outline-none"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers?.map(member => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-slate-200/50 rounded-lg"><Tag className="w-4 h-4 text-slate-600" /></div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Lead Tags</h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {(lead.tags || []).map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-sm"
                    >
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="p-0.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {(!lead.tags || lead.tags.length === 0) && (
                    <span className="text-xs font-medium text-slate-400 italic">No tags added yet</span>
                  )}
                </div>

                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag (e.g. Hot Lead, NRI)..."
                    className="flex-1 text-sm font-medium bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#74ebd5]/30 outline-none shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={isAddingTag || !tagInput.trim()}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md hover:-translate-y-0.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </form>
              </div>

              {/* TASKS & REMINDERS ENGINE */}
              <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 bg-amber-100/50 rounded-xl text-amber-600"><BellRing className="w-5 h-5"/></div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Tasks & Reminders</h3>
                </div>

                <form onSubmit={handleAddReminder} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Task Type</label>
                      <select 
                        value={reminderType}
                        onChange={(e) => setReminderType(e.target.value)}
                        className="w-full text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer"
                      >
                        {REMINDER_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Due Date & Time</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Add a brief note about this task..."
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                      className="flex-1 text-sm font-medium border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-amber-500/20 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSavingReminder || !reminderDate}
                      className="px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                    >
                      {isSavingReminder ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                      Schedule
                    </button>
                  </div>
                </form>

                <div className="space-y-3">
                  {reminders.filter(r => r.status === 'Pending').length === 0 ? (
                    <div className="text-center py-4 text-xs font-medium text-slate-400 italic">No pending tasks for this lead.</div>
                  ) : (
                    reminders.filter(r => r.status === 'Pending').map(reminder => (
                      <div key={reminder.id} className="flex items-start justify-between gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-white text-amber-700 text-[10px] font-black uppercase tracking-widest rounded shadow-sm border border-amber-200">
                              {reminder.type}
                            </span>
                            <span className={`text-xs font-bold flex items-center gap-1 ${new Date(reminder.dueDate) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(reminder.dueDate) < new Date() ? 'Overdue: ' : ''}{new Date(reminder.dueDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          {reminder.note && <p className="text-sm font-medium text-slate-700 mt-1.5">{reminder.note}</p>}
                        </div>
                        <button 
                          onClick={() => markReminderComplete(reminder.id)}
                          className="p-2 bg-white text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-200 hover:border-emerald-200 transition-all shadow-sm shrink-0 flex flex-col items-center gap-1"
                          title="Mark as Completed"
                        >
                          <CheckSquare className="w-4 h-4" />
                          <span className="text-[9px] font-bold">Done</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FB Custom Questions */}
              {lead.customAnswers && Object.keys(lead.customAnswers).length > 0 && (
                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-[#9face6]/20 rounded-xl text-[#7a8ece]"><HelpCircle className="w-5 h-5"/></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Form Questions</h3>
                  </div>
                  <div className="space-y-3 bg-white/80 p-5 rounded-xl border border-slate-100">
                    {Object.entries(lead.customAnswers).map(([question, answer]) => (
                      <div key={question} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {question.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{String(answer)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Marketing Attribution */}
              {(lead.adName || lead.campaignName || lead.formId || lead.adId || lead.campaignId || lead.utm_source) && (
                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-[#74ebd5]/20 rounded-xl text-[#4cb8a5]"><Facebook className="w-5 h-5"/></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Marketing Attribution</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/80 p-5 rounded-xl border border-slate-100">
                    {lead.campaignName && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Campaign Name</span>
                        <span className="text-sm text-slate-800 font-bold">{lead.campaignName}</span>
                      </div>
                    )}
                    {lead.adName && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Ad Name</span>
                        <span className="text-sm text-slate-800 font-bold">{lead.adName}</span>
                      </div>
                    )}
                    {lead.formId && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Form ID</span>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60 shadow-sm">{lead.formId}</span>
                      </div>
                    )}
                    {lead.adId && (
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Ad ID</span>
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60 shadow-sm">{lead.adId}</span>
                      </div>
                    )}

                    {lead.utm_source && (
                      <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/60">
                        <div>
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">UTM Source</span>
                          <span className="text-xs font-mono font-bold text-slate-700">{lead.utm_source}</span>
                        </div>
                        {lead.utm_medium && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">UTM Medium</span>
                            <span className="text-xs font-mono font-bold text-slate-700">{lead.utm_medium}</span>
                          </div>
                        )}
                        {lead.utm_campaign && (
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">UTM Campaign</span>
                            <span className="text-xs font-mono font-bold text-slate-700">{lead.utm_campaign}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes & Activity Timeline */}
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] mt-8">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-5">Activity & Notes</h3>
              
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8 focus-within:border-[#74ebd5] focus-within:ring-2 focus-within:ring-[#74ebd5]/30 transition-all">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Log a call, add a note, or provide feedback..."
                  className="w-full p-5 text-sm font-medium text-slate-800 placeholder-slate-400 border-none focus:ring-0 resize-none min-h-[120px] outline-none"
                />
                <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">
                    Posting as <span className="font-bold text-slate-700">{user?.email}</span>
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={isSaving || !noteText.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#74ebd5] to-[#9face6] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[#74ebd5]/30"
                  >
                    {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    Save Note
                  </button>
                </div>
              </div>

              <div className="relative space-y-8 pl-2 sm:pl-0 mt-4">
                <div className="absolute top-4 bottom-0 left-[1.75rem] sm:left-[2.25rem] w-0.5 bg-slate-200" />
                {sortedNotes.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-medium text-sm relative z-10 bg-transparent">No activity notes yet. Be the first to add one!</div>
                ) : (
                  sortedNotes.map((note, idx) => {
                    const isClientAdmin = note.authorRole === 'client_admin' || note.authorRole === 'CLIENT_ADMIN';
                    const initial = note.authorEmail ? note.authorEmail.charAt(0).toUpperCase() : '?';
                    return (
                      <div key={idx} className="relative flex items-start gap-4 sm:gap-6">
                        <div className={`relative z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white shrink-0 shadow-sm text-sm sm:text-base font-black ${isClientAdmin ? 'bg-gradient-to-br from-[#74ebd5]/30 to-[#9face6]/30 text-[#50bdaf]' : 'bg-slate-100 text-slate-700'}`}>{initial}</div>
                        <div className={`flex-1 p-5 rounded-2xl shadow-sm border ${isClientAdmin ? 'bg-[#74ebd5]/5 border-[#74ebd5]/20' : 'bg-white border-slate-100'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800">{note.authorEmail}</span>
                              {isClientAdmin && <span className="px-2.5 py-1 rounded-md text-[9px] font-black bg-[#9face6]/20 text-[#7a8ece] uppercase tracking-widest shadow-sm">Manager</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><Clock className="w-3.5 h-3.5" />{formatTimestamp(note.timestamp)}</div>
                          </div>
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap text-slate-700">{note.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}