'use client';

import { Handle, Position } from 'reactflow';
import { User, ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface PatientNodeData {
  name: string;
  age: number;
  hasDoctor: boolean;
  recordCount?: number;
  isExpanded?: boolean;
}

interface PatientNodeProps {
  data: PatientNodeData;
}

export default function PatientNode({ data }: PatientNodeProps) {
  return (
    <div className="relative px-3 py-2 rounded-[12px] bg-[#F7F8FA] border border-[#DEE3E9] shadow-sm hover:shadow-md hover:border-[#CBD2D9] transition-all duration-200 cursor-pointer min-w-[160px]">
      {/* Left handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#0064E0] !border-[#0064E0] !w-4 !h-4 !border-2 hover:!scale-125 transition-transform"
      />
      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#0064E0] !border-[#0064E0] !w-4 !h-4 !border-2 hover:!scale-125 transition-transform"
      />
      <div className="flex items-center gap-2">
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {data.recordCount !== undefined && data.recordCount > 0 ? (
            data.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#0064E0]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#0064E0]" />
            )
          ) : null}
        </div>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${data.hasDoctor ? 'bg-[#0064E0]/10' : 'bg-[#BCC0C4]/30'}`}>
          <User className={`w-3 h-3 ${data.hasDoctor ? 'text-[#0064E0]' : 'text-[#BCC0C4]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-[#1C2B33] leading-tight truncate">
            {data.name}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#5D6C7B]">
            <span>{data.age} years old</span>
            {data.recordCount !== undefined && data.recordCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[#0064E0]">
                <FileText className="w-3 h-3" />
                <span>{data.recordCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
