import React, { useState, useRef, useCallback, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Network, List as ListIcon, Save, Play, MessageSquare, 
  MousePointerClick, GitBranch, Webhook, HeadphonesIcon, 
  PlusCircle, Zap, User, Phone, Mail, Settings2, X, Trash2, 
  CheckCheck, Send, MessageCircle, Smartphone, GripVertical,
  AlertCircle, CheckCircle2, LayoutGrid, Paperclip, 
  Image as ImageIcon, Video, Link2, FileText
} from 'lucide-react';
import ReactFlow, { 
  ReactFlowProvider, Background, Controls, applyNodeChanges, 
  applyEdgeChanges, addEdge, Connection, Edge, NodeChange, 
  EdgeChange, useReactFlow, Node 
} from 'reactflow';
import 'reactflow/dist/style.css';

import { 
  TriggerNode, MessageNode, ButtonNode, ListNode, CarouselNode, WaFormNode,
  CaptureNameNode, CapturePhoneNode, CaptureEmailNode, ConditionNode, 
  ApiRequestNode, HandoverNode 
} from './BotNodes';

const nodeTypes = {
  trigger: TriggerNode, message: MessageNode, button: ButtonNode, 
  list: ListNode, carousel: CarouselNode, waForm: WaFormNode, // ✨ NEW FORM NODE
  captureName: CaptureNameNode, capturePhone: CapturePhoneNode, 
  captureEmail: CaptureEmailNode, condition: ConditionNode, 
  apiRequest: ApiRequestNode, handover: HandoverNode,
};

const INITIAL_NODES: Node[] = [
  { id: 'node_trigger', type: 'trigger', position: { x: 300, y: 100 }, data: { label: 'Start', message: 'Hi' } },
  { id: 'node_welcome', type: 'message', position: { x: 300, y: 300 }, data: { label: 'Welcome Msg', message: 'Welcome to Leadspot! How can we help you today?', mediaType: 'none' } }
];
const INITIAL_EDGES: Edge[] = [
  { id: 'e_trigger_welcome', source: 'node_trigger', target: 'node_welcome', animated: true, style: { stroke: '#25D366', strokeWidth: 2 } }
];

let id = 1;
const getId = () => `wa_node_${Date.now()}_${id++}`;

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  time: Date;
  buttons?: string[];
  listMenu?: { title: string, items: string[] };
  carousel?: { title: string, subtitle: string, button: string, image?: string }[];
  waForm?: { title: string, button: string, fields: any[] }; // ✨ NEW SIMULATOR RENDER TYPE
  media?: 'image' | 'video' | 'document';
  sourceNodeId?: string;
}

