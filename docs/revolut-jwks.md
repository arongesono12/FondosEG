# Revolut Sandbox JWK Endpoint

Place your Revolut Sandbox signing certificate in this workspace as `signing.pem` or `signing.der`, then run:

```bash
node scripts/generate-revolut-jwks.js signing.pem fondoseg-sandbox-key-1
```

If your certificate is in DER format:

```bash
node scripts/generate-revolut-jwks.js signing.der fondoseg-sandbox-key-1
```

This generates:

- `public/.well-known/jwks.json`

Recommended public URL:

```text
https://fondoseg.com/.well-known/jwks.json
```

In the Revolut Developer Portal, paste that URL into the `Sandbox JWK endpoint` or `JWKs URL` field.

Important:

- Use the `signing` certificate, not `transport`.
- The `kid` you pass to the script must match the `kid` used in the JWT header for consent authorisation.
- The URL must be public and accessible over `https`.
