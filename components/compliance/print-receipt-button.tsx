'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintReceiptButton() {
  return (
    <Button type="button" className="rounded-xl bg-brand-gradient font-black text-white print:hidden" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      Imprimir comprobante
    </Button>
  );
}

