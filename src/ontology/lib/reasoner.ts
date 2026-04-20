import { Store } from 'n3';
import { OntologyStore } from './OntologyStore';
import fs from 'fs';
import path from 'path';

/**
 * OntologyReasoner - Applies reasoning rules to infer new knowledge
 * Uses JavaScript-based reasoning instead of N3 rules
 */
export class OntologyReasoner {
  constructor(rules?: string) {
    // Rules parameter kept for compatibility but not used
  }

  /**
   * Apply reasoning rules to the ontology store
   * @param store - The OntologyStore containing the knowledge base
   * @returns The updated store with inferred triples
   */
  async reason(store: OntologyStore): Promise<Store> {
    // Apply all reasoning rules
    this.applyDoctorOverloadRule(store);
    this.applyUnassignedPatientRule(store);
    this.applyAvailableDoctorRule(store);
    this.applyPatientNoRecordsRule(store);

    return store.getStore();
  }

  /**
   * Rule: Doctor Overload Detection
   * A doctor is considered overloaded if they have more than 10 patients
   */
  private applyDoctorOverloadRule(store: OntologyStore): void {
    const BASE = 'http://example.org/medical/';
    const doctors = store.getSubjectsByType(`${BASE}Doctor`);

    for (const doctorUri of doctors) {
      const countQuads = store.query(doctorUri, `${BASE}hasPatientCount`, undefined);
      if (countQuads.length > 0) {
        const count = parseInt(countQuads[0].object.value);
        if (count > 10) {
          store.addTriple(doctorUri, `${BASE}alertType`, 'doctor_overload');
          store.addTriple(doctorUri, `${BASE}alertSeverity`, 'warning');
          store.addTriple(doctorUri, `${BASE}alertTitle`, 'Doctor Overload');
          store.addTriple(doctorUri, `${BASE}alertDescription`, 'Doctor has too many patients assigned');
        }
      }
    }
  }

  /**
   * Rule: Unassigned Patient Detection
   * A patient is considered unassigned if they have no assigned doctor
   */
  private applyUnassignedPatientRule(store: OntologyStore): void {
    const BASE = 'http://example.org/medical/';
    const patients = store.getSubjectsByType(`${BASE}Patient`);

    for (const patientUri of patients) {
      const assignedQuads = store.query(patientUri, `${BASE}assignedTo`, undefined);
      if (assignedQuads.length === 0) {
        store.addTriple(patientUri, `${BASE}alertType`, 'unassigned_patient');
        store.addTriple(patientUri, `${BASE}alertSeverity`, 'warning');
        store.addTriple(patientUri, `${BASE}alertTitle`, 'Unassigned Patient');
        store.addTriple(patientUri, `${BASE}alertDescription`, 'Patient has no assigned doctor');
      }
    }
  }

  /**
   * Rule: Doctor Underutilized/Available
   * A doctor is considered available if they have fewer than 2 patients
   */
  private applyAvailableDoctorRule(store: OntologyStore): void {
    const BASE = 'http://example.org/medical/';
    const doctors = store.getSubjectsByType(`${BASE}Doctor`);

    for (const doctorUri of doctors) {
      const countQuads = store.query(doctorUri, `${BASE}hasPatientCount`, undefined);
      if (countQuads.length > 0) {
        const count = parseInt(countQuads[0].object.value);
        if (count < 2) {
          store.addTriple(doctorUri, `${BASE}alertType`, 'doctor_available');
          store.addTriple(doctorUri, `${BASE}alertSeverity`, 'info');
          store.addTriple(doctorUri, `${BASE}alertTitle`, 'Doctor Available');
          store.addTriple(doctorUri, `${BASE}alertDescription`, 'Doctor has capacity for more patients');
        }
      }
    }
  }

  /**
   * Rule: Patient Without Recent Records
   * Alert for patients who haven't had any medical records
   */
  private applyPatientNoRecordsRule(store: OntologyStore): void {
    const BASE = 'http://example.org/medical/';
    const patients = store.getSubjectsByType(`${BASE}Patient`);

    for (const patientUri of patients) {
      const countQuads = store.query(patientUri, `${BASE}hasRecordCount`, undefined);
      if (countQuads.length > 0) {
        const count = parseInt(countQuads[0].object.value);
        if (count === 0) {
          store.addTriple(patientUri, `${BASE}alertType`, 'patient_no_records');
          store.addTriple(patientUri, `${BASE}alertSeverity`, 'info');
          store.addTriple(patientUri, `${BASE}alertTitle`, 'Patient Without Records');
          store.addTriple(patientUri, `${BASE}alertDescription`, "Patient hasn't had any medical records");
        }
      }
    }
  }
}

/**
 * Load reasoning rules from a file
 * @param filePath - Path to the .n3 rules file
 */
export function loadRulesFromFile(filePath: string): string {
  try {
    const fullPath = path.resolve(filePath);
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load rules from ${filePath}:`, error);
    return '';
  }
}

/**
 * Extract alerts from the reasoned store
 * @param store - The OntologyStore after reasoning
 * @returns Array of alert objects
 */
export function extractAlerts(store: OntologyStore): Alert[] {
  const alerts: Alert[] = [];

  // Find all entities with alertType
  const alertQuads = store.query(undefined, 'http://example.org/medical/alertType', undefined);

  for (const quad of alertQuads) {
    const subjectUri = quad.subject.value;
    const ruleType = quad.object.value;

    // Get other alert properties
    const severityQuads = store.query(subjectUri, 'http://example.org/medical/alertSeverity', undefined);
    const titleQuads = store.query(subjectUri, 'http://example.org/medical/alertTitle', undefined);
    const descriptionQuads = store.query(subjectUri, 'http://example.org/medical/alertDescription', undefined);

    const severity = severityQuads.length > 0 ? severityQuads[0].object.value : 'info';
    const title = titleQuads.length > 0 ? titleQuads[0].object.value : 'Alert';
    const description = descriptionQuads.length > 0 ? descriptionQuads[0].object.value : '';

    alerts.push({
      id: subjectUri,
      ruleType,
      severity: severity as 'info' | 'warning' | 'critical',
      title,
      description,
      entityUri: subjectUri,
    });
  }

  return alerts;
}

/**
 * Extract recommendations from the reasoned store
 * @param store - The OntologyStore after reasoning
 * @param patientUri - Optional patient URI to filter recommendations
 * @returns Array of recommendation objects
 */
export function extractRecommendations(store: OntologyStore, patientUri?: string): Recommendation[] {
  // This would be implemented similarly based on your recommendation rules
  return [];
}

/**
 * Extract similar patients from the reasoned store
 * @param store - The OntologyStore after reasoning
 * @param patientUri - Patient URI to find similar patients for
 * @returns Array of similar patient objects
 */
export function extractSimilarPatients(store: OntologyStore, patientUri: string): SimilarPatient[] {
  // This would be implemented similarly based on your similarity rules
  return [];
}

// Type definitions
export interface Alert {
  id: string;
  ruleType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  entityUri: string;
}

export interface Recommendation {
  patientUri: string;
  doctorUri: string;
  doctorName: string;
  doctorSpecialty: string;
  currentLoad: number;
  reason: string;
}

export interface SimilarPatient {
  patientUri: string;
  patientName: string;
  patientAge: number;
  similarityReason: string;
}

export const defaultRules = ''; // Not used anymore, reasoning is done in JavaScript

export default OntologyReasoner;
