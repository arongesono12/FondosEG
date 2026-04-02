import { NextRequest, NextResponse } from 'next/server';
import { AuthzError, requireAuthUser } from '@/lib/server/authz';
import { createWalletTransfer, confirmWalletTransfer, getPendingWalletTransfers, getClientWalletTransfers, cancelWalletTransfer } from '@/services/wallet-transfer';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser();

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create') {
      const result = await createWalletTransfer(user.id, data);
      return NextResponse.json(result);
    }

    if (action === 'confirm') {
      const result = await confirmWalletTransfer(data);
      return NextResponse.json(result);
    }

    if (action === 'cancel') {
      const result = await cancelWalletTransfer(data.transfer_id, user.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Wallet transfer API error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUser();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'pending') {
      const transfers = await getPendingWalletTransfers(user.id);
      return NextResponse.json(transfers);
    }

    const transfers = await getClientWalletTransfers(user.id);
    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Wallet transfer API error:', error);
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
