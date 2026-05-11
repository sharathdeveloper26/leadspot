import React, { useState, useCallback, useMemo } from 'react';
import { Network, List as ListIcon, Save, Play, MessageSquare, HelpCircle, MessageCircle, Globe, Plus, X, Settings2, Trash2 } from 'lucide-react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, Connection, Edge, NodeChange, EdgeChange } from 'reactflow';
import 'reactflow/dist/style.css';

// ✨ IMPORT YOUR CUSTOM NODES ✨
import { TriggerNode, MessageNode, QuestionNode } from './BotNodes';

// ✨ THE UNIFIED BRAIN TYPES ✨
export type BotNodeType = 'trigger' | 'message' | 'question' | 'condition';

export interface BotNode {
  id: string;
  type: BotNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    text: string;
    options?: string[]; // For quick-reply buttons
    expectedAction?: 'wait_for_text' | 'wait_for_button';
  };
}

// ✨ INITIAL CANVAS DATA ✨
const INITIAL_NODES: BotNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { label: 'Keyword: "Hi" or "Pricing"', text: '' },
  },
  {
    id: 'msg-1',
    type: 'message',
    position: { x: 250, y: 200 },
    data: { label: 'Welcome Message', text: 'Welcome to Leadspot Real Estate! How can we help you today?' },
  },
  {
    id: 'q-1',
    type: 'question',
    position: { x: 250, y: 380 },
    data: { 
      label: 'Ask Preference', 
      text: 'Are you looking to buy or rent?',
      options: ['Buy', 'Rent'] 
    },
  }
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'msg-1', animated: true },
  { id: 'e2-3', source: 'msg-1', target: 'q-1', animated: true },
];

