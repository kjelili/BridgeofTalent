// ============================================================================
// Supabase client
// ----------------------------------------------------------------------------
// Reads project URL + anon key from environment variables, never from source.
//   - Local development: define them in .env.local (gitignored)
//   - Production:        define them in the Vercel project's Env Variables UI
//
// The `anon` key is safe to expose in the browser; Row-Level Security policies
// in supabase/migrations/0001_initial_schema.sql enforce what each user can do.
// NEVER use the `service_role` key here — it bypasses RLS and must stay
// server-side only.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast and visibly rather than silently breaking auth at runtime.
  // eslint-disable-next-line no-console
  console.error(
    'Supabase credentials are missing. Set REACT_APP_SUPABASE_URL and ' +
    'REACT_APP_SUPABASE_ANON_KEY in .env.local (locally) or in the Vercel ' +
    'project Environment Variables (production), then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,        // keep the session in localStorage so refresh doesn't log the user out
    autoRefreshToken: true,      // refresh the JWT in the background
    detectSessionInUrl: true,    // pick up the session from the URL after email confirmation / OAuth
  },
});

// Helper: derive the app's profile object (the shape App.js expects for
// `currentUser`) from a Supabase auth session + the profiles row. Centralised
// here so we don't sprinkle this mapping logic across the app.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, company')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
