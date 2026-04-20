import { NextRequest, NextResponse } from 'next/server';
import { OntologyStore } from '@/ontology/lib/OntologyStore';
import { exportToOntology } from '@/ontology/lib/mongodb-to-rdf';
import connectDB from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/ontology/query - Query the ontology for analytics data
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { type, params } = body;

    // Create ontology store
    const store = new OntologyStore();

    // Load ontology schema
    const schemaPath = path.join(process.cwd(), 'src/ontology/schema/medical-ontology.ttl');
    const schemaTTL = fs.readFileSync(schemaPath, 'utf-8');
    await store.loadSchema(schemaTTL);

    // Export MongoDB data to RDF
    await exportToOntology(store);

    // Process based on type
    switch (type) {
      case 'overview':
        return await getOverview(store);
      case 'diagnoses':
        return await getDiagnoses(store);
      case 'specialty-utilization':
        return await getSpecialtyUtilization(store);
      case 'neighbors':
        return await getNeighbors(store, params);
      case 'path':
        return await findPath(store, params);
      case 'connected_components':
        return await findConnectedComponents(store);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid query type' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error in ontology query:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to query ontology' },
      { status: 500 }
    );
  }
}

/**
 * Get overview statistics
 */
async function getOverview(store: OntologyStore) {
  const BASE = 'http://example.org/medical/';

  // Count entities
  const totalDoctors = store.getSubjectsByType(`${BASE}Doctor`).length;
  const totalPatients = store.getSubjectsByType(`${BASE}Patient`).length;
  const totalRecords = store.getSubjectsByType(`${BASE}MedicalRecord`).length;

  // Count unassigned patients
  const unassignedQuads = store.query(undefined, `${BASE}alertType`, 'unassigned_patient');
  const unassignedPatients = unassignedQuads.length;

  // Count overloaded doctors
  const overloadedQuads = store.query(undefined, `${BASE}alertType`, 'doctor_overload');
  const overloadedDoctors = overloadedQuads.length;

  // Calculate average patients per doctor
  let avgPatientsPerDoctor = 0;
  if (totalDoctors > 0) {
    const doctorUris = store.getSubjectsByType(`${BASE}Doctor`);
    let totalPatientCount = 0;

    for (const doctorUri of doctorUris) {
      const countQuads = store.query(doctorUri, `${BASE}hasPatientCount`, undefined);
      if (countQuads.length > 0) {
        totalPatientCount += parseInt(countQuads[0].object.value);
      }
    }

    avgPatientsPerDoctor = totalPatientCount / totalDoctors;
  }

  return NextResponse.json({
    success: true,
    data: {
      totalDoctors,
      totalPatients,
      totalRecords,
      unassignedPatients,
      overloadedDoctors,
      avgPatientsPerDoctor: Math.round(avgPatientsPerDoctor * 10) / 10,
    },
  });
}

/**
 * Get top diagnoses
 */
