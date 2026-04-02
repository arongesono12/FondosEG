'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRGeneratorProps {
  data: string;
  size?: number;
  onDownload?: () => void;
}

export function QRGenerator({ data, size = 200, onDownload }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const generateQR = async () => {
      try {
        setLoading(true);
        setError(null);
        await QRCode.toCanvas(canvasRef.current, data, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      } catch (err) {
        console.error('QR generation error:', err);
        setError('Error generating QR code');
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, [data, size]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `qr-transfer-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    onDownload?.();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-2xl shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center" style={{ width: size, height: size }}>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={loading}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Descargar QR
      </Button>
    </div>
  );
}

interface QRData {
  transfer_id: string;
  amount: number;
  currency: string;
  sender_name: string;
  receiver_name: string;
  verification_code: string;
}

export function generateQRData(transfer: QRData): string {
  const jsonStr = JSON.stringify(transfer);
  return `FondosEG://transfer/${btoa(jsonStr)}`;
}
