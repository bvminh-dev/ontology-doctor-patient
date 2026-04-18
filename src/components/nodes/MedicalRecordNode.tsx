'use client';

import { FileText } from 'lucide-react';

interface MedicalRecordNodeData {
  diagnosis: string;
  visitDate: string;
  patientName: string;
}

interface MedicalRecordNodeProps {
  data: MedicalRecordNodeData;
}

export default function MedicalRecordNode({ data }: MedicalRecordNodeProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="px-2 py-1.5 rounded-[8px] bg-[#E8F3FF] border border-[#ADD4E0] shadow-sm hover:shadow-md hover:border-[#0064E0] transition-all duration-200 min-w-[120px] cursor-default pointer-events-none">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-[#0064E0]/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-3 h-3 text-[#0064E0]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-[#1C2B33] leading-tight truncate" title={data.diagnosis}>
            {data.diagnosis}
          </div>
          <div className="text-[9px] text-[#5D6C7B]">
            {formatDate(data.visitDate)}
          </div>
        </div>
      </div>
    </div>
  );
}
