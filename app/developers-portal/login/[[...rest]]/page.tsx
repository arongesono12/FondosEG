import { SignIn } from '@clerk/nextjs';

export default function DevelopersPortalLoginPage() {
  return (
    <div className="auth-screen">
      <SignIn
        path="/developers-portal/login"
        signUpUrl="/developers-portal/register"
        fallbackRedirectUrl="/developer-console"
      />
    </div>
  );
}
