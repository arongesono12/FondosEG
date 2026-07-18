import { requireDeveloperAccess } from '@/lib/server/authz';

export default async function DashboardDeveloperAreaLayout({ children }: { children: React.ReactNode }) {
  await requireDeveloperAccess();
  return children;
}
