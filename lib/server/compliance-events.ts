import { PAYMENT_REGULATION } from '@/lib/compliance';
import { createAdminClient } from '@/lib/supabase/admin';

interface RecordPaymentConsentParams {
  actorUserId: string;
  transferId: string;
  transferType: 'agent_transfer' | 'wallet_transfer';
  amount: number;
  currency: string;
  feeAmount: number;
  beneficiaryName: string;
  channel: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function assertComplianceInfrastructure() {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from('compliance_events').select('id').limit(1);

  if (error) {
    throw new Error('El módulo de cumplimiento todavía no está habilitado en la base de datos');
  }
}

export async function recordPaymentConsent(params: RecordPaymentConsentParams) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from('compliance_events').insert({
    user_id: params.actorUserId,
    event_type: 'payment_consent',
    regulation_code: PAYMENT_REGULATION.code,
    disclosure_version: PAYMENT_REGULATION.disclosureVersion,
    entity_type: params.transferType,
    entity_id: params.transferId,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    metadata: {
      amount: params.amount,
      currency: params.currency,
      fee_amount: params.feeAmount,
      beneficiary_name: params.beneficiaryName,
      channel: params.channel,
      consent: true,
    },
  });

  if (error) {
    throw new Error(`No se pudo registrar la evidencia de consentimiento: ${error.message}`);
  }
}
