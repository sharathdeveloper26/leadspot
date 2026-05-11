import React, { useState, useCallback, useMemo } from 'react';
import { Network, List as ListIcon, Save, Play, MessageSquare, HelpCircle, MessageCircle, Globe, Plus } from 'lucide-react';
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
  const [botChannel, setBotChannel] = useState<'whatsapp' | 'widget'>('whatsapp'); // ✨ OMNICHANNEL TOGGLE
  
  const [nodes, setNodes] = useState<BotNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);

  // ✨ REGISTER THE CUSTOM NODES ✨
  const nodeTypes = useMemo(() => ({ 
    trigger: TriggerNode, 
    message: MessageNode,
    question: QuestionNode
  }), []);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as BotNode[]), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), []);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative w-full overflow-hidden">
      {/* ✨ HEADER & TOGGLE ✨ */}
      <div className="flex items-center justify-between p-6 bg-white border-b border-slate-200 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-extrabold text-slate-800">Flow Builder</h2>
            {/* Channel Indicator Badge */}
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${botChannel === 'whatsapp' ? 'bg-[#25D366]/10 text-[#1a9347] border-[#25D366]/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
              {botChannel === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {botChannel === 'whatsapp' ? 'WhatsApp Bot' : 'Website Widget'}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Design your automated real estate assistant.</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* ✨ Omnichannel Switcher ✨ */}
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

      {/* ✨ DUAL WORKSPACE ✨ */}
      <div className="flex-1 relative w-full h-full">
        {viewMode === 'canvas' ? (
          <div className="absolute inset-0 w-full h-full">
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              className="bg-slate-50"
            >
              <Background color="#cbd5e1" gap={16} />
              <Controls />
            </ReactFlow>
            
            {/* Floating Tool Palette */}
            <div className="absolute top-6 left-6 bg-white p-2 rounded-2xl shadow-xl border border-slate-200 flex flex-col gap-2 z-10">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30 cursor-pointer transition-all flex flex-col items-center gap-1 text-slate-500" title="Send Message">
                <MessageSquare className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Msg</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 cursor-pointer transition-all flex flex-col items-center gap-1 text-slate-500" title="Ask Question">
                <HelpCircle className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Ask</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-3xl mx-auto space-y-4 pb-20">
              {nodes.map((node, index) => (
                <div key={node.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start gap-4 hover:shadow-md transition-shadow relative group">
                  <div className="absolute -left-3 top-8 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold border-4 border-slate-50 shadow-sm">{index + 1}</div>
                  <div className={`p-3 rounded-xl shrink-0 ${node.type === 'trigger' ? 'bg-purple-100 text-purple-600' : node.type === 'question' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    {node.type === 'trigger' ? <Play className="w-5 h-5" /> : node.type === 'question' ? <HelpCircle className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 mb-1">{node.data.label}</h4>
                    <input 
                      type="text" 
                      defaultValue={node.data.text} 
                      placeholder="Type your message here..."
                      className="w-full mt-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#25D366]/30 outline-none"
                    />
                    {node.data.options && (
                      <div className="flex gap-2 mt-3">
                        {node.data.options.map((opt, i) => (
                          <span key={i} className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg">{opt}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-bold text-sm hover:bg-slate-50 hover:border-[#25D366] hover:text-[#25D366] transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Next Step
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}