import React from 'react';
import { Handle, Position } from 'reactflow';
import { Play, MessageSquare, HelpCircle, ListPlus, MousePointerClick } from 'lucide-react';

// ✨ 1. THE TRIGGER NODE (The starting point of the flow)
export const TriggerNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-purple-500 w-72 overflow-hidden">
      <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex items-center gap-2">
        <div className="p-1.5 bg-purple-500 text-white rounded-lg"><Play className="w-4 h-4" /></div>
        <h3 className="font-bold text-purple-900 text-sm">Flow Trigger</h3>
      </div>
      <div className="p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Condition</p>
        <div className="text-sm font-medium text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
          {data.label}
        </div>
      </div>
      {/* Target handle hidden for triggers, only Source handle at the bottom */}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500 border-2 border-white" />
    </div>
  );
};

// ✨ 2. THE MESSAGE NODE (Sending a standard text block)
export const MessageNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-72 overflow-hidden group hover:border-[#25D366] transition-colors">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-[#25D366] transition-colors" />
          <h3 className="font-bold text-slate-700 text-sm">Send Message</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 whitespace-pre-wrap">
          {data.text || 'Type your message...'}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white group-hover:bg-[#25D366]" />
    </div>
  );
};

// ✨ 3. THE QUESTION NODE (Asking a question and waiting for input/buttons)
export const QuestionNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-72 overflow-hidden group hover:border-amber-500 transition-colors">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-amber-50/30">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-amber-900 text-sm">Ask a Question</h3>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium text-slate-700 whitespace-pre-wrap">
          {data.text || 'What would you like to ask?'}
        </div>
        
        {/* Render Buttons if they exist in the data */}
        {data.options && data.options.length > 0 ? (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quick Replies</p>
            {data.options.map((opt: string, idx: number) => (
              <div key={idx} className="w-full py-1.5 px-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg text-center relative">
                {opt}
                {/* Dynamically create connection handles for EACH button so they can branch out! */}
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={`btn-${idx}`} 
                  className="w-2.5 h-2.5 bg-amber-500 border-2 border-white -right-1.5" 
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg">
            <MousePointerClick className="w-3.5 h-3.5" /> Waiting for text reply...
          </div>
        )}
      </div>
      {/* Default fallback source handle */}
      {(!data.options || data.options.length === 0) && (
         <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white group-hover:bg-amber-500" />
      )}
    </div>
  );
};