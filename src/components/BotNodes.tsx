import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { 
  MessageSquare, User, Mail, Phone, Building, 
  List, MousePointerClick, FileText, 
  GitBranch, Webhook, HeadphonesIcon, Play,
  Image as ImageIcon, Video, Paperclip, LayoutGrid
} from 'lucide-react';

// ==========================================
// 0. TRIGGER NODE (START POINT)
// ==========================================
export const TriggerNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-[#25D366] shadow-md' : 'border-[#25D366]/40'}`}>
    <div className="bg-[#25D366]/10 px-4 py-3 flex items-center gap-2 rounded-t-xl border-b border-[#25D366]/20">
      <Play className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
      <span className="text-xs font-black text-[#1a9347] uppercase tracking-widest">Flow Trigger</span>
    </div>
    <div className="p-4 space-y-2">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trigger Condition</div>
      <div className="text-sm font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
        {data.message || 'Keyword: "Hi"'}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-[#25D366] border-2 border-white" />
  </div>
));

// ==========================================
// 1. RICH MESSAGE NODE (Text + Media)
// ==========================================
export const MessageNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-indigo-500 shadow-md' : 'border-slate-200 hover:border-indigo-300'}`}>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-indigo-500 border-none" />
    <div className="bg-indigo-50/50 px-4 py-2.5 flex items-center gap-2 rounded-t-xl border-b border-indigo-100">
      <MessageSquare className="w-4 h-4 text-indigo-500" />
      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Send Message</span>
    </div>
    <div className="p-4">
      {/* Media Attachment Indicator */}
      {data.mediaType && data.mediaType !== 'none' && (
        <div className="mb-2 bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-center gap-2 text-slate-400">
          {data.mediaType === 'image' ? <ImageIcon className="w-4 h-4" /> : data.mediaType === 'video' ? <Video className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
          <span className="text-[10px] font-bold uppercase tracking-widest">{data.mediaType} Attached</span>
        </div>
      )}
      <div className="text-sm text-slate-600 font-medium whitespace-pre-wrap line-clamp-3">
        {data.message || <span className="text-slate-400 italic">Type a message...</span>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-300 border-none" />
  </div>
));

// ==========================================
// 2. INTERACTIVE BUTTONS NODE
// ==========================================
export const ButtonNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-blue-500 shadow-md' : 'border-slate-200 hover:border-blue-300'}`}>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-blue-500 border-none" />
    <div className="bg-blue-50/50 px-4 py-2.5 flex items-center gap-2 rounded-t-xl border-b border-blue-100">
      <MousePointerClick className="w-4 h-4 text-blue-500" />
      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Buttons (Max 3)</span>
    </div>
    <div className="p-4 bg-slate-50/30">
      <div className="text-sm text-slate-700 font-medium mb-3">{data.message || 'Ask a question...'}</div>
      <div className="flex flex-col gap-1.5 mt-2">
        {(data.buttons || ['Option 1']).map((btn: string, i: number) => (
          <div key={i} className="relative w-full">
            <div className="w-full text-center py-2 bg-white border border-blue-100 rounded-lg text-xs font-bold text-blue-600 shadow-sm">{btn}</div>
            <Handle type="source" position={Position.Right} id={`btn-${i}`} className="w-2 h-2 bg-blue-400 border-none right-[-20px]" />
          </div>
        ))}
      </div>
    </div>
  </div>
));

// ==========================================
// 3. INTERACTIVE LIST MENU NODE
// ==========================================
export const ListNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-64 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-[#0ea5e9] shadow-md' : 'border-slate-200 hover:border-[#0ea5e9]'}`}>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-[#0ea5e9] border-none" />
    <div className="bg-[#0ea5e9]/10 px-4 py-2.5 flex items-center gap-2 rounded-t-xl border-b border-[#0ea5e9]/20">
      <List className="w-4 h-4 text-[#0ea5e9]" />
      <span className="text-[10px] font-black text-[#0ea5e9] uppercase tracking-widest">List Menu (Max 10)</span>
    </div>
    <div className="p-4 bg-slate-50/30">
      <div className="text-sm text-slate-700 font-medium mb-3">{data.message || 'Please select an option:'}</div>
      <div className="w-full text-center py-2.5 bg-slate-800 rounded-lg text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2">
        <List className="w-3.5 h-3.5" /> {data.menuTitle || 'View Options'}
      </div>
      <div className="text-[10px] font-bold text-slate-400 text-center mt-2">{data.listItems?.length || 0} Options Configured</div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-300 border-none" />
  </div>
));

