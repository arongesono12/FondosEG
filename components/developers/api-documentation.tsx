'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, KeyRound, Package, Webhook } from '@/components/ui/hugeicons';
import { CodeBlock } from '@/components/developers/code-block';
import {
  buildRecipes,
  CASASEG_FLOW,
  ENDPOINT_GROUPS,
  ERROR_DOCS,
  MONEY_RULES,
  PRODUCTION_CHECKLIST,
  REQUEST_HEADERS,
  RESPONSE_HEADERS,
  TRANSFER_REJECTION_REASONS,
  WEBHOOK_EVENTS_DOC,
  WEBHOOK_PAYLOAD_SAMPLE,
  WEBHOOK_VERIFY_SNIPPET,
  type EndpointDoc,
} from '@/lib/developer-docs';
import { cn } from '@/lib/utils';

interface ApiDocumentationProps {
  baseUrl: string;
}

const SECTIONS = [
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'autenticacion', label: 'Autenticación' },
  { id: 'reglas', label: 'Reglas del dinero' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'ejemplos', label: 'Ejemplos' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'errores', label: 'Errores' },
  { id: 'casaseg', label: 'Guía: CasasEG' },
  { id: 'produccion', label: 'Antes de producción' },
] as const;

const GETTING_STARTED = [
  { icon: Package, title: '1. Crea la aplicación', detail: 'Solo un nombre. FondosEG le abre una billetera propia: sin rol ni teléfono.' },
  { icon: KeyRound, title: '2. Emite credenciales', detail: 'Una de prueba para integrar y otra de producción para operar. El secret se ve una vez.' },
  { icon: Webhook, title: '3. Registra un webhook', detail: 'Recibe firmados los cobros pagados y los envíos liquidados.' },
] as const;

const METHOD_STYLE: Record<EndpointDoc['method'], string> = {
  GET: 'text-sky-600 dark:text-sky-400',
  POST: 'text-emerald-600 dark:text-emerald-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
};

