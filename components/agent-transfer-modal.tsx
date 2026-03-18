'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { createTransfer } from '@/services/transfer';
import { formatCurrency } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  User,
  Phone,
  MapPin,
  Wallet,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { getAgentBalance } from '@/services/agent';

interface AgentTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CITIES_CAMEROON = [
  'Douala',
  'Yaoundé',
  'Kousséri',
  'Bamenda',
  'Maroua',
  'Bafoussam',
  'Garoua',
  'Mokolo',
  'Ngaoundéré',
  'Édea',
  'Kumba',
  'Buea',
  'Limbe',
  'Bafang',
  'Dschang',
  'Ebolowa',
  'Kribi',
  'Soulédou',
  'Bertoua',
  'Yagoua',
];

const CITIES_EQUATORIAL_GUINEA = [
  'Malabo',
  'Bata',
  'Ebebiyín',
  'Aconibe',
  'Añisoc',
  'Luba',
  'Mongomo',
  'Evinayong',
  'Oyala',
  'Mikomeseng',
  'Cibero',
  'Rebola',
  'Baney',
  'Musola',
  'Niefang',
  'Nkuéman',
  'Cup',
];

const COUNTRIES = [
  'Camerún',
  'Gabón',
  'Guinea Ecuatorial',
  'Congo',
  'Nigeria',
  'Chad',
  'República Centroafricana',
  'Santo Tomé y Príncipe',
  'Camerún',
  'Costa de Marfil',
  'Senegal',
  'Mali',
  'Burkina Faso',
  'Níger',
  'Togo',
  'Benín',
  'Liberia',
  'Sierra Leona',
  'Ghana',
  'Angola',
  'República Democrática del Congo',
];

const DOCUMENT_TYPES = [
  { value: 'dni', label: 'DNI' },
  { value: 'pasaporte', label: 'Pasaporte' },
  { value: 'cedula', label: 'Cédula de Identidad' },
  { value: 'dip', label: 'DIP' },
  { value: 'otro', label: 'Otro' },
];

