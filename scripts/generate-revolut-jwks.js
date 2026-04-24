const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function usage() {
  console.error(
    "Usage: node scripts/generate-revolut-jwks.js <signing.pem|signing.der> [kid] [outputPath]"
  );
}

function ensurePem(inputPath, content) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === ".pem" || content.toString("utf8").includes("BEGIN CERTIFICATE")) {
    return content.toString("utf8");
  }

  const base64 = content.toString("base64");
  const lines = base64.match(/.{1,64}/g) || [];
  return [
    "-----BEGIN CERTIFICATE-----",
    ...lines,
    "-----END CERTIFICATE-----",
    "",
  ].join("\n");
}

function main() {
  const [, , certArg, kidArg, outputArg] = process.argv;
  if (!certArg) {
    usage();
    process.exit(1);
  }

  const certPath = path.resolve(certArg);
  const outputPath = path.resolve(outputArg || "public/.well-known/jwks.json");
  const kid = kidArg || "fondoseg-sandbox-key-1";

  if (!fs.existsSync(certPath)) {
    console.error(`Certificate not found: ${certPath}`);
    process.exit(1);
  }

  const certBuffer = fs.readFileSync(certPath);
  const certPem = ensurePem(certPath, certBuffer);
  const x509 = new crypto.X509Certificate(certPem);
  const jwk = x509.publicKey.export({ format: "jwk" });
  const x5c = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  if (!jwk.n || !jwk.e) {
    console.error("Could not extract RSA public key parameters from the certificate.");
    process.exit(1);
  }

  const jwks = {
    keys: [
      {
        e: jwk.e,
        n: jwk.n,
        kid,
        kty: "RSA",
        use: "sig",
        x5c: [x5c],
      },
    ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(jwks, null, 2)}\n`, "utf8");

  console.log(`Generated JWKs file: ${outputPath}`);
  console.log(`Use this kid in your JWT header: ${kid}`);
}

main();