interface DocSectionProps {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

function DocSection({ id, title, description, children }: DocSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function DefinitionTable({ rows }: { rows: ReadonlyArray<{ name: string; detail: string }> }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border">
      {rows.map((row) => (
        <div key={row.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
          <dt className="font-mono text-xs font-medium text-foreground">{row.name}</dt>
          <dd className="text-sm text-muted-foreground">{row.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ApiDocumentation({ baseUrl }: ApiDocumentationProps) {
  const recipes = buildRecipes(baseUrl);
  const openApiUrl = `${baseUrl}/api/docs/openapi.json`;

  return (
    <div className="grid gap-8 xl:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Secciones de la documentación" className="hidden xl:block">
        <ul className="sticky top-6 space-y-0.5 text-sm">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="block rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="app-card min-w-0 space-y-12 p-5 md:p-8">
        <DocSection
          id="como-funciona"
          title="Cómo funciona"
          description="Cada producto que integras (por ejemplo CasasEG) es una aplicación con su propia billetera FondosEG. Los cobros entran en ella y los envíos salen de ella."
        >
          <ol className="grid gap-3 md:grid-cols-3">
            {GETTING_STARTED.map((step) => (
              <li key={step.title} className="rounded-xl border border-border p-4">
                <step.icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
          <dl className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">URL base</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-foreground">{baseUrl}/api/v1/external</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Entornos</dt>
              <dd className="mt-0.5 text-foreground"><span className="font-mono text-xs">sk_test_</span> simula · <span className="font-mono text-xs">sk_live_</span> opera</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Contrato OpenAPI 3.1</dt>
              <dd className="mt-0.5 break-all font-mono text-xs">
                <a className="text-primary hover:underline" href={openApiUrl} target="_blank" rel="noreferrer">{openApiUrl}</a>
              </dd>
            </div>
          </dl>
        </DocSection>

        <DocSection
          id="autenticacion"
          title="Autenticación"
          description="Todas las llamadas salen de tu servidor con la API key y el secret de la aplicación. Nunca expongas el secret en una app móvil o en el navegador."
        >
          <DefinitionTable rows={REQUEST_HEADERS} />
          <CodeBlock
            title="Cabeceras"
            tabs={[{
              id: 'headers',
              label: 'HTTP',
              code: 'x-api-key: sk_live_…\nx-api-secret: <API_SECRET>\nidempotency-key: 6f1d2c1e-6c55-4c43-9a0b-7d3f1b2c9e10\ncontent-type: application/json',
            }]}
          />
          <p className="text-sm text-muted-foreground">
            Si tu cliente HTTP no admite cabeceras propias, envía la key como <code className="font-mono text-xs">Authorization: Bearer sk_…</code>; el secret sigue yendo en <code className="font-mono text-xs">x-api-secret</code>.
          </p>
        </DocSection>

        <DocSection
          id="reglas"
          title="Reglas del dinero"
          description="La API aplica exactamente las mismas normas que los envíos desde la app de FondosEG."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {MONEY_RULES.map((rule) => (
              <div key={rule.title} className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">{rule.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{rule.detail}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="endpoints" title="Endpoints" description="Cada endpoint exige el permiso indicado a la derecha.">
          <div className="space-y-6">
            {ENDPOINT_GROUPS.map((group) => (
              <div key={group.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {group.endpoints.map((endpoint) => (
                    <li
                      key={`${endpoint.method}-${endpoint.path}-${endpoint.title}`}
                      className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_88px] md:items-center md:gap-4"
                    >
                      <p className="min-w-0 font-mono text-xs">
                        <span className={cn('mr-2 font-semibold', METHOD_STYLE[endpoint.method])}>{endpoint.method}</span>
                        <span className="break-all text-foreground">{endpoint.path}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{endpoint.title}.</span> {endpoint.description}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground md:text-right">{endpoint.scope}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection id="ejemplos" title="Ejemplos" description="Listos para copiar. Sustituye <API_KEY> y <API_SECRET> por los de tu credencial.">
          <div className="space-y-10">
            {recipes.map((recipe) => (
              <article key={recipe.id} aria-labelledby={`recipe-${recipe.id}`} className="space-y-3">
                <div>
                  <h3 id={`recipe-${recipe.id}`} className="text-base font-semibold text-foreground">{recipe.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{recipe.summary}</p>
                </div>
                <CodeBlock tabs={recipe.samples} />
                {recipe.response && (
                  <details className="rounded-xl border border-border">
                    <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Respuesta de ejemplo
                    </summary>
                    <div className="px-3 pb-3">
                      <CodeBlock title="JSON" tabs={[{ id: `${recipe.id}-response`, label: 'JSON', code: recipe.response }]} />
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        </DocSection>

        <DocSection
          id="webhooks"
          title="Webhooks"
          description="FondosEG envía un POST firmado a la URL de tu aplicación. Responde 2xx en menos de 10 s; si no, se reintenta hasta 5 veces. Cada evento solo llega a las aplicaciones implicadas."
        >
          <DefinitionTable rows={WEBHOOK_EVENTS_DOC.map((item) => ({ name: item.event, detail: item.detail }))} />
          <CodeBlock title="Petición que recibe tu servidor" tabs={[{ id: 'webhook-payload', label: 'HTTP', code: WEBHOOK_PAYLOAD_SAMPLE }]} />
          <CodeBlock title="Verificar la firma (Node, Deno o Edge)" tabs={[{ id: 'webhook-verify', label: 'TypeScript', code: WEBHOOK_VERIFY_SNIPPET }]} />
        </DocSection>

        <DocSection
          id="errores"
          title="Errores"
          description="Todas las respuestas de error tienen la forma { success: false, error: { code, message, details }, request_id }."
        >
          <ul className="divide-y divide-border rounded-xl border border-border">
            {ERROR_DOCS.map((item) => (
              <li key={item.code} className="grid gap-1 px-4 py-3 sm:grid-cols-[56px_200px_1fr] sm:items-center sm:gap-4">
                <span className="font-mono text-xs font-semibold text-foreground">{item.status}</span>
                <span className="font-mono text-xs text-primary">{item.code}</span>
                <span className="text-sm text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Motivos de rechazo de un envío (details.reason)</h3>
            <DefinitionTable rows={TRANSFER_REJECTION_REASONS.map((item) => ({ name: item.reason, detail: item.detail }))} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cabeceras de respuesta</h3>
            <DefinitionTable rows={RESPONSE_HEADERS} />
          </div>
        </DocSection>

        <DocSection
          id="casaseg"
          title="Guía: integrar CasasEG"
          description="Cobro del alquiler al inquilino y liquidación automática al propietario, de principio a fin."
        >
          <ol className="space-y-4">
            {CASASEG_FLOW.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </DocSection>

        <DocSection id="produccion" title="Antes de producción">
          <ul className="grid gap-2 md:grid-cols-2">
            {PRODUCTION_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </DocSection>
      </div>
    </div>
  );
}
