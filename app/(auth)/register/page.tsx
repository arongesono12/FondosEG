import { RegisterForm } from '@/components/auth/register-form';
import type { UserRole } from '@/types';

interface RegisterPageProps {
  searchParams: Promise<{
    name?: string | string[];
    email?: string | string[];
    phone?: string | string[];
    role?: string | string[];
  }>;
}

function readParam(value?: string | string[]) {
  return typeof value === 'string' ? value : undefined;
}

function isUserRole(value?: string): value is UserRole {
  return value === 'admin' || value === 'superadmin' || value === 'gestor' || value === 'cliente';
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const role = readParam(params.role);

  return (
    <RegisterForm
      prefill={{
        name: readParam(params.name),
        email: readParam(params.email),
        phone: readParam(params.phone),
        role: isUserRole(role) ? role : undefined,
      }}
    />
  );
}
