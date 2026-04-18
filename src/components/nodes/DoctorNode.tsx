'use client';

import { Handle, Position } from 'reactflow';
import { Stethoscope } from 'lucide-react';

interface DoctorNodeData {
  name: string;
  specialty: string;
  patientCount: number;
}

interface DoctorNodeProps {
  data: DoctorNodeData;
}

export default function DoctorNode({ data }: DoctorNodeProps) {
  return (
    <div className="relative px-4 py-3 rounded-[20px] bg-[#0064E0] shadow-[0_12px_28px_0_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] border-2 border-transparent hover:border-[#47A5FA] transition-all duration-200 min-w-[180px]">
      {/* Left handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-white !border-[#0064E0] !w-4 !h-4 !border-2 hover:!scale-125 transition-transform"
      />
      {/* Right handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-white !border-[#0064E0] !w-4 !h-4 !border-2 hover:!scale-125 transition-transform"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Stethoscope className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white leading-tight">
            {data.name}
          </div>
        </div>
      </div>
      <div className="text-xs text-white/80 mb-2">
        {data.specialty}
      </div>
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20">
        <span className="text-xs font-medium text-white">
          {data.patientCount} {data.patientCount === 1 ? 'patient' : 'patients'}
        </span>
      </div>
    </div>
  );
}
