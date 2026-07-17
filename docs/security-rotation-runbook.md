# Security rotation runbook

The repository previously contained private-key material and a bootstrap
administrator credential. Removing files from the current checkout is not a
rotation and does not remove them from Git history.

Before the next production deployment:

1. Disable or reset the affected administrator account through Supabase Auth.
2. Revoke the exposed signing/private keys at their issuing provider.
3. Generate new keys outside the repository and store them in the hosting
   provider's secret manager.
4. Rotate Supabase service-role, payment-provider, webhook, Twilio, email, and
   deployment secrets if they may have shared the same environment.
5. Rewrite Git history with `git filter-repo` or BFG, coordinate a fresh clone
   for every contributor, and invalidate caches or artifacts containing the old
   files.
6. Enable GitHub secret scanning and push protection.

Never paste replacement values into migrations, documentation, logs, issues,
or pull requests.
