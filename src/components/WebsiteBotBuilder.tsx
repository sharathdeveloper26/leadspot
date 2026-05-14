import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Bot, Settings2, Play, MousePointerClick, 
  MessageSquare, User, FileText, X, CheckCircle2, 
  Copy, Save, BrainCircuit, Globe, Palette, 
  HeadphonesIcon, Phone, Mail, Check, 
  ChevronRight, Sparkles, Code, MoreVertical, Mic, Send, Image as ImageIcon,Zap,Plus, Trash2,
  Network, LayoutTemplate, Minimize2, Type, RefreshCw
} from 'lucide-react';
import ReactFlow, { 
  ReactFlowProvider, Background, Controls, applyNodeChanges, 
  applyEdgeChanges, addEdge, Connection, Edge, NodeChange, 
  EdgeChange, useReactFlow, Node, Handle, Position
} from 'reactflow';
import 'reactflow/dist/style.css';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ==========================================
// 1. ENTERPRISE DYNAMIC BRANCHING NODES
// ==========================================
// ... (Keep existing WebTriggerNode, WebMessageNode, WebAskNode, WebButtonNode, AIBrainNode definitions here. They are unchanged from the previous version) ...
const WebTriggerNode = ({ data }: any) => (
  <div className="w-56 bg-white rounded-2xl shadow-sm border-2 border-emerald-500 overflow-hidden">
    <div className="bg-emerald-50 px-4 py-2.5 flex items-center gap-2 border-b border-emerald-100">
      <Globe className="w-4 h-4 text-emerald-600" />
      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Web Trigger</span>
    </div>
    <div className="p-4 text-center"><p className="text-sm font-bold text-slate-700">{data.label || 'On Widget Open'}</p></div>
    <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white shadow-sm" />
  </div>
);

const WebMessageNode = ({ data }: any) => (
  <div className="w-64 bg-white rounded-2xl shadow-sm border-2 border-indigo-200 hover:border-indigo-400 transition-colors overflow-hidden">
    <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-white shadow-sm" />
    <div className="bg-indigo-50 px-4 py-2.5 flex items-center gap-2 border-b border-indigo-100">
      <MessageSquare className="w-4 h-4 text-indigo-500" />
      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Message</span>
    </div>
    <div className="p-4"><p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{data.message || 'Type message...'}</p></div>
    <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-white shadow-sm" />
  </div>
);

