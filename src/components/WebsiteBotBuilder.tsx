import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Bot, Settings2, Play, MousePointerClick, 
  MessageSquare, User, FileText, X, CheckCircle2, 
  Copy, Save, BrainCircuit, Globe, Palette, 
  LayoutGrid, HeadphonesIcon, Phone, Mail, Check, 
  ChevronRight, Sparkles, Code, MoreVertical, Mic, Send, Image as ImageIcon,Zap, Plus, Trash2
} from 'lucide-react';
import ReactFlow, { 
  ReactFlowProvider, Background, Controls, applyNodeChanges, 
  applyEdgeChanges, addEdge, Connection, Edge, NodeChange, 
  EdgeChange, useReactFlow, Node, Handle, Position
} from 'reactflow';
import 'reactflow/dist/style.css';

// ==========================================
// 1. ENTERPRISE WEB CUSTOM NODES
// ==========================================
const WebTriggerNode = ({ data }: any) => (
  <div className="w-56 bg-white rounded-xl shadow-sm border-2 border-emerald-500">
    <div className="bg-emerald-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-emerald-100">
      <Globe className="w-4 h-4 text-emerald-600" />
      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Web Trigger</span>
    </div>
    <div className="p-4"><p className="text-sm font-bold text-slate-700">{data.label || 'On Widget Open'}</p></div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-emerald-500 border-none" />
  </div>
);

const WebMessageNode = ({ data }: any) => (
  <div className="w-56 bg-white rounded-xl shadow-sm border-2 border-indigo-200 hover:border-indigo-400 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-indigo-400 border-none" />
    <div className="bg-indigo-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-indigo-100">
      <MessageSquare className="w-4 h-4 text-indigo-500" />
      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Message</span>
    </div>
    <div className="p-4"><p className="text-xs text-slate-600 line-clamp-2">{data.message || 'Type message...'}</p></div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-indigo-400 border-none" />
  </div>
);

const WebAskNode = ({ data }: any) => {
  const isPhone = data.field === 'phone';
  const isEmail = data.field === 'email';
  const Icon = isPhone ? Phone : isEmail ? Mail : User;
  const color = isPhone ? 'amber' : isEmail ? 'rose' : 'sky';

  return (
    <div className={`w-56 bg-white rounded-xl shadow-sm border-2 border-${color}-300 hover:border-${color}-500 transition-colors`}>
      <Handle type="target" position={Position.Top} className={`w-2 h-2 bg-${color}-400 border-none`} />
      <div className={`bg-${color}-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-${color}-100`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
        <span className={`text-[10px] font-black text-${color}-800 uppercase tracking-widest`}>Ask {data.field}</span>
      </div>
      <div className="p-4"><p className="text-xs text-slate-600 line-clamp-2">{data.message || `Please provide your ${data.field}`}</p></div>
      <Handle type="source" position={Position.Bottom} className={`w-2 h-2 bg-${color}-400 border-none`} />
    </div>
  );
};

const WebButtonNode = ({ data }: any) => (
  <div className="w-64 bg-white rounded-xl shadow-sm border-2 border-blue-300 hover:border-blue-500 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-blue-400 border-none" />
    <div className="bg-blue-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-blue-100">
      <MousePointerClick className="w-4 h-4 text-blue-500" />
      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Interactive Menu</span>
    </div>
    <div className="p-3">
      <p className="text-xs font-medium text-slate-600 mb-2">{data.message || 'How may I assist you?'}</p>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {(data.buttons || ['Option 1']).map((b: string, i: number) => (
          <span key={i} className="px-2.5 py-1 bg-white border border-blue-200 text-blue-700 text-[10px] font-bold rounded-full shadow-sm">{b}</span>
        ))}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-blue-400 border-none" />
  </div>
);

const AIBrainNode = ({ data }: any) => (
  <div className="w-64 bg-slate-900 rounded-xl shadow-lg border-2 border-purple-500 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-50"></div>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-purple-500 border-none" />
    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 relative z-10">
      <BrainCircuit className="w-4 h-4 text-purple-400" />
      <span className="text-[10px] font-black text-purple-300 uppercase tracking-widest">AI RAG Handoff</span>
    </div>
    <div className="p-4 relative z-10">
      <p className="text-xs font-medium text-slate-300">Bot uses Gemini AI to answer questions using uploaded Knowledge Base.</p>
    </div>
  </div>
);

const nodeTypes = { 
  webTrigger: WebTriggerNode, webMessage: WebMessageNode, 
  webAsk: WebAskNode, webButton: WebButtonNode, aiBrain: AIBrainNode
};

const INITIAL_NODES: Node[] = [
  { id: '1', type: 'webTrigger', position: { x: 300, y: 50 }, data: { label: 'When user opens chat' } },
  { id: '2', type: 'webMessage', position: { x: 300, y: 200 }, data: { message: "Hello, I'm your AI Assistant. Welcome! How can I assist you today?" } },
  { id: '3', type: 'webButton', position: { x: 280, y: 350 }, data: { message: 'How may I assist you?', buttons: ['AI Agents', 'WhatsApp Campaigns', 'CRM', 'Pricing'] } }
];
const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#10b981' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#3b82f6' } }
];

