import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Doctor from '@/models/Doctor';
import Patient from '@/models/Patient';
import MedicalRecord from '@/models/MedicalRecord';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { type, params } = body;

    switch (type) {
      case 'neighbors':
        return await getNeighbors(params);
      case 'path':
        return await findPath(params);
      case 'connected_components':
        return await findConnectedComponents(params);
      case 'patient_chain':
        return await getPatientChain(params);
      case 'doctor_network':
        return await getDoctorNetwork(params);
      default:
        return NextResponse.json({ success: false, error: 'Invalid query type' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Query failed' }, { status: 500 });
  }
}

// Get neighbors of a node (doctors connected through patients, or vice versa)
async function getNeighbors(params: any) {
  const { nodeType, nodeId, depth = 1 } = params;

  if (nodeType === 'doctor' && depth === 1) {
    // Get all patients assigned to this doctor
    const patients = await Patient.find({ assignedDoctor: nodeId })
      .select('name age email');

    return NextResponse.json({
      success: true,
      data: {
        node: nodeId,
        neighbors: patients.map((p) => ({
          type: 'patient',
          id: p._id,
          ...p.toObject(),
        })),
      },
    });
  }

  if (nodeType === 'patient' && depth === 1) {
    // Get assigned doctor and all medical records
    const patient = await Patient.findById(nodeId).populate('assignedDoctor');
    const records = await MedicalRecord.find({ patient: nodeId })
      .populate('doctor', 'name specialty')
      .sort({ visitDate: -1 });

    const neighbors: any[] = [];

    if (patient?.assignedDoctor) {
      neighbors.push({
        type: 'doctor',
        relationship: 'assigned',
        id: patient.assignedDoctor._id,
        ...patient.assignedDoctor.toObject(),
      });
    }

    records.forEach((record) => {
      if (record.doctor) {
        const exists = neighbors.find((n) => n.id === record.doctor._id.toString());
        if (!exists) {
          neighbors.push({
            type: 'doctor',
            relationship: 'treated',
            id: record.doctor._id,
            visitDate: record.visitDate,
            ...record.doctor.toObject(),
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: { node: nodeId, neighbors },
    });
  }

  return NextResponse.json({ success: true, data: { node: nodeId, neighbors: [] } });
}

// Find path between two entities
async function findPath(params: any) {
  const { from, fromType, to, toType } = params;

  const visited = new Set<string>();
  const path: any[] = [];

  // Simple BFS to find connection
  async function bfs(currentId: string, currentType: string, targetId: string): Promise<boolean> {
    if (currentId === targetId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    if (currentType === 'patient') {
      const patient = await Patient.findById(currentId).populate('assignedDoctor');
      if (patient?.assignedDoctor) {
        path.push({
          from: currentId,
          to: patient.assignedDoctor._id.toString(),
          relationship: 'assigned_to',
        });
        if (await bfs(patient.assignedDoctor._id.toString(), 'doctor', targetId)) {
          return true;
        }
        path.pop();
      }

      // Check through medical records
      const records = await MedicalRecord.find({ patient: currentId }).populate('doctor');
      for (const record of records) {
        if (record.doctor && !visited.has(record.doctor._id.toString())) {
          path.push({
            from: currentId,
            to: record.doctor._id.toString(),
            relationship: 'treated_by',
            visitDate: record.visitDate,
          });
          if (await bfs(record.doctor._id.toString(), 'doctor', targetId)) {
            return true;
          }
          path.pop();
        }
      }
    }

    if (currentType === 'doctor') {
      const patients = await Patient.find({ assignedDoctor: currentId });
      for (const patient of patients) {
        const patientId = patient._id.toString();
        if (!visited.has(patientId)) {
          path.push({
            from: currentId,
            to: patientId,
            relationship: 'assigned_patient',
          });
          if (await bfs(patientId, 'patient', targetId)) {
            return true;
          }
          path.pop();
        }
      }
    }

    return false;
  }

  const found = await bfs(from, fromType, to);

  return NextResponse.json({
    success: true,
    data: {
      found,
      path,
      length: path.length,
    },
  });
}

// Find connected components (groups of related entities)
async function findConnectedComponents(params: any) {
  const { filter = {} } = params;

  const patients = await Patient.find({}).populate('assignedDoctor');
  const records = await MedicalRecord.find({})
    .populate('patient')
    .populate('doctor');

  // Build adjacency list
  const graph = new Map<string, Set<string>>();

  // Add doctor-patient edges
  patients.forEach((patient: any) => {
    const patientId = patient._id.toString();
    if (!graph.has(patientId)) graph.set(patientId, new Set());

    if (patient.assignedDoctor) {
      const doctorId = patient.assignedDoctor._id.toString();
      graph.get(patientId)!.add(doctorId);
      if (!graph.has(doctorId)) graph.set(doctorId, new Set());
      graph.get(doctorId)!.add(patientId);
    }
  });

  // Add record-patient and record-doctor edges
  records.forEach((record: any) => {
    const patientId = record.patient._id.toString();
    const doctorId = record.doctor._id.toString();

    if (graph.has(patientId) && graph.has(doctorId)) {
      graph.get(patientId)!.add(doctorId);
      graph.get(doctorId)!.add(patientId);
    }
  });

  // Find connected components using DFS
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const [nodeId] of graph) {
    if (visited.has(nodeId)) continue;

    const component: string[] = [];
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
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

// Get chain of patients treated by same doctor (potential transmission)
async function getPatientChain(params: any) {
  const { doctorId } = params;

  const patients = await Patient.find({ assignedDoctor: doctorId })
    .populate('assignedDoctor')
    .sort({ createdAt: 1 });

  const records = await MedicalRecord.find({
    doctor: doctorId,
  })
    .populate('patient')
    .sort({ visitDate: 1 });

  // Build timeline of patient interactions
  const chain: any[] = [];

  records.forEach((record) => {
    chain.push({
      date: record.visitDate,
      patientId: record.patient._id,
      patientName: record.patient.name,
      diagnosis: record.diagnosis,
      type: 'consultation',
    });
  });

  return NextResponse.json({
    success: true,
    data: {
      doctorId,
      chain,
      totalInteractions: chain.length,
    },
  });
}

// Analyze doctor collaboration network
async function getDoctorNetwork(params: any) {
  const records = await MedicalRecord.find({})
    .populate('doctor')
    .populate('patient');

  // Find pairs of doctors who treated the same patient
  const doctorPairs = new Map<string, number>();

  // Group records by patient
  const patientRecords = new Map<string, any[]>();
  records.forEach((record: any) => {
    const patientId = record.patient._id.toString();
    if (!patientRecords.has(patientId)) {
      patientRecords.set(patientId, []);
    }
    patientRecords.get(patientId)!.push(record);
  });

  // For each patient, find all doctors who treated them
  for (const [patientId, patientRecs] of patientRecords.entries()) {
    const doctors = patientRecs.map((r) => r.doctor._id.toString());

    // Count pairs
    for (let i = 0; i < doctors.length; i++) {
      for (let j = i + 1; j < doctors.length; j++) {
        const pairId = [doctors[i], doctors[j]].sort().join('-');
        doctorPairs.set(pairId, (doctorPairs.get(pairId) || 0) + 1);
      }
    }
  }

  // Convert to result
  const network = Array.from(doctorPairs.entries())
    .map(([pairId, count]) => {
      const [doctor1Id, doctor2Id] = pairId.split('-');
      return {
        doctor1Id,
        doctor2Id,
        sharedPatients: count,
      };
    })
    .sort((a, b) => b.sharedPatients - a.sharedPatients)
    .slice(0, 20);

  // Populate doctor details
  const doctorIds = new Set<string>();
  network.forEach((n) => {
    doctorIds.add(n.doctor1Id);
    doctorIds.add(n.doctor2Id);
  });

  const doctors = await Doctor.find({ _id: { $in: Array.from(doctorIds) } });

  const doctorMap = new Map(
    doctors.map((d) => [d._id.toString(), { name: d.name, specialty: d.specialty }])
  );

  const result = network.map((n) => ({
    doctor1: doctorMap.get(n.doctor1Id),
    doctor2: doctorMap.get(n.doctor2Id),
    sharedPatients: n.sharedPatients,
  }));

  return NextResponse.json({
    success: true,
    data: result,
  });
}
