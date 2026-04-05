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
    `FondosEG: Hola ${input.senderName}, su envio de ${formattedAmount} para ${input.receiverName} ha sido registrado correctamente.`,
    `Codigo de envio: ${input.transferCode}`,
    cityLine,
    'Comparta este codigo unicamente con el destinatario para facilitar el retiro con un gestor.',
    'Gracias por confiar en FondosEG.',
  ]
    .filter(Boolean)
    .join('\n');

  const receiverIntro = input.creditedToWallet
    ? `FondosEG: Hola ${input.receiverName}, ha recibido ${formattedAmount} de ${input.senderName} y ya esta disponible en su billetera FondosEG.`
    : `FondosEG: Hola ${input.receiverName}, tiene un envio disponible de ${formattedAmount} enviado por ${input.senderName}.`;

  const receiverWalletLine = input.creditedToWallet
    ? 'Si desea retirar el dinero en efectivo con un gestor, facilite este codigo de envio.'
    : 'Cuando vaya a un gestor para retirar los fondos, facilite este codigo de envio.';

  const receiverMessage = [
    receiverIntro,
    `Codigo de envio: ${input.transferCode}`,
    cityLine,
    receiverWalletLine,
    'Advertencia importante: debe traer su DIP para poder retirar los fondos.',
    'Gracias por usar FondosEG.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    senderMessage,
    receiverMessage,
  };
}
