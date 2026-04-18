'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
}

interface PatientFormProps {
  onSuccess: () => void;
}

export default function PatientForm({ onSuccess }: PatientFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    phone: '',
    email: '',
    assignedDoctor: '',
  });
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await fetch('/api/doctors');
      const result = await response.json();
      if (result.success) {
        setDoctors(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age),
        assignedDoctor: formData.assignedDoctor || undefined,
      };

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setFormData({ name: '', age: '', phone: '', email: '', assignedDoctor: '' });
        onSuccess();
      } else {
        setError(result.error || 'Failed to create patient');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add New Patient</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter patient name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age" className="text-xs">Age *</Label>
            <Input
              id="age"
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              required
              min="0"
              max="150"
              placeholder="Enter age"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs">Phone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              placeholder="e.g., +1 234 567 8900"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="patient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignedDoctor" className="text-xs">Assigned Doctor (Optional)</Label>
            <select
              id="assignedDoctor"
              value={formData.assignedDoctor}
              onChange={(e) => setFormData({ ...formData, assignedDoctor: e.target.value })}
              className="flex h-10 w-full rounded-[8px] border border-[#CED0D4] bg-white px-3 py-2 text-sm text-[#1C2B33] focus:outline-none focus:ring-3 focus:ring-[#0064E0]"
            >
              <option value="">No doctor assigned</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name} - {doctor.specialty}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-[#E41E3F] font-medium bg-[rgba(255,123,145,0.15)] px-3 py-2 rounded-[8px]">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Creating...' : 'Create Patient'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
