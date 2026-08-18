import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config.js';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    // Anon key is sufficient: `auth.getUser(token)` validates the JWT against
    // the Supabase auth server, so no service-role key is needed here.
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface SupabaseIdentity {
  supabaseId: string;
  email: string | null;
  displayName: string | null;
  provider: string;
}

/**
 * Validate a Supabase access token and return the identity it represents.
 * Returns null when the token is missing/invalid/expired.
 */
export async function verifySupabaseToken(
  accessToken: string,
): Promise<SupabaseIdentity | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await getClient().auth.getUser(accessToken);
  if (error || !data?.user) return null;

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;

  return {
    supabaseId: user.id,
    email: user.email ?? null,
    displayName,
    provider: (user.app_metadata?.provider as string) ?? 'oauth',
  };
}
