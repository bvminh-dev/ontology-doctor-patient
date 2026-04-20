import Doctor from '@/models/Doctor';
import Patient from '@/models/Patient';
import MedicalRecord from '@/models/MedicalRecord';
import { OntologyStore } from './OntologyStore';
import { Types } from 'mongoose';

const BASE = 'http://example.org/medical/';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Export MongoDB data to RDF triples in the OntologyStore
 * @param store - The OntologyStore to populate with RDF triples
 */
export async function exportToOntology(store: OntologyStore): Promise<void> {
  // Export Doctors
  await exportDoctors(store);

  // Export Patients
  await exportPatients(store);

  // Export Medical Records
  await exportMedicalRecords(store);

  // Calculate derived properties
  await calculateDerivedProperties(store);
}

/**
 * Export Doctor documents to RDF
 */
async function exportDoctors(store: OntologyStore): Promise<void> {
  const doctors = await Doctor.find({}).lean();

  for (const doctor of doctors) {
    const doctorUri = `${BASE}doctor/${doctor._id}`;

    // Type assertion
    store.addTriple(doctorUri, RDF + 'type', `${BASE}Doctor`);

    // Basic properties
    if (doctor.name) {
      store.addTriple(doctorUri, `${BASE}name`, doctor.name);
    }

    if (doctor.specialty) {
      store.addTriple(doctorUri, `${BASE}specialty`, doctor.specialty);

      // Create specialty node and link to it
      const specialtyUri = `${BASE}specialty/${encodeURIComponent(doctor.specialty)}`;
      store.addTriple(specialtyUri, RDF + 'type', `${BASE}Specialty`);
      store.addTriple(specialtyUri, `${BASE}specialtyName`, doctor.specialty);
      store.addTriple(doctorUri, `${BASE}hasSpecialty`, specialtyUri);
    }

    if (doctor.email) {
      store.addTriple(doctorUri, `${BASE}email`, doctor.email);
    }

    if (doctor.phone) {
      store.addTriple(doctorUri, `${BASE}phone`, doctor.phone);
    }
  }
}

/**
 * Export Patient documents to RDF
 */
async function exportPatients(store: OntologyStore): Promise<void> {
  const patients = await Patient.find({}).lean();

  for (const patient of patients) {
    const patientUri = `${BASE}patient/${patient._id}`;

    // Type assertion
    store.addTriple(patientUri, RDF + 'type', `${BASE}Patient`);

    // Basic properties
    if (patient.name) {
      store.addTriple(patientUri, `${BASE}name`, patient.name);
    }

    if (patient.age !== undefined) {
      store.addTriple(patientUri, `${BASE}age`, patient.age.toString(), XSD + 'integer');
    }

    if (patient.email) {
      store.addTriple(patientUri, `${BASE}email`, patient.email);
    }

    if (patient.phone) {
      store.addTriple(patientUri, `${BASE}phone`, patient.phone);
    }

    // Assigned doctor relationship
    if (patient.assignedDoctor) {
      const doctorUri = `${BASE}doctor/${patient.assignedDoctor}`;
      store.addTriple(patientUri, `${BASE}assignedTo`, doctorUri);
      store.addTriple(doctorUri, `${BASE}treats`, patientUri);
    }
  }
}

/**
 * Export MedicalRecord documents to RDF
 */
async function exportMedicalRecords(store: OntologyStore): Promise<void> {
  const records = await MedicalRecord.find({})
    .populate('patient')
    .populate('doctor')
    .lean();

  for (const record of records) {
    if (!record.patient || !record.doctor) continue;

    const recordUri = `${BASE}record/${record._id}`;
    const patientUri = `${BASE}patient/${record.patient._id}`;
    const doctorUri = `${BASE}doctor/${record.doctor._id}`;

    // Type assertion
    store.addTriple(recordUri, RDF + 'type', `${BASE}MedicalRecord`);

    // Relationships
    store.addTriple(recordUri, `${BASE}forPatient`, patientUri);
    store.addTriple(recordUri, `${BASE}createdBy`, doctorUri);
    store.addTriple(patientUri, `${BASE}hasRecord`, recordUri);

    // Visit date
    if (record.visitDate) {
      const visitDateStr = record.visitDate.toISOString();
      store.addTriple(recordUri, `${BASE}visitDate`, visitDateStr, XSD + 'dateTime');
    }

    // Diagnosis
    if (record.diagnosis) {
      const diagnosisUri = `${BASE}diagnosis/${encodeURIComponent(record.diagnosis)}`;
      store.addTriple(diagnosisUri, RDF + 'type', `${BASE}Diagnosis`);
      store.addTriple(diagnosisUri, `${BASE}diagnosisName`, record.diagnosis);
      store.addTriple(recordUri, `${BASE}hasDiagnosis`, diagnosisUri);

      // Link patient to diagnosis for similarity rules
      store.addTriple(patientUri, `${BASE}hasRecord`, recordUri);
    }

    // Symptoms
    if (record.symptoms && Array.isArray(record.symptoms)) {
      for (const symptom of record.symptoms) {
        const symptomUri = `${BASE}symptom/${encodeURIComponent(symptom)}`;
        store.addTriple(symptomUri, RDF + 'type', `${BASE}Symptom`);
        store.addTriple(symptomUri, `${BASE}symptomName`, symptom);
        store.addTriple(recordUri, `${BASE}hasSymptomInRecord`, symptomUri);
        store.addTriple(patientUri, `${BASE}hasSymptom`, symptomUri);

        // Add specialty indication for common symptoms
        addSpecialtyIndication(store, symptom, symptomUri);
      }
    }

    // Treatment
    if (record.treatment) {
      store.addTriple(recordUri, `${BASE}treatment`, record.treatment);
    }

    // Notes
    if (record.notes) {
      store.addTriple(recordUri, `${BASE}notes`, record.notes);
    }

    // Follow-up date
    if (record.followUpDate) {
      const followUpStr = record.followUpDate.toISOString();
      store.addTriple(recordUri, `${BASE}followUpDate`, followUpStr, XSD + 'dateTime');
    }
  }
}