async function getDiagnoses(store: OntologyStore) {
  const BASE = 'http://example.org/medical/';

  // Get all diagnoses and count occurrences
  const diagnosisCounts = new Map<string, number>();

  const diagnosisUris = store.getSubjectsByType(`${BASE}Diagnosis`);

  for (const diagnosisUri of diagnosisUris) {
    const nameQuads = store.query(diagnosisUri, `${BASE}diagnosisName`, undefined);
    const name = nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown';

    // Count records with this diagnosis
    const recordQuads = store.query(undefined, `${BASE}hasDiagnosis`, diagnosisUri);
    const count = recordQuads.length;

    diagnosisCounts.set(name, count);
  }

  // Calculate total for percentage
  const totalCount = Array.from(diagnosisCounts.values()).reduce((sum, count) => sum + count, 0);

  // Convert to array and sort
  const diagnoses = Array.from(diagnosisCounts.entries())
    .map(([name, count]) => ({
      diagnosis: name,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    data: diagnoses,
  });
}

/**
 * Get specialty utilization
 */
async function getSpecialtyUtilization(store: OntologyStore) {
  const BASE = 'http://example.org/medical/';

  // Group doctors by specialty
  const specialtyData = new Map<string, {
    doctorCount: number;
    patientCount: number;
    overloadedCount: number;
  }>();

  const doctorUris = store.getSubjectsByType(`${BASE}Doctor`);

  for (const doctorUri of doctorUris) {
    // Get specialty
    const specialtyQuads = store.query(doctorUri, `${BASE}specialty`, undefined);
    const specialty = specialtyQuads.length > 0 ? specialtyQuads[0].object.value : 'Unknown';

    // Get patient count
    const countQuads = store.query(doctorUri, `${BASE}hasPatientCount`, undefined);
    const patientCount = countQuads.length > 0 ? parseInt(countQuads[0].object.value) : 0;

    // Check if overloaded
    const overloadedQuads = store.query(doctorUri, `${BASE}alertType`, 'doctor_overload');
    const isOverloaded = overloadedQuads.length > 0;

    // Update specialty data
    const current = specialtyData.get(specialty) || {
      doctorCount: 0,
      patientCount: 0,
      overloadedCount: 0,
    };

    current.doctorCount++;
    current.patientCount += patientCount;
    if (isOverloaded) {
      current.overloadedCount++;
    }

    specialtyData.set(specialty, current);
  }

  // Convert to array
  const specialties = Array.from(specialtyData.entries())
    .map(([specialty, data]) => ({
      specialty,
      doctorCount: data.doctorCount,
      patientCount: data.patientCount,
      avgPatientsPerDoctor: data.doctorCount > 0
        ? (data.patientCount / data.doctorCount).toFixed(1)
        : '0.0',
      overloadedCount: data.overloadedCount,
    }))
    .sort((a, b) => b.patientCount - a.patientCount);

  return NextResponse.json({
    success: true,
    data: specialties,
  });
}

/**
 * Get neighbors of a node
 */
async function getNeighbors(store: OntologyStore, params: any) {
  const BASE = 'http://example.org/medical/';
  const { nodeType, nodeId, depth = 1 } = params;

  const nodeUri = `${BASE}${nodeType}/${nodeId}`;

  if (nodeType === 'doctor' && depth === 1) {
    // Get all patients assigned to this doctor
    const patientQuads = store.query(undefined, `${BASE}assignedTo`, nodeUri);

    const neighbors = patientQuads.map((quad) => {
      const patientUri = quad.subject.value;
      const nameQuads = store.query(patientUri, `${BASE}name`, undefined);
      const ageQuads = store.query(patientUri, `${BASE}age`, undefined);

      return {
        type: 'patient',
        id: patientUri.replace(`${BASE}patient/`, ''),
        name: nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown',
        age: ageQuads.length > 0 ? parseInt(ageQuads[0].object.value) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        node: nodeId,
        neighbors,
      },
    });
  }

  if (nodeType === 'patient' && depth === 1) {
    const neighbors: any[] = [];

    // Get assigned doctor
    const doctorQuads = store.query(nodeUri, `${BASE}assignedTo`, undefined);

    for (const docQuad of doctorQuads) {
      const doctorUri = docQuad.object.value;
      const nameQuads = store.query(doctorUri, `${BASE}name`, undefined);
      const specialtyQuads = store.query(doctorUri, `${BASE}specialty`, undefined);

      neighbors.push({
        type: 'doctor',
        relationship: 'assigned',
        id: doctorUri.replace(`${BASE}doctor/`, ''),
        name: nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown',
        specialty: specialtyQuads.length > 0 ? specialtyQuads[0].object.value : 'Unknown',
      });
    }

    // Get doctors who treated this patient (via records)
    const recordQuads = store.query(nodeUri, `${BASE}hasRecord`, undefined);

    for (const recQuad of recordQuads) {
      const recordUri = recQuad.object.value;
      const doctorQuads = store.query(recordUri, `${BASE}createdBy`, undefined);

      for (const docQuad of doctorQuads) {
        const doctorUri = docQuad.object.value;
        const visitDateQuads = store.query(recordUri, `${BASE}visitDate`, undefined);

        const existing = neighbors.find((n) => n.id === doctorUri.replace(`${BASE}doctor/`, ''));
        if (!existing) {
          const nameQuads = store.query(doctorUri, `${BASE}name`, undefined);
          const specialtyQuads = store.query(doctorUri, `${BASE}specialty`, undefined);

          neighbors.push({
            type: 'doctor',
            relationship: 'treated',
            id: doctorUri.replace(`${BASE}doctor/`, ''),
            name: nameQuads.length > 0 ? nameQuads[0].object.value : 'Unknown',
            specialty: specialtyQuads.length > 0 ? specialtyQuads[0].object.value : 'Unknown',
            visitDate: visitDateQuads.length > 0 ? visitDateQuads[0].object.value : null,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        node: nodeId,
        neighbors,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      node: nodeId,
      neighbors: [],
    },
  });
}

/**
 * Find path between two entities
 */
async function findPath(store: OntologyStore, params: any) {
  const BASE = 'http://example.org/medical/';
  const { from, fromType, to, toType } = params;

  const fromUri = `${BASE}${fromType}/${from}`;
  const toUri = `${BASE}${toType}/${to}`;

  // Simple BFS to find connection
  const visited = new Set<string>();
  const path: any[] = [];
  const queue: Array<{ uri: string; type: string; path: any[] }> = [
    { uri: fromUri, type: fromType, path: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.uri === toUri) {
      return NextResponse.json({
        success: true,
        data: {
          found: true,
          path: current.path,
          length: current.path.length,
        },
      });
    }

    if (visited.has(current.uri)) {
      continue;
    }
    visited.add(current.uri);

    // Get neighbors based on type
    if (current.type === 'patient') {
      // Get assigned doctor
      const doctorQuads = store.query(current.uri, `${BASE}assignedTo`, undefined);
      for (const docQuad of doctorQuads) {
        queue.push({
          uri: docQuad.object.value,
          type: 'doctor',
          path: [
            ...current.path,
            {
              from: current.uri,
              to: docQuad.object.value,
              relationship: 'assigned_to',
            },
          ],
        });
      }

      // Get treating doctors
      const recordQuads = store.query(current.uri, `${BASE}hasRecord`, undefined);
      for (const recQuad of recordQuads) {
        const doctorQuads = store.query(recQuad.object.value, `${BASE}createdBy`, undefined);
        for (const docQuad of doctorQuads) {
          queue.push({
            uri: docQuad.object.value,
            type: 'doctor',
            path: [
              ...current.path,
              {
                from: current.uri,
                to: docQuad.object.value,
                relationship: 'treated_by',
              },
            ],
          });
        }
      }
    } else if (current.type === 'doctor') {
      // Get patients
      const patientQuads = store.query(undefined, `${BASE}assignedTo`, current.uri);
      for (const patQuad of patientQuads) {
        queue.push({
          uri: patQuad.subject.value,
          type: 'patient',
          path: [
            ...current.path,
            {
              from: current.uri,
              to: patQuad.subject.value,
              relationship: 'assigned_patient',
            },
          ],
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      found: false,
      path: [],
      length: 0,
    },
  });
}

/**
 * Find connected components
 */
async function findConnectedComponents(store: OntologyStore) {
  const BASE = 'http://example.org/medical/';

  // Build adjacency list
  const graph = new Map<string, Set<string>>();

  // Add doctor-patient edges
  const patientUris = store.getSubjectsByType(`${BASE}Patient`);

  for (const patientUri of patientUris) {
    if (!graph.has(patientUri)) {
      graph.set(patientUri, new Set());
    }

    const doctorQuads = store.query(patientUri, `${BASE}assignedTo`, undefined);
    for (const docQuad of doctorQuads) {
      const doctorUri = docQuad.object.value;
      graph.get(patientUri)!.add(doctorUri);

      if (!graph.has(doctorUri)) {
        graph.set(doctorUri, new Set());
      }
      graph.get(doctorUri)!.add(patientUri);
    }
  }

  // Find connected components using DFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const [nodeId] of graph) {
    if (visited.has(nodeId)) {
      continue;
    }

    const component: string[] = [];
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      component.push(current);

      const neighbors = graph.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }

    if (component.length > 0) {
      components.push(component);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      components: components.map((comp, index) => ({
        id: index + 1,
        size: comp.length,
        nodes: comp,
      })),
      totalComponents: components.length,
    },
  });
}
