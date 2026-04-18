'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, UserPlus, Activity, TrendingUp } from 'lucide-react';

interface OverviewStats {
  totalDoctors: number;
  totalPatients: number;
  totalRecords: number;
  unassignedPatients: number;
  overloadedDoctors: number;
  avgPatientsPerDoctor: number;
}

interface DiagnosisStats {
  diagnosis: string;
  count: number;
  percentage: string;
}

interface SpecialtyUtilization {
  specialty: string;
  doctorCount: number;
  patientCount: number;
  avgPatientsPerDoctor: string;
  overloadedCount: number;
}

interface AnalyticsDashboardProps {
  refreshTrigger?: number;
}

export default function AnalyticsDashboard({ refreshTrigger = 0 }: AnalyticsDashboardProps) {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisStats[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyUtilization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [refreshTrigger]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, diagnosesRes, specialtiesRes] = await Promise.all([
        fetch('/api/analytics?type=overview'),
        fetch('/api/analytics?type=diagnoses'),
        fetch('/api/analytics?type=specialty-utilization'),
      ]);

      const overviewData = await overviewRes.json();
      const diagnosesData = await diagnosesRes.json();
      const specialtiesData = await specialtiesRes.json();

      if (overviewData.success) setOverview(overviewData.data);
      if (diagnosesData.success) setDiagnoses(diagnosesData.data);
      if (specialtiesData.success) setSpecialties(specialtiesData.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#5D6C7B]">Loading analytics...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8 text-[#0064E0]" />
                <div>
                  <p className="text-2xl font-bold text-[#1C2B33]">{overview.totalDoctors}</p>
                  <p className="text-xs text-[#65676B]">Doctors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-8 h-8 text-[#31A24C]" />
                <div>
                  <p className="text-2xl font-bold text-[#1C2B33]">{overview.totalPatients}</p>
                  <p className="text-xs text-[#65676B]">Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="w-8 h-8 text-[#6441D2]" />
                <div>
                  <p className="text-2xl font-bold text-[#1C2B33]">{overview.totalRecords}</p>
                  <p className="text-xs text-[#65676B]">Records</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E41E3F] bg-[rgba(228,30,63,0.1)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-8 h-8 text-[#E41E3F]" />
                <div>
                  <p className="text-2xl font-bold text-[#E41E3F]">{overview.overloadedDoctors}</p>
                  <p className="text-xs text-[#65676B]">Overloaded</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-8 h-8 text-[#1C2B33]" />
                <div>
                  <p className="text-2xl font-bold text-[#1C2B33]">
                    {overview.avgPatientsPerDoctor.toFixed(1)}
                  </p>
                  <p className="text-xs text-[#65676B]">Avg Load</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#F7B928] bg-[rgba(247,185,40,0.1)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-8 h-8 text-[#F7B928]" />
                <div>
                  <p className="text-2xl font-bold text-[#E41E3F]">{overview.unassignedPatients}</p>
                  <p className="text-xs text-[#65676B]">Unassigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Diagnoses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Diagnoses</CardTitle>
          </CardHeader>
          <CardContent>
            {diagnoses.length === 0 ? (
              <p className="text-[#5D6C7B]">No data available</p>
            ) : (
              <div className="space-y-3">
                {diagnoses.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-[#1C2B33]">{item.diagnosis}</span>
                        <span className="text-sm text-[#65676B]">{item.count} cases</span>
                      </div>
                      <div className="w-full h-2 bg-[#F1F4F7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0064E0] rounded-full transition-all"
                          style={{ width: `${Math.min(Number(item.percentage), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Specialty Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Specialty Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            {specialties.length === 0 ? (
              <p className="text-[#5D6C7B]">No data available</p>
            ) : (
              <div className="space-y-3">
                {specialties.map((item) => (
                  <div
                    key={item.specialty}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#F7F8FA]"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#1C2B33]">{item.specialty}</p>
                      <p className="text-xs text-[#65676B]">
                        {item.doctorCount} doctor{item.doctorCount !== 1 ? 's' : ''} • {item.patientCount} patients
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#1C2B33]">{item.avgPatientsPerDoctor}</p>
                      <p className="text-xs text-[#65676B]">avg/load</p>
                    </div>
                    {item.overloadedCount > 0 && (
                      <div className="ml-3 px-2 py-1 rounded-full bg-[#E41E3F] text-white text-xs">
                        {item.overloadedCount} overload
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
