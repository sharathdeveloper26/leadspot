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
// Inside BotNodes.tsx

export const MessageNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-72 overflow-hidden group hover:border-[#25D366] hover:shadow-xl transition-all">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-[#25D366] transition-colors" />
          {/* Use the internal Label name instead of "Send Message" */}
          <h3 className="font-bold text-slate-700 text-sm truncate w-48">{data.label || 'Send Message'}</h3>
        </div>
      </div>
      <div className="p-4">
        {/* ✨ ADDED LINE-CLAMP-2 FOR ENTERPRISE TRUNCATION ✨ */}
        <div className="text-sm font-medium text-slate-600 px-1 py-1 rounded-xl line-clamp-2 whitespace-pre-line leading-relaxed">
          {data.text || <span className="text-slate-400 italic">No message configured...</span>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white group-hover:bg-[#25D366]" />
    </div>
  );
};

export const QuestionNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 w-72 overflow-hidden group hover:border-amber-500 hover:shadow-xl transition-all">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white" />
      <div className="px-4 py-3 border-b border-amber-100/50 flex items-center justify-between bg-amber-50/30">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <h3 className="font-bold text-amber-900 text-sm truncate w-48">{data.label || 'Ask a Question'}</h3>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {/* ✨ ADDED LINE-CLAMP-2 ✨ */}
        <div className="text-sm font-medium text-slate-700 line-clamp-2 whitespace-pre-line leading-relaxed px-1">
          {data.text || <span className="text-slate-400 italic">No question configured...</span>}
        </div>
        
        {data.options && data.options.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-slate-100/80">
            {data.options.map((opt: string, idx: number) => (
              <div key={idx} className="w-full py-1.5 px-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg text-center relative shadow-sm">
                <span className="truncate block w-full pr-2">{opt}</span>
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
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg mt-2">
            <MousePointerClick className="w-3.5 h-3.5" /> Waiting for text reply...
          </div>
        )}
      </div>
      {(!data.options || data.options.length === 0) && (
         <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white group-hover:bg-amber-500" />
      )}
    </div>
  );
};