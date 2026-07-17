/** Shared authentication and authorization boundary. */
export {
  AuthServiceError,
  AuthzError,
  getOptionalAuthState,
  getOptionalAuthUser,
  requireAuthUser,
  requireAuthUserId,
  requireProfile,
  requireRole,
  requireSelfOrAdmin,
  requireSuperAdmin,
} from '@/lib/server/authz';

