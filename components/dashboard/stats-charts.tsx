'use client';

import { useId, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Label, PolarAngleAxis, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, XAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn, formatDateShort } from '@/lib/utils';

const TITLE_CLASS = 'text-xl font-black text-foreground';

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="dashboard-inset rounded-3xl border border-dashed border-border/20 bg-background/50 px-6 py-10 text-center">
      <p className="text-sm font-bold text-muted-foreground">{message}</p>
    </div>
  );
}

export interface ActivityPoint {
  /** Día natural en UTC, `YYYY-MM-DD`. */
  date: string;
  amount: number;
  count: number;
}

type ActivitySeries = 'amount' | 'count';

const ACTIVITY_SERIES: readonly ActivitySeries[] = ['amount', 'count'];

// Misma tinta que las barras de las tarjetas de arriba: el conmutador ya dice qué serie se ve.
const activityConfig = {
  amount: { label: 'Volumen', color: 'var(--chart-1)' },
  count: { label: 'Operaciones', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface ActivityBarChartProps {
  title: string;
  description: string;
  data: ActivityPoint[];
  formatAmount: (value: number) => string;
  children?: ReactNode;
}

/** Barras diarias con un conmutador entre volumen y número de operaciones. */
export function ActivityBarChart({ title, description, data, formatAmount, children }: ActivityBarChartProps) {
  const [activeSeries, setActiveSeries] = useState<ActivitySeries>('amount');
  const gradientId = `activity-bars-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const formatSeries = (series: ActivitySeries, value: number) => (series === 'amount' ? formatAmount(value) : String(value));
  const totalOf = (series: ActivitySeries) => data.reduce((sum, point) => sum + point[series], 0);

  return (
    <Card className="@container flex min-w-0 flex-col">
      <CardHeader className="flex-col items-stretch gap-0! overflow-hidden rounded-t-[20px] border-b p-0! @3xl:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1.5 px-6 py-5">
          <CardTitle className={TITLE_CLASS}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="grid grid-cols-2 border-t border-border @3xl:border-t-0">
          {ACTIVITY_SERIES.map((series) => (
            <button
              key={series}
              type="button"
              aria-pressed={activeSeries === series}
              data-active={activeSeries === series}
              onClick={() => setActiveSeries(series)}
              className="flex min-w-0 flex-col justify-center gap-1 rounded-none border-border px-4 py-4 text-left transition-colors even:border-l hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-[active=true]:bg-muted @xl:px-6 @3xl:border-l"
            >
              <span className="text-xs text-muted-foreground">{activityConfig[series].label}</span>
              <span className="text-lg leading-tight font-bold tabular-nums text-foreground wrap-anywhere @xl:text-2xl">
                {formatSeries(series, totalOf(series))}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      {/* El gráfico crece hasta igualar la altura de la tarjeta vecina, sin dejar un hueco debajo. */}
      <CardContent className="flex flex-1 flex-col gap-5 p-6">
        {data.length === 0 ? (
          <ChartEmpty message="No hay actividad en este período." />
        ) : (
          <ChartContainer config={activityConfig} className="aspect-auto min-h-62.5 w-full flex-1">
            <BarChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => formatDateShort(value).slice(0, 5)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDateShort(String(value))}
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{activityConfig[activeSeries].label}</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">{formatSeries(activeSeries, Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey={activeSeries} fill={`url(#${gradientId})`} radius={[3, 3, 0, 0]} maxBarSize={17} />
            </BarChart>
          </ChartContainer>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export interface ShareRow {
  name: string;
  value: string;
  detail?: string;
  /** La fila que representa el arco del anillo. */
  highlighted?: boolean;
}

const shareConfig = {
  share: { label: 'Participación', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface ShareRadialChartProps {
  title: string;
  description: string;
  /** Porcentaje entero que dibuja el arco y se lee en el centro. */
  share: number;
  shareLabel: string;
  summary: string;
  detail: string;
  rows: ShareRow[];
}

/** Anillo de un único porcentaje, con el desglose que lo explica debajo. */
export function ShareRadialChart({ title, description, share, shareLabel, summary, detail, rows }: ShareRadialChartProps) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="items-center pb-0 text-center">
        <CardTitle className={TITLE_CLASS}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {rows.length === 0 ? (
        <CardContent className="p-6">
          <ChartEmpty message="No hay datos suficientes todavía." />
        </CardContent>
      ) : (
        <>
          <CardContent className="pb-0">
            <ChartContainer config={shareConfig} className="mx-auto aspect-square max-h-62.5">
              {/* El anillo completo vale 100: el arco es proporcional al dato y nunca decorativo. */}
              <RadialBarChart
                data={[{ name: 'share', share, fill: 'var(--color-share)' }]}
                startAngle={90}
                endAngle={-270}
                innerRadius={65}
                outerRadius={95}
              >
                <PolarGrid
                  gridType="circle"
                  radialLines={false}
                  stroke="none"
                  className="first:fill-muted last:fill-background"
                  polarRadius={[86, 74]}
                />
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <RadialBar dataKey="share" />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-foreground text-4xl font-bold">
                            {share}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 22} className="fill-muted-foreground">
                            {shareLabel}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex-col gap-2 pt-2 text-center text-sm">
            <p className="leading-snug font-medium text-foreground">{summary}</p>
            <p className="leading-snug text-muted-foreground">{detail}</p>
          </CardFooter>
          <CardContent className="space-y-3">
            {rows.map((row) => (
              <div key={row.name} className="dashboard-inset flex items-center justify-between gap-3 rounded-2xl border border-border/10 bg-background/70 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('h-3 w-3 shrink-0 rounded-full', row.highlighted ? 'bg-chart-1' : 'bg-muted-foreground/40')} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{row.name}</p>
                    {row.detail && <p className="text-xs font-semibold text-muted-foreground">{row.detail}</p>}
                  </div>
                </div>
                <p className="shrink-0 text-sm font-black tabular-nums text-foreground">{row.value}</p>
              </div>
            ))}
          </CardContent>
        </>
      )}
    </Card>
  );
}
