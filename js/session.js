import { supabase } from "./supabaseClient.js";

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export function goToLogin() {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login.html?returnTo=${returnTo}`;
}

export async function requireUserOrRedirect() {
  const user = await getUser();
  if (!user) {
    goToLogin();
    return null;
  }
  return user;
}

// Alias så ældre filer stadig virker
export async function requireUser() {
  return requireUserOrRedirect();
}
