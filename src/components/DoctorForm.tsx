'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DoctorFormProps {
  onSuccess: () => void;
}

export default function DoctorForm({ onSuccess }: DoctorFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setFormData({ name: '', specialty: '', phone: '', email: '' });
        onSuccess();
      } else {
        setError(result.error || 'Failed to create doctor');
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
        <CardTitle className="text-lg">Add New Doctor</CardTitle>
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
              placeholder="Enter doctor name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty" className="text-xs">Specialty *</Label>
            <Input
              id="specialty"
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              required
              placeholder="e.g., Cardiology, Neurology"
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
              placeholder="doctor@example.com"
            />
          </div>
          {error && <p className="text-sm text-[#E41E3F] font-medium bg-[rgba(255,123,145,0.15)] px-3 py-2 rounded-[8px]">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Creating...' : 'Create Doctor'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
