import { SignUp } from '@clerk/nextjs';

export default function DevelopersPortalRegisterPage() {
  return (
    <div className="auth-screen">
      <SignUp
        path="/developers-portal/register"
        signInUrl="/developers-portal/login"
        fallbackRedirectUrl="/developer-console"
      />
    </div>
  );
}
