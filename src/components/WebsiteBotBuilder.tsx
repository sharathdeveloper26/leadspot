import React, { useState } from 'react';
import { 
  Bot, UploadCloud, Link2, FileText, Settings2, Code, 
  Palette, Play, Plus, Trash2, CheckCircle2, Copy, 
  MessageSquare, User, Phone, Zap
} from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';

export default function WebsiteBotBuilder() {
  const { companyName } = useBranding();
  const [activeTab, setActiveTab] = useState<'knowledge' | 'customize' | 'embed'>('knowledge');
  
  // Knowledge Base State
  const [files, setFiles] = useState<{name: string, size: string, status: string}[]>([
    { name: 'Sunset_Villas_Brochure.pdf', size: '2.4 MB', status: 'Trained' }
  ]);
  const [urls, setUrls] = useState<{url: string, status: string}[]>([]);
  const [newUrl, setNewUrl] = useState('');

  // Customization State
  const [botName, setBotName] = useState('Leadspot Assistant');
  const [welcomeMessage, setWelcomeMessage] = useState('Hi! I can answer any questions about our properties. How can I help you today?');
  const [primaryColor, setPrimaryColor] = useState('#50bdaf');
  const [requireLeadForm, setRequireLeadForm] = useState(true);

  // Widget Preview State
  const [chatOpen, setChatOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<{role: 'bot'|'user', text: string}[]>([
    { role: 'bot', text: welcomeMessage }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setUrls([...urls, { url: newUrl, status: 'Scraping...' }]);
    setNewUrl('');
    // Simulate scraping
    setTimeout(() => {
      setUrls(prev => prev.map(u => u.url === newUrl ? { ...u, status: 'Trained' } : u));
    }, 2000);
  };

  const handleSimulateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChatHistory([...chatHistory, { role: 'user', text: chatInput }]);
    setChatInput('');

    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        role: 'bot', 
        text: requireLeadForm && prev.length === 2 
          ? "I'd love to help with that! Before I answer, could you please provide your Name and Phone Number so our team can follow up?" 
          : "Based on the uploaded brochures, the starting price is ₹1.2 Cr. Would you like to schedule a site visit?" 
      }]);
    }, 1000);
  };

  const widgetCode = `<script>
  window.LeadspotChatConfig = {
    clientId: "YOUR_CLIENT_ID",
    botName: "${botName}",
    color: "${primaryColor}"
  };
</script>
<script src="https://cdn.leadspot.com/widget.js" async defer></script>`;

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full relative overflow-hidden">
      
      {/* Top Header */}
      <div className="bg-white px-8 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm">
            <Bot className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">AI Website Chatbot</h2>
            <p className="text-sm font-medium text-slate-500">Train your custom AI and deploy it to your site.</p>
          </div>
        </div>
        <button className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
          <Play className="w-4 h-4 fill-current" /> Save & Train AI
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANE: Configuration */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-white z-0 overflow-y-auto custom-scrollbar">
          
          {/* Tabs */}
          <div className="flex px-6 pt-4 border-b border-slate-100 gap-6 sticky top-0 bg-white/90 backdrop-blur-md z-10">
            <button onClick={() => setActiveTab('knowledge')} className={`pb-3 text-sm font-bold transition-colors relative flex items-center gap-2 ${activeTab === 'knowledge' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <UploadCloud className="w-4 h-4" /> Knowledge Base
              {activeTab === 'knowledge' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
            <button onClick={() => setActiveTab('customize')} className={`pb-3 text-sm font-bold transition-colors relative flex items-center gap-2 ${activeTab === 'customize' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <Palette className="w-4 h-4" /> Customization
              {activeTab === 'customize' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
            <button onClick={() => setActiveTab('embed')} className={`pb-3 text-sm font-bold transition-colors relative flex items-center gap-2 ${activeTab === 'embed' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <Code className="w-4 h-4" /> Embed Code
              {activeTab === 'embed' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
            </button>
          </div>

          <div className="p-8">
            {/* KNOWLEDGE BASE TAB */}
            {activeTab === 'knowledge' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Train your AI</h3>
                  <p className="text-sm font-medium text-slate-500 mb-4">Upload property brochures, floor plans, or link your website. The AI will learn everything automatically.</p>
                  
                  <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group">
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 text-indigo-500" />
                    </div>
                    <h4 className="text-sm font-bold text-indigo-900">Click or drag PDF files here</h4>
                    <p className="text-xs font-medium text-indigo-400 mt-1">Maximum 50MB per file</p>
                  </div>
                </div>

                {files.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Uploaded Documents</h4>
                    <div className="space-y-2">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-indigo-400" />
                            <div>
                              <p className="text-sm font-bold text-slate-700">{f.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{f.size}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> {f.status}</span>
                            <button className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Scrape Website Links</h4>
                  <form onSubmit={handleAddUrl} className="flex gap-2">
                    <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://your-property-site.com" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                    <button type="submit" disabled={!newUrl} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-slate-800 transition-all"><Plus className="w-4 h-4"/> Add URL</button>
                  </form>
                  
                  {urls.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {urls.map((u, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <div className="flex items-center gap-2 truncate pr-4 text-sm font-medium text-blue-600">
                            <Link2 className="w-4 h-4 shrink-0" /> {u.url}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0 ${u.status === 'Trained' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse'}`}>{u.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CUSTOMIZATION TAB */}
            {activeTab === 'customize' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Bot Name</label>
                    <input type="text" value={botName} onChange={e => setBotName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Brand Color</label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-11 w-11 rounded-xl cursor-pointer border-0 p-0" />
                      <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Welcome Message</label>
                  <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none resize-y" />
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-4">
                  <div className="p-2 bg-amber-100 rounded-lg shrink-0"><User className="w-5 h-5 text-amber-600"/></div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 mb-1">Lead Generation Gate</h4>
                    <p className="text-xs font-medium text-amber-700/80 mb-3 leading-relaxed">Require users to enter their Name and Phone Number before the AI answers complex questions. This pushes leads directly into your CRM.</p>
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={requireLeadForm} onChange={() => setRequireLeadForm(!requireLeadForm)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${requireLeadForm ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${requireLeadForm ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <div className="ml-3 text-sm font-bold text-slate-700">Enable Lead Capture</div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* EMBED TAB */}
            {activeTab === 'embed' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Deploy to your Website</h3>
                  <p className="text-sm font-medium text-slate-500 mb-6">Paste this code inside the <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&lt;head&gt;</code> or just before the closing <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&lt;/body&gt;</code> tag of your website.</p>
                </div>

                <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/50 bg-slate-800/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HTML Widget Code</span>
                    <button onClick={() => { navigator.clipboard.writeText(widgetCode); setIsCopied(true); setTimeout(()=>setIsCopied(false), 2000); }} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                      {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {isCopied ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                  <pre className="p-5 overflow-x-auto custom-scrollbar text-sm font-mono text-emerald-400 leading-relaxed">
                    <code>{widgetCode}</code>
                  </pre>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANE: Live Widget Simulator */}
        <div className="w-[420px] bg-[#f0f2f5] border-l border-slate-200 shrink-0 hidden lg:flex flex-col relative z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
          <div className="p-6 bg-white border-b border-slate-200 shrink-0 text-center">
            <h3 className="text-sm font-bold text-slate-800 flex items-center justify-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Interactive Preview</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Test your AI responses here</p>
          </div>

          <div className="flex-1 relative p-6">
            {/* The Floating Widget UI */}
            <div className="absolute bottom-6 right-6 w-[360px] h-[500px] bg-white rounded-2xl shadow-[0_15px_50px_-12px_rgba(0,0,0,0.2)] border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
              
              {/* Widget Header */}
              <div className="px-5 py-4 text-white flex items-center justify-between shadow-md z-10" style={{ backgroundColor: primaryColor }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold leading-tight">{botName}</h4>
                    <p className="text-[10px] text-white/80 font-medium">Online • Replies instantly</p>
                  </div>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'}`} style={msg.role === 'user' ? { backgroundColor: primaryColor } : {}}>
                      <p className="leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-100">
                <form onSubmit={handleSimulateChat} className="flex items-center gap-2">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type your question..." className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  <button type="submit" disabled={!chatInput.trim()} className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 disabled:opacity-50 disabled:scale-100 shrink-0" style={{ backgroundColor: primaryColor }}>
                    <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}