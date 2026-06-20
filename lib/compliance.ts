export const PAYMENT_REGULATION = {
  code: '04/18/CEMAC/UMAC/COBAC',
  adoptedAt: '2018-12-21',
  disclosureVersion: 'cemac-payment-disclosure-2026-06',
  officialUrl:
    'https://www.beac.int/wp-content/uploads/2019/07/REGLEMENT-N-04-18-CEMAC-UMAC-COBAC-du-21-d%C3%A9cembre-2018.pdf',
} as const;

export const PAYMENT_COMPLAINT_TARGET_DAYS = 15;

export function createComplaintReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const random = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `REC-${date}-${random}`;
}

