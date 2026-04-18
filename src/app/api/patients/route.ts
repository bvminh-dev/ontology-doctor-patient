import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Patient from '@/models/Patient';

export async function GET() {
  try {
    await connectDB();
    const patients = await Patient.find({}).populate('assignedDoctor', 'name specialty').sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: patients }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch patients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const patient = await Patient.create(body);
    const populatedPatient = await Patient.findById(patient._id).populate('assignedDoctor', 'name specialty');
    return NextResponse.json({ success: true, data: populatedPatient }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create patient' }, { status: 400 });
  }
}
