import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Bot, Settings2, Play, MousePointerClick, 
  MessageSquare, User, FileText, X, CheckCircle2, 
  Copy, Save, BrainCircuit, Globe, Palette, 
  LayoutGrid, HeadphonesIcon, GitBranch, Plus, Trash2, Image as ImageIcon
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
      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Chat Message</span>
    </div>
    <div className="p-4"><p className="text-xs text-slate-600 line-clamp-2">{data.message || 'Type message...'}</p></div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-indigo-400 border-none" />
  </div>
);

const WebButtonNode = ({ data }: any) => (
  <div className="w-64 bg-white rounded-xl shadow-sm border-2 border-blue-300 hover:border-blue-500 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-blue-400 border-none" />
    <div className="bg-blue-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-blue-100">
      <MousePointerClick className="w-4 h-4 text-blue-500" />
      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Quick Replies</span>
    </div>
    <div className="p-3">
      <p className="text-xs font-medium text-slate-600 mb-2">{data.message || 'Please select:'}</p>
      <div className="flex flex-wrap gap-1.5">
        {(data.buttons || ['Option 1']).map((b: string, i: number) => (
          <span key={i} className="px-2 py-1 bg-white border border-blue-200 text-blue-600 text-[10px] font-bold rounded-lg shadow-sm">{b}</span>
        ))}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-blue-400 border-none" />
  </div>
);

const WebCarouselNode = ({ data }: any) => (
  <div className="w-64 bg-white rounded-xl shadow-sm border-2 border-pink-300 hover:border-pink-500 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-pink-400 border-none" />
    <div className="bg-pink-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-pink-100">
      <LayoutGrid className="w-4 h-4 text-pink-500" />
      <span className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Property Carousel</span>
    </div>
    <div className="p-3 flex gap-2 overflow-hidden">
      {(data.cards || [1, 2]).slice(0,2).map((_:any, i:number) => (
        <div key={i} className="w-24 h-24 bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center shrink-0">
          <ImageIcon className="w-6 h-6 text-slate-300 mb-1"/>
          <div className="w-16 h-2 bg-slate-200 rounded-full"></div>
        </div>
      ))}
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-pink-400 border-none" />
  </div>
);

const WebLeadNode = ({ data }: any) => (
  <div className="w-56 bg-white rounded-xl shadow-sm border-2 border-amber-300 hover:border-amber-500 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-amber-400 border-none" />
    <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-amber-100">
      <User className="w-4 h-4 text-amber-600" />
      <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Lead Form</span>
    </div>
    <div className="p-4"><p className="text-xs font-bold text-slate-700">Collect: {data.captureType || 'Name & Email'}</p></div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-amber-400 border-none" />
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

const WebHandoffNode = ({ data }: any) => (
  <div className="w-56 bg-slate-100 rounded-xl shadow-sm border-2 border-slate-300 hover:border-slate-500 transition-colors">
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-slate-400 border-none" />
    <div className="bg-slate-200 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-slate-300">
      <HeadphonesIcon className="w-4 h-4 text-slate-600" />
      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Human Handoff</span>
    </div>
    <div className="p-4"><p className="text-xs font-bold text-slate-700">Transfer to Live Agent</p></div>
  </div>
);

const nodeTypes = { 
  webTrigger: WebTriggerNode, webMessage: WebMessageNode, 
  webButton: WebButtonNode, webCarousel: WebCarouselNode,
  webLead: WebLeadNode, aiBrain: AIBrainNode, webHandoff: WebHandoffNode 
};

const INITIAL_NODES: Node[] = [
  { id: '1', type: 'webTrigger', position: { x: 300, y: 50 }, data: { label: 'When user opens chat' } },
  { id: '2', type: 'webMessage', position: { x: 300, y: 200 }, data: { message: 'Hi! Welcome to our website. Are you looking for a specific property today?' } },
  { id: '3', type: 'webButton', position: { x: 280, y: 350 }, data: { message: 'Select an option:', buttons: ['Explore Properties', 'Talk to Agent'] } }
];
const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#10b981' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#6366f1' } }
];

