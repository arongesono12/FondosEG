/**
 * Server-only privileged database boundary.
 * Domain infrastructure may import this module; UI and HTTP clients must not.
 */
import 'server-only';

export { createAdminClient } from '@/lib/supabase/admin';

