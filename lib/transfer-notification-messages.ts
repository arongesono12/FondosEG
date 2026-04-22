interface TransferNotificationMessageInput {
  transferCode: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  destinationCity?: string | null;
  creditedToWallet?: boolean;
}

function formatAmount(amount: number, currency: string): string {
  const normalizedCurrency = currency || 'XAF';

  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${normalizedCurrency}`;
  }
}

export function buildTransferNotificationMessages(input: TransferNotificationMessageInput) {
  const formattedAmount = formatAmount(input.amount, input.currency);
  const cityLine = input.destinationCity ? `Ciudad de retiro: ${input.destinationCity}` : null;

  const senderMessage = [
    `FondosEG: Hola ${input.senderName}. Hemos registrado correctamente su envío de ${formattedAmount} para ${input.receiverName}.`,
    `Código de envío: ${input.transferCode}`,
    cityLine,
    `Comparta este código únicamente con ${input.receiverName} para que pueda retirar el dinero con un gestor autorizado.`,
    'Gracias por confiar en FondosEG.',
  ]
    .filter(Boolean)
    .join('\n');

  const receiverIntro = input.creditedToWallet
    ? `FondosEG: Hola ${input.receiverName}. Ha recibido ${formattedAmount} de ${input.senderName}. El dinero ya está disponible en su billetera FondosEG.`
    : `FondosEG: Hola ${input.receiverName}. Tiene disponible un envío de ${formattedAmount} enviado por ${input.senderName}.`;

  const receiverWalletLine = input.creditedToWallet
    ? 'Si desea retirarlo en efectivo con un gestor, presente este código de envío.'
    : 'Cuando acuda a un gestor para retirar los fondos, presente este código de envío.';

  const receiverMessage = [
    receiverIntro,
    `Código de envío: ${input.transferCode}`,
    cityLine,
    receiverWalletLine,
    'Importante: debe presentar su DIP para retirar los fondos.',
    'Gracias por usar FondosEG.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    senderMessage,
    receiverMessage,
  };
}
