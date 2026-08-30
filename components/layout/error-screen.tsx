import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DashboardLogo } from './dashboard-logo';

interface ErrorScreenAction {
  href: string;
  label: string;
  variant?: 'primary' | 'outline';
}

interface ErrorScreenProps {
  title: string;
  description: string;
  badge?: string;
  actions?: ErrorScreenAction[];
}

export function ErrorScreen({ title, description, badge, actions }: ErrorScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card interactive={false} className="w-full max-w-lg rounded-4xl p-8 text-center">
        <DashboardLogo
          size="lg"
          className="justify-center mb-5"
          iconClassName="h-14 w-14 rounded-full"
          labelClassName="text-4xl"
        />
        {badge && (
          <div className="mx-auto mb-4 inline-flex items-center rounded-full border border-border/20 bg-muted/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
            {badge}
          </div>
        )}
        <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{description}</p>
        {actions && actions.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {actions.map((action) => (
              <Button
                key={action.href}
                asChild
                size="xl"
                variant={action.variant === 'outline' ? 'outline' : 'brand'}
                className="rounded-2xl"
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
