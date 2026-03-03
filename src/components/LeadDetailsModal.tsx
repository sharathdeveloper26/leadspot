import React, { useState, useEffect } from 'react';
import { X, Phone, Mail, Home, Calendar, Globe, Facebook, Search, Zap, CheckCircle2, AlertCircle, Clock, Send, Tag, Plus, UserCircle2 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
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
  [key: string]: any; // For advanced tracking parameters
}

interface LeadDetailsModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: (updatedLead: Lead) => void;
  teamMembers: {id: string, name: string}[];
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

export default function LeadDetailsModal({ lead, isOpen, onClose, onLeadUpdated, teamMembers }: LeadDetailsModalProps) {
  const { user, role } = useAuth();
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [leadSources, setLeadSources] = useState<{id: string, name: string}[]>([]);
  const [leadSubSources, setLeadSubSources] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
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
    if (isOpen) {
      fetchLeadSources();
    }
  }, [user?.clientId, isOpen]);

  if (!isOpen || !lead) return null;

  const handleAddTag = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tagInput.trim() || !user) return;

    const newTag = tagInput.trim();
    if (lead.tags?.includes(newTag)) {
      setTagInput('');
      return;
    }

    setIsAddingTag(true);
    try {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        tags: arrayUnion(newTag)
      });

      onLeadUpdated({
        ...lead,
        tags: [...(lead.tags || []), newTag]
      });
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
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        tags: arrayRemove(tag)
      });

      onLeadUpdated({
        ...lead,
        tags: (lead.tags || []).filter(t => t !== tag)
      });
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

      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, {
        notes: arrayUnion(newNote)
      });

      // Update local state
      const updatedLead = {
        ...lead,
        notes: [...(lead.notes || []), newNote]
      };
      
      onLeadUpdated(updatedLead);
      setNoteText('');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const leadRef = doc(db, 'leads', lead.id);
      await updateDoc(leadRef, { status: newStatus });
      onLeadUpdated({ ...lead, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAssignmentChange = async (newAssignedToId: string) => {
    try {
      const leadRef = doc(db, 'leads', lead.id);
      const assignedUser = (teamMembers || []).find(m => m.id === newAssignedToId);
      const assignedToName = assignedUser ? assignedUser.name : '';
      
      await updateDoc(leadRef, { 
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
    let colorClass = "bg-stone-100 text-stone-600";
    let label = source || 'Manual';

    if (s.includes('facebook')) {
      icon = <Facebook className="w-3.5 h-3.5" />;
      colorClass = "bg-blue-100 text-blue-700";
    } else if (s.includes('google')) {
      icon = <Search className="w-3.5 h-3.5" />;
      colorClass = "bg-amber-100 text-amber-700";
    } else if (s.includes('website')) {
      icon = <Globe className="w-3.5 h-3.5" />;
      colorClass = "bg-emerald-100 text-emerald-700";
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
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
      case 'Closed Won': return 'bg-stone-800 text-white';
      case 'Closed Lost': return 'bg-red-100 text-red-700';
      case 'Junk / Invalid': return 'bg-stone-200 text-stone-600';
      default: return 'bg-stone-100 text-stone-700';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Unknown';
    if (date.toDate) {
      return new Date(date.toDate()).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    }
    return new Date(date).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${datePart} at ${timePart}`;
  };

  // Extract advanced tracking params (any keys starting with utm_ or other non-standard fields)
  const standardFields = ['id', 'firstName', 'lastName', 'email', 'phone', 'projectProperty', 'status', 'source', 'subSource', 'assignedTo', 'assignedToId', 'assignedToName', 'isDuplicate', 'createdAt', 'notes', 'clientId', 'tags'];
  const advancedParams = Object.keys(lead).filter(key => !standardFields.includes(key));

  // Sort notes chronologically (oldest first, or newest first depending on preference. Let's do newest first for timeline)
  const sortedNotes = [...(lead.notes || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/50 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-stone-900">Lead Details</h2>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border-none focus:ring-2 focus:ring-emerald-600/20 outline-none cursor-pointer appearance-none pr-8 bg-no-repeat bg-[right_0.5rem_center] bg-[length:1em_1em] ${getStatusBadgeClass(lead.status)}`}
              style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")` }}
            >
              {PIPELINE_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {lead.isDuplicate && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 uppercase tracking-wider">
                Duplicate
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Profile Section */}
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-stone-900 tracking-tight">
                    {lead.firstName} {lead.lastName}
                  </h1>
                  <div className="mt-2 flex items-center gap-4 text-sm text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Created {formatDate(lead.createdAt)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm font-medium text-stone-500">
                        {lead.source || 'Manual'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-stone-300">/</span>
                      <span className="text-sm font-medium text-stone-500">
                        {lead.subSource || 'No Sub-Source'}
                      </span>
                    </div>
                  </div>
                </div>
                {getSourceBadge(lead.source, lead.subSource)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-stone-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Phone Number</p>
                    <p className="text-stone-900 font-medium">{lead.phone || 'Not provided'}</p>
                  </div>
                </div>
                
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-stone-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Email Address</p>
                    <p className="text-stone-900 font-medium">{lead.email || 'Not provided'}</p>
                  </div>
                </div>

                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center gap-3 md:col-span-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-stone-400">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Project / Property of Interest</p>
                    <p className="text-stone-900 font-medium">{lead.projectProperty || 'Not specified'}</p>
                  </div>
                </div>

                {user?.role === 'client_admin' && (
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex items-center gap-3 md:col-span-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm text-stone-400">
                      <UserCircle2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Assigned To</p>
                      <select
                        value={lead.assignedToId || lead.assignedTo || ''}
                        onChange={(e) => handleAssignmentChange(e.target.value)}
                        className="w-full text-sm font-medium text-stone-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer appearance-none pr-4 bg-no-repeat bg-[right_0_center] bg-[length:1em_1em]"
                        style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")` }}
                      >
                        <option value="">Unassigned</option>
                        {teamMembers?.map(member => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                        {(lead.assignedToId || lead.assignedTo) && !(teamMembers || []).find(m => m.id === (lead.assignedToId || lead.assignedTo)) && (
                          <option value={lead.assignedToId || lead.assignedTo}>{lead.assignedToName || lead.assignedToId || lead.assignedTo}</option>
                        )}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-stone-400" />
                  <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">Lead Tags</h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {(lead.tags || []).map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="p-0.5 hover:bg-stone-200 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {(!lead.tags || lead.tags.length === 0) && (
                    <span className="text-xs text-stone-400 italic">No tags added yet</span>
                  )}
                </div>

                <form onSubmit={handleAddTag} className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add a tag (e.g. Hot Lead, NRI)..."
                    className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isAddingTag || !tagInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </form>
              </div>

              {/* Advanced Tracking Parameters */}
              {advancedParams.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-stone-900 mb-3">Advanced Tracking</h3>
                  <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-stone-200">
                        {advancedParams.map(key => (
                          <tr key={key}>
                            <td className="px-4 py-2 font-medium text-stone-600 bg-stone-100/50 w-1/3">{key}</td>
                            <td className="px-4 py-2 text-stone-900 break-all">{String(lead[key])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <hr className="border-stone-200" />

            {/* Notes & Activity Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-stone-900 mb-4">Activity & Feedback History</h3>
              
              {/* Note Input */}
              <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden mb-8 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Log a call, add a note, or provide feedback..."
                  className="w-full p-4 text-sm text-stone-900 placeholder-stone-400 border-none focus:ring-0 resize-none min-h-[100px]"
                />
                <div className="bg-stone-50 px-4 py-3 border-t border-stone-200 flex justify-between items-center">
                  <span className="text-xs text-stone-500">
                    Posting as <span className="font-medium text-stone-700">{user?.email}</span>
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={isSaving || !noteText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Save Note
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative space-y-8 pl-2 sm:pl-0">
                {/* Continuous Vertical Line */}
                <div className="absolute top-4 bottom-0 left-[1.75rem] sm:left-[2.25rem] w-0.5 bg-stone-200" />
                
                {sortedNotes.length === 0 ? (
                  <div className="text-center py-8 text-stone-500 text-sm relative z-10 bg-white">
                    No activity notes yet. Be the first to add one!
                  </div>
                ) : (
                  sortedNotes.map((note, idx) => {
                    const isClientAdmin = note.authorRole === 'client_admin' || note.authorRole === 'CLIENT_ADMIN';
                    const initial = note.authorEmail ? note.authorEmail.charAt(0).toUpperCase() : '?';
                    
                    return (
                      <div key={idx} className="relative flex items-start gap-4 sm:gap-6">
                        {/* Avatar on the line */}
                        <div className={`relative z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white shrink-0 shadow-sm text-sm sm:text-base font-bold ${
                          isClientAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-700'
                        }`}>
                          {initial}
                        </div>
                        
                        {/* Note Card */}
                        <div className={`flex-1 p-5 rounded-2xl shadow-sm border ${
                          isClientAdmin 
                            ? 'bg-indigo-50/50 border-indigo-100' 
                            : 'bg-white border-stone-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-stone-900">{note.authorEmail}</span>
                              {isClientAdmin && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                                  Manager Note
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimestamp(note.timestamp)}
                            </div>
                          </div>
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                            isClientAdmin ? 'text-indigo-900/80' : 'text-stone-600'
                          }`}>
                            {note.text}
                          </p>
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
