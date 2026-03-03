import React, { useState } from 'react';
import { X } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LeadSource {
  id: string;
  name: string;
}

interface LeadSubSource {
  id: string;
  name: string;
}

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: () => void;
  teamMembers: User[];
  leadSources: LeadSource[];
  leadSubSources: LeadSubSource[];
}

const PIPELINE_STATUSES = [
  'New',
  'Contacted',
  'Site Visit',
  'Negotiation',
  'Closed Won',
  'Closed Lost'
];

export default function AddLeadModal({ 
  isOpen, 
  onClose, 
  onLeadAdded, 
  teamMembers, 
  leadSources, 
  leadSubSources 
}: AddLeadModalProps) {
  const { user } = useAuth();
  
  const [addingLead, setAddingLead] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [projectProperty, setProjectProperty] = useState('');
  const [status, setStatus] = useState('New');
  const [source, setSource] = useState('');
  const [subSource, setSubSource] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  if (!isOpen) return null;

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.clientId) return;
    setAddingLead(true);
    try {
      const currentSource = source || 'Manual';
      
      let initialAssignedId = assignedTo;
      let initialAssignedName = '';
      
      if (user?.role === 'client_admin') {
        const assignedUser = teamMembers.find(m => m.id === assignedTo);
        initialAssignedName = assignedUser ? assignedUser.name : '';
      } else {
        initialAssignedId = user?.uid || '';
        const currentUser = teamMembers.find(m => m.id === user?.uid);
        initialAssignedName = currentUser ? currentUser.name : (user?.email || '');
      }

      const formData: any = {
        assignedToId: initialAssignedId,
        assignedToName: initialAssignedName,
        source: currentSource
      };
      const leadData: any = null;

      // --- AUTO-ASSIGNMENT ENGINE ---
      let finalAssignedId = formData.assignedToId || leadData?.assignedToId || null;
      let finalAssignedName = formData.assignedToName || leadData?.assignedToName || null;
      const selectedSource = formData.source || leadData?.source;

      if (!finalAssignedId && selectedSource && user?.clientId) {
        console.log("ENGINE: Checking rules for source ->", selectedSource);
        try {
          const rulesRef = collection(db, 'lead_assignment_rules');
          const q = query(rulesRef, where('clientId', '==', user.clientId), where('sourceName', '==', selectedSource));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const rule = snapshot.docs[0].data();
            console.log("ENGINE: Rule found! Assigning to ->", rule.agentName);
            finalAssignedId = rule.agentId;
            finalAssignedName = rule.agentName;
          } else {
            console.log("ENGINE: No rule found for this source.");
          }

        } catch (error) {
          console.error("ENGINE ERROR:", error);
        }
      }
      // ------------------------------

      await addDoc(collection(db, 'leads'), {
        clientId: user.clientId,
        firstName,
        lastName,
        email,
        phone,
        projectProperty,
        status,
        source: currentSource,
        subSource: subSource || '',
        assignedTo: finalAssignedId,
        assignedToId: finalAssignedId,
        assignedToName: finalAssignedName,
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
      
      onLeadAdded();
      onClose();
    } catch (error) {
      console.error("Error adding lead:", error);
      alert("Failed to add lead. Check console for details.");
    } finally {
      setAddingLead(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <h3 className="text-lg font-semibold text-stone-900">Add New Lead</h3>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleAddLead} className="flex flex-col overflow-hidden flex-1">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Project / Property</label>
              <input
                type="text"
                value={projectProperty}
                onChange={(e) => setProjectProperty(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm"
                placeholder="e.g. Sunset Villas"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
              >
                {PIPELINE_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
              >
                {leadSources.length === 0 && <option value="Manual">Manual</option>}
                {leadSources.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Sub-Source</label>
              <select
                value={subSource}
                onChange={(e) => setSubSource(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
              >
                <option value="">None</option>
                {leadSubSources.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {user?.role === 'client_admin' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors sm:text-sm bg-white"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-stone-200 p-4 sm:p-6 bg-stone-50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingLead}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 flex justify-center items-center"
            >
              {addingLead ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Save Lead'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
