import { SignUp } from '@clerk/nextjs';

import { AuthLegalFooter } from '@/components/auth/auth-legal-footer';

export default function RegisterPage() {
  return (
    <div className="auth-screen">
      <SignUp
        path="/register"
        signInUrl="/login"
        fallbackRedirectUrl="/dashboard"
      />
      <AuthLegalFooter />
    </div>
  );
}
