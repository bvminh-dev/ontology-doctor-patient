import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Doctor from '@/models/Doctor';
import Patient from '@/models/Patient';
import MedicalRecord from '@/models/MedicalRecord';

// Rule type definitions
export enum RuleType {
  DOCTOR_OVERLOAD = 'doctor_overload',
  UNASSIGNED_PATIENT = 'unassigned_patient',
  FOLLOW_UP_DUE = 'follow_up_due',
  CRITICAL_DIAGNOSIS = 'critical_diagnosis',
  PATIENT_NO_RECORDS = 'patient_no_records',
  DOCTOR_UNDERUTILIZED = 'doctor_underutilized',
}

// Rule configurations
const ruleConfigs = {
  doctor_overload_threshold: 10,
  doctor_underutilized_threshold: 2,
  critical_diagnoses: ['Tuberculosis', 'COVID-19', 'Pneumonia', 'Sepsis', 'Meningitis', 'Influenza'],
  record_stale_days: 30,
};

export interface Alert {
  id: string;
  ruleType: RuleType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedEntities: {
    doctors?: any[];
    patients?: any[];
    records?: any[];
  };
  actions: Array<{
    label: string;
    type: 'navigate' | 'assign' | 'schedule' | 'view';
    target?: string;
  }>;
  createdAt: Date;
}

// Rule evaluation functions
async function evaluateDoctorOverload(): Promise<Alert[]> {
  await connectDB();

  const doctors = await Doctor.find({});
  const patients = await Patient.find({}).populate('assignedDoctor');

  // Count patients per doctor
  const doctorPatientCount = new Map<string, number>();
  patients.forEach((patient: any) => {
    if (patient.assignedDoctor?._id) {
      const doctorId = patient.assignedDoctor._id.toString();
      doctorPatientCount.set(doctorId, (doctorPatientCount.get(doctorId) || 0) + 1);
    }
  });

  const alerts: Alert[] = [];

  for (const [doctorId, count] of doctorPatientCount.entries()) {
    if (count > ruleConfigs.doctor_overload_threshold) {
      const doctor = await Doctor.findById(doctorId);
      if (doctor) {
        alerts.push({
          id: `alert-overload-${doctorId}`,
          ruleType: RuleType.DOCTOR_OVERLOAD,
          severity: 'warning',
          title: `Doctor Overload: ${doctor.name}`,
          description: `Dr. ${doctor.name} has ${count} patients assigned (threshold: ${ruleConfigs.doctor_overload_threshold})`,
          affectedEntities: {
            doctors: [doctor],
          },
          actions: [
            { label: 'View Patients', type: 'navigate', target: `/patients?doctor=${doctorId}` },
            { label: 'Reassign', type: 'assign', target: doctorId },
          ],
          createdAt: new Date(),
        });
      }
    }
  }

  return alerts;
}

async function evaluateUnassignedPatients(): Promise<Alert[]> {
  await connectDB();

  const unassignedPatients = await Patient.find({ assignedDoctor: { $exists: false } });

  if (unassignedPatients.length === 0) return [];

  return [{
    id: 'alert-unassigned-patients',
    ruleType: RuleType.UNASSIGNED_PATIENT,
    severity: 'warning',
    title: 'Unassigned Patients',
    description: `${unassignedPatients.length} patient(s) without assigned doctor`,
    affectedEntities: {
      patients: unassignedPatients,
    },
    actions: [
      { label: 'Assign Doctor', type: 'navigate', target: '/patients' },
    ],
    createdAt: new Date(),
  }];
}

async function evaluateFollowUpDue(): Promise<Alert[]> {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recordsRequiringFollowUp = await MedicalRecord.find({
    followUpDate: { $lte: today },
  }).populate('patient').populate('doctor');

  if (recordsRequiringFollowUp.length === 0) return [];

  return [{
    id: 'alert-followup-due',
    ruleType: RuleType.FOLLOW_UP_DUE,
    severity: 'info',
    title: 'Follow-up Appointments Due',
    description: `${recordsRequiringFollowUp.length} patient(s) have follow-up appointments due today or earlier`,
    affectedEntities: {
      records: recordsRequiringFollowUp,
    },
    actions: [
      { label: 'View Records', type: 'navigate', target: '/records' },
    ],
    createdAt: new Date(),
  }];
}

