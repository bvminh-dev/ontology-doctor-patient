import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MedicalRecord from '@/models/MedicalRecord';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const doctorId = searchParams.get('doctorId');

    let query: any = {};

    if (patientId) {
      query.patient = patientId;
    }

    if (doctorId) {
      query.doctor = doctorId;
    }

    const records = await MedicalRecord.find(query)
      .populate('patient', 'name age email')
      .populate('doctor', 'name specialty email')
      .sort({ visitDate: -1, createdAt: -1 });

    return NextResponse.json({ success: true, data: records }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch medical records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const record = await MedicalRecord.create(body);
    const populatedRecord = await MedicalRecord.findById(record._id)
      .populate('patient', 'name age email')
      .populate('doctor', 'name specialty email');

    return NextResponse.json({ success: true, data: populatedRecord }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create medical record' },
      { status: 400 }
    );
  }
}
