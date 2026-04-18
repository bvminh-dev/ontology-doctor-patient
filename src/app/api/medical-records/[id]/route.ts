import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MedicalRecord from '@/models/MedicalRecord';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid medical record ID' }, { status: 400 });
    }

    const record = await MedicalRecord.findById(id)
      .populate('patient', 'name age email phone')
      .populate('doctor', 'name specialty email phone');

    if (!record) {
      return NextResponse.json({ success: false, error: 'Medical record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch medical record' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid medical record ID' }, { status: 400 });
    }

    const record = await MedicalRecord.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    ).populate('patient', 'name age email phone')
     .populate('doctor', 'name specialty email phone');

    if (!record) {
      return NextResponse.json({ success: false, error: 'Medical record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update medical record' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid medical record ID' }, { status: 400 });
    }

    const record = await MedicalRecord.findByIdAndDelete(id);

    if (!record) {
      return NextResponse.json({ success: false, error: 'Medical record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: record }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete medical record' }, { status: 500 });
  }
}
