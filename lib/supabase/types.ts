/** Claims made available to application authorization code from Supabase Auth. */
export interface SupabaseClaims {
  sub: string;
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/** The application-owned identity boundary; never contains service credentials. */
export interface SupabaseApplicationUser {
  id: string;
  email?: string;
  role?: string;
  workspaceId?: string;
}
