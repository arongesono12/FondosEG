'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  Menu,
  Package,
  Rocket,
  ShieldCheck,
  Webhook,
  X,
  Zap,
} from 'lucide-react';

import { DashboardLogo } from '@/components/layout/dashboard-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'introduccion', label: 'Introducción' },
  { id: 'inicio-rapido', label: 'Inicio rápido' },
  { id: 'autenticacion', label: 'Autenticación' },
  { id: 'ejemplos', label: 'Ejemplos' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'errores', label: 'Errores y reintentos' },
  { id: 'produccion', label: 'Paso a producción' },
] as const;

const endpoints = [
  { method: 'GET', path: '/api/v1/external/balance', scope: 'balance', description: 'Consulta el saldo disponible para la credencial.' },
  { method: 'GET', path: '/api/v1/external/history', scope: 'history', description: 'Lista operaciones con paginación y filtros.' },
  { method: 'POST', path: '/api/v1/external/transfer', scope: 'transfer', description: 'Crea una transferencia operada por un gestor.' },
  { method: 'POST', path: '/api/v1/external/wallet-transfer', scope: 'transfer', description: 'Mueve saldo entre clientes FondosEG.' },
  { method: 'GET', path: '/api/v1/external/properties', scope: 'properties', description: 'Consulta las propiedades visibles.' },
  { method: 'GET', path: '/api/v1/external/rentals', scope: 'properties', description: 'Consulta contratos de alquiler.' },
  { method: 'GET · POST', path: '/api/v1/external/rental-payments', scope: 'payments', description: 'Consulta o inicia pagos de alquiler.' },
] as const;

