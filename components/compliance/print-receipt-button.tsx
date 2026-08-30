'use client';

import { FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintReceiptButton() {
  return (
    <Button type="button" variant="brand" className="rounded-xl font-semibold print:hidden" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      Imprimir / guardar PDF
      <FileDown className="ml-2 h-4 w-4" />
    </Button>
  );
}