export function AgentTransferModal({ open, onOpenChange, onSuccess }: AgentTransferModalProps) {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number>(0);
  const [customCity, setCustomCity] = useState(false);
  const [customCountry, setCustomCountry] = useState(false);

  const [formData, setFormData] = useState({
    sender_name: '',
    sender_phone: '',
    sender_document_type: 'dni',
    sender_document_number: '',
    receiver_name: '',
    receiver_phone: '',
    receiver_document_type: 'dni',
    receiver_document_number: '',
    destination_city: '',
    destination_country: '',
    amount: '',
    currency: 'XAF',
    notes: '',
  });

  const allCities = [...CITIES_CAMEROON, ...CITIES_EQUATORIAL_GUINEA].sort();

  useEffect(() => {
    async function loadBalance() {
      if (!user?.id) return;
      const balanceData = await getAgentBalance(user.id);
      setBalance(balanceData?.balance || 0);
    }
    if (open && user?.id) {
      loadBalance();
    }
  }, [open, user?.id]);

  useEffect(() => {
    if (open && user) {
      setFormData(prev => ({
        ...prev,
        sender_name: user.name || '',
        sender_phone: user.phone || '',
      }));
    }
  }, [open, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setError('');

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingrese un monto válido');
      return;
    }

    if (amount > balance) {
      setError('Saldo insuficiente para realizar esta transferencia');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmTransfer = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError('');

    const amount = parseFloat(formData.amount);

    try {
      const result = await createTransfer({
        sender_name: formData.sender_name,
        sender_phone: formData.sender_phone,
        sender_document_type: formData.sender_document_type || undefined,
        sender_document_number: formData.sender_document_number || undefined,
        receiver_name: formData.receiver_name,
        receiver_phone: formData.receiver_phone,
        receiver_document_type: formData.receiver_document_type || undefined,
        receiver_document_number: formData.receiver_document_number || undefined,
        destination_city: formData.destination_city,
        destination_country: formData.destination_country || undefined,
        amount: amount,
        currency: formData.currency,
        notes: formData.notes || undefined,
      }, user.id);

      if (result.success) {
        setShowConfirm(false);
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setFormData({
            sender_name: user.name || '',
            sender_phone: user.phone || '',
            sender_document_type: 'dni',
            sender_document_number: '',
            receiver_name: '',
            receiver_phone: '',
            receiver_document_type: 'dni',
            receiver_document_number: '',
            destination_city: '',
            destination_country: '',
            amount: '',
            currency: 'XAF',
            notes: '',
          });
          setCustomCity(false);
          setCustomCountry(false);
          onOpenChange(false);
          onSuccess?.();
        }, 2000);
      } else {
        setError(result.error || 'Error al crear la transferencia');
        setShowConfirm(false);
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setShowConfirm(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden outline-none max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 border-b border-border/10">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
            <Send className="h-5 w-5 text-primary" /> Nueva Transferencia
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Complete los datos del destinatario para realizar el envío de dinero
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-black text-foreground">¡Transferencia realizada!</p>
              <p className="text-sm text-muted-foreground">El dinero ha sido enviado exitosamente</p>
            </div>
          ) : (
            <>
              {/* Saldo disponible */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase">Saldo disponible</p>
                    <p className="text-lg font-black text-foreground">{formatCurrency(balance)}</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Datos del remitente (solo lectura) */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Datos del Remitente</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="sender_name" className="text-xs font-bold text-muted-foreground">Nombre</Label>
                      <Input
                        id="sender_name"
                        name="sender_name"
                        value={formData.sender_name}
                        onChange={handleChange}
                        className="h-10 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="sender_phone" className="text-xs font-bold text-muted-foreground">Teléfono</Label>
                      <Input
                        id="sender_phone"
                        name="sender_phone"
                        value={formData.sender_phone}
                        onChange={handleChange}
                        className="h-10 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="sender_document_type" className="text-xs font-bold text-muted-foreground">Tipo de Documento</Label>
                      <select
                        id="sender_document_type"
                        name="sender_document_type"
                        value={formData.sender_document_type}
                        onChange={handleChange}
                        className="w-full h-10 mt-1 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20"
                        required
                      >
                        {DOCUMENT_TYPES.map((doc) => (
                          <option key={doc.value} value={doc.value}>{doc.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="sender_document_number" className="text-xs font-bold text-muted-foreground">N° Documento</Label>
                      <Input
                        id="sender_document_number"
                        name="sender_document_number"
                        value={formData.sender_document_number}
                        onChange={handleChange}
                        placeholder="Número de documento"
                        className="h-10 rounded-xl mt-1"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Datos del destinatario */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Datos del Destinatario</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="receiver_name" className="text-xs font-bold text-muted-foreground">Nombre completo</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="receiver_name"
                          name="receiver_name"
                          value={formData.receiver_name}
                          onChange={handleChange}
                          placeholder="Nombre del destinatario"
                          className="h-10 pl-10 rounded-xl"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="receiver_phone" className="text-xs font-bold text-muted-foreground">Teléfono</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="receiver_phone"
                          name="receiver_phone"
                          value={formData.receiver_phone}
                          onChange={handleChange}
                          placeholder="+237 XXXXXXXX"
                          className="h-10 pl-10 rounded-xl"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="receiver_document_type" className="text-xs font-bold text-muted-foreground">Tipo de Documento</Label>
                      <select
                        id="receiver_document_type"
                        name="receiver_document_type"
                        value={formData.receiver_document_type}
                        onChange={handleChange}
                        className="w-full h-10 mt-1 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20"
                        required
                      >
                        {DOCUMENT_TYPES.map((doc) => (
                          <option key={doc.value} value={doc.value}>{doc.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="receiver_document_number" className="text-xs font-bold text-muted-foreground">N° Documento</Label>
                      <Input
                        id="receiver_document_number"
                        name="receiver_document_number"
                        value={formData.receiver_document_number}
                        onChange={handleChange}
                        placeholder="Número de documento"
                        className="h-10 rounded-xl mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="destination_city" className="text-xs font-bold text-muted-foreground">Ciudad</Label>
                      <div className="relative mt-1">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          id="destination_city"
                          name="destination_city"
                          value={formData.destination_city}
                          onChange={handleChange}
                          className="w-full h-10 pl-10 pr-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20"
                          required
                        >
                          <option value="">Seleccionar ciudad</option>
                          {allCities.map((city: string) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center mt-2">
                      <button
                        type="button"
                        onClick={() => setCustomCity(!customCity)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {customCity ? 'Seleccionar de lista' : 'Escribir ciudad manualmente'}
                      </button>
                    </div>
                    {customCity && (
                      <div className="mt-2">
                        <Input
                          id="destination_city_custom"
                          name="destination_city"
                          value={formData.destination_city}
                          onChange={handleChange}
                          placeholder="Escriba la ciudad..."
                          className="h-10 rounded-xl"
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="destination_country" className="text-xs font-bold text-muted-foreground">País</Label>
                      {!customCountry ? (
                        <>
                          <select
                            id="destination_country"
                            name="destination_country"
                            value={formData.destination_country}
                            onChange={handleChange}
                            className="w-full h-10 mt-1 px-3 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20"
                            required
                          >
                            <option value="">Seleccionar país</option>
                            {COUNTRIES.map((country: string) => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </select>
                          <div className="flex items-center mt-2">
                            <button
                              type="button"
                              onClick={() => setCustomCountry(true)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              Escribir país manualmente
                            </button>
                          </div>
                        </>
                      ) : (
                        <div>
                          <Input
                            id="destination_country_custom"
                            name="destination_country"
                            value={formData.destination_country}
                            onChange={handleChange}
                            placeholder="Escriba el país..."
                            className="h-10 rounded-xl mt-1"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomCountry(false)}
                            className="text-xs text-primary hover:underline font-medium mt-1"
                          >
                            Seleccionar de lista
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monto */}
                <div className="space-y-3">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Monto a Enviar</p>
                  <div>
                    <Label htmlFor="amount" className="text-xs font-bold text-muted-foreground">Monto (XAF)</Label>
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      min="100"
                      step="100"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0"
                      className="h-12 text-lg font-black rounded-xl mt-1"
                      required
                    />
                    {formData.amount && parseFloat(formData.amount) > balance && (
                      <p className="text-xs text-red-500 mt-1 font-bold">Monto excede el saldo disponible</p>
                    )}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <Label htmlFor="notes" className="text-xs font-bold text-muted-foreground">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Mensaje opcional para el destinatario..."
                    className="rounded-xl mt-1 resize-none"
                    rows={2}
                  />
                </div>

                <Button 
                  type="submit"
                  disabled={loading || !formData.amount || parseFloat(formData.amount) > balance || !formData.receiver_name || !formData.receiver_phone || !formData.destination_city || !formData.sender_document_number || !formData.receiver_document_number}
                  className="w-full h-12 rounded-xl bg-brand-gradient text-white font-black shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all"
                >
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Continuar
                  </>
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Modal de Confirmación */}
        <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) setShowConfirm(false); }}>
          <DialogContent className="max-w-md p-0 overflow-hidden outline-none">
            <DialogHeader className="p-6 border-b border-border/10">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> Confirmar Transferencia
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Verifique los datos antes de confirmar el envío
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                  ⚠️ Revise los datos antes de confirmar
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Esta acción no se puede deshacer. Asegúrese de que los datos sean correctos.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Remitente</span>
                  <span className="text-sm font-black text-foreground">{formData.sender_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Teléfono Remitente</span>
                  <span className="text-sm font-black text-foreground">{formData.sender_phone}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Destinatario</span>
                  <span className="text-sm font-black text-foreground">{formData.receiver_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Teléfono Destinatario</span>
                  <span className="text-sm font-black text-foreground">{formData.receiver_phone}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Ciudad</span>
                  <span className="text-sm font-black text-foreground">{formData.destination_city}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">País</span>
                  <span className="text-sm font-black text-foreground">{formData.destination_country}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/10">
                  <span className="text-xs font-bold text-muted-foreground">Monto</span>
                  <span className="text-lg font-black text-green-600">{formData.amount ? formatCurrency(parseFloat(formData.amount)) : ''}</span>
                </div>
                {formData.notes && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-bold text-muted-foreground">Notas</span>
                    <span className="text-sm font-bold text-foreground text-right max-w-[200px]">{formData.notes}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="flex-1 h-12 rounded-xl font-bold"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
                <Button 
                  onClick={handleConfirmTransfer}
                  disabled={loading}
                  className="flex-1 h-12 rounded-xl bg-brand-gradient text-white font-black shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