const examples = {
  curl: `curl "https://fondoseg.com/api/v1/external/balance" \\
  -H "accept: application/json" \\
  -H "x-api-key: $FONDOSEG_API_KEY" \\
  -H "x-api-secret: $FONDOSEG_API_SECRET"`,
  typescript: `const response = await fetch(
  'https://fondoseg.com/api/v1/external/balance',
  {
    headers: {
      accept: 'application/json',
      'x-api-key': process.env.FONDOSEG_API_KEY,
      'x-api-secret': process.env.FONDOSEG_API_SECRET,
    },
  }
);

const result = await response.json();
if (!response.ok) throw new Error(result.error.message);

console.log(result.data.balance);`,
  javascript: `const response = await fetch(
  'https://fondoseg.com/api/v1/external/balance',
  {
    headers: {
      accept: 'application/json',
      'x-api-key': process.env.FONDOSEG_API_KEY,
      'x-api-secret': process.env.FONDOSEG_API_SECRET,
    },
  }
);

if (!response.ok) {
  throw new Error(\`FondosEG respondió ${'${response.status}'}\`);
}

const { data } = await response.json();
console.log(data.balance, data.currency);`,
  python: `import os
import requests

response = requests.get(
    "https://fondoseg.com/api/v1/external/balance",
    headers={
        "Accept": "application/json",
        "x-api-key": os.environ["FONDOSEG_API_KEY"],
        "x-api-secret": os.environ["FONDOSEG_API_SECRET"],
    },
    timeout=15,
)

response.raise_for_status()
data = response.json()["data"]
print(data["balance"], data["currency"])`,
  php: `<?php
$request = curl_init(
  'https://fondoseg.com/api/v1/external/balance'
);

curl_setopt_array($request, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'accept: application/json',
    'x-api-key: ' . getenv('FONDOSEG_API_KEY'),
    'x-api-secret: ' . getenv('FONDOSEG_API_SECRET'),
  ],
]);

$result = curl_exec($request);
curl_close($request);`,
  java: `var client = java.net.http.HttpClient.newHttpClient();
var request = java.net.http.HttpRequest.newBuilder()
    .uri(java.net.URI.create(
        "https://fondoseg.com/api/v1/external/balance"
    ))
    .header("Accept", "application/json")
    .header("x-api-key", System.getenv("FONDOSEG_API_KEY"))
    .header("x-api-secret", System.getenv("FONDOSEG_API_SECRET"))
    .GET()
    .build();

var response = client.send(
    request,
    java.net.http.HttpResponse.BodyHandlers.ofString()
);

if (response.statusCode() >= 400) {
    throw new RuntimeException(response.body());
}
System.out.println(response.body());`,
  csharp: `using System.Net.Http.Headers;

using var client = new HttpClient();
client.DefaultRequestHeaders.Accept.Add(
    new MediaTypeWithQualityHeaderValue("application/json")
);
client.DefaultRequestHeaders.Add(
    "x-api-key", Environment.GetEnvironmentVariable("FONDOSEG_API_KEY")
);
client.DefaultRequestHeaders.Add(
    "x-api-secret", Environment.GetEnvironmentVariable("FONDOSEG_API_SECRET")
);

var response = await client.GetAsync(
    "https://fondoseg.com/api/v1/external/balance"
);
response.EnsureSuccessStatusCode();

var json = await response.Content.ReadAsStringAsync();
Console.WriteLine(json);`,
  go: `package main

import (
    "fmt"
    "io"
    "net/http"
    "os"
)

func main() {
    req, _ := http.NewRequest(
        http.MethodGet,
        "https://fondoseg.com/api/v1/external/balance",
        nil,
    )
    req.Header.Set("Accept", "application/json")
    req.Header.Set("x-api-key", os.Getenv("FONDOSEG_API_KEY"))
    req.Header.Set("x-api-secret", os.Getenv("FONDOSEG_API_SECRET"))

    response, err := http.DefaultClient.Do(req)
    if err != nil { panic(err) }
    defer response.Body.Close()

    body, _ := io.ReadAll(response.Body)
    fmt.Println(string(body))
}`,
  kotlin: `val client = java.net.http.HttpClient.newHttpClient()
val request = java.net.http.HttpRequest.newBuilder()
    .uri(java.net.URI.create(
        "https://fondoseg.com/api/v1/external/balance"
    ))
    .header("Accept", "application/json")
    .header("x-api-key", System.getenv("FONDOSEG_API_KEY"))
    .header("x-api-secret", System.getenv("FONDOSEG_API_SECRET"))
    .GET()
    .build()

val response = client.send(
    request,
    java.net.http.HttpResponse.BodyHandlers.ofString()
)
check(response.statusCode() < 400) { response.body() }
println(response.body())`,
  swift: `import Foundation

let url = URL(
  string: "https://fondoseg.com/api/v1/external/balance"
)!
var request = URLRequest(url: url)
request.setValue("application/json", forHTTPHeaderField: "Accept")
request.setValue(
  ProcessInfo.processInfo.environment["FONDOSEG_API_KEY"],
  forHTTPHeaderField: "x-api-key"
)
request.setValue(
  ProcessInfo.processInfo.environment["FONDOSEG_API_SECRET"],
  forHTTPHeaderField: "x-api-secret"
)

let (data, response) = try await URLSession.shared.data(for: request)
guard let http = response as? HTTPURLResponse,
      (200..<300).contains(http.statusCode) else {
  throw URLError(.badServerResponse)
}
print(String(decoding: data, as: UTF8.self))`,
  dart: `import 'dart:io';
import 'package:http/http.dart' as http;

Future<void> main() async {
  final response = await http.get(
    Uri.parse('https://fondoseg.com/api/v1/external/balance'),
    headers: {
      'Accept': 'application/json',
      'x-api-key': Platform.environment['FONDOSEG_API_KEY']!,
      'x-api-secret': Platform.environment['FONDOSEG_API_SECRET']!,
    },
  );

  if (response.statusCode >= 400) {
    throw HttpException(response.body);
  }
  print(response.body);
}`,
  ruby: `require 'net/http'
require 'json'

uri = URI('https://fondoseg.com/api/v1/external/balance')
request = Net::HTTP::Get.new(uri)
request['Accept'] = 'application/json'
request['x-api-key'] = ENV.fetch('FONDOSEG_API_KEY')
request['x-api-secret'] = ENV.fetch('FONDOSEG_API_SECRET')

response = Net::HTTP.start(
  uri.hostname,
  uri.port,
  use_ssl: true
) { |http| http.request(request) }

raise response.body unless response.is_a?(Net::HTTPSuccess)
puts JSON.parse(response.body).dig('data', 'balance')`,
  rust: `use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&std::env::var("FONDOSEG_API_KEY").unwrap()).unwrap(),
    );
    headers.insert(
        "x-api-secret",
        HeaderValue::from_str(&std::env::var("FONDOSEG_API_SECRET").unwrap()).unwrap(),
    );

    let response = reqwest::Client::new()
        .get("https://fondoseg.com/api/v1/external/balance")
        .headers(headers)
        .send()
        .await?
        .error_for_status()?;

    println!("{}", response.text().await?);
    Ok(())
}`,
};

