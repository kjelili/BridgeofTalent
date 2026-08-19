import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

// Read and validate the public Supabase credentials lazily. Doing this at
// module scope would throw during `next build` (page-data collection imports
// this module before runtime env vars are available).
function getPublicSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { supabaseUrl, supabaseAnonKey };
}

// NOTE: The browser client lives in `@/lib/supabase-browser` so that Client
// Components never import this module (which pulls in `next/headers`).

// Server client for Server Components / Server Actions
export async function createServerSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseConfig();
  const cookieStore = cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be safely ignored if middleware refreshes user sessions.
        }
      },
    },
  });
}

// Admin client for Edge Functions / API routes (service role)
export function createAdminClient() {
  const { supabaseUrl } = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createBrowserClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
