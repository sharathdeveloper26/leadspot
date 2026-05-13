import React, { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  X, MessageSquare, Megaphone, ShieldCheck, Zap, 
  Smartphone, AlertCircle, PlusCircle, Trash2, CheckCircle2, Link2, Type, MousePointerClick
} from 'lucide-react';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateTemplateModal({ isOpen, onClose, onSuccess }: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [language, setLanguage] = useState('en_US');
  
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT'>('NONE');
  const [headerText, setHeaderText] = useState('');
  
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  
  const [buttons, setButtons] = useState<{ type: 'QUICK_REPLY' | 'URL'; text: string; url?: string }[]>([]);
  const [examples, setExamples] = useState<Record<string, string>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Automatically extract {{1}}, {{2}} from body text for Meta's required sample values
  const variables = useMemo(() => {
    const regex = /\{\{(\d+)\}\}/g;
    const matches = Array.from(bodyText.matchAll(regex));
    const uniqueVars = Array.from(new Set(matches.map(m => m[1]))).sort((a, b) => parseInt(a) - parseInt(b));
    return uniqueVars;
  }, [bodyText]);

  // Clean the template name for Meta (lowercase, underscores only)
  const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const handleAddButton = (type: 'QUICK_REPLY' | 'URL') => {
    if (buttons.length >= 3) return; // Meta max is 3
    setButtons([...buttons, { type, text: '', url: type === 'URL' ? 'https://' : undefined }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name || !bodyText) {
      setError('Template name and body text are required.');
      return;
    }
    
    if (variables.length > 0) {
      const missingExamples = variables.some(v => !examples[v] || examples[v].trim() === '');
      if (missingExamples) {
        setError('You must provide sample values for all {{variables}} for Meta approval.');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      const functions = getFunctions();
      const createTemplate = httpsCallable(functions, 'createWhatsAppTemplate');

      // Construct Meta's strict components array
      const components: any[] = [];

      if (headerType === 'TEXT' && headerText) {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
      }

      const bodyComponent: any = { type: 'BODY', text: bodyText };
      if (variables.length > 0) {
        bodyComponent.example = { body_text: [variables.map(v => examples[v])] };
      }
      components.push(bodyComponent);

      if (footerText) {
        components.push({ type: 'FOOTER', text: footerText });
      }

      if (buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: buttons.map(b => {
            if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
            return { type: 'URL', text: b.text, url: b.url };
          })
        });
      }

      await createTemplate({
        name: cleanName,
        category,
        language,
        components
      });

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit template to Meta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* LEFT PANE: Form Configuration */}
        <div className="flex-1 flex flex-col h-full border-r border-slate-100 overflow-y-auto custom-scrollbar">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10">
            <div>
              <h2 className="text-xl font-black text-slate-800">Create Template</h2>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">Submit for Meta Approval</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5"/></button>
          </div>

          <div className="p-6 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-start gap-3 border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" /> {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Template Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. welcome_message_01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/30 outline-none text-sm font-bold text-slate-800 transition-all" />
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Meta Name: <span className="font-bold text-slate-600">{cleanName || '...'}</span></p>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/30 outline-none text-sm font-bold text-slate-800 transition-all cursor-pointer">
                    <option value="en_US">English (US)</option><option value="en_GB">English (UK)</option><option value="es">Spanish</option><option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Category</label>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => setCategory('MARKETING')} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${category === 'MARKETING' ? 'border-[#25D366] bg-[#25D366]/5 text-[#1EBE57]' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}><Megaphone className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">Marketing</span></button>
                  <button onClick={() => setCategory('UTILITY')} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${category === 'UTILITY' ? 'border-[#0ea5e9] bg-sky-50 text-[#0ea5e9]' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}><MessageSquare className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">Utility</span></button>
                  <button onClick={() => setCategory('AUTHENTICATION')} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${category === 'AUTHENTICATION' ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}><ShieldCheck className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-widest">Auth (OTP)</span></button>
                </div>
              </div>
            </div>

            {/* Template Body */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Type className="w-4 h-4 text-indigo-500"/> Content Structure</h3>
              
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Header (Optional)</label>
                <div className="flex gap-3 mb-3">
                  <button onClick={() => setHeaderType('NONE')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${headerType === 'NONE' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>None</button>
                  <button onClick={() => setHeaderType('TEXT')} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${headerType === 'TEXT' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Text Header</button>
                </div>
                {headerType === 'TEXT' && (
                  <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} maxLength={60} placeholder="Enter a short header title (max 60 chars)" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-bold shadow-sm" />
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">Body Text (Required)</label>
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Use {'{{1}}'} for variables</span>
                </div>
                <textarea rows={5} value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Hi {{1}}, welcome to Leadspot! Your account {{2}} is ready." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm resize-y custom-scrollbar" />
              </div>

              {/* Dynamic Variables Mapping */}
              {variables.length > 0 && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-indigo-800 mb-2"><Zap className="w-4 h-4"/><span className="text-xs font-black uppercase tracking-widest">Provide Sample Values</span></div>
                  {variables.map(v => (
                    <div key={v} className="flex items-center gap-3">
                      <div className="w-12 h-9 bg-white border border-indigo-200 rounded-lg flex items-center justify-center text-xs font-black text-indigo-600 shrink-0">{`{{${v}}}`}</div>
                      <input type="text" value={examples[v] || ''} onChange={e => setExamples({...examples, [v]: e.target.value})} placeholder={`e.g. John Doe`} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium focus:border-indigo-400" />
                    </div>
                  ))}
                  <p className="text-[10px] text-indigo-500/70 font-bold leading-tight">Meta requires real-world examples for variables to approve the template.</p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Footer (Optional)</label>
                <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} maxLength={60} placeholder="e.g. Reply STOP to unsubscribe" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none text-sm font-medium shadow-sm text-slate-500" />
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-blue-500"/> Action Buttons</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{buttons.length}/3 Added</span>
              </div>
              
              <div className="space-y-3">
                {buttons.map((btn, i) => (
                  <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 relative animate-in slide-in-from-left-2">
                    <button onClick={() => handleRemoveButton(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm"><X className="w-3 h-3"/></button>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-500 shrink-0">
                      {btn.type === 'QUICK_REPLY' ? <MessageSquare className="w-4 h-4"/> : <Link2 className="w-4 h-4"/>}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input type="text" value={btn.text} onChange={e => { const newB = [...buttons]; newB[i].text = e.target.value; setButtons(newB); }} placeholder={btn.type === 'QUICK_REPLY' ? "Button Text (e.g. I'm Interested)" : "Button Text (e.g. Visit Website)"} className="w-full bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none text-sm font-bold text-slate-800 pb-1" maxLength={20} />
                      {btn.type === 'URL' && (
                        <input type="text" value={btn.url} onChange={e => { const newB = [...buttons]; newB[i].url = e.target.value; setButtons(newB); }} placeholder="https://yourwebsite.com" className="w-full bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none text-xs font-medium text-slate-600 pb-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {buttons.length < 3 && (
                <div className="flex gap-3 mt-4">
                  <button onClick={() => handleAddButton('QUICK_REPLY')} className="flex-1 py-2.5 border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 rounded-xl text-blue-600 font-bold text-xs transition-colors flex items-center justify-center gap-2"><PlusCircle className="w-3.5 h-3.5"/> Quick Reply</button>
                  <button onClick={() => handleAddButton('URL')} className="flex-1 py-2.5 border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-2"><Link2 className="w-3.5 h-3.5"/> Link Button</button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT PANE: Live WhatsApp Simulator */}
        <div className="w-full md:w-[380px] bg-[#f0f2f5] flex flex-col shrink-0 border-l border-slate-200">
          <div className="px-6 py-4 bg-[#075e54] text-white flex items-center gap-3 shadow-md z-10 shrink-0">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center"><Smartphone className="w-5 h-5 text-white"/></div>
            <div><h3 className="text-sm font-bold leading-tight">Live Preview</h3><p className="text-[10px] text-white/70">Leadspot Client</p></div>
          </div>

          <div className="flex-1 p-5 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center overflow-y-auto custom-scrollbar flex flex-col justify-center">
            
            <div className="max-w-[90%] bg-white rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex flex-col relative mx-auto overflow-hidden animate-in zoom-in-95 duration-300">
              
              <div className="p-3">
                {headerType === 'TEXT' && headerText && (
                  <h4 className="text-sm font-black text-slate-900 mb-1 leading-tight">{headerText}</h4>
                )}

                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {bodyText ? (
                    // Replace {{1}} with the mock data the user provided for the preview
                    bodyText.replace(/\{\{(\d+)\}\}/g, (match, num) => examples[num] ? `[${examples[num]}]` : match)
                  ) : (
                    <span className="text-slate-400 italic">Start typing your body text...</span>
                  )}
                </p>

                {footerText && (
                  <p className="text-[11px] font-medium text-slate-400 mt-2">{footerText}</p>
                )}

                <div className="flex justify-end mt-1 text-slate-400">
                  <span className="text-[9px] font-bold">12:00 PM</span>
                </div>
              </div>

              {buttons.length > 0 && (
                <div className="flex flex-col border-t border-slate-100 bg-slate-50/50">
                  {buttons.map((btn, i) => (
                    <div key={i} className="py-2.5 border-b border-slate-100 last:border-0 text-center text-sm font-bold text-[#0ea5e9] flex items-center justify-center gap-2">
                      {btn.type === 'URL' && <Link2 className="w-3.5 h-3.5"/>}
                      {btn.text || 'Button Text'}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <button onClick={handleSubmit} disabled={isSubmitting || !name || !bodyText} className="w-full py-3.5 bg-[#25D366] hover:bg-[#1EBE57] text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/30 disabled:opacity-50 disabled:shadow-none">
              {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>}
              {isSubmitting ? 'Submitting to Meta...' : 'Submit Template'}
            </button>
            <p className="text-[10px] text-center font-bold text-slate-400 mt-3">Templates usually take 1-2 minutes to be approved by Meta.</p>
          </div>
        </div>

      </div>
    </div>
  );
}