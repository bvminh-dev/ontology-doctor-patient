'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Patient {
  _id: string;
  name: string;
  age: number;
  assignedDoctor?: { _id: string; name: string } | null;
}

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
}

interface MedicalRecordFormProps {
  onSuccess: () => void;
}

export default function MedicalRecordForm({ onSuccess }: MedicalRecordFormProps) {
  const [formData, setFormData] = useState({
    patient: '',
    doctor: '',
    visitDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    symptoms: [] as string[],
    treatment: '',
    notes: '',
    followUpDate: '',
  });

  const [symptomInput, setSymptomInput] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/patients');
      const result = await response.json();
      if (result.success) {
        setPatients(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

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

  const handlePatientChange = (patientId: string) => {
    setFormData({ ...formData, patient: patientId });

    // Auto-fill doctor with patient's assigned doctor
    const selectedPatient = patients.find((p) => p._id === patientId);
    if (selectedPatient?.assignedDoctor?._id) {
      setFormData((prev) => ({ ...prev, doctor: selectedPatient.assignedDoctor!._id }));
    }
  };

  const addSymptom = () => {
    if (symptomInput.trim() && formData.symptoms.length < 10) {
      setFormData({
        ...formData,
        symptoms: [...formData.symptoms, symptomInput.trim()],
      });
      setSymptomInput('');
    }
  };

  const removeSymptom = (index: number) => {
    setFormData({
      ...formData,
      symptoms: formData.symptoms.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        symptoms: formData.symptoms,
        followUpDate: formData.followUpDate || undefined,
        visitDate: new Date(formData.visitDate),
      };

      const response = await fetch('/api/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        // Reset form
        setFormData({
          patient: '',
          doctor: '',
          visitDate: new Date().toISOString().split('T')[0],
          diagnosis: '',
          symptoms: [],
          treatment: '',
          notes: '',
          followUpDate: '',
        });
        onSuccess();
      } else {
        setError(result.error || 'Failed to create medical record');
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
        <CardTitle className="text-lg">New Medical Record</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="patient" className="text-xs">Patient *</Label>
            <select
              id="patient"
              value={formData.patient}
              onChange={(e) => handlePatientChange(e.target.value)}
              className="flex h-10 w-full rounded-[8px] border border-[#CED0D4] bg-white px-3 py-2 text-sm text-[#1C2B33] focus:outline-none focus:ring-3 focus:ring-[#0064E0]"
              required
            >
              <option value="">Select a patient</option>
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>
                  {patient.name} (Age: {patient.age})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctor" className="text-xs">Doctor *</Label>
            <select
              id="doctor"
              value={formData.doctor}
              onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
              className="flex h-10 w-full rounded-[8px] border border-[#CED0D4] bg-white px-3 py-2 text-sm text-[#1C2B33] focus:outline-none focus:ring-3 focus:ring-[#0064E0]"
              required
            >
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name} - {doctor.specialty}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitDate" className="text-xs">Visit Date *</Label>
            <Input
              id="visitDate"
              type="date"
              value={formData.visitDate}
              onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
              required
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis" className="text-xs">Diagnosis *</Label>
            <Input
              id="diagnosis"
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              placeholder="Primary diagnosis"
              required
              maxLength={500}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptoms" className="text-xs">Symptoms (max 10)</Label>
            <div className="flex gap-2">
              <Input
                id="symptoms"
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSymptom())}
                placeholder="Add symptom and press Enter"
                disabled={formData.symptoms.length >= 10}
                className="text-sm flex-1"
              />
              <Button
                type="button"
                onClick={addSymptom}
                disabled={!symptomInput.trim() || formData.symptoms.length >= 10}
                variant="outline"
                size="sm"
                className="rounded-[100px]"
              >
                Add
              </Button>
            </div>
            {formData.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.symptoms.map((symptom, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#E8F3FF] text-[#0064E0] text-xs"
                  >
                    {symptom}
                    <button
                      type="button"
                      onClick={() => removeSymptom(index)}
                      className="hover:text-[#E41E3F]"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment" className="text-xs">Treatment Plan</Label>
            <textarea
              id="treatment"
              value={formData.treatment}
              onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
              placeholder="Treatment details..."
              rows={3}
              maxLength={1000}
              className="flex w-full rounded-[8px] border border-[#CED0D4] bg-white px-3 py-2 text-sm text-[#1C2B33] focus:outline-none focus:ring-3 focus:ring-[#0064E0] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs">Additional Notes</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
              maxLength={2000}
              className="flex w-full rounded-[8px] border border-[#CED0D4] bg-white px-3 py-2 text-sm text-[#1C2B33] focus:outline-none focus:ring-3 focus:ring-[#0064E0] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpDate" className="text-xs">Follow-up Date (Optional)</Label>
            <Input
              id="followUpDate"
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              className="text-sm"
            />
          </div>

          {error && <p className="text-sm text-[#E41E3F] font-medium bg-[rgba(255,123,145,0.15)] px-3 py-2 rounded-[8px]">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Creating...' : 'Create Medical Record'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
