'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  Connection,
  addEdge,
  ConnectionLineType,
  ConnectionMode,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';

import DoctorNode from './nodes/DoctorNode';
import PatientNode from './nodes/PatientNode';
import MedicalRecordNode from './nodes/MedicalRecordNode';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
}

interface Patient {
  _id: string;
  name: string;
  age: number;
  assignedDoctor?: Doctor | null;
}

interface MedicalRecord {
  _id: string;
  patient: { _id: string; name: string };
  doctor: { _id: string; name: string };
  visitDate: string;
  diagnosis: string;
}

interface OntologyGraphProps {
  refreshTrigger: number;
  onSuccess?: () => void;
}

const nodeTypes: NodeTypes = {
  doctor: DoctorNode,
  patient: PatientNode,
  medicalRecord: MedicalRecordNode,
};

export default function OntologyGraph({ refreshTrigger, onSuccess }: OntologyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const onSelectionChange = useCallback(({ edges: selectedEdges }: OnSelectionChangeParams) => {
    setSelectedEdges(selectedEdges.map((e) => e.id));
  }, []);

  const togglePatientExpanded = useCallback((patientId: string) => {
    setExpandedPatients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [doctorsRes, patientsRes, recordsRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/patients'),
        fetch('/api/medical-records'),
      ]);

      const doctorsResult = await doctorsRes.json();
      const patientsResult = await patientsRes.json();
      const recordsResult = await recordsRes.json();

      if (!doctorsResult.success || !patientsResult.success || !recordsResult.success) {
        throw new Error('Failed to fetch data');
      }

      const doctors: Doctor[] = doctorsResult.data;
      const patients: Patient[] = patientsResult.data;
      const medicalRecords: MedicalRecord[] = recordsResult.data;

      // Calculate counts
      const patientCountMap = new Map<string, number>();
      patients.forEach((patient) => {
        if (patient.assignedDoctor?._id) {
          const count = patientCountMap.get(patient.assignedDoctor._id) || 0;
          patientCountMap.set(patient.assignedDoctor._id, count + 1);
        }
      });

      // Group medical records by patient
      const recordsByPatient = new Map<string, MedicalRecord[]>();
      medicalRecords.forEach((record) => {
        const patientId = record.patient._id;
        if (!recordsByPatient.has(patientId)) {
          recordsByPatient.set(patientId, []);
        }
        recordsByPatient.get(patientId)!.push(record);
      });

      // Create nodes with hierarchical layout
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const DOCTOR_Y = 50;
      const DOCTOR_SPACING_X = 350;
      const PATIENT_Y_START = 180;
      const PATIENT_SPACING_Y = 120;
      const PATIENT_SPACING_X = 200;
      const RECORD_SPACING_Y = 50;

      // Position doctors at the top
      doctors.forEach((doctor, index) => {
        newNodes.push({
          id: doctor._id,
          type: 'doctor',
          position: { x: 100 + index * DOCTOR_SPACING_X, y: DOCTOR_Y },
          data: {
            name: doctor.name,
            specialty: doctor.specialty,
            patientCount: patientCountMap.get(doctor._id) || 0,
          },
        });

        // Position patients below their assigned doctor
        const doctorPatients = patients.filter(
          (p) => p.assignedDoctor?._id === doctor._id
        );

        doctorPatients.forEach((patient, pIndex) => {
          const patientX = 100 + index * DOCTOR_SPACING_X + (pIndex % 2) * PATIENT_SPACING_X;
          const patientY = PATIENT_Y_START + Math.floor(pIndex / 2) * PATIENT_SPACING_Y;
          const isExpanded = expandedPatients.has(patient._id);
          const patientRecords = recordsByPatient.get(patient._id) || [];

          newNodes.push({
            id: patient._id,
            type: 'patient',
            position: { x: patientX, y: patientY },
            data: {
              name: patient.name,
              age: patient.age,
              hasDoctor: true,
              recordCount: patientRecords.length,
              isExpanded,
            },
            style: {
              width: isExpanded ? 280 : 160,
            },
          });

          // Create edge from patient to doctor
          newEdges.push({
            id: `${patient._id}-${doctor._id}`,
            source: patient._id,
            target: doctor._id,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#5D6B7B', strokeWidth: 3, cursor: 'pointer' },
            className: '!cursor-pointer hover:stroke-[#0064E0]',
          });

          // Add medical records as child nodes if expanded
          if (isExpanded && patientRecords.length > 0) {
            patientRecords.slice(0, 5).forEach((record, rIndex) => {
              newNodes.push({
                id: record._id,
                type: 'medicalRecord',
                position: { x: 160, y: 30 + rIndex * 45 },
                data: {
                  diagnosis: record.diagnosis,
                  visitDate: record.visitDate,
                  patientName: patient.name,
                },
                parentNode: patient._id,
                extent: 'parent',
                draggable: false,
                selectable: false,
              });
            });
          }
        });
      });

      // Position unassigned patients on the right side
      const unassignedPatients = patients.filter((p) => !p.assignedDoctor?._id);
      const unassignedStartX = 100 + doctors.length * DOCTOR_SPACING_X + 100;

      unassignedPatients.forEach((patient, index) => {
        const patientX = unassignedStartX + (index % 2) * PATIENT_SPACING_X;
        const patientY = DOCTOR_Y + 50 + Math.floor(index / 2) * PATIENT_SPACING_Y;
        const isExpanded = expandedPatients.has(patient._id);
        const patientRecords = recordsByPatient.get(patient._id) || [];

        newNodes.push({
          id: patient._id,
          type: 'patient',
          position: { x: patientX, y: patientY },
          data: {
            name: patient.name,
            age: patient.age,
            hasDoctor: false,
            recordCount: patientRecords.length,
            isExpanded,
          },
          style: {
            width: isExpanded ? 280 : 160,
          },
        });

        // Add medical records for unassigned patients if expanded
        if (isExpanded && patientRecords.length > 0) {
          patientRecords.slice(0, 5).forEach((record, rIndex) => {
            newNodes.push({
              id: record._id,
              type: 'medicalRecord',
              position: { x: 160, y: 30 + rIndex * 45 },
              data: {
                diagnosis: record.diagnosis,
                visitDate: record.visitDate,
                patientName: patient.name,
              },
              parentNode: patient._id,
              extent: 'parent',
              draggable: false,
              selectable: false,
            });
          });
        }
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (err) {
      setError('Failed to load ontology data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, expandedPatients]);

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, fetchData]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      let patientId: string | null = null;
      let doctorId: string | null = null;

      if (sourceNode.type === 'patient' && targetNode.type === 'doctor') {
        patientId = sourceNode.id;
        doctorId = targetNode.id;
      } else if (sourceNode.type === 'doctor' && targetNode.type === 'patient') {
        patientId = targetNode.id;
        doctorId = sourceNode.id;
      } else {
        showMessage('error', 'Only connect patients to doctors');
        return;
      }

      setSaving(true);

      try {
        const response = await fetch(`/api/patients/${patientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedDoctor: doctorId }),
        });

        const result = await response.json();

        if (result.success) {
          const edge = {
            ...connection,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#0064E0', strokeWidth: 3, cursor: 'pointer' },
            className: '!cursor-pointer',
            selectable: true,
          };
          setEdges((eds) => addEdge(edge, eds));

          showMessage('success', 'Connection saved!');
          onSuccess?.();

          setTimeout(() => {
            fetchData();
          }, 500);
        } else {
          showMessage('error', result.error || 'Failed to save connection');
        }
      } catch (err) {
        showMessage('error', 'Network error. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [nodes, setEdges, showMessage, onSuccess, fetchData]
  );

  const deleteSelectedConnection = useCallback(async () => {
    if (selectedEdges.length === 0) return;

    const edgeId = selectedEdges[0];
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const patientId = edge.source;
    const patientNode = nodes.find((n) => n.id === patientId);

    if (!patientNode || patientNode.type !== 'patient') return;

    setSaving(true);

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDoctor: null }),
      });

      const result = await response.json();

      if (result.success) {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setSelectedEdges([]);
        showMessage('success', 'Connection removed!');
        onSuccess?.();

        setTimeout(() => {
          fetchData();
        }, 500);
      } else {
        showMessage('error', result.error || 'Failed to remove connection');
      }
    } catch (err) {
      showMessage('error', 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedEdges, edges, nodes, setEdges, showMessage, onSuccess, fetchData]);

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        if (!edge) continue;

        const patientId = edge.source;
        const patientNode = nodes.find((n) => n.id === patientId);

        if (!patientNode || patientNode.type !== 'patient') continue;

        setSaving(true);

        try {
          const response = await fetch(`/api/patients/${patientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedDoctor: null }),
          });

          const result = await response.json();

          if (result.success) {
            showMessage('success', 'Connection removed!');
            onSuccess?.();

            setTimeout(() => {
              fetchData();
            }, 500);
          } else {
            showMessage('error', result.error || 'Failed to remove connection');
          }
        } catch (err) {
          showMessage('error', 'Network error. Please try again.');
        } finally {
          setSaving(false);
        }
      }
    },
    [edges, nodes, showMessage, onSuccess, fetchData]
  );

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'patient') {
      togglePatientExpanded(node.id);
    }
  }, [togglePatientExpanded]);

  if (loading) {
    return (
      <div className="bg-white rounded-[20px] shadow-[0_12px_28px_0_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] p-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0064E0] mb-4"></div>
            <p className="text-[#5D6C7B]">Loading ontology...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-[20px] shadow-[0_12px_28px_0_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] p-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-[#E41E3F] font-medium mb-2">Error</p>
            <p className="text-[#5D6C7B]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="bg-white rounded-[20px] shadow-[0_12px_28px_0_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] p-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center max-w-md">
            <p className="text-[#5D6C7B] mb-4">No data to display</p>
            <p className="text-sm text-[#65676B]">
              Add doctors and patients to see the ontology visualization
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] shadow-[0_12px_28px_0_rgba(0,0,0,0.2),0_2px_4px_0_rgba(0,0,0,0.1)] overflow-hidden">
      <div className="p-6 border-b border-[#DEE3E9]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1C2B33]">Doctor-Patient-Medical Records Ontology</h3>
            <p className="text-sm text-[#5D6C7B] mt-1">
              Click patient nodes to expand/collapse medical records. Drag to connect patients with doctors.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedEdges.length > 0 && (
              <Button
                onClick={deleteSelectedConnection}
                disabled={saving}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Connection
              </Button>
            )}
            {message && (
              <div
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  message.type === 'success'
                    ? 'bg-[rgba(49,162,76,0.15)] text-[#007D1E]'
                    : 'bg-[rgba(255,123,145,0.15)] text-[#C80A28]'
                }`}
              >
                {message.text}
              </div>
            )}
            {saving && (
              <div className="flex items-center gap-2 text-sm text-[#5D6C7B]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0064E0]"></div>
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: '700px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={onSelectionChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionMode={ConnectionMode.Loose}
          fitView
          deleteKeyCode="Delete"
          elementsSelectable
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#DEE3E9" />
          <Controls
            className="!bg-white !border !border-[#DEE3E9] !rounded-lg"
            showZoom={true}
            showFitView={true}
            showInteractive={true}
          />
          <MiniMap
            className="!bg-white !border !border-[#DEE3E9] !rounded-lg"
            nodeColor={(node) => {
              if (node.type === 'medicalRecord') return '#E8F3FF';
              return node.type === 'doctor' ? '#0064E0' : '#F7F8FA';
            }}
            maskColor="rgba(0, 0, 0, 0.05)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
