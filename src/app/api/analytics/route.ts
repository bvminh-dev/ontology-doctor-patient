import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Doctor from '@/models/Doctor';
import Patient from '@/models/Patient';
import MedicalRecord from '@/models/MedicalRecord';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    switch (type) {
      case 'overview':
        return await getOverview();
      case 'diagnoses':
        return await getDiagnosisStats();
      case 'specialty-utilization':
        return await getSpecialtyUtilization();
      case 'timeline':
        return await getTimeline(searchParams);
      case 'doctor-ranking':
        return await getDoctorRanking();
      default:
        return NextResponse.json({ success: false, error: 'Invalid analytics type' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

async function getOverview() {
  const [totalDoctors, totalPatients, totalRecords, unassignedPatients] = await Promise.all([
    Doctor.countDocuments({}),
    Patient.countDocuments({}),
    MedicalRecord.countDocuments({}),
    Patient.countDocuments({ assignedDoctor: { $exists: false } }),
  ]);

  // Calculate overloaded doctors
  const patients = await Patient.find({}).populate('assignedDoctor');
  const doctorPatientCount = new Map<string, number>();
  patients.forEach((patient: any) => {
    if (patient.assignedDoctor?._id) {
      const doctorId = patient.assignedDoctor._id.toString();
      doctorPatientCount.set(doctorId, (doctorPatientCount.get(doctorId) || 0) + 1);
    }
  });

  const overloadedDoctors = Array.from(doctorPatientCount.values()).filter(
    (count) => count > 10
  ).length;

  return NextResponse.json({
    success: true,
    data: {
      totalDoctors,
      totalPatients,
      totalRecords,
      unassignedPatients,
      overloadedDoctors,
      avgPatientsPerDoctor: totalDoctors > 0 ? (totalPatients - unassignedPatients) / totalDoctors : 0,
    },
  });
}

async function getDiagnosisStats() {
  const diagnosisCounts = await MedicalRecord.aggregate([
    {
      $group: {
        _id: '$diagnosis',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);

  const totalRecords = await MedicalRecord.countDocuments();

  const stats = diagnosisCounts.map((item: any) => ({
    diagnosis: item._id,
    count: item.count,
    percentage: totalRecords > 0 ? ((item.count / totalRecords) * 100).toFixed(1) : 0,
  }));

  return NextResponse.json({ success: true, data: stats });
}

async function getSpecialtyUtilization() {
  const doctors = await Doctor.find({});
  const patients = await Patient.find({}).populate('assignedDoctor');

  // Group by specialty
  const specialtyStats = new Map<string, {
    doctorCount: number;
    patientCount: number;
    overloadedCount: number;
  }>();

  doctors.forEach((doctor) => {
    const specialty = doctor.specialty;
    if (!specialtyStats.has(specialty)) {
      specialtyStats.set(specialty, {
        doctorCount: 0,
        patientCount: 0,
        overloadedCount: 0,
      });
    }
    specialtyStats.get(specialty)!.doctorCount++;
  });

  // Count patients per specialty
  const doctorPatientCount = new Map<string, number>();
  patients.forEach((patient: any) => {
    if (patient.assignedDoctor) {
      const doctorId = patient.assignedDoctor._id.toString();
      doctorPatientCount.set(doctorId, (doctorPatientCount.get(doctorId) || 0) + 1);
    }
  });

  // Calculate utilization per specialty
  const result = [];

  for (const [specialty, stats] of specialtyStats.entries()) {
    const specialtyDoctors = doctors.filter((d) => d.specialty === specialty);
    let totalPatients = 0;
    let overloadedCount = 0;

    specialtyDoctors.forEach((doctor) => {
      const count = doctorPatientCount.get(doctor._id.toString()) || 0;
      totalPatients += count;
      if (count > 10) overloadedCount++;
    });

    result.push({
      specialty,
      doctorCount: stats.doctorCount,
      patientCount: totalPatients,
      avgPatientsPerDoctor: stats.doctorCount > 0 ? (totalPatients / stats.doctorCount).toFixed(1) : 0,
      overloadedCount,
    });
  }

  result.sort((a, b) => b.patientCount - a.patientCount);

  return NextResponse.json({ success: true, data: result });
}

async function getTimeline(searchParams: URLSearchParams) {
  const days = parseInt(searchParams.get('days') || '30');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const timelineData = await MedicalRecord.aggregate([
    {
      $match: {
        visitDate: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$visitDate' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return NextResponse.json({ success: true, data: timelineData });
}

async function getDoctorRanking() {
  const patients = await Patient.find({}).populate('assignedDoctor');

  const doctorPatientCount = new Map<string, {
    name: string;
    specialty: string;
    count: number;
  }>();

  patients.forEach((patient: any) => {
    if (patient.assignedDoctor) {
      const doctor = patient.assignedDoctor;
      const doctorId = doctor._id.toString();
      const existing = doctorPatientCount.get(doctorId);

      if (existing) {
        existing.count++;
      } else {
        doctorPatientCount.set(doctorId, {
          name: doctor.name,
          specialty: doctor.specialty,
          count: 1,
        });
      }
    }
  });

  const ranking = Array.from(doctorPatientCount.values())
    .sort((a, b) => b.count - a.count)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return NextResponse.json({ success: true, data: ranking });
}
