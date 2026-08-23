interface TransferNotificationMessageInput {
  transferCode: string;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  destinationCity?: string | null;
  /**
   * El beneficiario tenía cuenta en la aplicación, así que el envío se liquidó
   * contra su billetera en el momento de crearse.
   *
   * No es lo mismo que "acreditado": antes el importe entraba en la billetera
   * PERO el código seguía siendo cobrable en ventanilla, de modo que el propio
   * emisor podía retirar el dinero del beneficiario. Ahora, liquidado significa
   * cerrado: el código ya no autoriza ninguna entrega de efectivo y el titular
   * emite el suyo propio si quiere billetes.
   */
  settledToWallet?: boolean;
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

  if (input.settledToWallet) {
    // Ni el emisor ni el beneficiario deben recibir instrucciones de ventanilla:
    // no hay nada que cobrar con este código. Al emisor se le da como
    // referencia de la operación, no como vale.
    const senderMessage = [
      `FondosEG: Hola ${input.senderName}. Su envío de ${formattedAmount} para ${input.receiverName} se ha entregado en su billetera FondosEG.`,
      `Referencia: ${input.transferCode}`,
      'No hace falta ningún código de retiro: el beneficiario ya dispone del dinero en su cuenta.',
      'Gracias por confiar en FondosEG.',
    ].join('\n');

    const receiverMessage = [
      `FondosEG: Hola ${input.receiverName}. Ha recibido ${formattedAmount} de ${input.senderName}. El dinero ya está disponible en su billetera FondosEG.`,
      `Referencia: ${input.transferCode}`,
      'Puede usarlo desde la aplicación o, si quiere efectivo, generar usted mismo un código de retiro en su panel y presentarlo con su DIP en cualquier gestor autorizado.',
      'Gracias por usar FondosEG.',
    ].join('\n');

    return { senderMessage, receiverMessage };
  }

  const senderMessage = [
    `FondosEG: Hola ${input.senderName}. Hemos registrado correctamente su envío de ${formattedAmount} para ${input.receiverName}.`,
    `Código de envío: ${input.transferCode}`,
    cityLine,
    `Comparta este código únicamente con ${input.receiverName} para que pueda retirar el dinero con un gestor autorizado.`,
    'Gracias por confiar en FondosEG.',
  ]
    .filter(Boolean)
    .join('\n');

  const receiverMessage = [
    `FondosEG: Hola ${input.receiverName}. Tiene disponible un envío de ${formattedAmount} enviado por ${input.senderName}.`,
    `Código de envío: ${input.transferCode}`,
    cityLine,
    'Cuando acuda a un gestor para retirar los fondos, presente este código de envío.',
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