// ==========================================
// 4. CAROUSEL / PRODUCT CARDS NODE
// ==========================================
export const CarouselNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-72 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-pink-500 shadow-md' : 'border-slate-200 hover:border-pink-300'}`}>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-pink-500 border-none" />
    <div className="bg-pink-50/50 px-4 py-2.5 flex items-center gap-2 rounded-t-xl border-b border-pink-100">
      <LayoutGrid className="w-4 h-4 text-pink-500" />
      <span className="text-[10px] font-black text-pink-700 uppercase tracking-widest">Product Carousel (Max 10)</span>
    </div>
    <div className="p-4 flex gap-2 overflow-hidden bg-slate-50/30">
      {/* Render mock mini-cards */}
      {(data.cards || [1,2]).slice(0,2).map((_: any, i: number) => (
        <div key={i} className="w-24 h-28 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="h-12 bg-slate-100 flex items-center justify-center"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
          <div className="p-1.5 flex-1">
            <div className="h-2 bg-slate-200 rounded w-full mb-1"></div>
            <div className="h-2 bg-slate-100 rounded w-2/3"></div>
          </div>
          <div className="h-5 bg-pink-50 border-t border-pink-100 mt-auto flex items-center justify-center"><span className="text-[7px] font-bold text-pink-600">BUTTON</span></div>
        </div>
      ))}
      {data.cards?.length > 2 && <div className="w-8 flex items-center justify-center text-slate-300 text-xs font-bold bg-slate-50 rounded-lg border border-slate-100 shrink-0">+{data.cards.length - 2}</div>}
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-300 border-none" />
  </div>
));

// ==========================================
// 5. LEAD CAPTURE (DATA COLLECTION) NODES
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
// 6. LOGIC & ACTION NODES
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
// ==========================================
// 7. WHATSAPP NATIVE FORM (FLOWS) NODE
// ==========================================
export const WaFormNode = memo(({ data, selected }: { data: any, selected: boolean }) => (
  <div className={`w-72 bg-white rounded-xl shadow-sm border-2 transition-all ${selected ? 'border-violet-500 shadow-md' : 'border-slate-200 hover:border-violet-300'}`}>
    <Handle type="target" position={Position.Top} className="w-2 h-2 bg-violet-500 border-none" />
    <div className="bg-violet-50/50 px-4 py-2.5 flex items-center gap-2 rounded-t-xl border-b border-violet-100">
      <FileText className="w-4 h-4 text-violet-600" />
      <span className="text-[10px] font-black text-violet-800 uppercase tracking-widest">WhatsApp Form (Flows)</span>
    </div>
    <div className="p-4 bg-slate-50/30">
      <div className="text-sm text-slate-800 font-bold mb-1">{data.formTitle || 'Lead Capture Form'}</div>
      <div className="text-xs text-slate-500 font-medium mb-3">{data.message || 'Please fill out this form:'}</div>
      
      <div className="w-full py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col gap-1.5 p-2 pointer-events-none">
        {(data.fields || [{name: 'Full Name', type: 'text'}]).slice(0, 3).map((f: any, i: number) => (
          <div key={i} className="w-full h-7 bg-slate-50 border border-slate-100 rounded md text-[10px] font-medium flex items-center px-2.5 text-slate-400">
            {f.name} {f.required ? <span className="text-red-400 ml-0.5">*</span> : ''}
          </div>
        ))}
        {(data.fields?.length > 3) && <div className="text-[9px] text-center text-slate-400 font-bold">+{data.fields.length - 3} more fields</div>}
        
        <div className="w-full mt-1 py-1.5 bg-violet-100 text-violet-700 rounded text-[10px] font-black uppercase tracking-widest text-center border border-violet-200 shadow-sm">
          {data.buttonText || 'Open Form'}
        </div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-slate-300 border-none" />
  </div>
));