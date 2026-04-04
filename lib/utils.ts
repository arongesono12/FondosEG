import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { calculateCommission, normalizeTransferStatus } from '@/lib/financial';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const exchangeRates: Record<string, Record<string, number>> = {
  XAF: {
    XAF: 1,
    EUR: 0.001524,
    USD: 0.001671,
    GBP: 0.001273,
  },
  EUR: {
    XAF: 655.957,
    EUR: 1,
    USD: 1.0963,
    GBP: 0.8352,
  },
  USD: {
    XAF: 598.45,
    USD: 1,
    EUR: 0.9121,
    GBP: 0.7620,
  },
  GBP: {
    XAF: 785.23,
    GBP: 1,
    EUR: 1.1973,
    USD: 1.3124,
  },
};

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;
  
  const rates = exchangeRates[fromCurrency];
  if (!rates || !rates[toCurrency]) return amount;
  
  return amount * rates[toCurrency];
}

export function formatCurrency(amount: number, currency: string = 'XAF'): string {
  if (currency === 'XAF') {
    return new Intl.NumberFormat('es-ES').format(amount) + ' XAF';
  }
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function generateTransferCode(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `TRX-${year}-${random}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  if (status === 'sent') {
    return 'bg-green-100 text-green-800';
  }

  if (status === 'failed') {
    return 'bg-red-100 text-red-800';
  }

  switch (normalizeTransferStatus(status)) {
    case 'available_for_pickup':
      return 'bg-blue-100 text-blue-800';
    case 'paid_out':
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'created':
      return 'bg-yellow-100 text-yellow-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusText(status: string): string {
  switch (normalizeTransferStatus(status)) {
    case 'available_for_pickup':
      return 'Disponible';
    case 'paid_out':
      return 'Pagado';
    case 'completed':
      return 'Completado';
    case 'created':
      return 'Pendiente';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

export function formatPhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function getPhoneLookupCandidates(phone: string): string[] {
  const trimmed = phone.trim();
  const compact = formatPhone(phone).trim();
  const digits = normalizePhoneDigits(phone);

  return Array.from(
    new Set(
      [
        trimmed,
        compact,
        digits,
        digits ? `+${digits}` : '',
        digits.startsWith('00') ? `+${digits.slice(2)}` : '',
      ].filter(Boolean)
    )
  );
}

export function calculateFee(amount: number): number {
  return calculateCommission(amount);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
