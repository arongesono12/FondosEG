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
import { Card } from '@/components/ui/card';
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

const heroTransferCurl = `curl -X POST https://api.fondoseg.com/v1/transfers \\
  -H "Authorization: Bearer {API_KEY}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 8f6e5b3c-2d4a-4c9e-9b91-1f2a3b4c5d6e" \\
  -d '{
    "amount": 15000.50,
    "currency": "XAF",
    "from_account_id": "acc_1234567890",
    "to_account_id": "acc_9876543210",
    "description": "Pago de alquiler - Mayo 2024"
  }'`;

const heroResponseJson = `{
  "id": "trf_01J2X7H8Y9ZC3D4E5F6G7H8I9J",
  "status": "completed",
  "amount": 15000.50,
  "currency": "XAF",
  "created_at": "2024-05-20T14:33:21Z",
  "reference": "ALQ-MAYO-2024-001"
}`;

const heroWebhookJson = `{
  "event": "transfer.completed",
  "data": {
    "id": "trf_01J2X7H8Y9ZC3D4E5F6G7H8I9J",
    "status": "completed",
    "amount": 15000.50
  }
}`;

const capabilityChips = [
  { label: 'REST + JSON', icon: Code2, color: 'text-emerald-300' },
  { label: 'Sandbox', icon: Package, color: 'text-amber-300' },
  { label: 'Webhook', icon: Webhook, color: 'text-pink-300' },
  { label: 'HMAC', icon: ShieldCheck, color: 'text-yellow-300' },
  { label: 'SDK Ready', icon: Code2, color: 'text-fuchsia-300' },
  { label: 'API Keys', icon: KeyRound, color: 'text-sky-300' },
] as const;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Card interactive={false} className="rounded-2xl border-white/10 bg-slate-950 bg-none">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          {label && <span className="ml-2 text-xs font-semibold text-slate-400">{label}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={copy} className="rounded-lg px-2.5 text-slate-400 hover:bg-white/10 hover:text-white">
          {copied ? <Check className="text-emerald-400" /> : <Copy />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-6 text-slate-200"><code>{code}</code></pre>
    </Card>
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

function ApiHeroVisual() {
  const [copied, setCopied] = useState(false);

  async function copyHeroCode() {
    await navigator.clipboard.writeText(heroTransferCurl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="relative min-h-[610px] min-w-0 overflow-visible">
      <div className="pointer-events-none absolute left-[12%] top-[72px] h-px w-[28%] bg-gradient-to-r from-white/40 via-emerald-400/55 to-emerald-400/20" />
      <div className="pointer-events-none absolute left-[11.6%] top-[68px] h-2 w-2 rounded-full bg-white/55 shadow-[0_0_10px_rgba(255,255,255,.8)]" />
      <div className="pointer-events-none absolute left-[40%] top-[72px] h-[92px] w-px bg-gradient-to-b from-emerald-400/25 to-pink-400/75" />
      <div className="pointer-events-none absolute left-[39.65%] top-[160px] h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,.95)]" />
      <div className="pointer-events-none absolute left-[53%] top-[302px] h-[42px] w-px bg-gradient-to-b from-pink-400/70 to-fuchsia-400/60" />
      <div className="pointer-events-none absolute left-[52.65%] top-[340px] h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,.95)]" />
      <div className="pointer-events-none absolute left-[75%] top-[309px] h-[34px] w-px bg-gradient-to-b from-pink-400/65 to-purple-400/75" />
      <div className="pointer-events-none absolute left-[74.65%] top-[339px] h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,.95)]" />
      <div className="pointer-events-none absolute right-0 top-[225px] h-px w-[17%] bg-gradient-to-l from-pink-400 via-fuchsia-400/70 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-[221px] h-2 w-2 rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,.95)]" />

      <Card interactive={false} className="absolute left-[12%] top-[32px] z-30 h-[270px] w-[72%] rounded-2xl border-pink-500/80 bg-[#10071a]/95 bg-none shadow-[0_24px_70px_rgba(15,3,25,.55),0_0_45px_rgba(236,72,153,.10)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-7 text-sm font-bold text-white">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-400" /> cURL</span>
            <span className="text-white/75">POST</span>
            <code className="text-white">/v1/transfers</code>
          </div>
          <Button variant="outline" size="sm" onClick={copyHeroCode} className="rounded-xl border-white/10 bg-white/5 text-white/70 hover:border-pink-400/60 hover:bg-white/10 hover:text-white">
            {copied ? <Check className="text-emerald-300" /> : <Copy />}
            {copied ? 'Copiado' : 'Copy'}
          </Button>
        </div>
        <pre className="h-[212px] overflow-hidden px-6 py-4 text-[12px] leading-[19px] text-slate-200"><code>{heroTransferCurl}</code></pre>
      </Card>

      <Card interactive={false} className="absolute left-0 top-[332px] z-20 h-[238px] w-[44%] rounded-2xl border-pink-500/60 bg-[#080c19]/95 bg-none shadow-[0_22px_60px_rgba(3,7,18,.50),0_0_38px_rgba(236,72,153,.08)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-bold text-white"><span className="h-3 w-3 rounded-full bg-emerald-400" /> 200 OK</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-white/60">JSON <ChevronRight className="h-3.5 w-3.5 rotate-90" /></span>
        </div>
        <pre className="h-[180px] overflow-hidden px-6 py-4 text-[11px] leading-[18px] text-emerald-200"><code>{heroResponseJson}</code></pre>
      </Card>

      <Card interactive={false} className="absolute left-[48%] top-[332px] z-20 h-[252px] w-[48%] rounded-2xl border-purple-500/75 bg-[#080c19]/95 bg-none shadow-[0_22px_60px_rgba(3,7,18,.50),0_0_38px_rgba(168,85,247,.10)]">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-bold text-white"><span className="h-3 w-3 rounded-full bg-purple-400" /> Webhook</p>
          <p className="mt-1 text-xs font-semibold text-white/60">transfer.completed</p>
        </div>
        <pre className="h-[145px] overflow-hidden px-6 py-4 text-[11px] leading-[18px] text-sky-200"><code>{heroWebhookJson}</code></pre>
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-white/55">
          <span>2024-05-20T14:33:21Z</span>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-bold text-emerald-300">Entregado ✓</span>
        </div>
      </Card>
    </div>
  );
}

export function ApiDocumentation() {
  const [language, setLanguage] = useState<keyof typeof examples>('typescript');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/85 backdrop-blur-2xl transition-colors duration-300 dark:border-white/10 dark:bg-[#060b17]/90">
        <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="FondosEG inicio"><DashboardLogo size="md" priority /></Link>
            <span className="hidden h-7 w-px bg-border sm:block dark:bg-white/10" />
            <span className="hidden text-sm font-semibold text-muted-foreground sm:block">Documentación API</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.12)] sm:block">API v1 – Operativa</span>
            <ThemeToggle />
            <Button asChild variant="brand" className="hidden rounded-2xl px-6 font-bold sm:inline-flex">
              <Link href="/developers-portal">Obtener credenciales <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="border border-border text-foreground dark:border-white/10 dark:text-white lg:hidden" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              {mobileNavOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid w-full lg:grid-cols-[240px_minmax(0,1fr)] lg:pl-[clamp(0px,10.5vw,240px)]">
        <aside className={cn('border-r border-border/40 bg-background/95 px-5 py-8 transition-colors duration-300 dark:border-white/10 dark:bg-[#050b16]/95 lg:sticky lg:top-[68px] lg:block lg:h-[calc(100vh-68px)]', mobileNavOpen ? 'block' : 'hidden')}>
          <p className="mb-5 px-3 text-[10px] font-bold uppercase tracking-[0.36em] text-muted-foreground">Guía de integración</p>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`} onClick={() => setMobileNavOpen(false)} className="group flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground dark:hover:bg-white/[0.04] dark:hover:text-white">
                {section.label}<ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </a>
            ))}
          </nav>
          <Card interactive={false} className="mt-10 rounded-2xl p-5">
            <BookOpen className="h-6 w-6 text-pink-400" />
            <p className="mt-5 text-base font-bold text-foreground">Referencia completa</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Especificación OpenAPI 3.1 lista para Postman, Insomnia o generación de clientes.</p>
            <Button asChild variant="link" size="sm" className="mt-3 h-auto justify-start p-0 font-bold text-pink-500 dark:text-pink-400">
              <Link href="/api/docs/openapi.json" target="_blank">Abrir OpenAPI <ExternalLink /></Link>
            </Button>
          </Card>
        </aside>

        <main className="min-w-0">
          <section id="introduccion" className="relative flex min-h-[calc(100vh-68px)] min-w-0 flex-col overflow-hidden border-b border-border/40 bg-background px-5 py-10 transition-colors duration-300 dark:border-white/10 dark:bg-[#020817] sm:px-8 lg:px-10 2xl:min-h-[875px] 2xl:px-14 2xl:py-12 2xl:pb-12">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.055)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%] bg-linear-to-l from-pink-500/10 via-fuchsia-500/5 to-transparent dark:from-pink-600/18 dark:via-fuchsia-500/8" />
            <div className="relative flex-1 2xl:grid 2xl:grid-cols-[minmax(0,650px)_minmax(0,1fr)] 2xl:grid-rows-[610px_auto] 2xl:gap-x-8">
              <div className="min-w-0 max-w-[690px] 2xl:pt-[82px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/35 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-600 dark:border-pink-400/35 dark:bg-pink-400/10 dark:text-pink-200"><Zap className="h-4 w-4" /> FondosEG API v1</div>
                <h1 className="mt-8 max-w-[740px] text-4xl font-black leading-[1.05] tracking-[-0.045em] text-foreground sm:text-5xl xl:text-[50px] 2xl:text-[56px]">Integra pagos y transferencias con una API clara y segura.</h1>
                <p className="mt-7 max-w-[640px] text-base font-medium leading-8 text-muted-foreground 2xl:text-lg 2xl:leading-9">Conecta tu backend con FondosEG para consultar saldos, mover dinero, gestionar alquileres y recibir eventos en tiempo real. Empieza en pruebas y pasa a producción sin cambiar tu implementación.</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Button asChild variant="brand" size="lg" className="h-14 rounded-2xl px-7 font-bold"><Link href="#inicio-rapido">Empezar a integrar <ArrowRight /></Link></Button>
                  <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl px-7 font-bold"><Link href="/api/docs/openapi.json" target="_blank">Ver OpenAPI <ExternalLink /></Link></Button>
                </div>
                <div className="mt-9 flex flex-wrap gap-2">
                  {capabilityChips.map(({ label, icon: Icon, color }) => (
                    <Card asChild key={label} interactive={false} className="rounded-xl">
                      <span className="inline-flex h-12 items-center gap-2 px-4 text-sm font-semibold">
                        <Icon className={cn('h-4 w-4', color)} />
                        {label}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="hidden min-w-0 xl:mt-10 xl:block 2xl:col-start-2 2xl:row-start-1 2xl:mt-0 2xl:pt-[28px]">
                <ApiHeroVisual />
              </div>
              <div className="relative mt-10 grid gap-4 sm:grid-cols-3 2xl:col-span-2 2xl:row-start-2 2xl:mt-0 2xl:w-[1048px]">
                {[['REST + JSON', 'Interfaz estándar y predecible'], ['Entorno test', 'Prueba sin mover dinero real'], ['Webhooks HMAC', 'Eventos verificados y deduplicables']].map(([title, detail]) => (
                  <Card key={title} interactive={false} className="min-h-[120px] rounded-2xl p-6"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><p className="mt-4 text-sm font-bold text-foreground">{title}</p><p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p></Card>
                ))}
              </div>
            </div>
          </section>

          <div className="divide-y divide-white/10 bg-background text-foreground">
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
                  return <Card key={String(number)} interactive={false} className="p-6"><div className="flex items-center justify-between"><StepIcon className="h-6 w-6 text-pink-500" /><span className="text-3xl font-black text-muted/80">{String(number)}</span></div><h3 className="mt-5 text-lg font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(detail)}</p></Card>;
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
                  ].map(([name, detail]) => <Card key={name} interactive={false} className="rounded-2xl p-4"><code className="text-sm font-bold text-pink-600 dark:text-pink-400">{name}</code><p className="mt-1 text-sm text-muted-foreground">{detail}</p></Card>)}
                </div>
                <CodeBlock label=".env" code={`FONDOSEG_API_KEY=sk_test_••••••••\nFONDOSEG_API_SECRET=secret_••••••••\nFONDOSEG_BASE_URL=https://fondoseg.com`} />
              </div>
              <Card interactive={false} className="mt-6 rounded-2xl border-amber-500/20 bg-amber-500/10 bg-none p-5 text-sm leading-6 text-amber-900 dark:text-amber-200"><strong>Importante:</strong> no incluyas las credenciales en React, Flutter, aplicaciones móviles, repositorios, analytics o logs. Tu app llama a tu backend y tu backend llama a FondosEG.</Card>
            </section>

            <section id="ejemplos" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Ejemplos" title="Consulta un saldo en minutos">La respuesta mantiene la misma estructura en pruebas y producción; el entorno test añade <code className="rounded bg-muted px-1.5 py-0.5 text-sm">sandbox: true</code>.</SectionTitle>
              <div className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-muted/70 p-1.5">
                {(Object.keys(examples) as (keyof typeof examples)[]).map((item) => <Button key={item} variant="ghost" size="sm" onClick={() => setLanguage(item)} className={cn('rounded-xl px-3.5 font-bold', language === item ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:text-foreground')}>{exampleLabels[item]}</Button>)}
              </div>
              <CodeBlock label={exampleFiles[language]} code={examples[language]} />
              <h3 className="mt-10 text-xl font-bold">Crear una transferencia idempotente</h3>
              <p className="mb-4 mt-2 text-sm leading-6 text-muted-foreground">Si la red falla, reintenta con la misma <code>idempotency-key</code>. FondosEG devolverá el resultado original sin duplicar el movimiento.</p>
              <CodeBlock label="transfer.ts" code={transferExample} />
            </section>

            <section id="endpoints" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Referencia" title="Endpoints disponibles">Todos los endpoints públicos están versionados bajo <code className="rounded bg-muted px-1.5 py-0.5 text-sm">/api/v1/external</code>.</SectionTitle>
              <Card interactive={false}>
                {endpoints.map((endpoint, index) => <div key={endpoint.path} className={cn('grid gap-3 p-5 md:grid-cols-[92px_minmax(260px,1fr)_110px_1.2fr] md:items-center', index && 'border-t border-border/40')}><span className={cn('w-fit rounded-lg px-2.5 py-1 text-[11px] font-black', endpoint.method.startsWith('GET') ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300')}>{endpoint.method}</span><code className="overflow-x-auto text-sm font-bold">{endpoint.path}</code><span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{endpoint.scope}</span><p className="text-sm leading-5 text-muted-foreground">{endpoint.description}</p></div>)}
              </Card>
            </section>

            <section id="webhooks" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Eventos" title="Webhooks firmados, estados al instante">Configura una URL HTTPS desde tu consola. Verifica la firma sobre el body sin modificar antes de procesar cualquier evento.</SectionTitle>
              <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-3">{['transfer.created', 'transfer.paid_out', 'wallet_transfer.confirmed', 'rental_payment.updated'].map(event => <Card key={event} interactive={false} className="flex items-center gap-3 rounded-2xl p-4"><Webhook className="h-4 w-4 text-pink-500" /><code className="text-sm font-bold">{event}</code></Card>)}</div>
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
              ].map(([status, code, detail]) => <Card key={status} interactive={false} className="rounded-2xl p-5"><span className="text-2xl font-black">{status}</span><code className="mt-3 block text-xs font-bold text-pink-600 dark:text-pink-400">{code}</code><p className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</p></Card>)}</div>
            </section>

            <section id="produccion" className="scroll-mt-20 px-5 py-16 sm:px-10 lg:px-14 lg:py-20">
              <SectionTitle eyebrow="Go live" title="Checklist antes de producción">Completa estas verificaciones con credenciales test. Después crea una clave production separada y cambia únicamente las variables del servidor.</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">{[
                'Credenciales separadas para test y producción.', 'Secrets almacenados en un gestor seguro.', 'Idempotencia probada en todas las operaciones monetarias.', 'Reintentos limitados con backoff para 429 y 5xx.', 'Firmas y deduplicación de webhooks verificadas.', 'Logs con request ID, status y latencia, sin datos sensibles.'
              ].map(item => <Card key={item} interactive={false} className="flex items-start gap-3 rounded-2xl p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><p className="text-sm font-semibold leading-6">{item}</p></Card>)}</div>
              <Card interactive={false} className="mt-10 border-white/10 bg-slate-950 bg-none p-7 text-white sm:p-9"><Package className="h-7 w-7 text-pink-400" /><h3 className="mt-5 text-2xl font-black">¿Listo para construir?</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Crea tu cuenta de desarrollador, genera una credencial test y realiza tu primera petición. La referencia OpenAPI está disponible para automatizar el resto.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="rounded-xl bg-white font-bold text-slate-950 hover:bg-slate-100"><Link href="/developers-portal/register">Crear cuenta <ArrowRight /></Link></Button><Button asChild variant="outline" className="rounded-xl border-white/20 bg-white/5 font-bold text-white hover:bg-white/10"><Link href="/api/docs/openapi.json" target="_blank"><Clipboard /> OpenAPI JSON</Link></Button></div></Card>
            </section>
          </div>

          <footer className="border-t border-border/40 px-5 py-8 sm:px-10 lg:px-14"><div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><DashboardLogo size="sm" /><p>FondosEG API v1 · Diseñada para integraciones seguras.</p></div></footer>
        </main>
      </div>
    </div>
  );
}
