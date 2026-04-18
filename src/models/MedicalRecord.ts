import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IMedicalRecord extends Document {
  patient: Types.ObjectId;
  doctor: Types.ObjectId;
  visitDate: Date;
  diagnosis: string;
  symptoms?: string[];
  treatment?: string;
  notes?: string;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MedicalRecordSchema = new Schema<IMedicalRecord>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor is required'],
    },
    visitDate: {
      type: Date,
      required: [true, 'Visit date is required'],
      default: Date.now,
    },
    diagnosis: {
      type: String,
      required: [true, 'Diagnosis is required'],
      trim: true,
      maxlength: [500, 'Diagnosis cannot exceed 500 characters'],
    },
    symptoms: {
      type: [String],
      default: [],
      validate: {
        validator: function(symptoms: string[]) {
          return symptoms.length <= 10;
        },
        message: 'Cannot have more than 10 symptoms',
      },
    },
    treatment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Treatment cannot exceed 1000 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
    followUpDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
MedicalRecordSchema.index({ patient: 1, visitDate: -1 });
MedicalRecordSchema.index({ doctor: 1 });
MedicalRecordSchema.index({ createdAt: -1 });

const MedicalRecord = mongoose.models.MedicalRecord || mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);

export default MedicalRecord;
