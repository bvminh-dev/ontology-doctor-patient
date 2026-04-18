'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Patient {
  _id: string;
  name: string;
  age: number;
}

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
}

interface MedicalRecord {
  _id: string;
  patient: Patient;
  doctor: Doctor;
  visitDate: string;
  diagnosis: string;
  symptoms?: string[];
}

interface MedicalRecordListProps {
  refreshTrigger: number;
  patientFilter?: string;
  doctorFilter?: string;
}

export default function MedicalRecordList({
  refreshTrigger,
  patientFilter,
  doctorFilter,
}: MedicalRecordListProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [refreshTrigger, patientFilter, doctorFilter]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (patientFilter) params.append('patientId', patientFilter);
      if (doctorFilter) params.append('doctorId', doctorFilter);

      const response = await fetch(`/api/medical-records?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setRecords(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch medical records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this medical record?')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/medical-records/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setRecords(records.filter((r) => r._id !== id));
      }
    } catch (err) {
      console.error('Failed to delete medical record:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Medical Records ({records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#5D6C7B]">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Medical Records ({records.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-[#5D6C7B]">No medical records found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Symptoms</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record._id}>
                  <TableCell className="font-medium text-[#1C2B33]">
                    {formatDate(record.visitDate)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-[#1C2B33]">{record.patient.name}</div>
                      <div className="text-xs text-[#65676B]">Age: {record.patient.age}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-[#1C2B33]">{record.doctor.name}</div>
                      <div className="text-xs text-[#65676B]">{record.doctor.specialty}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{record.diagnosis}</TableCell>
                  <TableCell>
                    {record.symptoms && record.symptoms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {record.symptoms.slice(0, 2).map((symptom, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full bg-[#E8F3FF] text-[#0064E0] text-xs"
                          >
                            {symptom}
                          </span>
                        ))}
                        {record.symptoms.length > 2 && (
                          <span className="text-xs text-[#65676B]">
                            +{record.symptoms.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#BCC0C4]">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleDelete(record._id)}
                      disabled={deletingId === record._id}
                      variant="ghost"
                      size="sm"
                      className="text-[#E41E3F] hover:text-[#C80A28] hover:bg-[rgba(255,123,145,0.15)]"
                    >
                      {deletingId === record._id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
