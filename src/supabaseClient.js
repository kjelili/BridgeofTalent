// ============================================================================
// Supabase client
// ----------------------------------------------------------------------------
// The values below are the PUBLIC project URL and PUBLIC `anon` key.
// Both are designed by Supabase to be shipped in browser code; they appear in
// every visitor's DevTools regardless of where we store them. The real
// security boundary is the Row-Level Security policies in
// supabase/migrations/0001_initial_schema.sql.
//
// We hardcode them rather than using environment variables because Vercel's
// env-var injection into Create React App builds proved unreliable for this
// project. To rotate the anon key in the future:
//   1. Rotate it in the Supabase dashboard (Settings -> API Keys).
//   2. Replace SUPABASE_ANON_KEY below with the new value.
//   3. git commit + git push -- Vercel will redeploy automatically.
//
// NEVER paste the `service_role` key here. That one bypasses RLS and must
// stay server-side only.
//
// Environment variables, if present, override the hardcoded values. This lets
// you point a local dev server at a different Supabase project without
// editing source. In production we expect the hardcoded values to be used.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { processLock } from '@supabase/auth-js';

const HARDCODED_SUPABASE_URL = 'https://yizviueujgmnzvjcjnwy.supabase.co';
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpenZpdWV1amdtbnp2amNqbnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODUwNDgsImV4cCI6MjA5NDg2MTA0OH0.cJQdw_XKoecpdpFWVHqps56cPlbLaj5_BoF0eB-vsTc';

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL || HARDCODED_SUPABASE_URL;
const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || HARDCODED_SUPABASE_ANON_KEY;

// Exported so callers can build raw fetch() requests as a fallback when the
// SDK's internal auth lock wedges. See handleUpdateProfile in App.js.
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
// Auth token is stored in localStorage by the SDK under this key (project ref
// is parsed from the URL). Reading it directly lets us attach a Bearer header
// without going through the SDK's locked auth path.
export const SUPABASE_AUTH_STORAGE_KEY =
  `sb-${(supabaseUrl.match(/https:\/\/([^.]+)/) || [])[1] || ''}-auth-token`;


if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseAnonKey === '__REPLACE_WITH_ANON_KEY__'
) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase credentials missing. Edit src/supabaseClient.js and replace ' +
    'HARDCODED_SUPABASE_ANON_KEY with the real anon key from your Supabase ' +
    'dashboard (Settings -> API Keys).'
  );
}

// ---------------------------------------------------------------------------
// Stale-session self-healing
// ---------------------------------------------------------------------------
// Background: a session token in localStorage is signed by the JWT secret that
// was active in Supabase at the moment the user logged in. If that secret is
// later rotated, the token becomes cryptographically invalid -- but the
// Supabase client doesn't always detect that on startup; it can silently fail
// and leave the UI in a broken state (we hit this in production).
//
// Fix: stamp every successful session with a short fingerprint of the anon
// key. On boot, if the stored fingerprint doesn't match the current anon
// key's fingerprint, we know the project keys have rotated and the cached
// session is dead -- so we clear it before constructing the client.
// ---------------------------------------------------------------------------
const FINGERPRINT_KEY = 'bridgeoftalent-supabase-key-fp';

function anonKeyFingerprint(key) {
  // Lightweight non-cryptographic hash. We're not protecting anything here,
  // just detecting "has this string changed since we last booted?"
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return String(h);
}

try {
  const currentFp = anonKeyFingerprint(supabaseAnonKey);
  const storedFp = localStorage.getItem(FINGERPRINT_KEY);
  if (storedFp && storedFp !== currentFp) {
    // Anon key changed since last visit -> any cached sb-* session is stale.
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  }
  localStorage.setItem(FINGERPRINT_KEY, currentFp);
} catch (_) {
  // localStorage unavailable (private mode, etc.) -- non-fatal.
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use the in-process lock instead of the default navigator.locks-based one.
    // The navigator.locks implementation synchronises auth operations across
    // browser tabs, but in this single-tab app it was a recurring source of
    // deadlocks: signOut() and getSession() would hang indefinitely when the
    // lock was held by a prior operation that hadn't released it.
    // processLock is the same library's single-process alternative -- it
    // serialises within one tab (so refresh/auto-refresh races are still
    // safe) but doesn't reach out to the cross-tab LockManager.
    // Tradeoff: if a user signs out in one tab, other tabs won't see the
    // sign-out until they refresh. Acceptable for this app.
    lock: processLock,
  },
});

// Helper: load the app's profile row for a given auth user id.
// Centralised so the mapping logic isn't sprinkled across App.js.
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, company')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Raw authenticated fetch against Supabase's PostgREST endpoint.
//
// Why this exists: the SDK's .from('...').update/insert/delete() calls
// internally call auth.getSession() to attach a Bearer token, and that
// internal call can deadlock on the auth library's in-process lock after
// the session has been around for a few interactions. We hit this reliably
// on profile updates and worked around it by going direct. The same risk
// applies to every authenticated write across the app, so the workaround
// lives here as a shared helper rather than copy-pasted per call site.
//
// Reads usually work through the SDK fine (they go through a different
// code path), so this helper is intended for writes. Returns
// { data, error } shaped like the SDK does, so call sites can be similar.
//
// `path` is relative to /rest/v1/, e.g. "jobs?id=eq.abc&select=*".
// `body` is auto-JSON-stringified if it's an object. Headers default to
// "Prefer: return=representation" so the response includes the affected
// rows (matching .select() on the SDK side).
export async function supabaseAuthFetch(method, path, body = null, extraHeaders = {}) {
  let accessToken = null;
  try {
    const raw = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      accessToken = parsed?.access_token || null;
    }
  } catch (_) { /* ignore */ }

  if (!accessToken) {
    return { data: null, error: { message: 'Your session has expired. Please sign in again.' } };
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Prefer': 'return=representation',
    ...extraHeaders,
  };

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers,
      body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { data: null, error: { message: `HTTP ${resp.status}: ${txt || resp.statusText}`, status: resp.status } };
    }
    // 204 No Content is valid for DELETE -- treat as success with null data.
    if (resp.status === 204) return { data: null, error: null };
    const parsed = await resp.json().catch(() => null);
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message || 'Network error' } };
  }
}
