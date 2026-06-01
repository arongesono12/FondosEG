import { randomUUID } from 'crypto';

export function createSandboxBalance(role: string) {
  if (role === 'gestor') {
    return {
      role: 'gestor',
      balance: 1000000,
      cash_balance: 250000,
      currency: 'XAF',
      formatted: '1.000.000 XAF',
      sandbox: true,
    };
  }

  if (role === 'admin' || role === 'superadmin') {
    return {
      role,
      total_balance: 5000000,
      currency: 'XAF',
      agents_count: 2,
      agents: [
        {
          id: 'sandbox-agent-001',
          name: 'Gestor Sandbox',
          phone: '+240000000001',
          balance: 2500000,
          cash_balance: 500000,
        },
      ],
      sandbox: true,
    };
  }

  return {
    role: 'cliente',
    balance: 150000,
    currency: 'XAF',
    formatted: '150.000 XAF',
    sandbox: true,
  };
}

export function createSandboxAgentTransfer(input: {
  amount: number;
  currency: string;
  receiverName: string;
  receiverPhone: string;
  destinationCity: string;
}) {
  return {
    transfer_id: randomUUID(),
    transfer_code: `TST${Math.floor(100000 + Math.random() * 900000)}`,
    amount: input.amount,
    currency: input.currency,
    receiver_name: input.receiverName,
    receiver_phone: input.receiverPhone,
    destination_city: input.destinationCity,
    status: 'available_for_pickup',
    created_at: new Date().toISOString(),
    sandbox: true,
  };
}

export function createSandboxWalletTransfer(input: {
  amount: number;
  currency: string;
  receiverName: string;
  receiverPhone: string;
}) {
  return {
    transfer_id: randomUUID(),
    transfer_type: 'wallet',
    amount: input.amount,
    currency: input.currency,
    sender_name: 'Cliente Sandbox',
    sender_phone: '+240000000000',
    receiver_name: input.receiverName,
    receiver_phone: input.receiverPhone,
    status: 'completed',
    created_at: new Date().toISOString(),
    new_balance: Math.max(150000 - input.amount, 0),
    sandbox: true,
  };
}

export function createSandboxHistory(role: string) {
  const now = new Date().toISOString();

  if (role === 'cliente') {
    return [
      {
        id: randomUUID(),
        amount: 5000,
        currency: 'XAF',
        status: 'confirmed',
        transfer_type: 'wallet',
        receiver_name: 'Cliente Sandbox Destino',
        receiver_phone: '+240000000002',
        created_at: now,
        sandbox: true,
      },
    ];
  }

  return [
    {
      id: randomUUID(),
      transfer_code: 'TST123456',
      amount: 25000,
      currency: 'XAF',
      status: 'available_for_pickup',
      receiver_name: 'Cliente Sandbox Destino',
      receiver_phone: '+240000000002',
      destination_city: 'Malabo',
      created_at: now,
      sandbox: true,
    },
  ];
}