export default function BotBuilder() {
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas');
  const [botChannel, setBotChannel] = useState<'whatsapp' | 'widget'>('whatsapp'); 
  
  const [nodes, setNodes] = useState<BotNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);

  // ✨ State to track which node is being edited in the sidebar
  const [selectedNode, setSelectedNode] = useState<BotNode | null>(null);

  // ✨ REGISTER THE CUSTOM NODES ✨
  const nodeTypes = useMemo(() => ({ 
    trigger: TriggerNode, 
    message: MessageNode,
    question: QuestionNode
  }), []);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as BotNode[]), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), []);

  // ✨ THE NODE INJECTOR ✨
  const handleAddNode = useCallback((type: BotNodeType) => {
    const newId = `${type}-${Date.now()}`;
    const newNode: BotNode = {
      id: newId,
      type,
      position: { x: 250 + Math.random() * 50, y: 250 + Math.random() * 50 },
      data: {
        label: type === 'message' ? 'New Message' : type === 'question' ? 'New Question' : 'Action',
        text: '',
        ...(type === 'question' ? { options: ['Yes', 'No'] } : {})
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode); // Automatically open the editor for the new node!
  }, []);

  // ✨ REAL-TIME NODE UPDATER ✨
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

  const handleUpdateOption = (index: number, value: string) => {
    if (!selectedNode?.data.options) return;
    const newOptions = [...selectedNode.data.options];
    newOptions[index] = value;
    updateSelectedNodeData('options', newOptions);
  };

  const handleAddOption = () => {
    if (!selectedNode?.data.options) return;
    const newOptions = [...selectedNode.data.options, 'New Option'];
    updateSelectedNodeData('options', newOptions);
  };

  const handleRemoveOption = (index: number) => {
    if (!selectedNode?.data.options) return;
    const newOptions = selectedNode.data.options.filter((_, i) => i !== index);
    updateSelectedNodeData('options', newOptions);
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
        
        {/* LEFT PANEL: Node Library (Only visible in Canvas Mode) */}
        {viewMode === 'canvas' && (
          <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm relative">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Node Library</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {/* Category: Communication */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Communication</h4>
                
                <button onClick={() => handleAddNode('message')} className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-[#25D366] hover:shadow-md hover:shadow-[#25D366]/10 rounded-xl transition-all group text-left">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-[#25D366]/10 group-hover:text-[#25D366] transition-colors"><MessageSquare className="w-5 h-5" /></div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">Send Message</h5>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Standard text, image, or document block.</p>
                  </div>
                </button>

                <button onClick={() => handleAddNode('question')} className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/10 rounded-xl transition-all group text-left">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-amber-500/10 group-hover:text-amber-600 transition-colors"><HelpCircle className="w-5 h-5" /></div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">Ask a Question</h5>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Wait for text input or quick-reply buttons.</p>
                  </div>
                </button>
              </div>

              {/* Category: Logic (Preview) */}
              <div className="space-y-3 opacity-60 pointer-events-none" title="Coming in Phase 2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Logic (Pro)</h4>
                <div className="w-full flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><Network className="w-5 h-5" /></div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-700">Condition Split</h5>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">Branch flow based on variables (If/Else).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CENTER PANEL: Main Workspace (React Flow or List) */}
        <div className="flex-1 relative h-full bg-slate-50/50">
          {viewMode === 'canvas' ? (
            <div className="absolute inset-0 w-full h-full">
              <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => setSelectedNode(node as BotNode)}
                onPaneClick={() => setSelectedNode(null)}
                fitView
                className="bg-transparent"
              >
                <Background color="#cbd5e1" gap={16} />
                <Controls />
              </ReactFlow>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-8">
              <div className="max-w-3xl mx-auto space-y-4 pb-20">
                {nodes.map((node, index) => (
                  <div key={node.id} onClick={() => setSelectedNode(node)} className={`bg-white p-6 rounded-2xl shadow-sm border flex items-start gap-4 transition-all relative group cursor-pointer ${selectedNode?.id === node.id ? 'border-indigo-400 shadow-md ring-4 ring-indigo-50' : 'border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
                    <div className="absolute -left-3 top-8 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold border-4 border-slate-50 shadow-sm">{index + 1}</div>
                    <div className={`p-3 rounded-xl shrink-0 ${node.type === 'trigger' ? 'bg-purple-100 text-purple-600' : node.type === 'question' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                      {node.type === 'trigger' ? <Play className="w-5 h-5" /> : node.type === 'question' ? <HelpCircle className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-sm font-bold text-slate-800">{node.data.label}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{node.type}</span>
                      </div>
                      <div className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 whitespace-pre-wrap">
                        {node.data.text || <span className="text-slate-400 italic">No message configured...</span>}
                      </div>
                      {node.data.options && node.data.options.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {node.data.options.map((opt, i) => (
                            <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg">{opt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* List View Quick Add Actions */}
                <div className="flex gap-4 pt-4">
                  <button onClick={() => handleAddNode('message')} className="flex-1 py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-50 hover:border-[#25D366] hover:text-[#25D366] transition-all flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Add Message
                  </button>
                  <button onClick={() => handleAddNode('question')} className="flex-1 py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-50 hover:border-amber-500 hover:text-amber-600 transition-all flex items-center justify-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Add Question
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Property Inspector */}
        {selectedNode && (
          <div className="w-[380px] bg-white/90 backdrop-blur-2xl border-l border-slate-200 shadow-2xl flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300 z-20 relative">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Settings2 className="w-4 h-4" /></div>
                <h3 className="font-bold text-slate-800">Edit Node</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Internal Node ID */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Node ID</label>
                <code className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">{selectedNode.id}</code>
              </div>

              {/* Block Label */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Step Name (Internal)</label>
                <input 
                  type="text" 
                  value={selectedNode.data.label}
                  onChange={(e) => updateSelectedNodeData('label', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all"
                />
              </div>

              {/* Main Message Text */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Message Content</label>
                  <span className="text-[9px] text-slate-400 font-bold">Use {'{{name}}'}</span>
                </div>
                <textarea 
                  rows={5}
                  value={selectedNode.data.text}
                  onChange={(e) => updateSelectedNodeData('text', e.target.value)}
                  placeholder="Enter the message text the bot will send..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all resize-y"
                />
              </div>

              {/* Dynamic Quick Replies (Question Nodes Only) */}
              {selectedNode.type === 'question' && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Quick Reply Buttons</label>
                  <div className="space-y-3">
                    {selectedNode.data.options?.map((opt, index) => (
                      <div key={index} className="flex items-center gap-2 group animate-in slide-in-from-left-2 duration-200">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            value={opt}
                            onChange={(e) => handleUpdateOption(index, e.target.value)}
                            className="w-full pl-4 pr-10 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/30 outline-none text-sm font-bold text-amber-900 transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-300 pointer-events-none">{index + 1}</span>
                        </div>
                        <button onClick={() => handleRemoveOption(index)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors shadow-sm shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button onClick={handleAddOption} disabled={(selectedNode.data.options?.length || 0) >= 3} className="w-full py-2.5 border border-dashed border-amber-300 rounded-xl text-amber-600 font-bold text-xs hover:bg-amber-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:bg-transparent">
                      <Plus className="w-3.5 h-3.5" /> Add Button (Max 3)
                    </button>
                    <p className="text-[10px] font-medium text-slate-400 leading-relaxed mt-2">
                      WhatsApp limits quick replies to 3 buttons per message. For Website Widgets, up to 5 are supported.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Delete Node Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
              <button onClick={() => {
                setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNode(null);
              }} className="w-full py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-red-100 flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete this step
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}