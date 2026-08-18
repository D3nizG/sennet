import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  bcryptRounds: 12,
  jwtExpiresIn: '24h',
  // Supabase project used to verify Google (and future OAuth) access tokens.
  // Optional: when unset, the /auth/google endpoint responds 503 and the rest
  // of the app (password auth) keeps working.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
} as const;

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
