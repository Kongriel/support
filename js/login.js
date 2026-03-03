import { supabase } from "./supabaseClient.js";

const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");
const toSignup = document.getElementById("toSignup");

function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.classList.remove("ok", "err");
  if (type) msg.classList.add(type);
}

function getReturnTo() {
  const u = new URL(window.location.href);
  return u.searchParams.get("returnTo");
}

function setSignupLink() {
  const returnTo = getReturnTo();
  if (!returnTo) return;
  toSignup.href = `/signup.html?returnTo=${encodeURIComponent(returnTo)}`;
}

setSignupLink();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = form.email.value.trim();
  const password = form.password.value.trim();

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const returnTo = getReturnTo();
    window.location.href = returnTo ? decodeURIComponent(returnTo) : "/";
  } catch (err) {
    setMsg(err.message, "err");
  }
});
