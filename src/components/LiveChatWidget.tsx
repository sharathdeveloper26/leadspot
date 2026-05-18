import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Minimize2, MapPin, FileText, Download, MessageSquare } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

type SimMessage = { id: string; role: 'bot' | 'user' | 'system'; text?: string; buttons?: string[]; sourceNodeId?: string; type?: 'text' | 'image' | 'file' | 'location'; mediaUrl?: string; fileName?: string; };

export default function LiveChatWidget() {
  const [isIframeExpanded, setIsIframeExpanded] = useState(false); // Controls iframe bounds
  const [isChatVisible, setIsChatVisible] = useState(false);       // Controls smooth CSS animation
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [customFontBase64, setCustomFontBase64] = useState('');
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  
  // URL Config
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token') || '';
  const botName = searchParams.get('botName') || 'AI Agent';
  const botSubtitle = searchParams.get('botSubtitle') || 'Online';
  const rawColor = searchParams.get('themeColor') || '2563eb';
  const themeColor = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
  const avatarUrl = searchParams.get('avatarUrl') || '';
  const fontFamily = searchParams.get('fontFamily') || 'Inter';

  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [inputMode, setInputMode] = useState<'none' | 'text' | 'name' | 'email' | 'phone' | 'rag'>('none');
  const [chatInput, setChatInput] = useState('');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const [capturedData, setCapturedData] = useState({ name: '', phone: '', email: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✨ KILL THE WHITE BACKGROUND BUG ✨
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = 'transparent';
  }, []);

  // ✨ DYNAMIC GOOGLE FONTS INJECTION ✨
  useEffect(() => {
    if (['Inter', 'Roboto', 'Poppins'].includes(fontFamily)) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700;800&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, [fontFamily]);

  // ✨ SMATBOT-STYLE 2-STEP ANIMATION ENGINE ✨
  const openChat = () => {
    setIsIframeExpanded(true);
    window.parent.postMessage({ type: 'LEADSPOT_EXPAND' }, '*');
    // Wait for iframe to expand, then animate the widget in
    setTimeout(() => setIsChatVisible(true), 50); 
  };

  const closeChat = () => {
    setIsChatVisible(false); // Animate out first
    setTimeout(() => {
      setIsIframeExpanded(false); // Shrink iframe after animation finishes
      window.parent.postMessage({ type: 'LEADSPOT_COLLAPSE' }, '*');
    }, 300);
  };

  // Enterprise Auto-Popup Feature
  useEffect(() => {
    const autoOpenTimer = setTimeout(() => { openChat(); }, 3000); 
    return () => clearTimeout(autoOpenTimer);
  }, []);

  // Load from Firebase
  useEffect(() => {
    const loadFlow = async () => {
      try {
        if (!token) return;
        const clientId = atob(token); 
        const docSnap = await getDoc(doc(db, 'website_bot_flows', clientId));
        if (docSnap.exists()) {
          setNodes(docSnap.data().nodes || []);
          setEdges(docSnap.data().edges || []);
          if (docSnap.data().design?.customFontBase64) {
            setCustomFontBase64(docSnap.data().design.customFontBase64);
          }
        }
      } catch (e) {
        console.error("Error loading bot config", e);
      } finally {
        setIsFetching(false);
      }
    };
    loadFlow();
  }, [token]);

  useEffect(() => {
    if (isChatVisible && messages.length === 0 && nodes.length > 0 && !isFetching) {
      const triggerNode = nodes.find(n => n.type === 'webTrigger');
      if (triggerNode) setTimeout(() => autoAdvance(triggerNode.id), 400);
    }
  }, [isChatVisible, nodes, isFetching]);

  const executeNode = (nodeId: string) => {
    const currentNodeList = nodesRef.current;
    const node = currentNodeList.find(n => String(n.id) === String(nodeId));
    if (!node) { setIsTyping(false); return; }
    
    setActiveNodeId(node.id);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      if (node.type === 'webMessage') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', text: node.data.message, sourceNodeId: node.id }]);
        autoAdvance(node.id);
      } else if (node.type === 'webImage') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'image', mediaUrl: node.data.imageUrl, text: node.data.alt, sourceNodeId: node.id }]);
        autoAdvance(node.id);
      } else if (node.type === 'webFile') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'file', fileName: node.data.fileName, mediaUrl: node.data.fileUrl, sourceNodeId: node.id }]);
        autoAdvance(node.id);
      } else if (node.type === 'webLocation') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'location', text: node.data.address, sourceNodeId: node.id }]);
        autoAdvance(node.id);
      } else if (node.type === 'webButton') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', text: node.data.message, buttons: node.data.buttons, sourceNodeId: node.id }]);
        setInputMode('none'); 
      } else if (node.type === 'webAsk') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', text: node.data.message, sourceNodeId: node.id }]);
        setInputMode(node.data.field || 'text'); 
      } else if (node.type === 'aiBrain') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', type: 'text', text: '⚡ Connecting to AI Agent...' }]);
        setInputMode('rag'); 
      }
    }, 800);
  };

  const autoAdvance = (currentNodeId: string) => {
    setTimeout(() => {
      const currentEdgeList = edgesRef.current;
      const nextEdge = currentEdgeList.find(e => String(e.source) === String(currentNodeId));
      if (nextEdge) executeNode(nextEdge.target);
    }, 400);
  };

  const handleButtonClick = (e: React.MouseEvent, btnText: string, sourceNodeId: string, buttonIndex: number) => {
    e.preventDefault();
    setMessages(prev => [...prev.map(m => m.sourceNodeId === sourceNodeId ? { ...m, buttons: [] } : m), { id: Date.now().toString(), role: 'user', type: 'text', text: btnText }]);
    setIsTyping(true);
    
    const currentEdgeList = edgesRef.current;
    let targetEdge = currentEdgeList.find(e => String(e.source) === String(sourceNodeId) && String(e.sourceHandle) === `btn-${buttonIndex}`);
    if (!targetEdge) targetEdge = currentEdgeList.find(e => String(e.source) === String(sourceNodeId));

    if (targetEdge) executeNode(targetEdge.target);
    else setIsTyping(false);
  };

  const pushToCRM = async (newData: any) => {
    try {
      await fetch('https://us-central1-leadspot-crm-52ab4.cloudfunctions.net/captureWebsiteLead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          name: newData.name || capturedData.name,
          email: newData.email || capturedData.email,
          phone: newData.phone || capturedData.phone,
          chatHistory: messages.map(m => `${m.role.toUpperCase()}: ${m.text || m.type}`).join('\n')
        })
      });
    } catch (e) {
      console.error("CRM Sync failed", e);
    }
  };

  const handleTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeNodeId) return;

    const userInput = chatInput.trim();
    let isValid = true;
    let errorMsg = '';

    if (inputMode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput)) {
      isValid = false; errorMsg = "⚠️ Please enter a valid email address.";
    } else if (inputMode === 'phone' && !/^[6-9]\d{9}$/.test(userInput.replace(/\D/g, ''))) {
      isValid = false; errorMsg = "⚠️ Please enter a valid 10-digit phone number.";
    }

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', type: 'text', text: userInput }]);
    setChatInput('');

    if (!isValid) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', text: errorMsg }]);
      }, 600);
      return; 
    }

    setIsTyping(true);

    if (['text', 'name', 'phone', 'email'].includes(inputMode)) {
      let updatedData = { ...capturedData };
      if (inputMode === 'name') updatedData.name = userInput;
      if (inputMode === 'email') updatedData.email = userInput;
      if (inputMode === 'phone') updatedData.phone = userInput;
      setCapturedData(updatedData);

      if (['name', 'email', 'phone'].includes(inputMode)) pushToCRM(updatedData); 

      setInputMode('none');
      setTimeout(() => { setIsTyping(false); autoAdvance(activeNodeId); }, 800);
    } else if (inputMode === 'rag') {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'bot', type: 'text', text: "Thank you. Our team will get back to you with those details shortly." }]);
      }, 1500);
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  let placeholder = "Type your message...";
  if (inputMode === 'phone') placeholder = "Enter 10-digit mobile number...";
  if (inputMode === 'email') placeholder = "Enter email address...";
  if (inputMode === 'name') placeholder = "Enter your full name...";
  if (inputMode === 'none') placeholder = "Please select an option...";

  return (
    <div className="w-full h-full flex flex-col justify-end items-end p-4 lg:p-6 bg-transparent" style={{ fontFamily: fontFamily === 'CustomBotFont' ? 'CustomBotFont, sans-serif' : `"${fontFamily}", sans-serif` }}>
      
      <style dangerouslySetInnerHTML={{ __html: customFontBase64 ? `@font-face { font-family: 'CustomBotFont'; src: url('${customFontBase64}'); }` : '' }} />

      {isIframeExpanded ? (
        <div 
          className="w-full max-w-[380px] h-[650px] max-h-[85vh] bg-white sm:rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 flex flex-col overflow-hidden origin-bottom-right transition-all duration-300 ease-out"
          style={{ 
            opacity: isChatVisible ? 1 : 0, 
            transform: isChatVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)' 
          }}
        >
          {/* Smatbot Style Header */}
          <div className="px-5 py-4 text-white flex items-center justify-between z-10 shadow-md" style={{ backgroundColor: themeColor }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden relative shrink-0 border-2 border-white/20">
                {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <Bot className="w-6 h-6" style={{ color: themeColor }} />}
              </div>
              <div>
                <h4 className="text-[16px] font-black leading-tight tracking-wide">{botName}</h4>
                <p className="text-[11px] text-white/90 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 bg-[#00e676] rounded-full shadow-[0_0_5px_#00e676]"></span> {botSubtitle}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={closeChat} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Minimize2 className="w-4 h-4 text-white" /></button>
            </div>
          </div>

          <div className="flex-1 p-5 bg-[#f8fafc] overflow-y-auto space-y-5 custom-scrollbar flex flex-col relative">
            {isFetching && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#f8fafc]/80 backdrop-blur-sm z-20">
                 <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: themeColor, borderTopColor: 'transparent' }}></div>
              </div>
            )}

            {messages.map((msg) => (
              <React.Fragment key={msg.id}>
                {msg.role === 'system' && (
                  <div className="text-center py-2"><span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-amber-200 shadow-sm">{msg.text}</span></div>
                )}
                {msg.role === 'bot' && (
                  <div className="flex items-start gap-3 max-w-[92%] animate-in slide-in-from-bottom-2 duration-300">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-slate-100 mt-1">
                      {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover rounded-full p-0.5" /> : <Bot className="w-4 h-4" style={{ color: themeColor }} />}
                    </div>
                    <div className="flex flex-col gap-2 w-full min-w-0">
                      {msg.type === 'text' && <div className="bg-white px-5 py-3.5 text-[14px] shadow-sm border border-slate-100/60 text-slate-700 font-medium rounded-2xl rounded-tl-sm whitespace-pre-wrap">{msg.text}</div>}
                      
                      {msg.type === 'image' && (
                        <div className="bg-white p-2 shadow-sm border border-slate-100/60 rounded-2xl rounded-tl-sm w-[240px]">
                          <img src={msg.mediaUrl} className="w-full h-36 object-cover rounded-xl mb-2 border border-slate-100" />
                          {msg.text && <p className="text-[12px] font-bold text-slate-600 px-2 pb-1 truncate">{msg.text}</p>}
                        </div>
                      )}

                      {msg.type === 'file' && (
                        <div className="bg-white p-3 shadow-sm border border-slate-100/60 rounded-2xl rounded-tl-sm w-[240px] flex items-center gap-3">
                          <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500 shrink-0"><FileText className="w-5 h-5"/></div>
                          <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-slate-700 truncate">{msg.fileName}</p><p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">PDF Document</p></div>
                          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors"><Download className="w-4 h-4 shrink-0"/></a>
                        </div>
                      )}

                      {msg.type === 'location' && (
                        <div className="bg-white p-2 shadow-sm border border-slate-100/60 rounded-2xl rounded-tl-sm w-[240px]">
                          <div className="w-full h-28 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center mb-2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"><MapPin className="w-6 h-6 text-slate-400" /></div>
                          <p className="text-[12px] font-bold text-slate-600 px-2 pb-1 line-clamp-2">{msg.text}</p>
                        </div>
                      )}

                      {/* Pill Shaped Smatbot Buttons */}
                      {msg.buttons && msg.buttons.length > 0 && (
                        <div className="flex flex-wrap gap-2 w-full pt-1">
                          {msg.buttons.map((btn, i) => (
                            <button key={i} onClick={(e) => handleButtonClick(e, btn, msg.sourceNodeId!, i)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[13px] font-bold rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-blue-400 hover:text-blue-600 transition-all hover:-translate-y-0.5">{btn}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-300 w-full">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3.5 text-[14px] shadow-sm text-white font-medium whitespace-pre-wrap" style={{ backgroundColor: themeColor }}>{msg.text}</div>
                  </div>
                )}
              </React.Fragment>
            ))}
            {isTyping && (
              <div className="flex items-start gap-3 max-w-[92%] animate-in fade-in duration-300">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 mt-1 border border-slate-100">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover rounded-full p-0.5" /> : <Bot className="w-4 h-4" style={{ color: themeColor }} />}
                </div>
                <div className="bg-white px-4 py-3 shadow-sm border border-slate-100/60 rounded-2xl rounded-tl-sm flex items-center gap-1.5 h-[44px]">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-slate-100 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
            <form onSubmit={handleTextInput} className="flex items-center gap-2">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={inputMode === 'none' || isTyping} placeholder={placeholder} className="flex-1 bg-slate-50 rounded-full px-5 py-2.5 text-[14px] font-medium outline-none text-slate-700 disabled:opacity-50 border border-slate-200 focus:border-slate-300 transition-colors" />
              <button type="submit" disabled={!chatInput.trim() || isTyping} className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md disabled:opacity-50 shrink-0 hover:scale-105 transition-transform" style={{ backgroundColor: themeColor }}>
                <Send className="w-4 h-4 -ml-0.5 mt-0.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ✨ SMATBOT STYLE LAUNCHER WITH TOOLTIP ✨ */
        <div className="flex items-center gap-4 animate-in zoom-in duration-300 pb-2 pr-2">
          <div className="hidden sm:flex px-4 py-2.5 bg-white text-slate-800 text-[14px] font-bold rounded-xl shadow-lg border border-slate-100 relative">
            How can I help you?
            <div className="absolute top-1/2 -right-2 w-4 h-4 bg-white border-r border-t border-slate-100 rotate-45 -translate-y-1/2"></div>
          </div>
          <button onClick={openChat} className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:scale-110 transition-transform relative" style={{ backgroundColor: themeColor }}>
            {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover rounded-full p-1" /> : <MessageSquare className="w-7 h-7 text-white" />}
            <span className="absolute top-0 right-0 w-4 h-4 bg-[#00e676] rounded-full border-2 border-white shadow-sm"></span>
          </button>
        </div>
      )}
    </div>
  );
}