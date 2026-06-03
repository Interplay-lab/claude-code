/* Supabase client + auth helpers.
   When the env vars aren't set, `isLive` is false and the app stays in
   demo mode (in-memory seed data) so dev/build keep working without creds. */
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isLive = Boolean(URL && ANON);

export const supabase = isLive ? createClient(URL, ANON) : null;

/* Google sign-in (redirects back to the app). */
export async function signInWithGoogle() {
  if (!isLive) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (isLive) await supabase.auth.signOut();
}

export async function getSession() {
  if (!isLive) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* Subscribe to auth changes; returns an unsubscribe fn. */
export function onAuthChange(cb) {
  if (!isLive) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
