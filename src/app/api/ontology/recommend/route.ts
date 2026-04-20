import { NextRequest, NextResponse } from 'next/server';
import { OntologyStore } from '@/ontology/lib/OntologyStore';
import { exportToOntology } from '@/ontology/lib/mongodb-to-rdf';
import { OntologyReasoner, defaultRules, extractRecommendations, extractSimilarPatients } from '@/ontology/lib/reasoner';
import connectDB from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/ontology/recommend - Get recommendations based on ontology reasoning
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'doctors';
    const patientId = searchParams.get('patientId');
    const symptoms = searchParams.get('symptoms')?.split(',');

    // Create ontology store
    const store = new OntologyStore();

    // Load ontology schema
    const schemaPath = path.join(process.cwd(), 'src/ontology/schema/medical-ontology.ttl');
    const schemaTTL = fs.readFileSync(schemaPath, 'utf-8');
    await store.loadSchema(schemaTTL);

    // Export MongoDB data to RDF
    await exportToOntology(store);

    // Apply reasoning
    const reasoner = new OntologyReasoner(defaultRules);
    await reasoner.reason(store);

    // Process based on type
    switch (type) {
      case 'doctors':
        return await recommendDoctors(store, patientId || undefined);
      case 'specialists':
        return await recommendSpecialists(store, symptoms || []);
      case 'similar-patients':
        if (!patientId) {
          return NextResponse.json(
            { success: false, error: 'Patient ID is required for similar patients' },
            { status: 400 }
          );
        }
        return await findSimilarPatients(store, patientId);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid recommendation type' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in recommendations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

/**
 * Recommend doctors for a patient
 */
async function recommendDoctors(store: OntologyStore, patientId?: string) {
  const BASE = 'http://example.org/medical/';

  let patientUri: string | undefined;

  if (patientId) {
    patientUri = `${BASE}patient/${patientId}`;
  }

  // Extract recommendations
  let recommendations = extractRecommendations(store, patientUri);

  // If no patient specified, get all recommendations
  if (!patientId) {
    // Get unique doctor recommendations
    const doctorMap = new Map<string, any>();

    for (const rec of recommendations) {
      if (!doctorMap.has(rec.doctorUri)) {
        doctorMap.set(rec.doctorUri, rec);
      }
    }

    recommendations = Array.from(doctorMap.values());
  }

  // Sort by relevance (specialty match first, then by load)
  recommendations.sort((a, b) => {
    if (a.reason === 'specialty_match' && b.reason !== 'specialty_match') {
      return -1;
    }
    if (a.reason !== 'specialty_match' && b.reason === 'specialty_match') {
      return 1;
    }
    return a.currentLoad - b.currentLoad;
  });

  // Limit to top 5
  recommendations = recommendations.slice(0, 5);

  return NextResponse.json({
    success: true,
    data: {
      patientId,
      recommendations: recommendations.map((r) => ({
        doctorId: r.doctorUri.replace(`${BASE}doctor/`, ''),
        name: r.doctorName,
        specialty: r.doctorSpecialty,
        currentLoad: r.currentLoad,
        reason: r.reason,
        score: r.reason === 'specialty_match' ? 0.9 : 0.5 - r.currentLoad * 0.05,
      })),
    },
  });
}

/**
 * Recommend specialists based on symptoms
 */
async function recommendSpecialists(store: OntologyStore, symptoms: string[]) {
  if (!symptoms || symptoms.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        symptoms: [],
        recommendations: [],
      },
    });
  }

  const BASE = 'http://example.org/medical/';

  // Map symptoms to specialties
  const specialtyScores = new Map<string, number>();

  for (const symptom of symptoms) {
    const symptomUri = `${BASE}symptom/${encodeURIComponent(symptom)}`;
    const specialtyQuads = store.query(symptomUri, `${BASE}indicatesSpecialty`, undefined);

    for (const quad of specialtyQuads) {
      const specialtyUri = quad.object.value;
      const specialtyNameQuads = store.query(specialtyUri, `${BASE}specialtyName`, undefined);
      const specialtyName = specialtyNameQuads.length > 0 ? specialtyNameQuads[0].object.value : 'Unknown';

      const currentScore = specialtyScores.get(specialtyName) || 0;
      specialtyScores.set(specialtyName, currentScore + 1);
    }
  }

  // Get doctor information by specialty
  const recommendations = [];

  for (const [specialty, score] of specialtyScores.entries()) {
    const specialtyUri = `${BASE}specialty/${encodeURIComponent(specialty)}`;

    // Find doctors with this specialty
    const doctorQuads = store.query(undefined, `${BASE}hasSpecialty`, specialtyUri);
    const doctors = [];

    for (const docQuad of doctorQuads) {
      const doctorUri = docQuad.subject.value;

      // Get doctor details
      const nameQuads = store.query(doctorUri, `${BASE}name`, undefined);
      const countQuads = store.query(doctorUri, `${BASE}hasPatientCount`, undefined);

      const name = nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown';
      const patientCount = countQuads.length > 0 ? parseInt(countQuads[0].object.value) : 0;

      doctors.push({
        id: doctorUri.replace(`${BASE}doctor/`, ''),
        name,
        patientCount,
      });
    }

    recommendations.push({
      specialty,
      score,
      doctorCount: doctors.length,
      doctors: doctors.sort((a, b) => a.patientCount - b.patientCount),
    });
  }

  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    success: true,
    data: {
      symptoms,
      recommendations,
    },
  });
}

/**
 * Find similar patients based on diagnoses
 */
async function findSimilarPatients(store: OntologyStore, patientId: string) {
  const BASE = 'http://example.org/medical/';

  const patientUri = `${BASE}patient/${patientId}`;

  // Get patient details
  const nameQuads = store.query(patientUri, `${BASE}name`, undefined);
  const ageQuads = store.query(patientUri, `${BASE}age`, undefined);

  const patientName = nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown';
  const patientAge = ageQuads.length > 0 ? parseInt(ageQuads[0].object.value) : 0;

  // Get patient's diagnoses
  const recordQuads = store.query(patientUri, `${BASE}hasRecord`, undefined);
  const diagnoses = new Set<string>();

  for (const recQuad of recordQuads) {
    const recordUri = recQuad.object.value;
    const diagnosisQuads = store.query(recordUri, `${BASE}hasDiagnosis`, undefined);

    for (const diagQuad of diagnosisQuads) {
      const diagnosisUri = diagQuad.object.value;
      const diagnosisNameQuads = store.query(diagnosisUri, `${BASE}diagnosisName`, undefined);
      if (diagnosisNameQuads.length > 0) {
        diagnoses.add(diagnosisNameQuads[0].object.value);
      }
    }
  }

  // Apply reasoning to find similar patients
  const reasoner = new OntologyReasoner(defaultRules);
  await reasoner.reason(store);

  // Extract similar patients
  const similarPatients = extractSimilarPatients(store, patientUri);

  return NextResponse.json({
    success: true,
    data: {
      targetPatient: {
        id: patientId,
        name: patientName,
        age: patientAge,
        diagnoses: Array.from(diagnoses),
      },
      similarPatients: similarPatients.map((sp) => ({
        id: sp.patientUri.replace(`${BASE}patient/`, ''),
        name: sp.patientName,
        age: sp.patientAge,
        similarityReason: sp.similarityReason,
      })),
    },
  });
}
