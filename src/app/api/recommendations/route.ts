import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Doctor from '@/models/Doctor';
import Patient from '@/models/Patient';
import MedicalRecord from '@/models/MedicalRecord';

// Symptom to specialty mapping
const symptomSpecialtyMap: Record<string, string[]> = {
  'chest pain': ['Cardiology', 'Internal Medicine'],
  'heart': ['Cardiology'],
  'palpitations': ['Cardiology'],
  'skin': ['Dermatology'],
  'rash': ['Dermatology'],
  'itching': ['Dermatology'],
  'fever': ['Internal Medicine', 'Infectious Disease'],
  'cough': ['Pulmonology', 'Internal Medicine'],
  'breathing': ['Pulmonology'],
  'shortness of breath': ['Pulmonology', 'Cardiology'],
  'headache': ['Neurology', 'Internal Medicine'],
  'dizziness': ['Neurology'],
  'seizure': ['Neurology'],
  'stomach': ['Gastroenterology'],
  'digestive': ['Gastroenterology'],
  'nausea': ['Gastroenterology'],
  'joint': ['Orthopedics', 'Rheumatology'],
  'pain': ['Orthopedics', 'Pain Management'],
  'fracture': ['Orthopedics'],
  'child': ['Pediatrics'],
  'diabetes': ['Endocrinology'],
  'thyroid': ['Endocrinology'],
  'eye': ['Ophthalmology'],
  'ear': ['Otolaryngology'],
  'throat': ['Otolaryngology'],
  'mental': ['Psychiatry'],
  'anxiety': ['Psychiatry'],
  'depression': ['Psychiatry'],
  'pregnant': ['Obstetrics', 'Gynecology'],
  'woman': ['Gynecology'],
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'doctors';
    const patientId = searchParams.get('patientId');
    const symptoms = searchParams.get('symptoms')?.split(',');

    switch (type) {
      case 'doctors':
        return await recommendDoctors(patientId || undefined);
      case 'specialists':
        return await recommendSpecialists(symptoms || []);
      case 'similar-patients':
        return await findSimilarPatients(patientId!);
      default:
        return NextResponse.json({ success: false, error: 'Invalid recommendation type' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Recommendation failed' }, { status: 500 });
  }
}

// Recommend doctors for a patient
async function recommendDoctors(patientId?: string) {
  let patientSymptoms: string[] = [];
  let patientAge: number | undefined;
  let existingDoctorId: string | undefined;

  if (patientId) {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    // Get recent diagnoses/symptoms from medical records
    const recentRecords = await MedicalRecord.find({ patient: patientId })
      .sort({ visitDate: -1 })
      .limit(5);

    recentRecords.forEach((record) => {
      if (record.symptoms) {
        patientSymptoms.push(...record.symptoms);
      }
    });

    patientAge = patient.age;
    existingDoctorId = patient.assignedDoctor?.toString();
  }

  // Get all doctors with current load
  const doctors = await Doctor.find({});
  const patients = await Patient.find({}).populate('assignedDoctor');

  const doctorLoad = new Map<string, number>();
  patients.forEach((p: any) => {
    if (p.assignedDoctor) {
      const docId = p.assignedDoctor._id.toString();
      doctorLoad.set(docId, (doctorLoad.get(docId) || 0) + 1);
    }
  });

  // Score each doctor
  const recommendations = doctors
    .filter((doctor) => doctor._id.toString() !== existingDoctorId)
    .map((doctor) => {
      const docId = doctor._id.toString();
      const load = doctorLoad.get(docId) || 0;

      // Specialty matching based on symptoms
      const relevantSpecialties = patientSymptoms.flatMap(
        (symptom) => symptomSpecialtyMap[symptom.toLowerCase()] || []
      );

      const specialtyMatch = relevantSpecialties.includes(doctor.specialty) ? 1 : 0;

      // Load score (lower load = higher score)
      const loadScore = Math.max(0, 1 - load / 15);

      // Final score
      const score = specialtyMatch * 0.7 + loadScore * 0.3;

      return {
        doctorId: docId,
        name: doctor.name,
        specialty: doctor.specialty,
        score: Math.round(score * 100) / 100,
        currentLoad: load,
        reason: specialtyMatch
          ? `Specializes in relevant area for symptoms`
          : `Available (${load} patients)`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return NextResponse.json({
    success: true,
    data: {
      patientId,
      recommendations,
    },
  });
}

// Recommend specialists based on symptoms
async function recommendSpecialists(symptoms: string[]) {
  if (!symptoms || symptoms.length === 0) {
    return NextResponse.json({
      success: true,
      data: { recommendations: [] },
    });
  }

  // Map symptoms to specialties
  const specialtyScores = new Map<string, number>();

  symptoms.forEach((symptom) => {
    const symptomLower = symptom.toLowerCase();
    const specialties = symptomSpecialtyMap[symptomLower] || [];

    specialties.forEach((specialty) => {
      specialtyScores.set(
        specialty,
        (specialtyScores.get(specialty) || 0) + 1
      );
    });
  });

  // Get doctors by specialty
  const recommendations = [];

  for (const [specialty, score] of specialtyScores.entries()) {
    const doctors = await Doctor.find({ specialty });
    const patients = await Patient.find({ assignedDoctor: { $in: doctors.map((d) => d._id) } });

    recommendations.push({
      specialty,
      score,
      doctorCount: doctors.length,
      patientCount: patients.length,
      avgLoad: doctors.length > 0 ? (patients.length / doctors.length).toFixed(1) : 0,
      doctors: doctors.map((d) => ({
        id: d._id,
        name: d.name,
        email: d.email,
      })),
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    success: true,
    data: {
      symptoms,
      recommendations,
    },
  });
}

// Find similar patients (for case comparison, research, etc.)
async function findSimilarPatients(patientId: string) {
  const targetPatient = await Patient.findById(patientId).populate('assignedDoctor');
  if (!targetPatient) {
    return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
  }

  // Get patient's medical history
  const patientRecords = await MedicalRecord.find({ patient: patientId });
  const patientDiagnoses = new Set(patientRecords.map((r) => r.diagnosis));

  // Find all patients with overlapping diagnoses
  const allRecords = await MedicalRecord.find({})
    .populate('patient')
    .sort({ visitDate: -1 });

  const patientSimilarity = new Map<string, { similarity: number; commonDiagnoses: string[] }>();

  allRecords.forEach((record: any) => {
    const otherPatientId = record.patient._id.toString();
    if (otherPatientId === patientId) return;

    const commonDiagnoses = patientDiagnoses.has(record.diagnosis)
      ? [record.diagnosis]
      : [];

    if (commonDiagnoses.length > 0) {
      const existing = patientSimilarity.get(otherPatientId);
      if (existing) {
        existing.similarity += commonDiagnoses.length;
        existing.commonDiagnoses.push(...commonDiagnoses);
      } else {
        patientSimilarity.set(otherPatientId, {
          similarity: commonDiagnoses.length,
          commonDiagnoses: [...commonDiagnoses],
        });
      }
    }
  });

  // Convert to array and sort by similarity
  const similarPatientsPromises = Array.from(patientSimilarity.entries())
    .sort((a, b) => b[1].similarity - a[1].similarity)
    .slice(0, 10)
    .map(async ([patientIdStr, data]) => {
      const patient = await Patient.findById(patientIdStr).populate('assignedDoctor');
      if (!patient) return null;
      return {
        id: patient._id,
        name: patient.name,
        age: patient.age,
        assignedDoctor: patient.assignedDoctor,
        similarityScore: data.similarity,
        commonDiagnoses: [...new Set(data.commonDiagnoses)],
      };
    });

  const similarPatients = (await Promise.all(similarPatientsPromises)).filter((p): p is NonNullable<typeof p> => p !== null);

  return NextResponse.json({
    success: true,
    data: {
      targetPatient: {
        id: targetPatient._id,
        name: targetPatient.name,
        age: targetPatient.age,
        diagnoses: Array.from(patientDiagnoses),
      },
      similarPatients,
    },
  });
}
