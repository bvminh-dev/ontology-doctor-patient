'use client';

import { useState } from 'react';
import DoctorForm from '@/components/DoctorForm';
import PatientForm from '@/components/PatientForm';
import DoctorList from '@/components/DoctorList';
import PatientList from '@/components/PatientList';
import OntologyGraph from '@/components/OntologyGraph';
import MedicalRecordForm from '@/components/MedicalRecordForm';
import MedicalRecordList from '@/components/MedicalRecordList';
import AlertDashboard from '@/components/AlertDashboard';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { Button } from '@/components/ui/button';

type TabType = 'doctors' | 'patients' | 'ontology' | 'records' | 'insights';

export default function Home() {
  const [tab, setTab] = useState<TabType>('doctors');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-[rgba(241,244,247,0.8)] backdrop-blur-md border-b border-[rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-xl font-medium text-[#1C2B33]">
              Doctor-Patient Management
            </h1>
            <div className="flex gap-3">
              <Button
                onClick={() => setTab('doctors')}
                variant={tab === 'doctors' ? 'default' : 'ghost'}
                size="sm"
              >
                Doctors
              </Button>
              <Button
                onClick={() => setTab('patients')}
                variant={tab === 'patients' ? 'default' : 'ghost'}
                size="sm"
              >
                Patients
              </Button>
              <Button
                onClick={() => setTab('records')}
                variant={tab === 'records' ? 'default' : 'ghost'}
                size="sm"
              >
                Records
              </Button>
              <Button
                onClick={() => setTab('ontology')}
                variant={tab === 'ontology' ? 'default' : 'ghost'}
                size="sm"
              >
                Ontology
              </Button>
              <Button
                onClick={() => setTab('insights')}
                variant={tab === 'insights' ? 'default' : 'ghost'}
                size="sm"
              >
                Insights
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-7xl">
        {tab === 'insights' ? (
          <div className="space-y-8">
            <AlertDashboard refreshTrigger={refreshTrigger} />
            <AnalyticsDashboard refreshTrigger={refreshTrigger} />
          </div>
        ) : tab === 'ontology' ? (
          <OntologyGraph refreshTrigger={refreshTrigger} onSuccess={handleSuccess} />
        ) : tab === 'records' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <MedicalRecordForm onSuccess={handleSuccess} />
            </div>
            <div className="lg:col-span-2">
              <MedicalRecordList refreshTrigger={refreshTrigger} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              {tab === 'doctors' ? (
                <DoctorForm onSuccess={handleSuccess} />
              ) : (
                <PatientForm onSuccess={handleSuccess} />
              )}
            </div>

            <div className="lg:col-span-2">
              {tab === 'doctors' ? (
                <DoctorList refreshTrigger={refreshTrigger} />
              ) : (
                <PatientList refreshTrigger={refreshTrigger} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
