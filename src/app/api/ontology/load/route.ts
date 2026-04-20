import { NextRequest, NextResponse } from 'next/server';
import { OntologyStore } from '@/ontology/lib/OntologyStore';
import { exportToOntology } from '@/ontology/lib/mongodb-to-rdf';
import connectDB from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/ontology/load - Load ontology schema and export MongoDB data to RDF
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Create ontology store
    const store = new OntologyStore();

    // Load ontology schema
    const schemaPath = path.join(process.cwd(), 'src/ontology/schema/medical-ontology.ttl');
    const schemaTTL = fs.readFileSync(schemaPath, 'utf-8');
    await store.loadSchema(schemaTTL);

    // Export MongoDB data to RDF
    await exportToOntology(store);

    // Return statistics
    const stats = {
      triples: store.size(),
      doctors: store.getSubjectsByType('http://example.org/medical/Doctor').length,
      patients: store.getSubjectsByType('http://example.org/medical/Patient').length,
      records: store.getSubjectsByType('http://example.org/medical/MedicalRecord').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        message: 'Ontology loaded successfully',
        stats,
      },
    });
  } catch (error: any) {
    console.error('Error loading ontology:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load ontology' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ontology/load - Get ontology statistics
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Create ontology store
    const store = new OntologyStore();

    // Load ontology schema
    const schemaPath = path.join(process.cwd(), 'src/ontology/schema/medical-ontology.ttl');
    const schemaTTL = fs.readFileSync(schemaPath, 'utf-8');
    await store.loadSchema(schemaTTL);

    // Export MongoDB data to RDF
    await exportToOntology(store);

    // Return statistics
    const stats = {
      triples: store.size(),
      doctors: store.getSubjectsByType('http://example.org/medical/Doctor').length,
      patients: store.getSubjectsByType('http://example.org/medical/Patient').length,
      records: store.getSubjectsByType('http://example.org/medical/MedicalRecord').length,
      diagnoses: store.getSubjectsByType('http://example.org/medical/Diagnosis').length,
      symptoms: store.getSubjectsByType('http://example.org/medical/Symptom').length,
      specialties: store.getSubjectsByType('http://example.org/medical/Specialty').length,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error getting ontology stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get ontology stats' },
      { status: 500 }
    );
  }
}