/**
 * Add specialty indications for common symptoms
 * This maps symptoms to medical specialties
 */
function addSpecialtyIndication(store: OntologyStore, symptom: string, symptomUri: string): void {
  const symptomLower = symptom.toLowerCase();

  // Symptom to specialty mapping
  const specialtyMap: Record<string, string[]> = {
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

  // Check if symptom matches any known patterns
  for (const [key, specialties] of Object.entries(specialtyMap)) {
    if (symptomLower.includes(key)) {
      for (const specialty of specialties) {
        const specialtyUri = `${BASE}specialty/${encodeURIComponent(specialty)}`;
        store.addTriple(symptomUri, `${BASE}indicatesSpecialty`, specialtyUri);
      }
    }
  }
}

/**
 * Calculate derived properties like patient counts, record counts, etc.
 */
async function calculateDerivedProperties(store: OntologyStore): Promise<void> {
  // Calculate patient count per doctor
  const patients = await Patient.find({}).lean();
  const doctorPatientCount = new Map<string, number>();

  for (const patient of patients) {
    if (patient.assignedDoctor) {
      const doctorId = patient.assignedDoctor.toString();
      const count = doctorPatientCount.get(doctorId) || 0;
      doctorPatientCount.set(doctorId, count + 1);
    }
  }

  // Add patient count triples
  for (const [doctorId, count] of doctorPatientCount.entries()) {
    const doctorUri = `${BASE}doctor/${doctorId}`;
    store.addTriple(doctorUri, `${BASE}hasPatientCount`, count.toString(), XSD + 'integer');
  }

  // Initialize doctors with 0 patients
  const doctors = await Doctor.find({}).lean();
  for (const doctor of doctors) {
    const doctorUri = `${BASE}doctor/${doctor._id}`;
    const count = doctorPatientCount.get(doctor._id.toString()) || 0;
    store.addTriple(doctorUri, `${BASE}hasPatientCount`, count.toString(), XSD + 'integer');
  }

  // Calculate record count per patient
  const records = await MedicalRecord.find({}).lean();
  const patientRecordCount = new Map<string, number>();

  for (const record of records) {
    if (record.patient) {
      const patientId = record.patient.toString();
      const count = patientRecordCount.get(patientId) || 0;
      patientRecordCount.set(patientId, count + 1);
    }
  }

  // Add record count triples
  for (const patient of patients) {
    const patientUri = `${BASE}patient/${patient._id}`;
    const count = patientRecordCount.get(patient._id.toString()) || 0;
    store.addTriple(patientUri, `${BASE}hasRecordCount`, count.toString(), XSD + 'integer');
  }
}

/**
 * Export a single doctor to RDF (for real-time updates)
 */
export async function exportDoctorToOntology(store: OntologyStore, doctorId: string): Promise<void> {
  const doctor = await Doctor.findById(doctorId).lean();
  if (!doctor) return;

  const doctorUri = `${BASE}doctor/${doctor._id}`;

  store.addTriple(doctorUri, RDF + 'type', `${BASE}Doctor`);

  if (doctor.name) {
    store.addTriple(doctorUri, `${BASE}name`, doctor.name);
  }

  if (doctor.specialty) {
    store.addTriple(doctorUri, `${BASE}specialty`, doctor.specialty);
    const specialtyUri = `${BASE}specialty/${encodeURIComponent(doctor.specialty)}`;
    store.addTriple(specialtyUri, RDF + 'type', `${BASE}Specialty`);
    store.addTriple(specialtyUri, `${BASE}specialtyName`, doctor.specialty);
    store.addTriple(doctorUri, `${BASE}hasSpecialty`, specialtyUri);
  }

  if (doctor.email) {
    store.addTriple(doctorUri, `${BASE}email`, doctor.email);
  }

  if (doctor.phone) {
    store.addTriple(doctorUri, `${BASE}phone`, doctor.phone);
  }

  // Calculate patient count
  const patientCount = await Patient.countDocuments({ assignedDoctor: doctor._id });
  store.addTriple(doctorUri, `${BASE}hasPatientCount`, patientCount.toString(), XSD + 'integer');
}

/**
 * Export a single patient to RDF (for real-time updates)
 */
export async function exportPatientToOntology(store: OntologyStore, patientId: string): Promise<void> {
  const patient = await Patient.findById(patientId).lean();
  if (!patient) return;

  const patientUri = `${BASE}patient/${patient._id}`;

  store.addTriple(patientUri, RDF + 'type', `${BASE}Patient`);

  if (patient.name) {
    store.addTriple(patientUri, `${BASE}name`, patient.name);
  }

  if (patient.age !== undefined) {
    store.addTriple(patientUri, `${BASE}age`, patient.age.toString(), XSD + 'integer');
  }

  if (patient.email) {
    store.addTriple(patientUri, `${BASE}email`, patient.email);
  }

  if (patient.phone) {
    store.addTriple(patientUri, `${BASE}phone`, patient.phone);
  }

  if (patient.assignedDoctor) {
    const doctorUri = `${BASE}doctor/${patient.assignedDoctor}`;
    store.addTriple(patientUri, `${BASE}assignedTo`, doctorUri);
    store.addTriple(doctorUri, `${BASE}treats`, patientUri);
  }

  // Calculate record count
  const recordCount = await MedicalRecord.countDocuments({ patient: patient._id });
  store.addTriple(patientUri, `${BASE}hasRecordCount`, recordCount.toString(), XSD + 'integer');
}

/**
 * Export a single medical record to RDF (for real-time updates)
 */
export async function exportMedicalRecordToOntology(store: OntologyStore, recordId: string): Promise<void> {
  const record = await MedicalRecord.findById(recordId)
    .populate('patient')
    .populate('doctor')
    .lean();

  if (!record || !record.patient || !record.doctor) return;

  const recordUri = `${BASE}record/${record._id}`;
  const patientUri = `${BASE}patient/${record.patient._id}`;
  const doctorUri = `${BASE}doctor/${record.doctor._id}`;

  store.addTriple(recordUri, RDF + 'type', `${BASE}MedicalRecord`);
  store.addTriple(recordUri, `${BASE}forPatient`, patientUri);
  store.addTriple(recordUri, `${BASE}createdBy`, doctorUri);
  store.addTriple(patientUri, `${BASE}hasRecord`, recordUri);

  if (record.visitDate) {
    store.addTriple(recordUri, `${BASE}visitDate`, record.visitDate.toISOString(), XSD + 'dateTime');
  }

  if (record.diagnosis) {
    const diagnosisUri = `${BASE}diagnosis/${encodeURIComponent(record.diagnosis)}`;
    store.addTriple(diagnosisUri, RDF + 'type', `${BASE}Diagnosis`);
    store.addTriple(diagnosisUri, `${BASE}diagnosisName`, record.diagnosis);
    store.addTriple(recordUri, `${BASE}hasDiagnosis`, diagnosisUri);
  }

  if (record.symptoms && Array.isArray(record.symptoms)) {
    for (const symptom of record.symptoms) {
      const symptomUri = `${BASE}symptom/${encodeURIComponent(symptom)}`;
      store.addTriple(symptomUri, RDF + 'type', `${BASE}Symptom`);
      store.addTriple(symptomUri, `${BASE}symptomName`, symptom);
      store.addTriple(recordUri, `${BASE}hasSymptomInRecord`, symptomUri);
      store.addTriple(patientUri, `${BASE}hasSymptom`, symptomUri);
      addSpecialtyIndication(store, symptom, symptomUri);
    }
  }

  if (record.treatment) {
    store.addTriple(recordUri, `${BASE}treatment`, record.treatment);
  }

  if (record.notes) {
    store.addTriple(recordUri, `${BASE}notes`, record.notes);
  }

  if (record.followUpDate) {
    store.addTriple(recordUri, `${BASE}followUpDate`, record.followUpDate.toISOString(), XSD + 'dateTime');
  }

  // Update record count for patient
  const recordCount = await MedicalRecord.countDocuments({ patient: record.patient._id });
  store.addTriple(patientUri, `${BASE}hasRecordCount`, recordCount.toString(), XSD + 'integer');
}
