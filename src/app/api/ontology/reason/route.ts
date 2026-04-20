import { NextRequest, NextResponse } from 'next/server';
import { OntologyStore } from '@/ontology/lib/OntologyStore';
import { exportToOntology } from '@/ontology/lib/mongodb-to-rdf';
import { OntologyReasoner, defaultRules, extractAlerts, extractRecommendations } from '@/ontology/lib/reasoner';
import connectDB from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

// Singleton instance of the ontology store
let ontologyStore: OntologyStore | null = null;
let lastUpdate: Date | null = null;

/**
 * GET /api/ontology/reason - Get current alerts from reasoning
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleTypes = searchParams.get('ruleTypes')?.split(',') || [];

    // Initialize ontology store if needed
    if (!ontologyStore || !lastUpdate || Date.now() - lastUpdate.getTime() > 60000) {
      await initializeOntology();
    }

    // Apply reasoning
    const reasoner = new OntologyReasoner(defaultRules);
    await reasoner.reason(ontologyStore!);

    // Extract alerts
    let alerts = extractAlerts(ontologyStore!);

    // Filter by rule types if specified
    if (ruleTypes.length > 0) {
      alerts = alerts.filter((a) => ruleTypes.includes(a.ruleType));
    }

    // Sort by severity (critical > warning > info)
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.entityUri.localeCompare(b.entityUri);
    });

    // Calculate summary
    const summary = {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      total: alerts.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error in ontology reasoning:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reason ontology' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ontology/reason - Force re-initialization and reasoning
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleTypes } = body;

    // Force re-initialization
    ontologyStore = null;
    await initializeOntology();

    // Apply reasoning
    const reasoner = new OntologyReasoner(defaultRules);
    await reasoner.reason(ontologyStore!);

    // Extract alerts
    let alerts = extractAlerts(ontologyStore!);

    // Filter by rule types if specified
    if (ruleTypes && ruleTypes.length > 0) {
      alerts = alerts.filter((a) => ruleTypes.includes(a.ruleType));
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.entityUri.localeCompare(b.entityUri);
    });

    // Calculate summary
    const summary = {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      total: alerts.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error in ontology reasoning:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reason ontology' },
      { status: 500 }
    );
  }
}

/**
 * Initialize the ontology store with schema and data
 */
async function initializeOntology(): Promise<void> {
  await connectDB();

  // Create new store
  ontologyStore = new OntologyStore();

  // Load ontology schema
  const schemaPath = path.join(process.cwd(), 'src/ontology/schema/medical-ontology.ttl');
  const schemaTTL = fs.readFileSync(schemaPath, 'utf-8');
  await ontologyStore.loadSchema(schemaTTL);

  // Export MongoDB data to RDF
  await exportToOntology(ontologyStore);

  // Update last update time
  lastUpdate = new Date();
}