function WhatsAppBuilderFlow() {
  const { user } = useAuth();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { project, fitView } = useReactFlow();

  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [dialog, setDialog] = useState<{isOpen: boolean, type: 'success' | 'error', title: string, message: string} | null>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [activeListMenu, setActiveListMenu] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedFlow = async () => {
      if (!user?.clientId) return;
      try {
        const flowDocRef = doc(db, 'whatsapp_flows', user.clientId);
        const flowSnap = await getDoc(flowDocRef);
        
        if (flowSnap.exists() && flowSnap.data().nodes && flowSnap.data().nodes.length > 0) {
          setNodes(flowSnap.data().nodes);
          setEdges(flowSnap.data().edges || []);
        } else {
          setNodes(INITIAL_NODES); setEdges(INITIAL_EDGES);
        }
      } catch (error) {
        setNodes(INITIAL_NODES); setEdges(INITIAL_EDGES);
      } finally {
        setIsCanvasLoading(false); setTimeout(() => fitView({ duration: 800 }), 100);
      }
    };
    loadSavedFlow();
  }, [user?.clientId, fitView]);


  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection | Edge) => { setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }, eds)); }, []);
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => setSelectedNode(selectedNodes.length > 0 ? selectedNodes[0] : null), []);
  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = reactFlowWrapper.current
      ? project({ x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left, y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top })
      : { x: 0, y: 0 };

    let defaultData: any = { label: 'New Step', message: '' };
    if (type === 'message') defaultData = { ...defaultData, mediaType: 'none', mediaUrl: '' };
    if (type === 'button') defaultData = { ...defaultData, label: 'Ask Question', buttons: ['Option 1'] };
    if (type === 'list') defaultData = { ...defaultData, label: 'Selection List', message: 'Please select an option:', menuTitle: 'View Options', listItems: ['Item 1', 'Item 2'] };
    if (type === 'carousel') defaultData = { ...defaultData, label: 'Product Carousel', cards: [{ title: 'Product 1', subtitle: 'Desc 1', button: 'View' }] };
    
    // ✨ WA FORM DEFAULT DATA
    if (type === 'waForm') defaultData = { ...defaultData, label: 'Native Form', formTitle: 'Client Registration', message: 'Please fill out your details:', buttonText: 'Open Form', fields: [{ name: 'Full Name', type: 'text', required: true }] };

    if (type === 'condition') defaultData = { ...defaultData, label: 'Split Logic', variable: 'Lead.Source', operator: '==', value: 'Facebook' };
    if (type === 'apiRequest') defaultData = { ...defaultData, label: 'Fetch Data', method: 'GET', url: 'https://api.example.com', waitForResponse: true };
    if (type === 'handover') defaultData = { ...defaultData, label: 'Human Transfer', department: 'Sales Team' };

    const newNode: Node = { id: getId(), type, position, data: defaultData };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
  }, [project, setNodes]);

  const updateSelectedNodeData = (field: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNode.id) {
        const updatedNode = { ...node, data: { ...node.data, [field]: value } };
        setSelectedNode(updatedNode); return updatedNode;
      } return node;
    }));
  };

  const handlePublish = async () => {
    if (!user?.clientId) return;
    setIsPublishing(true);
    try {
      await setDoc(doc(db, 'whatsapp_flows', user.clientId), { clientId: user.clientId, nodes: nodes, edges: edges, updatedAt: serverTimestamp() }, { merge: true });
      setDialog({ isOpen: true, type: 'success', title: 'Flow Published Successfully', message: 'Your automation sequence has been saved and is now active on the Meta WhatsApp Cloud API.' });
    } catch (error) {
      setDialog({ isOpen: true, type: 'error', title: 'Publish Failed', message: 'Failed to save the flow. Please check your internet connection.' });
    } finally { setIsPublishing(false); }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isSimulatorOpen, activeListMenu]);

  const processBotResponse = (sourceNodeId: string, handleId?: string) => {
    setTimeout(() => {
      const connectingEdge = edges.find(e => e.source === sourceNodeId && (!handleId || e.sourceHandle === handleId));
      if (!connectingEdge) return;
      const targetNode = nodes.find(n => n.id === connectingEdge.target);
      if (!targetNode) return;

      let botResponse: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(),
        text: targetNode.data.message || `[${targetNode.type} Node]`,
        sender: 'bot',
        time: new Date(),
        sourceNodeId: targetNode.id
      };

      if (targetNode.type === 'message' && targetNode.data.mediaType && targetNode.data.mediaType !== 'none') {
        botResponse.media = targetNode.data.mediaType;
      } else if (targetNode.type === 'button') {
        botResponse.buttons = targetNode.data.buttons;
        botResponse.text = targetNode.data.message || 'Please select an option:';
      } else if (targetNode.type === 'list') {
        botResponse.listMenu = { title: targetNode.data.menuTitle || 'View Options', items: targetNode.data.listItems || [] };
        botResponse.text = targetNode.data.message || 'Please select from the menu:';
      } else if (targetNode.type === 'carousel') {
        botResponse.carousel = targetNode.data.cards || [];
        botResponse.text = ''; 
      } else if (targetNode.type === 'waForm') {
        // ✨ SIMULATOR: BIND WA FORM DATA
        botResponse.waForm = { title: targetNode.data.formTitle || 'Form', button: targetNode.data.buttonText || 'Open Form', fields: targetNode.data.fields || [] };
        botResponse.text = targetNode.data.message || 'Please fill out the form below:';
      } else if (targetNode.type === 'captureName') { botResponse.text = targetNode.data.message || 'Please enter your name:';
      } else if (targetNode.type === 'capturePhone') { botResponse.text = targetNode.data.message || 'Please enter your phone number:';
      } else if (targetNode.type === 'captureEmail') { botResponse.text = targetNode.data.message || 'Please enter your email:'; }

      setChatHistory(prev => [...prev, botResponse]);

      if (targetNode.type === 'message') {
        processBotResponse(targetNode.id); 
      }
    }, 600); 
  };

  const handleSimulateSend = (e?: React.FormEvent, textOverride?: string, skipProcessing: boolean = false) => {
    if (e) e.preventDefault();
    const textToSend = textOverride || simInput;
    if (!textToSend.trim()) return;

    setChatHistory(prev => [...prev, { id: Date.now().toString(), text: textToSend, sender: 'user', time: new Date() }]);
    setSimInput('');
    setActiveListMenu(null); 

    if (skipProcessing) return; 

    if (chatHistory.length === 0) {
      const triggerNode = nodes.find(n => n.type === 'trigger');
      const triggerKeyword = triggerNode?.data.message?.toLowerCase().replace(/['"]/g, '') || 'hi';
      if (triggerNode && textToSend.toLowerCase().includes(triggerKeyword)) { processBotResponse(triggerNode.id); } 
      else { setTimeout(() => { setChatHistory(prev => [...prev, { id: Date.now().toString(), text: `I only respond to the trigger keyword right now. Try typing "${triggerKeyword}".`, sender: 'bot', time: new Date() }]); }, 500); }
    } else {
      const lastBotMsg = [...chatHistory].reverse().find(m => m.sender === 'bot');
      if (lastBotMsg?.sourceNodeId) {
        const lastNode = nodes.find(n => n.id === lastBotMsg.sourceNodeId);
        // Let Forms process naturally on submission
        if (lastNode && lastNode.type && ['captureName', 'capturePhone', 'captureEmail', 'waForm'].includes(lastNode.type)) { 
          processBotResponse(lastNode.id); 
        }
      }
    }
  };

  const handleSimulateButtonClick = (btnText: string, btnIndex: number, sourceNodeId?: string) => {
    handleSimulateSend(undefined, btnText, true); 
    if (sourceNodeId) {
      processBotResponse(sourceNodeId, `btn-${btnIndex}`);
    }
  };

  const DraggableNode = ({ type, label, description, icon: Icon, color }: any) => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => { event.dataTransfer.setData('application/reactflow', nodeType); event.dataTransfer.effectAllowed = 'move'; };
    return (
      <div onDragStart={(event) => onDragStart(event, type)} draggable className={`w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-${color}-500 hover:shadow-md hover:shadow-${color}-500/10 rounded-xl transition-all cursor-grab group text-left`}>
        <div className={`p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:bg-${color}-50 group-hover:text-${color}-600 transition-colors`}><Icon className="w-5 h-5" /></div>
        <div><h5 className="text-sm font-bold text-slate-800">{label}</h5><p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{description}</p></div>
      </div>
    );
  };

  if (isCanvasLoading) return (<div className="flex flex-col items-center justify-center h-full bg-[#f8fafc] w-full"><div className="w-10 h-10 border-4 border-slate-200 border-t-[#25D366] rounded-full animate-spin mb-4" /><p className="text-sm font-bold text-slate-500 animate-pulse">Loading Workspace Flow...</p></div>);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] relative w-full overflow-hidden border border-slate-200 rounded-tl-xl">
      
      {dialog?.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 shadow-inner ${dialog.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                 {dialog.type === 'error' ? <AlertCircle className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{dialog.title}</h3>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{dialog.message}</p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setDialog(null)} className={`w-full py-3 text-white rounded-xl hover:opacity-90 transition-all font-bold text-sm shadow-lg ${dialog.type === 'error' ? 'bg-red-600 shadow-red-500/30' : 'bg-slate-900 shadow-slate-900/20'}`}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOOLBAR */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
        <div className="flex items-center bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/60 pointer-events-auto">
          <button onClick={() => { setViewMode('canvas'); setTimeout(() => fitView({ duration: 800 }), 100); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'canvas' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}><Network className="w-4 h-4" /> Canvas</button>
          <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}><ListIcon className="w-4 h-4" /> List</button>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button onClick={() => { setIsSimulatorOpen(!isSimulatorOpen); setChatHistory([]); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-lg border ${isSimulatorOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/90 backdrop-blur-md text-slate-700 hover:bg-white border-slate-200/60'}`}><Smartphone className="w-4 h-4" /> {isSimulatorOpen ? 'Close Simulator' : 'Test Bot'}</button>
          <button onClick={handlePublish} disabled={isPublishing} className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] text-white hover:bg-[#1EBE57] rounded-2xl text-sm font-bold shadow-lg shadow-[#25D366]/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none border border-[#1DA851]">{isPublishing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />} Publish Flow</button>
        </div>
      </div>

      <div className="flex-1 relative w-full h-full flex overflow-hidden">
        
        {/* PANE 1: NODE LIBRARY */}
        {viewMode === 'canvas' && (
          <aside className="w-[300px] bg-white/90 backdrop-blur-xl border-r border-slate-200/60 flex flex-col shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative">
            <div className="pt-20 pb-4 px-6 border-b border-slate-100/60"><h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Node Library</h3></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Messaging</h4>
                <DraggableNode type="message" label="Send Message" description="Text, Image, PDF, or Video." icon={MessageSquare} color="indigo" />
                <DraggableNode type="button" label="Interactive Buttons" description="Max 3 quick-reply buttons." icon={MousePointerClick} color="blue" />
                <DraggableNode type="list" label="List Menu" description="Native iOS/Android dropdown (Max 10)." icon={ListIcon} color="sky" />
                <DraggableNode type="carousel" label="Product Carousel" description="Horizontal scrolling rich cards." icon={LayoutGrid} color="pink" />
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">CRM Sync</h4>
                <DraggableNode type="waForm" label="Native WA Form" description="In-app forms (Flows)." icon={FileText} color="violet" />
                <DraggableNode type="captureName" label="Ask Name" description="Saves to Lead Profile." icon={User} color="emerald" />
                <DraggableNode type="capturePhone" label="Ask Phone" description="Validates WA numbers." icon={Phone} color="amber" />
                <DraggableNode type="captureEmail" label="Ask Email" description="Validates email format." icon={Mail} color="rose" />
              </div>
              <div className="space-y-3"><h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 flex items-center gap-2">Logic (Pro) <Zap className="w-3 h-3 text-amber-500"/></h4><DraggableNode type="condition" label="Condition Split" description="Branch flow based on variables." icon={GitBranch} color="purple" /><DraggableNode type="apiRequest" label="API Webhook" description="GET/POST to external servers." icon={Webhook} color="cyan" /><DraggableNode type="handover" label="Agent Transfer" description="Alert human team." icon={HeadphonesIcon} color="slate" /></div>
            </div>
          </aside>
        )}

        {/* PANE 2: CANVAS */}
        <main className="flex-1 relative h-full" ref={reactFlowWrapper}>
          {viewMode === 'canvas' ? (
            <ReactFlow 
              nodes={nodes} edges={edges} nodeTypes={nodeTypes} 
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
              onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver} 
              onSelectionChange={onSelectionChange} 
              fitView fitViewOptions={{ padding: 0.2 }}
              className="bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"
            >
              <Background color="#cbd5e1" gap={24} size={1.5} />
              <Controls className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm rounded-xl overflow-hidden mb-4 ml-4" showInteractive={false} />
            </ReactFlow>
         ) : (
            <div className="w-full h-full bg-[#f8fafc] overflow-y-auto custom-scrollbar p-8 pt-24">
              <div className="max-w-2xl mx-auto space-y-4 pb-12">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black text-slate-800">Sequential Flow View</h2>
                  <p className="text-sm font-medium text-slate-500">Your automation steps arranged visually by Y-axis position.</p>
                </div>
                
               {[...nodes].sort((a, b) => a.position.y - b.position.y).map((node) => {
                  let NodeIcon = MessageSquare; let colorTheme = 'indigo';
                  if (node.type === 'trigger') { NodeIcon = Play; colorTheme = 'emerald'; }
                  else if (node.type === 'button') { NodeIcon = MousePointerClick; colorTheme = 'blue'; }
                  else if (node.type === 'list') { NodeIcon = ListIcon; colorTheme = 'sky'; }
                  else if (node.type === 'carousel') { NodeIcon = LayoutGrid; colorTheme = 'pink'; }
                  else if (node.type === 'waForm') { NodeIcon = FileText; colorTheme = 'violet'; }
                  else if (['captureName', 'capturePhone', 'captureEmail'].includes(node.type || '')) { NodeIcon = User; colorTheme = 'amber'; }
                  else if (node.type === 'condition') { NodeIcon = GitBranch; colorTheme = 'purple'; }
                  else if (node.type === 'apiRequest') { NodeIcon = Webhook; colorTheme = 'cyan'; }
                  else if (node.type === 'handover') { NodeIcon = HeadphonesIcon; colorTheme = 'slate'; }

                  return (
                    <div key={node.id} onClick={() => { setSelectedNode(node); setViewMode('canvas'); }} className={`bg-white rounded-2xl p-5 flex items-start gap-4 border shadow-sm transition-all cursor-pointer group ${selectedNode?.id === node.id ? `border-${colorTheme}-500 ring-4 ring-${colorTheme}-50` : `border-slate-200 hover:border-${colorTheme}-300 hover:shadow-md`}`}>
                      <div className="mt-1 flex items-center justify-center text-slate-300 group-hover:text-slate-400"><GripVertical className="w-5 h-5"/></div>
                      <div className={`p-3 rounded-xl shrink-0 bg-${colorTheme}-50 text-${colorTheme}-600`}><NodeIcon className="w-5 h-5"/></div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-bold text-slate-800">{node.data.label || 'Configuration Step'}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100 px-2 py-1 rounded-md`}>{node.type}</span>
                        </div>
                        
                        {node.data.message && (
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm font-medium text-slate-600 mt-2 whitespace-pre-wrap">
                            {node.data.message}
                          </div>
                        )}

                        {node.type === 'button' && node.data.buttons && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {node.data.buttons.map((b: string, i: number) => <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">{b}</span>)}
                          </div>
                        )}
                        
                        {node.type === 'waForm' && node.data.fields && (
                          <div className="mt-3 p-3 bg-violet-50/50 border border-violet-100 rounded-xl">
                            <div className="text-xs font-bold text-violet-800 mb-2 border-b border-violet-100 pb-1">Form: {node.data.formTitle}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {node.data.fields.map((f: any, i: number) => <span key={i} className="px-2 py-1 bg-white text-slate-600 text-[10px] font-bold rounded shadow-sm border border-slate-200">{f.name} {f.required && <span className="text-red-400">*</span>}</span>)}
                            </div>
                          </div>
                        )}

                        {node.type === 'list' && node.data.listItems && (
                          <div className="mt-3 space-y-1.5">
                            <div className="text-xs font-bold text-sky-700 bg-sky-50 inline-block px-3 py-1 rounded border border-sky-100">Menu: {node.data.menuTitle}</div>
                            <div className="text-xs font-medium text-slate-500 pl-1">{node.data.listItems.length} options configured.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* PANE 3: PROPERTIES PANEL */}
        {selectedNode && !isSimulatorOpen && (
          <aside className="w-[380px] bg-white/95 backdrop-blur-2xl border-l border-slate-200/60 shadow-2xl flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200 z-20 relative">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 pt-20">
              <div className="flex items-center gap-2"><div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Settings2 className="w-4 h-4" /></div><h3 className="font-bold text-slate-800">Node Configuration</h3></div>
              <button onClick={() => setSelectedNode(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {selectedNode.type === 'trigger' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Trigger Keywords</label>
                  <input type="text" value={selectedNode.data.message || ''} onChange={(e) => updateSelectedNodeData('message', e.target.value)} placeholder='e.g. "Hi"' className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#25D366]/30 outline-none text-sm font-medium shadow-sm transition-all" />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Type this exact word in the simulator to start the flow.</p>
                </div>
              ) : (
                <>
                  <div><label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Internal Label</label><input type="text" value={selectedNode.data.label || ''} onChange={(e) => updateSelectedNodeData('label', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all" /></div>
                  
                  {selectedNode.type === 'message' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Media Attachment</label>
                        <select value={selectedNode.data.mediaType || 'none'} onChange={(e) => updateSelectedNodeData('mediaType', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-bold shadow-sm transition-all cursor-pointer">
                          <option value="none">No Media (Text Only)</option>
                          <option value="image">Image (.jpg, .png)</option>
                          <option value="document">Document (.pdf)</option>
                          <option value="video">Video (.mp4)</option>
                        </select>
                      </div>
                      
                      {selectedNode.data.mediaType && selectedNode.data.mediaType !== 'none' && (
                        <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 transition-colors">
                          <Link2 className="w-6 h-6 text-indigo-400 mb-2" />
                          <span className="text-sm font-bold text-indigo-600">Click to upload {selectedNode.data.mediaType}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {['message', 'captureName', 'capturePhone', 'captureEmail', 'button', 'list', 'waForm'].includes(selectedNode.type!) && (
                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">{selectedNode.type === 'waForm' ? 'Form Intro Message' : 'WhatsApp Body Text'}</label><textarea rows={4} value={selectedNode.data.message || ''} onChange={(e) => updateSelectedNodeData('message', e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm transition-all resize-y" /></div>
                  )}

                  {/* ✨ NATIVE FORM CONFIG ✨ */}
                  {selectedNode.type === 'waForm' && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Form Header Title</label>
                        <input type="text" value={selectedNode.data.formTitle || ''} onChange={(e) => updateSelectedNodeData('formTitle', e.target.value)} placeholder="e.g. Schedule Site Visit" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/30 outline-none text-sm font-bold shadow-sm transition-all" maxLength={30}/>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Button Text</label>
                        <input type="text" value={selectedNode.data.buttonText || ''} onChange={(e) => updateSelectedNodeData('buttonText', e.target.value)} placeholder="e.g. Open Form" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/30 outline-none text-sm font-bold shadow-sm transition-all" maxLength={20}/>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-3"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Input Fields</label></div>
                        <div className="space-y-3">
                          {(selectedNode.data.fields || []).map((field: any, index: number) => (
                            <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                              <button onClick={() => { const newF = selectedNode.data.fields.filter((_: any, i: number) => i !== index); updateSelectedNodeData('fields', newF); }} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                              
                              <div className="pr-6">
                                <input type="text" placeholder="Field Name (e.g. Email)" value={field.name || ''} onChange={(e) => { const newF = [...selectedNode.data.fields]; newF[index].name = e.target.value; updateSelectedNodeData('fields', newF); }} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold text-slate-800 mb-2" />
                                <div className="flex gap-2">
                                  <select value={field.type || 'text'} onChange={(e) => { const newF = [...selectedNode.data.fields]; newF[index].type = e.target.value; updateSelectedNodeData('fields', newF); }} className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-[10px] font-bold text-slate-600 cursor-pointer">
                                    <option value="text">Short Text</option><option value="email">Email</option><option value="number">Number</option><option value="dropdown">Dropdown</option>
                                  </select>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-lg cursor-pointer">
                                    <input type="checkbox" checked={field.required || false} onChange={(e) => { const newF = [...selectedNode.data.fields]; newF[index].required = e.target.checked; updateSelectedNodeData('fields', newF); }} className="rounded-sm border-slate-300 text-violet-500 focus:ring-violet-500 w-3 h-3"/> Req.
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => { const newF = [...(selectedNode.data.fields || []), { name: 'New Field', type: 'text', required: true }]; updateSelectedNodeData('fields', newF); }} className="w-full py-2.5 border border-dashed border-violet-300 rounded-xl text-violet-600 font-bold text-xs hover:bg-violet-50 transition-all flex items-center justify-center gap-2"><PlusCircle className="w-3.5 h-3.5" /> Add Form Field</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'button' && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Quick Replies</label><span className="text-[10px] font-bold bg-[#25D366]/10 text-[#1a9347] px-2 py-0.5 rounded border border-[#25D366]/20">Max 3 Buttons</span></div>
                      <div className="space-y-3">
                        {(selectedNode.data.buttons || []).map((btn: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="flex-1 relative"><input type="text" value={btn} onChange={(e) => { const newBtns = [...selectedNode.data.buttons]; newBtns[index] = e.target.value; updateSelectedNodeData('buttons', newBtns); }} className="w-full pl-4 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 outline-none text-sm font-bold text-slate-800 transition-all" maxLength={20}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">{index + 1}</span></div>
                            <button onClick={() => { const newBtns = selectedNode.data.buttons.filter((_: any, i: number) => i !== index); updateSelectedNodeData('buttons', newBtns); }} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shadow-sm shrink-0 border border-transparent hover:border-red-100"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                        {(selectedNode.data.buttons?.length || 0) < 3 && (
                          <button onClick={() => { const newBtns = [...(selectedNode.data.buttons || []), `Option ${(selectedNode.data.buttons?.length || 0) + 1}`]; updateSelectedNodeData('buttons', newBtns); }} className="w-full py-2.5 border border-dashed border-blue-300 rounded-xl text-blue-600 font-bold text-xs hover:bg-blue-50 transition-all flex items-center justify-center gap-2"><PlusCircle className="w-3.5 h-3.5" /> Add WhatsApp Button</button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'list' && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="mb-4">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Menu Call-to-Action Text</label>
                        <input type="text" value={selectedNode.data.menuTitle || ''} onChange={(e) => updateSelectedNodeData('menuTitle', e.target.value)} placeholder="e.g. View Options" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/30 outline-none text-sm font-bold shadow-sm transition-all" maxLength={20}/>
                      </div>
                      <div className="flex items-center justify-between mb-3"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Dropdown List Items</label><span className="text-[10px] font-bold bg-sky-100 text-sky-600 px-2 py-0.5 rounded border border-sky-200">Max 10 Items</span></div>
                      <div className="space-y-3">
                        {(selectedNode.data.listItems || []).map((item: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="flex-1 relative"><input type="text" value={item} onChange={(e) => { const newItems = [...selectedNode.data.listItems]; newItems[index] = e.target.value; updateSelectedNodeData('listItems', newItems); }} className="w-full pl-4 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/30 outline-none text-sm font-bold text-slate-800 transition-all" maxLength={24}/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">{index + 1}</span></div>
                            <button onClick={() => { const newItems = selectedNode.data.listItems.filter((_: any, i: number) => i !== index); updateSelectedNodeData('listItems', newItems); }} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shadow-sm shrink-0 border border-transparent hover:border-red-100"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                        {(selectedNode.data.listItems?.length || 0) < 10 && (
                          <button onClick={() => { const newItems = [...(selectedNode.data.listItems || []), `Item ${(selectedNode.data.listItems?.length || 0) + 1}`]; updateSelectedNodeData('listItems', newItems); }} className="w-full py-2.5 border border-dashed border-sky-300 rounded-xl text-sky-600 font-bold text-xs hover:bg-sky-50 transition-all flex items-center justify-center gap-2"><PlusCircle className="w-3.5 h-3.5" /> Add List Item</button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNode.type === 'carousel' && (
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-4"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Product Cards</label><span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-2 py-0.5 rounded border border-pink-200">Max 10 Cards</span></div>
                      <div className="space-y-4">
                        {(selectedNode.data.cards || []).map((card: any, index: number) => (
                          <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                            <div className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-md border-2 border-white">{index + 1}</div>
                            <button onClick={() => { const newCards = selectedNode.data.cards.filter((_: any, i: number) => i !== index); updateSelectedNodeData('cards', newCards); }} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                            
                            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Image URL</label><input type="text" placeholder="https://" value={card.image || ''} onChange={(e) => { const newCards = [...selectedNode.data.cards]; newCards[index].image = e.target.value; updateSelectedNodeData('cards', newCards); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs font-medium" /></div>
                            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Card Title</label><input type="text" value={card.title || ''} onChange={(e) => { const newCards = [...selectedNode.data.cards]; newCards[index].title = e.target.value; updateSelectedNodeData('cards', newCards); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold text-slate-800" maxLength={20}/></div>
                            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Subtitle</label><input type="text" value={card.subtitle || ''} onChange={(e) => { const newCards = [...selectedNode.data.cards]; newCards[index].subtitle = e.target.value; updateSelectedNodeData('cards', newCards); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs font-medium" /></div>
                            <div><label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Button Action</label><input type="text" value={card.button || ''} onChange={(e) => { const newCards = [...selectedNode.data.cards]; newCards[index].button = e.target.value; updateSelectedNodeData('cards', newCards); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold text-[#0ea5e9]" /></div>
                          </div>
                        ))}
                        {(selectedNode.data.cards?.length || 0) < 10 && (
                          <button onClick={() => { const newCards = [...(selectedNode.data.cards || []), { title: `Product ${(selectedNode.data.cards?.length || 0) + 1}`, subtitle: 'Description', button: 'View' }]; updateSelectedNodeData('cards', newCards); }} className="w-full py-2.5 border border-dashed border-pink-300 rounded-xl text-pink-600 font-bold text-xs hover:bg-pink-50 transition-all flex items-center justify-center gap-2"><PlusCircle className="w-3.5 h-3.5" /> Add Another Card</button>
                        )}
                      </div>
                    </div>
                  )}

                </>
              )}

              <div className="pt-8 border-t border-slate-100">
                <button onClick={() => { setNodes(nds => nds.filter(n => n.id !== selectedNode.id)); setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id)); setSelectedNode(null); }} className="w-full py-2.5 bg-red-50 text-red-600 font-bold text-sm rounded-xl hover:bg-red-100 transition-colors flex justify-center items-center gap-2"><Trash2 className="w-4 h-4"/> Delete Step</button>
              </div>
            </div>
          </aside>
        )}

        {/* PANE 4: LIVE TRAVERSAL SIMULATOR */}
        {isSimulatorOpen && (
          <aside className="w-[380px] bg-slate-100 border-l border-slate-200/60 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-300 z-30 relative shadow-2xl">
            <div className="px-6 py-4 bg-[#075e54] text-white flex justify-between items-center shadow-md z-10 mt-20 sm:mt-0">
              <div className="flex items-center gap-3"><div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center"><MessageCircle className="w-5 h-5 text-white"/></div><div><h3 className="text-sm font-bold leading-tight">Live Preview</h3><p className="text-[10px] text-white/70">online</p></div></div>
              <button onClick={() => setIsSimulatorOpen(false)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 p-4 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center overflow-y-auto space-y-4 custom-scrollbar flex flex-col relative">
              <div className="bg-white/90 text-slate-800 text-xs font-bold p-2.5 rounded-xl mx-auto w-fit shadow-sm my-2">Today</div>
              
              {chatHistory.length === 0 && (
                <div className="bg-white/80 backdrop-blur p-4 rounded-xl text-center shadow-sm text-sm font-medium text-slate-600 mt-4 mx-4">
                  Type "{nodes.find(n=>n.type==='trigger')?.data.message || 'Hi'}" below to start.
                </div>
              )}

              {chatHistory.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                  
                  {/* ✨ CAROUSEL RENDERER ✨ */}
                  {msg.carousel ? (
                     <div className="w-full max-w-[95%] overflow-x-auto flex gap-3 pb-4 pt-2 custom-scrollbar snap-x">
                        {msg.carousel.map((card, idx) => (
                          <div key={idx} className="w-48 bg-white rounded-2xl shadow-md border border-slate-100 flex flex-col overflow-hidden shrink-0 snap-center">
                            <div className="h-32 bg-slate-100 relative">
                              {card.image ? <img src={card.image} alt={card.title} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-8 h-8 text-slate-300"/></div>}
                            </div>
                            <div className="p-3">
                              <h4 className="font-bold text-sm text-slate-800 truncate">{card.title || 'Product Title'}</h4>
                              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{card.subtitle || 'Description'}</p>
                            </div>
                            <button onClick={() => handleSimulateSend(undefined, card.button || 'View', true)} className="py-2.5 border-t border-slate-100 text-[#0ea5e9] text-sm font-bold hover:bg-slate-50 transition-colors w-full text-center">
                              {card.button || 'View'}
                            </button>
                          </div>
                        ))}
                     </div>
                  ) : (
                    // STANDARD BUBBLE RENDERER
                    <div className="max-w-[85%] flex flex-col">
                      <div className={`p-1.5 text-sm shadow-sm relative ${msg.sender === 'user' ? 'bg-[#dcf8c6] text-slate-800 rounded-2xl rounded-tr-sm border border-[#25D366]/20' : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100'}`}>
                        
                        {/* MEDIA RENDERER */}
                        {msg.media && (
                          <div className="w-full h-32 bg-slate-100 rounded-xl mb-2 flex flex-col items-center justify-center border border-slate-200 overflow-hidden relative group">
                            {msg.media === 'image' ? <ImageIcon className="w-8 h-8 text-slate-300" /> : msg.media === 'video' ? <Video className="w-8 h-8 text-slate-300" /> : <Paperclip className="w-8 h-8 text-slate-300" />}
                            <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{msg.media} File</span>
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                              <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg"><Play className="w-4 h-4 text-slate-800 ml-0.5"/></div>
                            </div>
                          </div>
                        )}

                        <p className="leading-relaxed whitespace-pre-wrap px-2.5 pt-1.5 pb-1">{msg.text}</p>
                        
                        <div className={`flex justify-end gap-1 px-2.5 pb-1 ${msg.sender === 'user' ? 'text-green-800/60' : 'text-slate-400'}`}>
                          <span className="text-[9px] font-bold">{msg.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-blue-500" />}
                        </div>
                      </div>

                      {/* ✨ NATIVE WA FORM RENDERER ✨ */}
                      {msg.sender === 'bot' && msg.waForm && (
                        <div className="mt-1 w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                          <div className="p-3 bg-violet-50/50 border-b border-slate-100 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-violet-500" />
                            <span className="text-xs font-bold text-slate-800">{msg.waForm.title}</span>
                          </div>
                          <button onClick={() => { handleSimulateSend(undefined, `[Form Submitted: ${msg.waForm?.title}]`, true); if(msg.sourceNodeId) processBotResponse(msg.sourceNodeId); }} className="py-2.5 text-sm font-bold text-violet-600 hover:bg-violet-50 transition-colors w-full text-center">
                            {msg.waForm.button}
                          </button>
                        </div>
                      )}

                      {/* BUTTON RENDERER */}
                      {msg.sender === 'bot' && msg.buttons && msg.buttons.length > 0 && (
                        <div className="mt-1 flex flex-col gap-1 w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                          {msg.buttons.map((btn, i) => (
                            <button key={i} onClick={() => handleSimulateButtonClick(btn, i, msg.sourceNodeId)} className="py-2.5 text-sm font-bold text-[#0ea5e9] border-b border-slate-100 last:border-0 hover:bg-blue-50 active:bg-blue-100 transition-colors">
                              {btn}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* LIST MENU BUTTON */}
                      {msg.sender === 'bot' && msg.listMenu && (
                        <button onClick={() => setActiveListMenu(msg.sourceNodeId || 'menu')} className="mt-1 w-full bg-white rounded-xl shadow-sm border border-slate-100 py-3 flex items-center justify-center gap-2 text-[#0ea5e9] text-sm font-bold hover:bg-slate-50 transition-colors">
                          <ListIcon className="w-4 h-4" /> {msg.listMenu.title}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
              
              {/* NATIVE iOS/ANDROID LIST MODAL OVERLAY */}
              {activeListMenu && (
                <div className="absolute inset-x-0 bottom-0 top-1/4 bg-black/20 backdrop-blur-sm z-20 animate-in fade-in flex flex-col justify-end" onClick={() => setActiveListMenu(null)}>
                  <div className="bg-[#f0f0f0] w-full rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-12 duration-300 max-h-full" onClick={e => e.stopPropagation()}>
                    <div className="p-4 bg-white flex justify-between items-center shrink-0 border-b border-slate-200">
                      <h4 className="font-bold text-slate-800">Make a Selection</h4>
                      <button onClick={() => setActiveListMenu(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-2 space-y-2">
                      {chatHistory.find(m => m.sourceNodeId === activeListMenu)?.listMenu?.items.map((item, i) => (
                        <button key={i} onClick={() => { handleSimulateSend(undefined, item, true); setActiveListMenu(null); processBotResponse(activeListMenu); }} className="w-full text-left bg-white p-4 rounded-xl shadow-sm hover:shadow-md border border-slate-100 transition-all font-bold text-[#0ea5e9]">
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSimulateSend} className="p-3 bg-[#f0f0f0] flex items-center gap-2 z-10 shrink-0">
              <input type="text" value={simInput} onChange={(e) => setSimInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-3 text-slate-800 text-sm outline-none focus:ring-2 focus:ring-[#25D366]/30 shadow-inner" />
              <button type="submit" disabled={!simInput.trim()} className="w-11 h-11 bg-[#00a884] rounded-full flex items-center justify-center shadow-md disabled:opacity-50 transition-all hover:bg-[#128c7e] shrink-0"><Send className="w-4 h-4 text-white ml-0.5" /></button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppBuilder() {
  return <ReactFlowProvider><WhatsAppBuilderFlow /></ReactFlowProvider>;
}