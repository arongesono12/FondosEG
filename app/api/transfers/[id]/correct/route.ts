import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireProfile, requireRole } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { correctAgentTransferOperation } from '@/modules/transfers/application';
import { findRegisteredClientByPhone } from '@/lib/server/client-recipient';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireProfile();
    requireRole(profile, 'admin');

    const { id } = await context.params;
    const body = (await request.json()) as Partial<{
      sender_name: string;
      sender_phone: string;
      sender_document_type: string;
      sender_document_number: string;
      receiver_name: string;
      receiver_phone: string;
      receiver_document_type: string;
      receiver_document_number: string;
      destination_city: string;
      destination_country: string;
      amount: number;
      currency: string;
      notes: string;
    }>;

    const adminClient = createAdminClient();
    const { data: transfer, error } = await adminClient
      .from('transfers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !transfer) {
      return NextResponse.json({ success: false, error: 'Transferencia no encontrada' }, { status: 404 });
    }

    const merged = {
      sender_name: body.sender_name ?? transfer.sender_name,
      sender_phone: body.sender_phone ?? transfer.sender_phone,
      sender_document_type: body.sender_document_type ?? transfer.sender_document_type,
      sender_document_number: body.sender_document_number ?? transfer.sender_document_number,
      receiver_name: body.receiver_name ?? transfer.receiver_name,
      receiver_phone: body.receiver_phone ?? transfer.receiver_phone,
      receiver_document_type: body.receiver_document_type ?? transfer.receiver_document_type,
      receiver_document_number: body.receiver_document_number ?? transfer.receiver_document_number,
      destination_city: body.destination_city ?? transfer.destination_city,
      destination_country: body.destination_country ?? transfer.destination_country,
      amount: Number(body.amount ?? transfer.amount),
      currency: body.currency ?? transfer.currency,
      notes: body.notes ?? transfer.notes,
    };

    if (!merged.receiver_name || !merged.receiver_phone || !merged.destination_city || !Number.isFinite(merged.amount) || merged.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Faltan datos válidos para corregir la transferencia' }, { status: 400 });
    }

    const registeredReceiver = await findRegisteredClientByPhone(adminClient, merged.receiver_phone);
    const result = await correctAgentTransferOperation({
      transferId: id,
      actorUserId: profile.id,
      senderName: merged.sender_name,
      senderPhone: merged.sender_phone,
      senderDocumentType: merged.sender_document_type || undefined,
      senderDocumentNumber: merged.sender_document_number || undefined,
      receiverName: merged.receiver_name,
      receiverPhone: merged.receiver_phone,
      receiverDocumentType: merged.receiver_document_type || undefined,
      receiverDocumentNumber: merged.receiver_document_number || undefined,
      destinationCity: merged.destination_city,
      destinationCountry: merged.destination_country || undefined,
      amount: merged.amount,
      currency: merged.currency,
      notes: merged.notes || undefined,
      receiverUserId: registeredReceiver?.id ?? null,
    });

    return NextResponse.json({ success: true, transfer: result.transfer });
  } catch (err) {
    console.error('[PATCH /api/transfers/[id]/correct]', err);
    if (err instanceof AuthzError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
