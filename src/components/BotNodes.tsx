import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  MessageSquare, User, Mail, Phone, Building, 
  List, MousePointerClick, FileText, 
  GitBranch, Webhook, HeadphonesIcon 
} from 'lucide-react';

// ==========================================
// 1. MESSAGING & INTERACTIVE NODES
// ==========================================

export const MessageNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-indigo-500 shadow-md' : 'border-slate-200'}`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-white" />
    <div className="bg-indigo-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-indigo-100">
      <MessageSquare className="w-4 h-4 text-indigo-600" />
      <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Send Message</span>
    </div>
    <div className="p-4 text-sm text-slate-600 truncate">
      {data.message || <span className="text-slate-400 italic">Type a message...</span>}
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-white" />
  </div>
));

export const ButtonNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white" />
    <div className="bg-blue-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-blue-100">
      <MousePointerClick className="w-4 h-4 text-blue-600" />
      <span className="text-xs font-bold text-blue-900 uppercase tracking-widest">Buttons (Max 3)</span>
    </div>
    <div className="p-4 bg-slate-50 space-y-2 rounded-b-xl">
      <div className="text-sm font-medium text-slate-700 mb-3">{data.message || 'Ask a question...'}</div>
      {data.buttons?.map((btn: string, i: number) => (
        <div key={i} className="relative">
          <div className="w-full py-2 bg-white border border-blue-200 text-blue-700 text-xs font-bold text-center rounded-lg shadow-sm">
            {btn || `Button ${i + 1}`}
          </div>
          {/* Output handle for EACH button */}
          <Handle type="source" position={Position.Right} id={`btn-${i}`} className="w-3 h-3 bg-blue-500 border-2 border-white top-1/2 -translate-y-1/2 -right-1.5" />
        </div>
      ))}
      {(!data.buttons || data.buttons.length === 0) && (
        <div className="text-xs text-slate-400 text-center italic py-2">Select node to add buttons</div>
      )}
    </div>
  </div>
));

// ==========================================
// 2. LEAD CAPTURE (DATA COLLECTION) NODES
// ==========================================

const DataCaptureNode = ({ title, icon: Icon, colorClass, data, selected }: any) => {
  const colorMap: any = {
    emerald: { border: 'border-emerald-500', header: 'bg-emerald-50', textTitle: 'text-emerald-900', textIcon: 'text-emerald-600', handle: 'bg-emerald-500' },
    amber: { border: 'border-amber-500', header: 'bg-amber-50', textTitle: 'text-amber-900', textIcon: 'text-amber-600', handle: 'bg-amber-500' },
    rose: { border: 'border-rose-500', header: 'bg-rose-50', textTitle: 'text-rose-900', textIcon: 'text-rose-600', handle: 'bg-rose-500' }
  };
  const theme = colorMap[colorClass] || colorMap.emerald;

  return (
    <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? `${theme.border} shadow-md` : 'border-slate-200'}`}>
      <Handle type="target" position={Position.Top} className={`w-3 h-3 border-2 border-white ${theme.handle}`} />
      <div className={`${theme.header} px-4 py-2 flex items-center justify-between rounded-t-xl border-b border-slate-100`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${theme.textIcon}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${theme.textTitle}`}>{title}</span>
        </div>
        <div className="text-[9px] font-black bg-white px-1.5 py-0.5 rounded text-slate-400 border border-slate-200">CRM SYNC</div>
      </div>
      <div className="p-4 text-sm text-slate-600">
        {data.message || `Please provide your ${title.toLowerCase()}...`}
      </div>
      <Handle type="source" position={Position.Bottom} className={`w-3 h-3 border-2 border-white ${theme.handle}`} />
    </div>
  );
};

export const CaptureNameNode = memo((props: any) => <DataCaptureNode {...props} title="Ask Name" icon={User} colorClass="emerald" />);
export const CapturePhoneNode = memo((props: any) => <DataCaptureNode {...props} title="Ask Phone" icon={Phone} colorClass="amber" />);
export const CaptureEmailNode = memo((props: any) => <DataCaptureNode {...props} title="Ask Email" icon={Mail} colorClass="rose" />);

// ==========================================
// 3. LOGIC & ACTION NODES
// ==========================================

export const ConditionNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-purple-500 shadow-md' : 'border-slate-200'}`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white" />
    <div className="bg-purple-50 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-purple-100">
      <GitBranch className="w-4 h-4 text-purple-600" />
      <span className="text-xs font-bold text-purple-900 uppercase tracking-widest">Condition Match</span>
    </div>
    <div className="p-4 space-y-3">
      <div className="text-xs font-medium text-slate-600">
        If <span className="font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">{data.variable || 'Variable'}</span> {data.operator || 'equals'} <span className="font-bold text-purple-600">{data.value || 'Value'}</span>
      </div>
      <div className="flex justify-between relative mt-4">
        <div className="text-xs font-bold text-emerald-600">TRUE</div>
        <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-emerald-500 border-2 border-white left-1/4" />
        <div className="text-xs font-bold text-rose-600">FALSE</div>
        <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-rose-500 border-2 border-white left-3/4" />
      </div>
    </div>
  </div>
));

export const ApiRequestNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-slate-900 rounded-xl shadow-lg border-2 transition-all ${selected ? 'border-cyan-400' : 'border-slate-700'}`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-cyan-400 border-2 border-slate-900" />
    <div className="bg-slate-800 px-4 py-2 flex items-center gap-2 rounded-t-xl border-b border-slate-700">
      <Webhook className="w-4 h-4 text-cyan-400" />
      <span className="text-xs font-bold text-cyan-50 uppercase tracking-widest">API Request</span>
    </div>
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black text-cyan-900 bg-cyan-400 px-1.5 py-0.5 rounded">{data.method || 'GET'}</span>
        <span className="text-xs text-slate-300 truncate">{data.url || 'https://api.example.com'}</span>
      </div>
      <div className="text-[10px] text-slate-500 mt-2">Wait for response: {data.waitForResponse ? 'Yes' : 'No'}</div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-cyan-400 border-2 border-slate-900" />
  </div>
));

export const HandoverNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-rose-50 rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-rose-500 shadow-md' : 'border-rose-200'}`}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-rose-500 border-2 border-white" />
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><HeadphonesIcon className="w-5 h-5"/></div>
      <div>
        <div className="text-sm font-bold text-rose-900">Transfer to Agent</div>
        <div className="text-[10px] text-rose-600 font-medium">{data.department || 'General Inbox'}</div>
      </div>
    </div>
    {/* No output handle - this is a terminal node! */}
  </div>
));