const WebAskNode = ({ data }: any) => {
  const isPhone = data.field === 'phone';
  const isEmail = data.field === 'email';
  const Icon = isPhone ? Phone : isEmail ? Mail : User;
  const color = isPhone ? 'amber' : isEmail ? 'rose' : 'sky';

  return (
    <div className={`w-64 bg-white rounded-2xl shadow-sm border-2 border-${color}-300 hover:border-${color}-500 transition-colors overflow-hidden`}>
      <Handle type="target" position={Position.Top} className={`!w-3 !h-3 !bg-${color}-400 !border-2 !border-white shadow-sm`} />
      <div className={`bg-${color}-50 px-4 py-2.5 flex items-center gap-2 border-b border-${color}-100`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
        <span className={`text-[10px] font-black text-${color}-800 uppercase tracking-widest`}>Ask {data.field}</span>
      </div>
      <div className="p-4"><p className="text-sm font-medium text-slate-600">{data.message || `Please provide your ${data.field}`}</p></div>
      <Handle type="source" position={Position.Bottom} className={`!w-3 !h-3 !bg-${color}-400 !border-2 !border-white shadow-sm`} />
    </div>
  );
};

const WebButtonNode = ({ data }: any) => (
  <div className="w-72 bg-white rounded-2xl shadow-lg border-2 border-blue-400 transition-colors relative">
    <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white shadow-sm" />
    <div className="bg-blue-50 px-4 py-3 flex items-center gap-2 rounded-t-xl border-b border-blue-100">
      <Network className="w-4 h-4 text-blue-600" />
      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Interactive Menu</span>
    </div>
    <div className="p-5">
      <p className="text-sm font-bold text-slate-700 mb-4 text-center">{data.message || 'How may I assist you?'}</p>
      <div className="flex flex-col gap-3">
        {(data.buttons || ['Option 1']).map((b: string, i: number) => (
          <div key={i} className="relative w-full group">
            <div className="px-4 py-2.5 bg-white border-2 border-blue-100 text-blue-700 text-xs font-bold rounded-xl shadow-sm text-center group-hover:border-blue-400 transition-colors">
              {b}
            </div>
            <Handle type="source" position={Position.Right} id={`btn-${i}`} style={{ right: '-12px', top: '50%' }} className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white shadow-md cursor-crosshair hover:scale-150 transition-transform !z-50" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AIBrainNode = ({ data }: any) => (
  <div className="w-64 bg-slate-900 rounded-2xl shadow-xl border-2 border-purple-500 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-50"></div>
    <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white shadow-sm" />
    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 relative z-10">
      <BrainCircuit className="w-5 h-5 text-purple-400" />
      <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">AI RAG Handoff</span>
    </div>
    <div className="p-5 relative z-10">
      <p className="text-xs font-medium text-slate-300 leading-relaxed">Free-text chat activated. Gemini AI will now answer user queries based on your uploaded Knowledge Base.</p>
    </div>
  </div>
);

const nodeTypes = { webTrigger: WebTriggerNode, webMessage: WebMessageNode, webAsk: WebAskNode, webButton: WebButtonNode, aiBrain: AIBrainNode };

const INITIAL_NODES: Node[] = [
  { id: '1', type: 'webTrigger', position: { x: 300, y: 50 }, data: { label: 'When user opens chat' } },
  { id: '2', type: 'webMessage', position: { x: 300, y: 200 }, data: { message: "Hello, I'm Kenyt Sales AI Agent. Welcome! How can I assist you today?" } },
  { id: '3', type: 'webButton', position: { x: 280, y: 350 }, data: { message: 'How may I assist you?', buttons: ['AI Agents', 'Pricing'] } },
  { id: '4', type: 'aiBrain', position: { x: 550, y: 500 }, data: {} },
];
const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'e3-4', source: '3', target: '4', sourceHandle: 'btn-0', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }
];

let idCounter = 10;
const getId = () => `web_node_${Date.now()}_${idCounter++}`;

export type SimMessage = { id: string; role: 'bot' | 'user' | 'system'; text: string; buttons?: string[]; sourceNodeId?: string; };

function WebsiteBotBuilderFlow() {
  const { user } = useAuth();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { project, fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'builder' | 'knowledge' | 'design'>('overview');
  const [setupProgress, setSetupProgress] = useState({ flow: true, design: false, install: false, ai: false });

  // Widget Customization State
  const [widgetColor, setWidgetColor] = useState('#2563eb');
  const [botName, setBotName] = useState('Sales AI Agent');
  const [botSubtitle, setBotSubtitle] = useState('We are online to assist you');
  const [botAvatar, setBotAvatar] = useState('');
  const [widgetPosition, setWidgetPosition] = useState<'right' | 'left'>('right'); 
  const [widgetFont, setWidgetFont] = useState('Inter'); // ✨ NEW: Font Setting
  
  const [isWidgetOpen, setIsWidgetOpen] = useState(true); 
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'success' | 'error'} | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // ✨ REAL-TIME SIMULATOR STATE ✨
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simInputMode, setSimInputMode] = useState<'none' | 'text' | 'rag'>('none');
  const [simChatInput, setSimChatInput] = useState('');
  const [simActiveNodeId, setSimActiveNodeId] = useState<string | null>(null);

  // Load from Firebase
  useEffect(() => {
    const fetchFlow = async () => {
      if (!user?.clientId) return;
      try {
        const docSnap = await getDoc(doc(db, 'website_bot_flows', user.clientId));
        if (docSnap.exists() && docSnap.data().nodes) {
          setNodes(docSnap.data().nodes);
          setEdges(docSnap.data().edges || []);
          if (docSnap.data().design) {
            setBotName(docSnap.data().design.botName || 'Sales AI Agent');
            setBotSubtitle(docSnap.data().design.botSubtitle || 'We are online to assist you');
            setWidgetColor(docSnap.data().design.widgetColor || '#2563eb');
            setBotAvatar(docSnap.data().design.botAvatar || '');
            setWidgetPosition(docSnap.data().design.widgetPosition || 'right');
            setWidgetFont(docSnap.data().design.widgetFont || 'Inter');
            setSetupProgress(prev => ({ ...prev, design: true }));
          }
        }
      } catch (error) { console.error("Failed to load flow", error); } 
      finally { setIsLoaded(true); setTimeout(() => { fitView({ padding: 0.2 }); startSimulation(); }, 200); }
    };
    fetchFlow();
  }, [user?.clientId, fitView]);

  // Clean Save to Firebase
  const handleSaveFlow = async () => {
    if (!user?.clientId) return;
    setIsSaving(true);
    try {
      const cleanNodes = nodes.map(node => {
        const cleanData: any = {};
        if (node.data?.label) cleanData.label = node.data.label;
        if (node.data?.message) cleanData.message = node.data.message;
        if (node.data?.field) cleanData.field = node.data.field;
        if (Array.isArray(node.data?.buttons)) cleanData.buttons = [...node.data.buttons];
        return { id: String(node.id), type: String(node.type), position: { x: Number(node.position?.x) || 0, y: Number(node.position?.y) || 0 }, data: cleanData };
      });

      const cleanEdges = edges.map(edge => ({
        id: String(edge.id), source: String(edge.source), target: String(edge.target), sourceHandle: edge.sourceHandle ? String(edge.sourceHandle) : null, targetHandle: edge.targetHandle ? String(edge.targetHandle) : null,
      }));

      await setDoc(doc(db, 'website_bot_flows', user.clientId), {
        nodes: cleanNodes, edges: cleanEdges, design: { botName, botSubtitle, widgetColor, botAvatar, widgetPosition, widgetFont }, updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setToast({ show: true, msg: 'Chatbot Engine & Flow Saved Successfully!', type: 'success' });
    } catch (error: any) {
      console.error("Firebase Save Error:", error);
      setToast({ show: true, msg: `Save failed: ${error.message || 'Check connection.'}`, type: 'error' });
    } finally {
      setIsSaving(false); setTimeout(() => setToast(null), 3000);
    }
  };

  // ==========================================
  // ✨ THE SIMULATOR TRAVERSAL ENGINE ✨
  // ==========================================
  const executeNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setSimActiveNodeId(node.id);

    setTimeout(() => {
      if (node.type === 'webMessage') {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: node.data.message, sourceNodeId: node.id }]);
        autoAdvance(node.id);
      } 
      else if (node.type === 'webButton') {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: node.data.message, buttons: node.data.buttons, sourceNodeId: node.id }]);
        setSimInputMode('none'); // Wait for button click
      } 
      else if (node.type === 'webAsk') {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: node.data.message, sourceNodeId: node.id }]);
        setSimInputMode('text'); // Wait for text input
      }
      else if (node.type === 'aiBrain') {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: '⚡ AI Engine Activated. RAG Knowledge Base online.' }]);
        setSimInputMode('rag'); // Free text chat enabled
      }
    }, 600); // 600ms simulated typing delay
  };

  const autoAdvance = (currentNodeId: string) => {
    const nextEdge = edges.find(e => e.source === currentNodeId);
    if (nextEdge) executeNode(nextEdge.target);
  };

  const startSimulation = () => {
    setSimMessages([]); setSimInputMode('none');
    const triggerNode = nodes.find(n => n.type === 'webTrigger');
    if (triggerNode) autoAdvance(triggerNode.id);
  };

  const handleSimButtonClick = (btnText: string, sourceNodeId: string, buttonIndex: number) => {
    setSimMessages(prev => [...prev.map(m => m.sourceNodeId === sourceNodeId ? { ...m, buttons: [] } : m), { id: Date.now().toString(), role: 'user', text: btnText }]);
    const nextEdge = edges.find(e => e.source === sourceNodeId && e.sourceHandle === `btn-${buttonIndex}`);
    if (nextEdge) executeNode(nextEdge.target);
  };

  const handleSimTextInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simChatInput.trim() || !simActiveNodeId) return;

    const userInput = simChatInput.trim();
    setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userInput }]);
    setSimChatInput('');

    if (simInputMode === 'text') {
      setSimInputMode('none');
      // Mock CRM Sync
      setTimeout(() => {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: '⚡ Lead Data Extracted & Synced to CRM' }]);
        autoAdvance(simActiveNodeId);
      }, 500);
    } else if (simInputMode === 'rag') {
      // Mock Gemini Response
      setTimeout(() => {
        setSimMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', text: "Based on the knowledge base, I can confirm that information. Is there anything else you need?" }]);
      }, 1000);
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [simMessages]);

  // React Flow Handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 } }, eds)), []);
  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => setSelectedNode(nodes[0] || null), []);
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    const fieldType = event.dataTransfer.getData('field_type'); 
    if (!type || !reactFlowWrapper.current) return;
    const position = project({ x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left, y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top });
    let data: any = {};
    if (type === 'webMessage') data = { message: 'New message' };
    if (type === 'webAsk') data = { field: fieldType, message: `Please provide your ${fieldType}` };
    if (type === 'webButton') data = { message: 'How may I assist you?', buttons: ['Option 1', 'Option 2'] };
    const newNode = { id: getId(), type, position, data };
    setNodes((nds) => nds.concat(newNode)); setSelectedNode(newNode); setSetupProgress(prev => ({ ...prev, flow: true }));
  }, [project]);

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(node => {
      if (node.id === selectedNode.id) {
        const updated = { ...node, data: { ...node.data, [field]: value } }; setSelectedNode(updated); return updated;
      }
      return node;
    }));
  };

  const widgetCode = `<script>
  window.LeadspotChatConfig = {
    clientId: "${user?.clientId || 'YOUR_CLIENT_ID'}",
    botName: "${botName}",
    botSubtitle: "${botSubtitle}",
    themeColor: "${widgetColor}",
    position: "${widgetPosition}",
    fontFamily: "${widgetFont}",
    avatarUrl: "${botAvatar}"
  };
</script>
<script src="https://cdn.leadspot.com/enterprise-widget.js" async></script>`;
const handleCopyCode = () => {
    navigator.clipboard.writeText(widgetCode); 
    setIsCopied(true); 
    setSetupProgress(prev => ({ ...prev, install: true }));
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isLoaded) return <div className="flex-1 flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full relative overflow-hidden">
      {toast && toast.show && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 text-white">
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <X className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-bold">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* 🌟 ENTERPRISE TOOLBAR 🌟 */}
      <div className="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm w-full">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('overview')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Overview</button>
          <button onClick={() => setActiveTab('builder')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'builder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Flow Builder</button>
          <button onClick={() => setActiveTab('knowledge')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'knowledge' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>AI Brain</button>
          <button onClick={() => setActiveTab('design')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'design' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Design & Deploy</button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveFlow} disabled={isSaving} className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-slate-800 transition-all hover:-translate-y-0.5 flex items-center gap-2 disabled:opacity-50">
            {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Save Workspace
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* SCENARIO 1: SETUP OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
            <div className="max-w-3xl w-full space-y-8 mt-10">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Your bot space is ready.</h2>
                <p className="text-slate-500 font-medium">You can go live once you configure your bot checklist.</p>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">Required Setup <span className="text-red-500">*</span></h3>
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    {Object.values(setupProgress).filter(Boolean).length} / 4 steps completed
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  <div onClick={() => setActiveTab('builder')} className="p-6 flex items-center gap-6 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.flow ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Edit Your Chat Flow</h4><p className="text-sm font-medium text-slate-500 mt-1">Build engaging conversation branching flows for your users.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('design')} className="p-6 flex items-center gap-6 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.design ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Design Your Chatbot</h4><p className="text-sm font-medium text-slate-500 mt-1">Manage the look, feel, colors, and avatar of your widget.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('knowledge')} className="p-6 flex items-center gap-6 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.ai ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">AI Settings <Sparkles className="w-4 h-4 text-amber-500"/></h4><p className="text-sm font-medium text-slate-500 mt-1">Configure bot's brain. Upload PDFs for RAG training.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('design')} className="p-6 flex items-center gap-6 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.install ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Install Your Chatbot</h4><p className="text-sm font-medium text-slate-500 mt-1">Copy the embed code and install it on your website.</p></div>
                    {setupProgress.install ? <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">Connected</span> : <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 2: THE BUILDER CANVAS */}
        {activeTab === 'builder' && (
          <>
            <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-xl relative">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h3 className="font-bold text-slate-800 text-base">Add Chat Component</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Drag into Canvas</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                <div className="space-y-3">
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'webMessage'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md"><div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><MessageSquare className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">Message</p></div>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'webAsk'); e.dataTransfer.setData('field_type', 'name'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-white border border-slate-200 rounded-xl hover:border-sky-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md"><div className="p-2 bg-sky-50 rounded-lg text-sky-500 group-hover:bg-sky-100 transition-colors"><User className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">Ask Name</p></div>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'webAsk'); e.dataTransfer.setData('field_type', 'phone'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-white border border-slate-200 rounded-xl hover:border-amber-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md"><div className="p-2 bg-amber-50 rounded-lg text-amber-500 group-hover:bg-amber-100 transition-colors"><Phone className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">Ask Phone Number</p></div>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'webAsk'); e.dataTransfer.setData('field_type', 'email'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-white border border-slate-200 rounded-xl hover:border-rose-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md"><div className="p-2 bg-rose-50 rounded-lg text-rose-500 group-hover:bg-rose-100 transition-colors"><Mail className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">Ask Email</p></div>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'webButton'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md"><div className="p-2 bg-blue-50 rounded-lg text-blue-500 group-hover:bg-blue-100 transition-colors"><Network className="w-4 h-4" /></div><p className="text-sm font-bold text-slate-700">Interactive Menu</p></div>
                </div>
                <div className="space-y-3 pt-6 border-t border-slate-200 border-dashed">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2">Advanced Actions</h4>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'aiBrain'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500 cursor-grab flex items-center gap-4 shadow-md group relative overflow-hidden transition-all">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                    <div className="p-2.5 bg-purple-500/20 rounded-lg text-purple-400 relative z-10"><BrainCircuit className="w-5 h-5" /></div>
                    <div className="relative z-10"><p className="text-sm font-bold text-white">AI RAG Engine</p></div>
                  </div>
                </div>
              </div>
            </aside>

            <main className="flex-1 relative h-full bg-slate-50" ref={reactFlowWrapper}>
              <ReactFlow 
                nodes={nodes} edges={edges} nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
                onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver} 
                onSelectionChange={onSelectionChange} 
                fitView fitViewOptions={{ padding: 0.2 }}
                className="bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"
              >
                <Background color="#cbd5e1" gap={24} size={1.5} />
                <Controls className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mb-4 ml-4" showInteractive={false} />
              </ReactFlow>

              {selectedNode && (
                <div className="absolute top-0 right-0 bottom-0 w-[400px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right-8 z-20">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-base">Customize Bot Message</h3>
                    <button onClick={() => setSelectedNode(null)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-colors"><X className="w-5 h-5"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative mb-2">
                      <span className="absolute -top-3 left-5 bg-white px-3 py-0.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest border border-slate-200 rounded-full shadow-sm">Preview</span>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedNode.data.message || '...'}</p>
                    </div>

                    {['webMessage', 'webAsk', 'webButton'].includes(selectedNode.type!) && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Message Text</label>
                        <textarea rows={4} value={selectedNode.data.message || ''} onChange={(e) => updateNodeData('message', e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none resize-y shadow-sm" />
                      </div>
                    )}

                    {selectedNode.type === 'webButton' && (
                      <div className="pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">Branching Options</label>
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Map edges on canvas</span>
                        </div>
                        <div className="space-y-3">
                          {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                            <div key={index} className="flex gap-2 relative">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
                              <input type="text" value={btn} onChange={(e) => { const newBtns = [...selectedNode.data.buttons]; newBtns[index] = e.target.value; updateNodeData('buttons', newBtns); }} className="flex-1 pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm" />
                              <button onClick={() => { const newBtns = selectedNode.data.buttons.filter((_:any, i:number) => i !== index); updateNodeData('buttons', newBtns); }} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          ))}
                          <button onClick={() => updateNodeData('buttons', [...(selectedNode.data.buttons || []), 'New Option'])} className="w-full py-3 mt-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> Add Branch Option</button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <button onClick={() => { setNodes(n => n.filter(x => x.id !== selectedNode.id)); setSelectedNode(null); }} className="w-full py-3.5 bg-white border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-50 hover:border-red-300 transition-all shadow-sm flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4"/> Delete Component
                    </button>
                  </div>
                </div>
              )}
            </main>
          </>
        )}

        {/* SCENARIO 3: AI BRAIN */}
        {activeTab === 'knowledge' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
             <div className="max-w-3xl w-full space-y-8 mt-10">
              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-[2rem] p-10 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <BrainCircuit className="w-12 h-12 text-purple-300 mb-5" />
                <h3 className="text-3xl font-black mb-3 tracking-tight">Train your AI Assistant</h3>
                <p className="text-purple-200 font-medium max-w-xl leading-relaxed">Upload property brochures or PDF documents. The AI will securely read this data and use it to answer dynamic user queries instantly.</p>
              </div>
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-10">
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all group">
                  <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"><FileText className="w-8 h-8 text-indigo-500" /></div>
                  <h4 className="text-lg font-bold text-indigo-900 mb-2">Click or drag PDF files here</h4>
                  <p className="text-sm font-medium text-indigo-500/70">Maximum 50MB per file. Only PDF supported.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 4: DESIGN & INSTALL WITH SIMULATOR */}
        {activeTab === 'design' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
            <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 mt-6">
              
              {/* Left Column: Settings */}
              <div className="space-y-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3"><Palette className="w-6 h-6 text-indigo-500"/> Widget Design</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Header Title</label>
                      <input type="text" value={botName} onChange={e => { setBotName(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Header Subtitle</label>
                      <input type="text" value={botSubtitle} onChange={e => { setBotSubtitle(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                    </div>

                    {/* ✨ FONT SETTING ✨ */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Typography Font</label>
                      <select value={widgetFont} onChange={e => setWidgetFont(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all cursor-pointer">
                        <option value="Inter">Inter (Modern Default)</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Poppins">Poppins</option>
                        <option value="system-ui">System Default (Fastest)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Widget Position</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setWidgetPosition('left'); setSetupProgress(prev => ({...prev, design: true})); }} className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${widgetPosition === 'left' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <LayoutTemplate className="w-4 h-4 scale-x-[-1]" /> Bottom Left
                        </button>
                        <button onClick={() => { setWidgetPosition('right'); setSetupProgress(prev => ({...prev, design: true})); }} className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${widgetPosition === 'right' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                          <LayoutTemplate className="w-4 h-4" /> Bottom Right
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Theme Color</label>
                      <div className="flex items-center gap-4">
                        <input type="color" value={widgetColor} onChange={e => { setWidgetColor(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-14 h-14 rounded-xl cursor-pointer border-0 p-0 shadow-sm" />
                        <input type="text" value={widgetColor} onChange={e => { setWidgetColor(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Custom Avatar URL (Optional)</label>
                      <div className="flex gap-4">
                        <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {botAvatar ? <img src={botAvatar} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                        </div>
                        <input type="url" placeholder="https://..." value={botAvatar} onChange={e => { setBotAvatar(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Code className="w-6 h-6 text-emerald-400"/> Install Script</h3>
                    <button onClick={handleCopyCode} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-lg">
                      {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {isCopied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-slate-400 mb-6 relative z-10">Paste this code inside the <code className="bg-slate-800 text-slate-300 px-2 py-1 rounded-md">&lt;head&gt;</code> tag of your website.</p>
                  <pre className="p-5 bg-black/50 rounded-xl overflow-x-auto custom-scrollbar text-sm font-mono text-emerald-400 leading-relaxed border border-white/10 relative z-10">
                    <code>{widgetCode}</code>
                  </pre>
                </div>
              </div>

              {/* ✨ KENYT.AI STYLE LIVE WEB PREVIEW WITH REALTIME SIMULATOR ✨ */}
              <div className="flex justify-center items-start lg:pl-12">
                <div className="w-full h-[700px] bg-slate-200/50 rounded-[32px] border-4 border-slate-300 overflow-hidden relative shadow-inner">
                  
                  <div className="absolute top-4 left-4 z-20 flex gap-2">
                    <button onClick={startSimulation} className="bg-white/90 backdrop-blur border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" /> Restart Simulator
                    </button>
                  </div>

                  <div className="absolute inset-0 p-8 opacity-20 pointer-events-none">
                    <div className="w-3/4 h-8 bg-slate-400 rounded-lg mb-6"></div>
                    <div className="w-full h-4 bg-slate-400 rounded mb-3"></div>
                    <div className="w-5/6 h-4 bg-slate-400 rounded mb-8"></div>
                    <div className="w-1/2 h-48 bg-slate-400 rounded-2xl mb-8"></div>
                    <div className="w-full h-4 bg-slate-400 rounded mb-3"></div>
                  </div>

                  <div className={`absolute bottom-6 flex flex-col ${widgetPosition === 'left' ? 'left-6 items-start' : 'right-6 items-end'}`} style={{ fontFamily: widgetFont }}>
                    
                    {isWidgetOpen && (
                      <div className="w-[340px] bg-white rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden mb-4 animate-in slide-in-from-bottom-8 origin-bottom-right">
                        
                        <div className="px-5 py-3.5 text-white flex items-center justify-between shadow-sm z-10" style={{ backgroundColor: widgetColor }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md overflow-hidden relative border-2 border-white/20 shrink-0">
                              {botAvatar ? <img src={botAvatar} className="w-full h-full object-cover" /> : <Bot className="w-6 h-6" style={{ color: widgetColor }} />}
                            </div>
                            <div>
                              <h4 className="text-[14px] font-bold leading-tight tracking-wide">{botName}</h4>
                              <p className="text-[10px] text-white/90 font-medium flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-[#00e676] rounded-full shadow-[0_0_5px_#00e676]"></span> {botSubtitle}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><MoreVertical className="w-4 h-4 text-white" /></button>
                            <button onClick={() => setIsWidgetOpen(false)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Minimize2 className="w-4 h-4 text-white" /></button>
                          </div>
                        </div>

                        {/* LIVE CHAT TRAVERSAL BODY */}
                        <div className="h-[380px] p-5 bg-[#f5f7f9] overflow-y-auto space-y-4 custom-scrollbar flex flex-col">
                          
                          {simMessages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                              <Bot className="w-8 h-8 mb-2 opacity-50" />
                              <p className="text-xs font-bold">Simulator Ready</p>
                            </div>
                          )}

                          {simMessages.map((msg) => (
                            <React.Fragment key={msg.id}>
                              {msg.role === 'system' && (
                                <div className="text-center py-2"><span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-amber-200">{msg.text}</span></div>
                              )}
                              
                              {msg.role === 'bot' && (
                                <div className="flex items-start gap-2.5 max-w-[92%] animate-in slide-in-from-bottom-2">
                                  <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-slate-100 mt-1">
                                    {botAvatar ? <img src={botAvatar} className="w-full h-full object-cover rounded-full" /> : <Bot className="w-4 h-4" style={{ color: widgetColor }} />}
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <div className="bg-white px-4 py-3 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-slate-700 font-medium rounded-2xl rounded-tl-sm leading-relaxed whitespace-pre-wrap">
                                      {msg.text}
                                    </div>
                                    {msg.buttons && msg.buttons.length > 0 && (
                                      <div className="flex flex-wrap gap-2 w-full">
                                        {msg.buttons.map((btn: string, i: number) => (
                                          <button key={i} onClick={() => handleSimButtonClick(btn, msg.sourceNodeId!, i)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-full shadow-sm hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer">
                                            {btn}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {msg.role === 'user' && (
                                <div className="flex justify-end animate-in slide-in-from-bottom-2 w-full">
                                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] shadow-sm text-white font-medium whitespace-pre-wrap" style={{ backgroundColor: widgetColor }}>
                                    {msg.text}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white border-t border-slate-100 relative z-10">
                          <form onSubmit={handleSimTextInput} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 border-r border-slate-200 pr-2 pl-1 cursor-pointer group">
                              <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-800">EN</span>
                              <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                            </div>
                            <input type="text" value={simChatInput} onChange={e => setSimChatInput(e.target.value)} disabled={simInputMode === 'none'} placeholder={simInputMode === 'none' ? "Please select an option above..." : "Type your message..."} className="flex-1 bg-transparent px-2 py-1.5 text-[13px] font-medium outline-none text-slate-700 placeholder:text-slate-400 disabled:opacity-50" />
                            <button type="submit" disabled={!simChatInput.trim()} className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md shrink-0 transition-transform hover:scale-105 disabled:opacity-50" style={{ backgroundColor: widgetColor }}>
                              <Send className="w-3.5 h-3.5 -ml-0.5 mt-0.5" />
                            </button>
                          </form>
                          <div className="text-center mt-2 pt-2 border-t border-slate-50 flex items-center justify-center gap-1">
                            <Zap className="w-3 h-3 text-amber-500 fill-current" />
                            <span className="text-[9px] font-bold text-slate-400 tracking-wide">by Leadspot.AI</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isWidgetOpen && (
                      <button onClick={() => setIsWidgetOpen(true)} className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform relative animate-in zoom-in" style={{ backgroundColor: widgetColor }}>
                        {botAvatar ? <img src={botAvatar} className="w-full h-full object-cover rounded-full p-0.5" /> : <MessageSquare className="w-7 h-7 text-white" />}
                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-[3px] border-slate-200 text-white text-[11px] font-black flex items-center justify-center shadow-sm">1</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function WebsiteBotBuilder() {
  return (
    <ReactFlowProvider>
      <WebsiteBotBuilderFlow />
    </ReactFlowProvider>
  );
}