import { SignIn } from '@clerk/nextjs';

import { AuthLegalFooter } from '@/components/auth/auth-legal-footer';

export default function LoginPage() {
  return (
    <div className="auth-screen">
      <SignIn
        path="/login"
        signUpUrl="/register"
        fallbackRedirectUrl="/dashboard"
      />
      <AuthLegalFooter />
    </div>
  );
}