let idCounter = 4;
const getId = () => `web_node_${Date.now()}_${idCounter++}`;

function WebsiteBotBuilderFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, fitView } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Widget Customization State
  const [widgetColor, setWidgetColor] = useState('#6366f1');
  const [botName, setBotName] = useState('AI Assistant');
  const [isCopied, setIsCopied] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'nodes' | 'knowledge' | 'design'>('nodes');

  // React Flow Handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)), []);
  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => setSelectedNode(nodes[0] || null), []);

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowWrapper.current) return;

    const position = project({ x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left, y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top });
    let data: any = {};
    if (type === 'webMessage') data = { message: 'New message' };
    if (type === 'webButton') data = { message: 'Choose an option:', buttons: ['Option 1', 'Option 2'] };
    if (type === 'webCarousel') data = { cards: [{title: 'Property A', subtitle: 'Location A', button: 'View'}, {title: 'Property B', subtitle: 'Location B', button: 'View'}] };
    if (type === 'webLead') data = { captureType: 'Name, Email & Phone' };
    
    const newNode = { id: getId(), type, position, data };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
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
    themeColor: "${widgetColor}"
  };
</script>
<script src="https://cdn.leadspot.com/web-widget.js" async></script>`;

  const DraggableNode = ({ type, label, description, icon: Icon, color }: any) => {
    const onDragStart = (event: React.DragEvent) => { event.dataTransfer.setData('application/reactflow', type); event.dataTransfer.effectAllowed = 'move'; };
    return (
      <div onDragStart={onDragStart} draggable className={`p-3 bg-white border border-slate-200 rounded-xl hover:border-${color}-400 cursor-grab flex items-center gap-3 shadow-sm group transition-all hover:shadow-md`}>
        <div className={`p-2 bg-${color}-50 rounded-lg text-${color}-500 group-hover:bg-${color}-100 transition-colors`}><Icon className="w-4 h-4" /></div>
        <div><p className="text-sm font-bold text-slate-700">{label}</p><p className="text-[10px] text-slate-500 font-medium">{description}</p></div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full relative overflow-hidden rounded-tl-xl border border-slate-200">
      
      {/* Top Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
            <Bot className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none">Website Bot Flow Builder</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Enterprise Automation Engine</p>
          </div>
        </div>
        <button className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2">
          <Save className="w-4 h-4" /> Deploy Widget
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANE: Node Library & Settings */}
        <aside className="w-[320px] bg-white/90 backdrop-blur-xl border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-lg relative">
          <div className="flex p-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <button onClick={() => setActiveSettingsTab('nodes')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeSettingsTab === 'nodes' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Builder</button>
            <button onClick={() => setActiveSettingsTab('knowledge')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeSettingsTab === 'knowledge' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>AI Brain</button>
            <button onClick={() => setActiveSettingsTab('design')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeSettingsTab === 'design' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>Design</button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {activeSettingsTab === 'nodes' && (
              <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Messaging & Media</h4>
                  <DraggableNode type="webMessage" label="Text Message" description="Send text or simple media." icon={MessageSquare} color="indigo" />
                  <DraggableNode type="webButton" label="Quick Replies" description="Interactive clickable buttons." icon={MousePointerClick} color="blue" />
                  <DraggableNode type="webCarousel" label="Product Carousel" description="Swipeable property cards." icon={LayoutGrid} color="pink" />
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Data & Logic</h4>
                  <DraggableNode type="webLead" label="Lead Capture Form" description="Ask for Name, Email, Phone." icon={User} color="amber" />
                  <div onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'aiBrain'); e.dataTransfer.effectAllowed = 'move'; }} draggable className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-purple-500 cursor-grab flex items-center gap-3 shadow-sm group relative overflow-hidden transition-all hover:shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                    <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 relative z-10"><BrainCircuit className="w-4 h-4" /></div>
                    <div className="relative z-10"><p className="text-sm font-bold text-white">AI RAG Engine</p><p className="text-[10px] text-slate-400 font-medium">Hand off to trained Gemini Bot</p></div>
                  </div>
                  <DraggableNode type="webHandoff" label="Live Agent Transfer" description="Alert human support team." icon={HeadphonesIcon} color="slate" />
                </div>
              </div>
            )}

            {activeSettingsTab === 'knowledge' && (
              <div className="space-y-5 animate-in slide-in-from-left-4 duration-300">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                  <BrainCircuit className="w-6 h-6 text-purple-500 mb-2" />
                  <h4 className="text-sm font-bold text-purple-900 mb-1">Train the AI Brain</h4>
                  <p className="text-xs font-medium text-purple-700">Upload PDFs or add Website URLs. When the flow hits the 'AI RAG Engine' node, it will answer questions strictly based on this data.</p>
                </div>
                <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-sm hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex flex-col items-center justify-center gap-2">
                  <FileText className="w-6 h-6" /> Upload Brochure (PDF)
                </button>
              </div>
            )}

            {activeSettingsTab === 'design' && (
              <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Bot Name</label>
                  <input type="text" value={botName} onChange={e => setBotName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/30 outline-none shadow-sm transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Brand Theme Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm" />
                    <input type="text" value={widgetColor} onChange={e => setWidgetColor(e.target.value)} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500/30 outline-none shadow-sm transition-all" />
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">HTML Embed Code</h4>
                  <div className="bg-slate-900 rounded-xl p-4 relative shadow-lg">
                    <button onClick={() => { navigator.clipboard.writeText(widgetCode); setIsCopied(true); setTimeout(()=>setIsCopied(false), 2000); }} className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                      {isCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed pr-8">
                      <code>{widgetCode}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* MIDDLE PANE: Canvas */}
        <main className="flex-1 relative h-full" ref={reactFlowWrapper}>
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

          {/* ✨ ENTERPRISE PROPERTIES PANEL ✨ */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-[320px] bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-right-4 z-20 max-h-[90%]">
              <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><Settings2 className="w-4 h-4"/> Node Configuration</h3>
                <button onClick={() => setSelectedNode(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                {selectedNode.type === 'webMessage' && (
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Bot Message Text</label>
                    <textarea rows={4} value={selectedNode.data.message || ''} onChange={(e) => updateNodeData('message', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none resize-y" placeholder="Enter message here..." />
                  </div>
                )}

                {selectedNode.type === 'webButton' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Prompt Text</label>
                      <input type="text" value={selectedNode.data.message || ''} onChange={(e) => updateNodeData('message', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/30 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Quick Replies</label>
                      <div className="space-y-2">
                        {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                          <div key={index} className="flex gap-2">
                            <input type="text" value={btn} onChange={(e) => { const newBtns = [...selectedNode.data.buttons]; newBtns[index] = e.target.value; updateNodeData('buttons', newBtns); }} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-blue-400" />
                            <button onClick={() => { const newBtns = selectedNode.data.buttons.filter((_:any, i:number) => i !== index); updateNodeData('buttons', newBtns); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        ))}
                        <button onClick={() => updateNodeData('buttons', [...(selectedNode.data.buttons || []), 'New Option'])} className="w-full py-2 border border-dashed border-blue-300 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5"/> Add Button</button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'webLead' && (
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Data to Capture</label>
                    <select value={selectedNode.data.captureType || 'Name & Email'} onChange={(e) => updateNodeData('captureType', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/30">
                      <option>Name Only</option><option>Email Only</option><option>Phone Only</option>
                      <option>Name & Email</option><option>Name, Email & Phone</option>
                    </select>
                    <p className="text-[10px] font-medium text-slate-500 mt-2">Captured data will automatically create a new Lead in your CRM.</p>
                  </div>
                )}

                {selectedNode.type === 'webCarousel' && (
                  <div>
                    <div className="flex items-center justify-between mb-3"><label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Cards</label></div>
                    <div className="space-y-4">
                      {(selectedNode.data.cards || []).map((card: any, index: number) => (
                        <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative group">
                          <button onClick={() => { const newC = selectedNode.data.cards.filter((_:any, i:number) => i !== index); updateNodeData('cards', newC); }} className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full shadow-sm"><X className="w-3 h-3"/></button>
                          <input type="text" placeholder="Image URL" value={card.image || ''} onChange={(e) => { const newC = [...selectedNode.data.cards]; newC[index].image = e.target.value; updateNodeData('cards', newC); }} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none" />
                          <input type="text" placeholder="Title" value={card.title || ''} onChange={(e) => { const newC = [...selectedNode.data.cards]; newC[index].title = e.target.value; updateNodeData('cards', newC); }} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none" />
                          <input type="text" placeholder="Subtitle" value={card.subtitle || ''} onChange={(e) => { const newC = [...selectedNode.data.cards]; newC[index].subtitle = e.target.value; updateNodeData('cards', newC); }} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none" />
                        </div>
                      ))}
                      <button onClick={() => updateNodeData('cards', [...(selectedNode.data.cards || []), {title:'New Item', subtitle:'Desc', button:'View'}])} className="w-full py-2 border border-dashed border-pink-300 text-pink-600 rounded-lg text-xs font-bold hover:bg-pink-50 transition-colors flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5"/> Add Card</button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl shrink-0">
                <button onClick={() => { setNodes(n => n.filter(x => x.id !== selectedNode.id)); setSelectedNode(null); }} className="w-full py-2.5 bg-white border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-50 hover:border-red-300 transition-all shadow-sm">
                  Delete Node
                </button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT PANE: Live Widget Preview */}
        <aside className="w-[360px] bg-slate-50 border-l border-slate-200 flex flex-col shrink-0 relative z-20 hidden lg:flex">
          <div className="p-4 bg-white border-b border-slate-200 shrink-0 text-center flex items-center justify-center gap-2">
            <Play className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800">Live Simulation</h3>
          </div>

          <div className="flex-1 relative p-6 flex flex-col justify-end bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center opacity-90">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm"></div>

            <div className="relative w-full h-[550px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500 z-10">
              
              {/* Widget Header */}
              <div className="px-5 py-4 text-white flex items-center justify-between shadow-md z-10" style={{ backgroundColor: widgetColor }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold leading-tight">{botName}</h4>
                    <p className="text-[10px] text-white/80 font-medium flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online
                    </p>
                  </div>
                </div>
                <X className="w-5 h-5 opacity-70 cursor-pointer" />
              </div>

              {/* Chat Body */}
              <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-4 custom-scrollbar">
                
                {/* Standard Message Mock */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] shadow-sm bg-white border border-slate-100 text-slate-800 font-medium">
                    Hi! Welcome to our website. Are you looking for a specific property today?
                  </div>
                </div>

                {/* Interactive Buttons Mock */}
                <div className="flex justify-start">
                  <div className="w-full flex flex-col gap-1.5">
                    <button className="py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm" style={{ color: widgetColor }}>
                      Explore Properties
                    </button>
                    <button className="py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm" style={{ color: widgetColor }}>
                      Talk to Agent
                    </button>
                  </div>
                </div>

              </div>

              {/* Chat Input */}
              <div className="p-3 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Type a message..." disabled className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-sm font-medium outline-none opacity-70 cursor-not-allowed" />
                  <button disabled className="w-10 h-10 rounded-full flex items-center justify-center text-white opacity-70 cursor-not-allowed shrink-0" style={{ backgroundColor: widgetColor }}>
                    <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
                <div className="text-center mt-2"><span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">⚡ Powered by Leadspot AI</span></div>
              </div>
            </div>
          </div>
        </aside>

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