const exampleLabels: Record<keyof typeof examples, string> = {
  curl: 'cURL',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  php: 'PHP',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  kotlin: 'Kotlin',
  swift: 'Swift',
  dart: 'Dart',
  ruby: 'Ruby',
  rust: 'Rust',
};

const exampleFiles: Record<keyof typeof examples, string> = {
  curl: 'Terminal',
  typescript: 'server.ts',
  javascript: 'server.js',
  python: 'balance.py',
  php: 'balance.php',
  java: 'BalanceExample.java',
  csharp: 'Program.cs',
  go: 'main.go',
  kotlin: 'BalanceExample.kt',
  swift: 'BalanceExample.swift',
  dart: 'balance.dart',
  ruby: 'balance.rb',
  rust: 'main.rs',
};

const transferExample = `const response = await fetch(
  'https://fondoseg.com/api/v1/external/transfer',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.FONDOSEG_API_KEY,
      'x-api-secret': process.env.FONDOSEG_API_SECRET,
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      sender_name: 'Cliente origen',
      sender_phone: '+240222000000',
      receiver_name: 'Cliente destino',
      receiver_phone: '+240222111111',
      destination_city: 'Malabo',
      amount: 25000,
      currency: 'XAF',
    }),
  }
);`;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/15">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          {label && <span className="ml-2 text-xs font-semibold text-slate-400">{label}</span>}
        </div>
        <button onClick={copy} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-6 text-slate-200"><code>{code}</code></pre>
    </div>
  );
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-600 dark:text-pink-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base font-medium leading-7 text-muted-foreground">{children}</p>
    </div>
  );
}

