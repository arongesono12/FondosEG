'use client';

import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardCard } from './dashboard-card';
import {
  DASHBOARD_MODULES,
  type DashboardModuleId,
  type DashboardModuleViewProps,
} from './dashboard-modules';

const loading = () => (
  <div className="dashboard-module-loading" aria-label="Cargando módulo">
    <DashboardCard className="h-28 animate-pulse" />
    <DashboardCard className="h-64 animate-pulse" />
    <DashboardCard className="h-48 animate-pulse" />
  </div>
);

const moduleComponents: Record<DashboardModuleId, React.ComponentType> = {
  transfers: dynamic(() => import('@/app/(dashboard)/transfers/page'), { loading }),
  agents: dynamic(() => import('@/app/(dashboard)/agents/page'), { loading }),
  balance: dynamic(() => import('@/app/(dashboard)/balance/page'), { loading }),
  stats: dynamic(() => import('@/app/(dashboard)/stats/page'), { loading }),
  history: dynamic(() => import('@/app/(dashboard)/history/page'), { loading }),
  staff: dynamic(() => import('@/app/(dashboard)/staff/page'), { loading }),
};

interface DashboardModulePanelProps extends DashboardModuleViewProps {
  moduleId: DashboardModuleId;
  onClose: () => void;
}

interface DashboardModuleViewComponentProps extends DashboardModuleViewProps {
  moduleId: DashboardModuleId;
}

export function DashboardModuleView({
  moduleId,
  presentation = 'page',
}: DashboardModuleViewComponentProps) {
  const ModuleComponent = moduleComponents[moduleId];

  return (
    <div
      key={moduleId}
      className="dashboard-module-viewport"
      data-presentation={presentation}
      data-module={moduleId}
    >
      <ModuleComponent />
    </div>
  );
}

export function DashboardModulePanel({
  moduleId,
  onClose,
  presentation = 'panel',
}: DashboardModulePanelProps) {
  const definition = DASHBOARD_MODULES[moduleId];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        mobile="none"
        hideClose
        overlayClassName="dashboard-module-overlay"
        className="dashboard-module-panel gap-0 p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="dashboard-module-panel-header">
          <div>
            <span className="dashboard-module-eyebrow">FondosEG</span>
            <DialogTitle>{definition.label}</DialogTitle>
          </div>
          <DialogClose className="dashboard-module-close" aria-label={`Cerrar ${definition.label}`}>
            <X aria-hidden="true" />
          </DialogClose>
        </DialogHeader>
        <DialogBody className="dashboard-module-panel-body">
          <DashboardModuleView moduleId={moduleId} presentation={presentation} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
