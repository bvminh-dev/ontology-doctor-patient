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

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
}

interface DoctorListProps {
  refreshTrigger: number;
}

export default function DoctorList({ refreshTrigger }: DoctorListProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, [refreshTrigger]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/doctors');
      const result = await response.json();
      if (result.success) {
        setDoctors(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Doctors</CardTitle>
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
        <CardTitle className="text-lg">Doctors ({doctors.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {doctors.length === 0 ? (
          <p className="text-[#5D6C7B]">No doctors found. Add your first doctor!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor._id}>
                  <TableCell className="font-bold text-[#1C2B33]">{doctor.name}</TableCell>
                  <TableCell>{doctor.specialty}</TableCell>
                  <TableCell>{doctor.phone}</TableCell>
                  <TableCell>{doctor.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
