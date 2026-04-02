'use client';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MessageSquare, Send, Loader2, ChevronDown, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import type { User } from '@/types';

interface SupportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType?: 'balance_topup' | 'report_error' | 'general';
  defaultMessage?: string;
}

export function SupportModal({ open, onOpenChange, requestType = 'general', defaultMessage = '' }: SupportModalProps) {
  const { user } = useAppStore();
  const [message, setMessage] = useState(defaultMessage);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [admins, setAdmins] = useState<User[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const isClient = user?.role === 'cliente';

  const titleMap = {
    balance_topup: 'Solicitar Recarga de Saldo',
    report_error: 'Reportar Transferencia con Error',
    general: isClient ? 'Contactar Gestor' : 'Contactar Administración',
  };

  const descMap = {
    balance_topup: 'Contacta con un administrador de FondosEG para recargar tu cuenta',
    report_error: isClient 
      ? 'Reporta el error de tu transferencia al gestor que te envió los fondos' 
      : 'Describe el problema con la transferencia para que un administrador pueda ayudarte',
    general: isClient 
      ? 'Contacta al gestor que te envió una transferencia' 
      : 'Envía un mensaje al equipo de administración de FondosEG',
  };

  // Load admins when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingAdmins(true);
    
    const endpoint = isClient ? '/api/gestors-for-client' : '/api/admins';
    fetch(endpoint)
      .then((r) => r.json())
      .then((data: User[]) => {
        setAdmins(data);
        if (data.length > 0) setSelectedAdmin(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingAdmins(false));
  }, [open, isClient]);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          message: message,
          targetAdminId: selectedAdmin?.id,
          targetAdminName: selectedAdmin?.name,
          targetAdminEmail: selectedAdmin?.email,
          targetAdminPhone: selectedAdmin?.phone,
          requestType: requestType,
        }),
      });

      if (response.ok) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setMessage('');
          onOpenChange(false);
        }, 2500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
        <DialogHeader className="p-6 border-b border-border/10">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" /> {titleMap[requestType]}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {descMap[requestType]}
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-5">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-black text-foreground">¡Solicitud enviada!</p>
              <p className="text-sm text-muted-foreground">El administrador te responderá pronto</p>
            </div>
          ) : (
            <>
              {/* Admin Selector */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Seleccionar Administrador
                </label>

                {loadingAdmins ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-border/20 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando administradores...
                  </div>
                ) : admins.length === 0 ? (
                  <div className="p-3 rounded-xl border border-border/20 text-muted-foreground text-sm">
                    No hay administradores disponibles
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-border/20 bg-card hover:bg-muted/50 transition-colors text-left"
                    >
                      {selectedAdmin ? (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-primary/20">
                            <AvatarImage src={selectedAdmin.avatar_url} />
                            <AvatarFallback className="bg-brand-gradient text-white text-xs font-bold">
                              {getInitials(selectedAdmin.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-bold text-foreground">{selectedAdmin.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Administrador</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Elige un administrador</span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {dropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border/20 rounded-xl shadow-xl overflow-hidden">
                        {admins.map((admin) => (
                          <button
                            key={admin.id}
                            type="button"
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left ${
                              selectedAdmin?.id === admin.id ? 'bg-primary/5' : ''
                            }`}
                          >
                            <Avatar className="h-8 w-8 border border-primary/20">
                              <AvatarImage src={admin.avatar_url} />
                              <AvatarFallback className="bg-brand-gradient text-white text-xs font-bold">
                                {getInitials(admin.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-bold text-foreground">{admin.name}</p>
                              <p className="text-[10px] text-muted-foreground">{admin.email}</p>
                            </div>
                            {selectedAdmin?.id === admin.id && (
                              <ShieldCheck className="h-4 w-4 text-primary ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Tu mensaje / solicitud</label>
                <Textarea 
                  placeholder={requestType === 'balance_topup' 
                    ? "Ej: Necesito recargar mi cuenta con 500.000 XAF para continuar operando..." 
                    : requestType === 'report_error'
                    ? "Ej: La transferencia con código TX-123 no fue completada correctamente. El monto fuedebía ser 50.000 XAF pero se envió 5.000 XAF..."
                    : "Escribe tu mensaje aquí..."}
                  className="min-h-[100px] rounded-xl border-border/20 focus:ring-pink-500/50"
                  value={message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleSend}
                disabled={!message.trim() || loading || !selectedAdmin}
                className="w-full h-12 rounded-xl bg-brand-gradient text-white font-black shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" /> 
                    {requestType === 'balance_topup' ? 'Solicitar Recarga' : requestType === 'report_error' ? 'Reportar Error' : 'Enviar Mensaje'}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