export function ApiDocumentation() {
  const [language, setLanguage] = useState<keyof typeof examples>('typescript');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="FondosEG inicio"><DashboardLogo size="md" priority /></Link>
            <span className="hidden h-6 w-px bg-border sm:block" />
            <span className="hidden text-sm font-bold text-muted-foreground sm:block">Documentación API</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 sm:block">API v1 · Operativa</span>
            <ThemeToggle />
            <Button asChild className="hidden rounded-xl bg-brand-gradient font-bold text-white sm:inline-flex">
              <Link href="/developers-portal">Obtener credenciales <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={cn('border-r border-border/40 bg-background px-5 py-6 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]', mobileNavOpen ? 'block' : 'hidden')}>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Guía de integración</p>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={() => setMobileNavOpen(false)} className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-pink-500/10 hover:text-pink-600 dark:hover:text-pink-400">
                {section.label}<ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </a>
            ))}
          </nav>
          <div className="mt-8 rounded-2xl border border-border/40 bg-card/60 p-4">
            <BookOpen className="h-5 w-5 text-pink-500" />
            <p className="mt-3 text-sm font-bold">Referencia completa</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Especificación OpenAPI 3.1 lista para Postman, Insomnia o generación de clientes.</p>
            <Link href="/api/docs/openapi.json" target="_blank" className="mt-3 flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400">Abrir OpenAPI <ExternalLink className="h-3 w-3" /></Link>
          </div>
        </aside>

        <main className="min-w-0">
          <section id="introduccion" className="relative overflow-hidden border-b border-border/40 px-5 py-16 sm:px-10 lg:px-14 lg:py-24">
            <div className="pointer-events-none absolute -right-32 -top-36 h-[480px] w-[480px] rounded-full bg-pink-500/10 blur-3xl" />
            <div className="relative max-w-5xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-700 dark:text-pink-300"><Zap className="h-3.5 w-3.5" /> FondosEG API v1</div>
              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">Integra pagos y transferencias con una API clara y segura.</h1>
              <p className="mt-6 max-w-3xl text-lg font-medium leading-8 text-muted-foreground">Conecta tu backend con FondosEG para consultar saldos, mover dinero, gestionar alquileres y recibir eventos en tiempo real. Empieza en pruebas y pasa a producción sin cambiar tu implementación.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-2xl bg-brand-gradient px-6 font-bold text-white"><Link href="#inicio-rapido">Empezar a integrar <ArrowRight /></Link></Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl px-6 font-bold"><Link href="/api/docs/openapi.json" target="_blank">Ver OpenAPI <ExternalLink /></Link></Button>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {[['REST + JSON', 'Interfaz estándar y predecible'], ['Entorno test', 'Prueba sin mover dinero real'], ['Webhooks HMAC', 'Eventos verificados y deduplicables']].map(([title, detail]) => (
                  <div key={title} className="rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>
                ))}
              </div>
            </div>
          </section>

          <div className="divide-y divide-border/40">
            <section id="inicio-rapido" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Inicio rápido" title="Tu primera petición en cuatro pasos">La ruta recomendada separa credenciales, servidor y entornos desde el primer día.</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  [KeyRound, '01', 'Crea una credencial', 'Regístrate en el portal y genera una clave en el entorno test con los permisos mínimos necesarios.'],
                  [ShieldCheck, '02', 'Guarda el secreto', 'Conserva API key y secret en variables del servidor. El secret solo se muestra una vez.'],
                  [Code2, '03', 'Llama desde tu backend', 'Envía los headers de autenticación desde una función o API propia, nunca desde el navegador.'],
                  [Rocket, '04', 'Valida y despliega', 'Prueba idempotencia, errores y webhooks antes de solicitar credenciales de producción.'],
                ].map(([Icon, number, title, detail]) => {
                  const StepIcon = Icon as typeof KeyRound;
                  return <div key={String(number)} className="rounded-3xl border border-border/40 bg-card/40 p-6"><div className="flex items-center justify-between"><StepIcon className="h-6 w-6 text-pink-500" /><span className="text-3xl font-black text-muted/80">{String(number)}</span></div><h3 className="mt-5 text-lg font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(detail)}</p></div>;
                })}
              </div>
            </section>

            <section id="autenticacion" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Autenticación" title="Credenciales solo en el servidor">Cada request usa una API key identificable y un secret privado. Asigna una credencial distinta a cada aplicación y entorno.</SectionTitle>
              <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
                <div className="space-y-3">
                  {[
                    ['x-api-key', 'Identifica la aplicación y sus permisos.'],
                    ['x-api-secret', 'Autentica la petición. Nunca debe llegar al cliente.'],
                    ['idempotency-key', 'UUID único para cada POST que mueve dinero.'],
                    ['content-type', 'Usa application/json cuando envíes un body.'],
                  ].map(([name, detail]) => <div key={name} className="rounded-2xl border border-border/40 p-4"><code className="text-sm font-bold text-pink-600 dark:text-pink-400">{name}</code><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>)}
                </div>
                <CodeBlock label=".env" code={`FONDOSEG_API_KEY=sk_test_••••••••\nFONDOSEG_API_SECRET=secret_••••••••\nFONDOSEG_BASE_URL=https://fondoseg.com`} />
              </div>
              <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-900 dark:text-amber-200"><strong>Importante:</strong> no incluyas las credenciales en React, Flutter, aplicaciones móviles, repositorios, analytics o logs. Tu app llama a tu backend y tu backend llama a FondosEG.</div>
            </section>

            <section id="ejemplos" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Ejemplos" title="Consulta un saldo en minutos">La respuesta mantiene la misma estructura en pruebas y producción; el entorno test añade <code className="rounded bg-muted px-1.5 py-0.5 text-sm">sandbox: true</code>.</SectionTitle>
              <div className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-muted/70 p-1.5">
                {(Object.keys(examples) as (keyof typeof examples)[]).map((item) => <button key={item} onClick={() => setLanguage(item)} className={cn('rounded-xl px-3.5 py-2 text-xs font-bold transition', language === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{exampleLabels[item]}</button>)}
              </div>
              <CodeBlock label={exampleFiles[language]} code={examples[language]} />
              <h3 className="mt-10 text-xl font-bold">Crear una transferencia idempotente</h3>
              <p className="mb-4 mt-2 text-sm leading-6 text-muted-foreground">Si la red falla, reintenta con la misma <code>idempotency-key</code>. FondosEG devolverá el resultado original sin duplicar el movimiento.</p>
              <CodeBlock label="transfer.ts" code={transferExample} />
            </section>

            <section id="endpoints" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Referencia" title="Endpoints disponibles">Todos los endpoints públicos están versionados bajo <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/api/v1/external</code>.</SectionTitle>
              <div className="overflow-hidden rounded-3xl border border-border/40">
                {endpoints.map((endpoint, index) => <div key={endpoint.path} className={cn('grid gap-3 p-5 md:grid-cols-[92px_minmax(260px,1fr)_110px_1.2fr] md:items-center', index && 'border-t border-border/40')}><span className={cn('w-fit rounded-lg px-2.5 py-1 text-[11px] font-black', endpoint.method.startsWith('GET') ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300')}>{endpoint.method}</span><code className="overflow-x-auto text-sm font-bold">{endpoint.path}</code><span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{endpoint.scope}</span><p className="text-sm leading-5 text-muted-foreground">{endpoint.description}</p></div>)}
              </div>
            </section>

            <section id="webhooks" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Eventos" title="Webhooks firmados, estados al instante">Configura una URL HTTPS desde tu consola. Verifica la firma sobre el body sin modificar antes de procesar cualquier evento.</SectionTitle>
              <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-3">{['transfer.created', 'transfer.paid_out', 'wallet_transfer.confirmed', 'rental_payment.updated'].map(event => <div key={event} className="flex items-center gap-3 rounded-2xl border border-border/40 p-4"><Webhook className="h-4 w-4 text-pink-500" /><code className="text-sm font-bold">{event}</code></div>)}</div>
                <CodeBlock label="webhook.ts" code={`const rawBody = await request.text();
const timestamp = request.headers.get(
  'x-fondoseg-webhook-timestamp'
);
const signature = request.headers.get(
  'x-fondoseg-webhook-signature'
);

// HMAC SHA-256 de \`${'${timestamp}.${rawBody}'}\`
// con FONDOSEG_WEBHOOK_SECRET.
// Compara firmas en tiempo constante y deduplica
// por X-FondosEG-Webhook-Id.`} />
              </div>
            </section>

            <section id="errores" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Resiliencia" title="Errores predecibles y trazables">Guarda siempre el <code className="rounded bg-muted px-1.5 py-0.5 text-sm">x-request-id</code>; es la referencia que permite seguir una operación de extremo a extremo.</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
                ['400', 'validation_error', 'Corrige el payload; no reintentes automáticamente.'], ['401', 'invalid_credentials', 'Revisa key, secret y estado de la credencial.'], ['403', 'permission_denied', 'La clave no tiene el scope o rol requerido.'], ['409', 'idempotency_conflict', 'La misma clave se usó con otro payload.'], ['429', 'rate_limit_exceeded', 'Respeta retry-after y usa backoff exponencial.'], ['5xx', 'internal_error', 'Reintenta con backoff y la misma idempotency-key.']
              ].map(([status, code, detail]) => <div key={status} className="rounded-2xl border border-border/40 p-5"><span className="text-2xl font-black">{status}</span><code className="mt-3 block text-xs font-bold text-pink-600 dark:text-pink-400">{code}</code><p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p></div>)}</div>
            </section>

            <section id="produccion" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Go live" title="Checklist antes de producción">Completa estas verificaciones con credenciales test. Después crea una clave production separada y cambia únicamente las variables del servidor.</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">{[
                'Credenciales separadas para test y producción.', 'Secrets almacenados en un gestor seguro.', 'Idempotencia probada en todas las operaciones monetarias.', 'Reintentos limitados con backoff para 429 y 5xx.', 'Firmas y deduplicación de webhooks verificadas.', 'Logs con request ID, status y latencia, sin datos sensibles.'
              ].map(item => <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/40 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><p className="text-sm font-semibold leading-6">{item}</p></div>)}</div>
              <div className="mt-10 overflow-hidden rounded-3xl bg-slate-950 p-7 text-white sm:p-9"><Package className="h-7 w-7 text-pink-400" /><h3 className="mt-5 text-2xl font-black">¿Listo para construir?</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Crea tu cuenta de desarrollador, genera una credencial test y realiza tu primera petición. La referencia OpenAPI está disponible para automatizar el resto.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="rounded-xl bg-white font-bold text-slate-950 hover:bg-slate-100"><Link href="/developers-portal/register">Crear cuenta <ArrowRight /></Link></Button><Button asChild variant="outline" className="rounded-xl border-white/20 bg-white/5 font-bold text-white hover:bg-white/10"><Link href="/api/docs/openapi.json" target="_blank"><Clipboard /> OpenAPI JSON</Link></Button></div></div>
            </section>
          </div>

          <footer className="border-t border-border/40 px-5 py-8 sm:px-10 lg:px-14"><div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><DashboardLogo size="sm" /><p>FondosEG API v1 · Diseñada para integraciones seguras.</p></div></footer>
        </main>
      </div>
    </div>
  );
}
