import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPIKey, requirePermission } from '@/lib/api-auth';
import { generateTransferCode } from '@/lib/utils';
import { createAgentTransferOperation } from '@/lib/server/financial-operations';
import { persistIdempotencyResponse, readIdempotencyState } from '@/lib/server/api-idempotency';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    if (!await requirePermission(auth, 'transfer')) {
      return NextResponse.json({ error: 'Permiso denegado: transfer' }, { status: 403 });
    }

    const { user_id, role_access } = auth.apiKey!;
    
    if (role_access !== 'gestor') {
      return NextResponse.json(
        { error: 'Solo gestores pueden realizar transferencias' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const idempotencyState = await readIdempotencyState(
      auth.apiKey!.id,
      request.headers.get('idempotency-key'),
      body
    );

    if (idempotencyState?.conflictMessage) {
      return NextResponse.json({ error: idempotencyState.conflictMessage }, { status: 409 });
    }

    if (idempotencyState?.cachedResponse) {
      return NextResponse.json(idempotencyState.cachedResponse.body, {
        status: idempotencyState.cachedResponse.status,
      });
    }

    const {
      sender_name,
      sender_phone,
      sender_document_type,
      sender_document_number,
      receiver_name,
      receiver_phone,
      receiver_document_type,
      receiver_document_number,
      destination_city,
      destination_country,
      amount,
      currency = 'XAF',
      notes,
    } = body;

    if (!receiver_name || !receiver_phone || !amount || !destination_city) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const transferCode = generateTransferCode();

    const { transfer } = await createAgentTransferOperation({
      agentId: user_id,
      actorUserId: user_id,
      transferCode,
      senderName: sender_name,
      senderPhone: sender_phone,
      senderDocumentType: sender_document_type,
      senderDocumentNumber: sender_document_number,
      receiverName: receiver_name,
      receiverPhone: receiver_phone,
      receiverDocumentType: receiver_document_type,
      receiverDocumentNumber: receiver_document_number,
      destinationCity: destination_city,
      destinationCountry: destination_country,
      amount: Number(amount),
      currency,
      notes,
    });

    const responseBody = {
      success: true,
      data: {
        transfer_id: (transfer as { id: string }).id,
        transfer_code: transferCode,
        amount,
        currency,
        receiver_name,
        receiver_phone,
        destination_city,
        status: 'available_for_pickup',
        created_at: (transfer as { created_at: string }).created_at,
      },
    };

    await persistIdempotencyResponse(auth.apiKey!.id, idempotencyState, 200, responseBody);

    return NextResponse.json(responseBody);

  } catch (error) {
    console.error('API Transfer Error:', error);
    if (error instanceof Error && error.message) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

