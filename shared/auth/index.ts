/** Shared authentication and authorization boundary. */
export {
  AuthServiceError,
  AuthzError,
  getOptionalAuthState,
  getOptionalAuthUser,
  requireAuthUser,
  requireAuthUserId,
  requireDashboardAccess,
  requireDeveloperAccess,
  requireProductAccess,
  requireProfile,
  requireRole,
  requireSelfOrAdmin,
  requireSuperAdmin,
  type AuthUser,
} from '@/lib/server/authz';
