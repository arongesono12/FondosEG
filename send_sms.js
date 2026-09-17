/* eslint-disable @typescript-eslint/no-require-imports */
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

if (!accountSid || !apiKey || !apiSecret) {
  console.error(
    "Faltan variables de entorno: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET",
  );
  process.exit(1);
}

const client = twilio(apiKey, apiSecret, { accountSid });

async function createMessage() {
  const message = await client.messages.create({
    body: "Este es el barco que hizo la carrera de Kessel en catorce parsecs.",
    from: "FondosEG",
    to: "+18777804236",
  });

  console.log("Enviado. SID:", message.body);
}

createMessage();