async function evaluateCriticalDiagnosis(): Promise<Alert[]> {
  await connectDB();

  const criticalRecords = await MedicalRecord.find({
    diagnosis: { $in: ruleConfigs.critical_diagnoses },
  })
    .populate('patient')
    .populate('doctor')
    .sort({ visitDate: -1 })
    .limit(20);

  if (criticalRecords.length === 0) return [];

  // Group by diagnosis
  const diagnosisGroups = new Map<string, any[]>();
  criticalRecords.forEach((record: any) => {
    if (!diagnosisGroups.has(record.diagnosis)) {
      diagnosisGroups.set(record.diagnosis, []);
    }
    diagnosisGroups.get(record.diagnosis)!.push(record);
  });

  const alerts: Alert[] = [];

  for (const [diagnosis, records] of diagnosisGroups.entries()) {
    alerts.push({
      id: `alert-critical-${diagnosis}`,
      ruleType: RuleType.CRITICAL_DIAGNOSIS,
      severity: 'critical',
      title: `Critical Diagnosis: ${diagnosis}`,
      description: `${records.length} recent case(s) of ${diagnosis} detected`,
      affectedEntities: {
        records: records,
      },
      actions: [
        { label: 'View Cases', type: 'view', target: diagnosis },
        { label: 'Contact Tracing', type: 'navigate', target: '/ontology' },
      ],
      createdAt: new Date(),
    });
  }

  return alerts;
}

async function evaluatePatientNoRecords(): Promise<Alert[]> {
  await connectDB();

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - ruleConfigs.record_stale_days);

  // Get all patients with records
  const patientsWithRecords = await MedicalRecord.aggregate([
    {
      $match: {
        visitDate: { $gte: staleDate },
      },
    },
    {
      $group: {
        _id: '$patient',
        lastRecordDate: { $max: '$visitDate' },
      },
    },
  ]);

  const recentPatientIds = new Set(
    patientsWithRecords.map((p: any) => p._id.toString())
  );

  const allPatients = await Patient.find({});
  const stalePatients = allPatients.filter(
    (p) => !recentPatientIds.has(p._id.toString())
  );

  if (stalePatients.length === 0) return [];

  return [{
    id: 'alert-stale-patients',
    ruleType: RuleType.PATIENT_NO_RECORDS,
    severity: 'info',
    title: 'Patients Without Recent Records',
    description: `${stalePatients.length} patient(s) haven't had medical records in ${ruleConfigs.record_stale_days} days`,
    affectedEntities: {
      patients: stalePatients,
    },
    actions: [
      { label: 'Create Records', type: 'navigate', target: '/records' },
    ],
    createdAt: new Date(),
  }];
}

async function evaluateDoctorUnderutilized(): Promise<Alert[]> {
  await connectDB();

  const doctors = await Doctor.find({});
  const patients = await Patient.find({}).populate('assignedDoctor');

  // Count patients per doctor
  const doctorPatientCount = new Map<string, number>();
  patients.forEach((patient: any) => {
    if (patient.assignedDoctor?._id) {
      const doctorId = patient.assignedDoctor._id.toString();
      doctorPatientCount.set(doctorId, (doctorPatientCount.get(doctorId) || 0) + 1);
    }
  });

  const alerts: Alert[] = [];

  doctors.forEach((doctor) => {
    const count = doctorPatientCount.get(doctor._id.toString()) || 0;
    if (count < ruleConfigs.doctor_underutilized_threshold) {
      alerts.push({
        id: `alert-underutilized-${doctor._id}`,
        ruleType: RuleType.DOCTOR_UNDERUTILIZED,
        severity: 'info',
        title: `Doctor Available: ${doctor.name}`,
        description: `Dr. ${doctor.name} (${doctor.specialty}) has capacity - only ${count} patient(s) assigned`,
        affectedEntities: {
          doctors: [doctor],
        },
        actions: [
          { label: 'Assign Patients', type: 'navigate', target: '/patients' },
        ],
        createdAt: new Date(),
      });
    }
  });

  return alerts;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleTypes = searchParams.get('ruleTypes')?.split(',') || [];

    const alerts: Alert[] = [];

    // Evaluate each rule type
    const ruleEvaluations = [
      () => evaluateDoctorOverload(),
      () => evaluateUnassignedPatients(),
      () => evaluateFollowUpDue(),
      () => evaluateCriticalDiagnosis(),
      () => evaluatePatientNoRecords(),
      () => evaluateDoctorUnderutilized(),
    ];

    for (const evaluation of ruleEvaluations) {
      const ruleAlerts = await evaluation();
      alerts.push(...ruleAlerts);
    }

    // Filter by rule types if specified
    const filteredAlerts = ruleTypes.length > 0
      ? alerts.filter((alert) => ruleTypes.includes(alert.ruleType))
      : alerts;

    // Sort by severity (critical > warning > info) then by date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    filteredAlerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        summary: {
          critical: filteredAlerts.filter((a) => a.severity === 'critical').length,
          warning: filteredAlerts.filter((a) => a.severity === 'warning').length,
          info: filteredAlerts.filter((a) => a.severity === 'info').length,
          total: filteredAlerts.length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate rules' },
      { status: 500 }
    );
  }
}
