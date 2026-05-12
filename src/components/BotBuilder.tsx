import React, { useState, useRef, useCallback, useMemo } from 'react';
import { 
  Network, List as ListIcon, Save, Play, MessageSquare, 
  HelpCircle, MessageCircle, Globe, Plus, X, Settings2, Trash2, 
  User, Mail, Phone, MousePointerClick, GitBranch, Webhook, HeadphonesIcon, PlusCircle,Zap
} from 'lucide-react';
import ReactFlow, { 
  ReactFlowProvider, Background, Controls, applyNodeChanges, 
  applyEdgeChanges, addEdge, Connection, Edge, NodeChange, 
  EdgeChange, useReactFlow, Node 
} from 'reactflow';
import 'reactflow/dist/style.css';

// ✨ IMPORT YOUR NEW CUSTOM NODES ✨
import { 
  MessageNode, ButtonNode, CaptureNameNode, CapturePhoneNode, 
  CaptureEmailNode, ConditionNode, ApiRequestNode, HandoverNode 
} from './BotNodes';

// ✨ REGISTER THE CUSTOM NODES ✨
const nodeTypes = {
  message: MessageNode,
  button: ButtonNode,
  captureName: CaptureNameNode,
  capturePhone: CapturePhoneNode,
  captureEmail: CaptureEmailNode,
  condition: ConditionNode,
  apiRequest: ApiRequestNode,
  handover: HandoverNode,
};

let id = 1;
const getId = () => `node_${id++}`;

function BotBuilderFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // App State
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas');
  const [botChannel, setBotChannel] = useState<'whatsapp' | 'widget'>('whatsapp'); 
  
  // Canvas State
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // ✨ CANVAS EVENT HANDLERS ✨
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), []);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    setSelectedNode(selectedNodes.length > 0 ? selectedNodes[0] : null);
  }, []);

  // ✨ DRAG & DROP ENGINE ✨
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowWrapper.current
        ? project({
            x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left,
            y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top,
          })
        : { x: 0, y: 0 };

      // Initialize payload based on Enterprise node type
      let defaultData: any = { label: 'New Step', message: '' };
      if (type === 'button') defaultData = { ...defaultData, label: 'Ask Question', buttons: ['Option 1'] };
      if (type === 'condition') defaultData = { ...defaultData, label: 'Split Logic', variable: 'Lead.Source', operator: '==', value: 'Facebook' };
      if (type === 'apiRequest') defaultData = { ...defaultData, label: 'Fetch Data', method: 'GET', url: 'https://api.example.com', waitForResponse: true };
      if (type === 'handover') defaultData = { ...defaultData, label: 'Human Transfer', department: 'Sales Team' };

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: defaultData,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [project, setNodes]
  );

  // ✨ REAL-TIME PROPERTIES UPDATER ✨
  const updateSelectedNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const updatedNode = { ...node, data: { ...node.data, [field]: value } };
          setSelectedNode(updatedNode); // Keep sidebar in sync
          return updatedNode;
        }
        return node;
      })
    );
  };

  // Helper component for the draggable library
  const DraggableNode = ({ type, label, description, icon: Icon, color }: any) => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    };
    return (
      <div 
        onDragStart={(event) => onDragStart(event, type)} 
        draggable 
        className={`w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-${color}-500 hover:shadow-md hover:shadow-${color}-500/10 rounded-xl transition-all cursor-grab group text-left`}
      >
        <div className={`p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-${color}-50 group-hover:text-${color}-600 transition-colors`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-800">{label}</h5>
          <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative w-full overflow-hidden">
      
      {/* ✨ 1. HEADER & TOGGLE ✨ */}
      <div className="flex items-center justify-between p-6 bg-white border-b border-slate-200 shrink-0 z-20 shadow-sm relative">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-extrabold text-slate-800">Flow Builder</h2>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${botChannel === 'whatsapp' ? 'bg-[#25D366]/10 text-[#1a9347] border-[#25D366]/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
              {botChannel === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {botChannel === 'whatsapp' ? 'WhatsApp Bot' : 'Website Widget'}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Design your automated real estate assistant.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner mr-2">
            <button onClick={() => setBotChannel('whatsapp')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${botChannel === 'whatsapp' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>WhatsApp</button>
            <button onClick={() => setBotChannel('widget')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${botChannel === 'widget' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Website</button>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button onClick={() => setViewMode('canvas')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'canvas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Network className="w-4 h-4" /> Canvas</button>
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><ListIcon className="w-4 h-4" /> List</button>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2"></div>

          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-sm shadow-sm transition-all">
            <Play className="w-4 h-4 text-amber-500 fill-amber-500" /> Test Bot
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white hover:bg-[#1EBE57] rounded-xl text-sm font-bold shadow-lg shadow-[#25D366]/30 transition-all hover:-translate-y-0.5">
            <Save className="w-4 h-4" /> Publish Flow
          </button>
        </div>
      </div>

      {/* ✨ 2. TRIPLE WORKSPACE LAYOUT ✨ */}
      <div className="flex-1 relative w-full h-full flex overflow-hidden">
        
        {/* LEFT PANEL: Node Library */}
        {viewMode === 'canvas' && (
          <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm relative">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Node Library</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Communication</h4>
                <DraggableNode type="message" label="Send Message" description="Standard text or media block." icon={MessageSquare} color="indigo" />
                <DraggableNode type="button" label="Ask a Question" description="Wait for quick-reply buttons." icon={MousePointerClick} color="blue" />
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">CRM Data Capture</h4>
                <DraggableNode type="captureName" label="Ask Name" description="Saves to Lead Profile." icon={User} color="emerald" />
                <DraggableNode type="capturePhone" label="Ask Phone" description="Validates WhatsApp numbers." icon={Phone} color="amber" />
                <DraggableNode type="captureEmail" label="Ask Email" description="Validates email format." icon={Mail} color="rose" />
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">Logic (Pro) <Zap className="w-3 h-3 text-amber-500"/></h4>
                <DraggableNode type="condition" label="Condition Split" description="Branch flow based on variables." icon={GitBranch} color="purple" />
                <DraggableNode type="apiRequest" label="API Webhook" description="GET/POST to external servers." icon={Webhook} color="cyan" />
                <DraggableNode type="handover" label="Agent Transfer" description="Pause bot, alert human team." icon={HeadphonesIcon} color="rose" />
              </div>

            </div>
          </aside>
        )}

        {/* CENTER PANEL: Canvas */}
        <main className="flex-1 relative h-full bg-slate-50/50" ref={reactFlowWrapper}>
          {viewMode === 'canvas' ? (
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectionChange={onSelectionChange}
              fitView
              className="bg-transparent"
            >
              <Background color="#cbd5e1" gap={16} size={1.5} />
              <Controls className="bg-white border-slate-200 shadow-sm rounded-lg" />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 font-bold">List View is under construction. Switch to Canvas.</div>
          )}
        </main>

        {/* RIGHT PANEL: Property Inspector */}
        {selectedNode && (
          <aside className="w-[380px] bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200 z-20 relative">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Settings2 className="w-4 h-4" /></div>
                <h3 className="font-bold text-slate-800">Node Configuration</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Common Label Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Internal Label</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label || ''}
                  onChange={(e) => updateSelectedNodeData('label', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all"
                />
              </div>

              {/* ✨ CONDITIONAL RENDER: Messaging Nodes ✨ */}
              {['message', 'captureName', 'capturePhone', 'captureEmail', 'button'].includes(selectedNode.type!) && (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Message Content</label>
                  </div>
                  <textarea 
                    rows={4}
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateSelectedNodeData('message', e.target.value)}
                    placeholder="Enter the message text..."
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all resize-y"
                  />
                </div>
              )}

              {/* ✨ CONDITIONAL RENDER: Button Nodes ✨ */}
              {selectedNode.type === 'button' && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Quick Replies</label>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      Max {botChannel === 'whatsapp' ? '3' : '5'}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Render existing buttons */}
                    {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            value={btn}
                            onChange={(e) => {
                              const newBtns = [...selectedNode.data.buttons];
                              newBtns[index] = e.target.value;
                              updateSelectedNodeData('buttons', newBtns);
                            }}
                            className="w-full pl-4 pr-8 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 outline-none text-sm font-bold text-blue-900 transition-all"
                            maxLength={20}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-300 pointer-events-none">{index + 1}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const newBtns = selectedNode.data.buttons.filter((_: any, i: number) => i !== index);
                            updateSelectedNodeData('buttons', newBtns);
                          }}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shadow-sm shrink-0 border border-transparent hover:border-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Button logic based on WhatsApp vs Web constraint */}
                    {(selectedNode.data.buttons?.length || 0) < (botChannel === 'whatsapp' ? 3 : 5) && (
                      <button 
                        onClick={() => {
                          const newBtns = [...(selectedNode.data.buttons || []), `Option ${(selectedNode.data.buttons?.length || 0) + 1}`];
                          updateSelectedNodeData('buttons', newBtns);
                        }}
                        className="w-full py-2.5 border border-dashed border-blue-300 rounded-xl text-blue-600 font-bold text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add Button
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ✨ CONDITIONAL RENDER: Condition Splitting ✨ */}
              {selectedNode.type === 'condition' && (
                <div className="space-y-4 p-4 bg-purple-50/50 border border-purple-100 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 mb-1.5 uppercase tracking-widest">Variable to Check</label>
                    <input type="text" value={selectedNode.data.variable || ''} onChange={(e) => updateSelectedNodeData('variable', e.target.value)} className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg outline-none text-sm font-bold shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 mb-1.5 uppercase tracking-widest">Operator</label>
                    <select value={selectedNode.data.operator || '=='} onChange={(e) => updateSelectedNodeData('operator', e.target.value)} className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg outline-none text-sm font-bold shadow-sm">
                      <option value="==">Equals (==)</option>
                      <option value="!=">Not Equals (!=)</option>
                      <option value="contains">Contains</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-purple-900 mb-1.5 uppercase tracking-widest">Target Value</label>
                    <input type="text" value={selectedNode.data.value || ''} onChange={(e) => updateSelectedNodeData('value', e.target.value)} className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg outline-none text-sm font-bold shadow-sm" />
                  </div>
                </div>
              )}

              {/* Global Delete Button */}
              <div className="pt-8 border-t border-slate-100">
                <button 
                  onClick={() => {
                    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                    setSelectedNode(null);
                  }}
                  className="w-full py-2.5 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
                >
                  <Trash2 className="w-4 h-4"/> Delete Step
                </button>
              </div>

            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// Wrap in ReactFlowProvider so hooks work
export default function BotBuilder() {
  return (
    <ReactFlowProvider>
      <BotBuilderFlow />
    </ReactFlowProvider>
  );
}