let idCounter = 4;
const getId = () => `web_node_${Date.now()}_${idCounter++}`;

function WebsiteBotBuilderFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Setup Wizard State
  const [activeTab, setActiveTab] = useState<'overview' | 'builder' | 'knowledge' | 'design'>('overview');
  const [setupProgress, setSetupProgress] = useState({ flow: true, design: false, install: false, ai: false });

  // ✨ ENTERPRISE KENYT.AI STYLE WIDGET CUSTOMIZATION ✨
  const [widgetColor, setWidgetColor] = useState('#2563eb');
  const [botName, setBotName] = useState('Sales AI Agent');
  const [botSubtitle, setBotSubtitle] = useState('We are online to assist you');
  const [botAvatar, setBotAvatar] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // React Flow Handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)), []);
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
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
    setSetupProgress(prev => ({ ...prev, flow: true }));
  }, [project]);

  const updateNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes(nds => nds.map(node => {
      if (node.id === selectedNode.id) {
        const updated = { ...node, data: { ...node.data, [field]: value } };
        setSelectedNode(updated); return updated;
      }
      return node;
    }));
  };

  const widgetCode = `<script>
  window.LeadspotChatConfig = {
    botId: "YOUR_BOT_ID",
    botName: "${botName}",
    botSubtitle: "${botSubtitle}",
    themeColor: "${widgetColor}",
    avatarUrl: "${botAvatar}"
  };
</script>
<script src="https://cdn.leadspot.com/enterprise-widget.js" async></script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(widgetCode); 
    setIsCopied(true); 
    setSetupProgress(prev => ({ ...prev, install: true }));
    setTimeout(()=>setIsCopied(false), 2000);
  };

  const DraggableNode = ({ type, fieldType, label, icon: Icon, color }: any) => {
    const onDragStart = (event: React.DragEvent) => { 
      event.dataTransfer.setData('application/reactflow', type); 
      if (fieldType) event.dataTransfer.setData('field_type', fieldType);
      event.dataTransfer.effectAllowed = 'move'; 
    };
    return (
      <div onDragStart={onDragStart} draggable className={`p-3 bg-white border border-slate-200 rounded-xl hover:border-${color}-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md`}>
        <div className={`p-2 bg-${color}-50 rounded-lg text-${color}-500 group-hover:bg-${color}-100 transition-colors`}><Icon className="w-4 h-4" /></div>
        <p className="text-sm font-bold text-slate-700">{label}</p>
      </div>
    );
  };

  // Dynamic values for simulator based on canvas
  const previewMessage = nodes.find(n => n.type === 'webMessage')?.data?.message || "Hello! I'm your AI Assistant. How can I assist you today?";
  const previewMenu = nodes.find(n => n.type === 'webButton')?.data || { message: 'How may I assist you?', buttons: ['AI Agents', 'WhatsApp Campaigns'] };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full relative overflow-hidden rounded-tl-xl border border-slate-200">
      
      {/* Top Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('overview')} className="w-10 h-10 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm transition-colors cursor-pointer">
            <Bot className="w-5 h-5 text-indigo-600" />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">Website AI Chatbot</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Enterprise Automation</span>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Overview</button>
          <button onClick={() => setActiveTab('builder')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'builder' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Chat Flow</button>
          <button onClick={() => setActiveTab('knowledge')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'knowledge' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>AI Brain</button>
          <button onClick={() => setActiveTab('design')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'design' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Design & Install</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SCENARIO 1: SETUP OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
            <div className="max-w-3xl w-full space-y-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Your bot space is ready.</h2>
                <p className="text-slate-500 font-medium">You can go live once you configure your bot checklist.</p>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">Required Setup <span className="text-red-500">*</span></h3>
                </div>

                <div className="divide-y divide-slate-100">
                  <div onClick={() => setActiveTab('builder')} className="p-6 flex items-center gap-5 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.flow ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Edit Your Chat Flow</h4><p className="text-sm font-medium text-slate-500 mt-1">Build engaging conversation flows for your bot users before handing off to AI.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('design')} className="p-6 flex items-center gap-5 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.design ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Design Your Chatbot</h4><p className="text-sm font-medium text-slate-500 mt-1">Manage the look, feel, colors, and avatar of your chatbot widget.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('knowledge')} className="p-6 flex items-center gap-5 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.ai ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">AI Settings <Sparkles className="w-4 h-4 text-amber-500"/></h4><p className="text-sm font-medium text-slate-500 mt-1">Configure bot's brain. Upload PDFs or paste website links for RAG training.</p></div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                  <div onClick={() => setActiveTab('design')} className="p-6 flex items-center gap-5 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${setupProgress.install ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-300 text-slate-300'}`}><Check className="w-5 h-5" /></div>
                    <div className="flex-1"><h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Install Your Chatbot</h4><p className="text-sm font-medium text-slate-500 mt-1">Copy the embed code and install it on your website or landing pages.</p></div>
                    {setupProgress.install ? <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">Connected</span> : <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 2: THE BUILDER CANVAS */}
        {activeTab === 'builder' && (
          <>
            <aside className="w-[300px] bg-white/90 backdrop-blur-xl border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-lg relative">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h3 className="font-bold text-slate-800">Add Chat Component</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Drag into Canvas</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                <div className="space-y-2">
                  <DraggableNode type="webMessage" label="Message" icon={MessageSquare} color="indigo" />
                  <DraggableNode type="webAsk" fieldType="name" label="Ask Name" icon={User} color="sky" />
                  <DraggableNode type="webAsk" fieldType="phone" label="Ask Phone Number" icon={Phone} color="amber" />
                  <DraggableNode type="webAsk" fieldType="email" label="Ask Email" icon={Mail} color="rose" />
                  <DraggableNode type="webButton" label="Interactive Menu" icon={MousePointerClick} color="blue" />
                </div>
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-2">Advanced Actions</h4>
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'aiBrain'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500 cursor-grab flex items-center gap-3 shadow-sm group relative overflow-hidden transition-all hover:shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 relative z-10"><BrainCircuit className="w-4 h-4" /></div>
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
                <div className="absolute top-0 right-0 bottom-0 w-[360px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right-8 z-20">
                  <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-sm">Customize Bot Messages</h3>
                    <button onClick={() => setSelectedNode(null)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {['webMessage', 'webAsk', 'webButton'].includes(selectedNode.type!) && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Message Text</label>
                        <textarea rows={4} value={selectedNode.data.message || ''} onChange={(e) => updateNodeData('message', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none resize-y shadow-sm" />
                      </div>
                    )}
                    {selectedNode.type === 'webButton' && (
                      <div className="pt-4 border-t border-slate-100">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Menu Options</label>
                        <div className="space-y-3">
                          {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                            <div key={index} className="flex gap-2 relative">
                              <input type="text" value={btn} onChange={(e) => { const newBtns = [...selectedNode.data.buttons]; newBtns[index] = e.target.value; updateNodeData('buttons', newBtns); }} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 shadow-sm pr-10" />
                              <button onClick={() => { const newBtns = selectedNode.data.buttons.filter((_:any, i:number) => i !== index); updateNodeData('buttons', newBtns); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          ))}
                          <button onClick={() => updateNodeData('buttons', [...(selectedNode.data.buttons || []), 'New Option'])} className="w-full py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> Add Menu Item</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
                    <button onClick={() => { setNodes(n => n.filter(x => x.id !== selectedNode.id)); setSelectedNode(null); }} className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-50 hover:border-red-300 transition-all shadow-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Delete Component</button>
                  </div>
                </div>
              )}
            </main>
          </>
        )}

        {/* SCENARIO 3: AI BRAIN */}
        {activeTab === 'knowledge' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
             <div className="max-w-2xl w-full space-y-8">
              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <BrainCircuit className="w-10 h-10 text-purple-300 mb-4" />
                <h3 className="text-2xl font-black mb-2">Train your AI Assistant</h3>
                <p className="text-purple-200 font-medium max-w-lg">Upload property brochures. The AI will learn your data and use it to answer questions when the flow reaches the AI node.</p>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all group">
                  <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FileText className="w-6 h-6 text-indigo-500" /></div>
                  <h4 className="text-base font-bold text-indigo-900 mb-1">Click or drag PDF files here</h4>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✨ SCENARIO 4: DESIGN & INSTALL (KENYT.AI STYLE PREVIEW) ✨ */}
        {activeTab === 'design' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50 flex justify-center animate-in fade-in duration-300">
            <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10">
              
              <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Palette className="w-5 h-5 text-indigo-500"/> Widget Design</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Header Title</label>
                      <input type="text" value={botName} onChange={e => { setBotName(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Header Subtitle</label>
                      <input type="text" value={botSubtitle} onChange={e => { setBotSubtitle(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Theme Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={widgetColor} onChange={e => { setWidgetColor(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm" />
                        <input type="text" value={widgetColor} onChange={e => { setWidgetColor(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Custom Avatar URL (Optional)</label>
                      <div className="flex gap-2">
                        <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {botAvatar ? <img src={botAvatar} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                        </div>
                        <input type="url" placeholder="https://..." value={botAvatar} onChange={e => { setBotAvatar(e.target.value); setSetupProgress(prev => ({ ...prev, design: true })); }} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Code className="w-5 h-5 text-emerald-400"/> Install Script</h3>
                    <button onClick={handleCopyCode} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                      {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-slate-400 mb-6 relative z-10">Paste this code inside the <code className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">&lt;head&gt;</code> tag of your website.</p>
                  <pre className="p-4 bg-black/50 rounded-xl overflow-x-auto custom-scrollbar text-xs font-mono text-emerald-400 leading-relaxed border border-white/10 relative z-10">
                    <code>{widgetCode}</code>
                  </pre>
                </div>
              </div>

              {/* ✨ KENYT.AI STYLE LIVE PREVIEW WIDGET ✨ */}
              <div className="flex justify-center items-start lg:pl-10">
                <div className="w-[360px] bg-white rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden relative">
                  
                  {/* Widget Header */}
                  <div className="px-4 py-3.5 text-white flex items-center justify-between shadow-sm z-10" style={{ backgroundColor: widgetColor }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md overflow-hidden relative border-2 border-white/20 shrink-0">
                        {botAvatar ? <img src={botAvatar} className="w-full h-full object-cover" /> : <Bot className="w-6 h-6" style={{ color: widgetColor }} />}
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold leading-tight tracking-wide">{botName}</h4>
                        <p className="text-[11px] text-white/90 font-medium flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 bg-[#00e676] rounded-full shadow-[0_0_5px_#00e676]"></span> {botSubtitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><MoreVertical className="w-4 h-4 text-white" /></button>
                      <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X className="w-4 h-4 text-white" /></button>
                    </div>
                  </div>

                  {/* Chat Body */}
                  <div className="h-[420px] p-5 bg-[#f5f7f9] overflow-y-auto space-y-4 custom-scrollbar flex flex-col">
                    
                    {/* Bot Message Bubble with Avatar */}
                    <div className="flex items-start gap-2 max-w-[90%]">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-slate-100 mt-1">
                        <Bot className="w-3.5 h-3.5" style={{ color: widgetColor }} />
                      </div>
                      <div className="bg-white px-4 py-3 text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-slate-700 font-medium rounded-2xl rounded-tl-sm leading-relaxed">
                        {previewMessage}
                      </div>
                    </div>

                    {/* Interactive Menu Grid (Kenyt Style) */}
                    <div className="flex flex-col items-center mt-2 w-full">
                      <p className="text-[12px] font-bold text-slate-500 mb-3">{previewMenu.message}</p>
                      <div className="flex flex-wrap justify-center gap-2 w-full px-2">
                        {(previewMenu.buttons || []).map((btn: string, i: number) => (
                          <button key={i} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-full shadow-sm hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center gap-1.5">
                            {btn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="p-3 bg-white border-t border-slate-100 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-r border-slate-200 pr-2 cursor-pointer group">
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">EN</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                      </div>
                      <input type="text" placeholder="Type your message..." disabled className="flex-1 bg-transparent px-2 py-1 text-[13px] font-medium outline-none text-slate-700 placeholder:text-slate-400" />
                      <button disabled className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><Mic className="w-4 h-4"/></button>
                      <button disabled className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md shrink-0 transition-transform hover:scale-105" style={{ backgroundColor: widgetColor }}>
                        <Send className="w-4 h-4 -ml-0.5 mt-0.5" />
                      </button>
                    </div>
                    <div className="text-center mt-2 border-t border-slate-50 pt-2 flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500 fill-current" />
                      <span className="text-[10px] font-bold text-slate-400">by Leadspot.AI</span>
                    </div>
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