import { supabase } from "./supabaseClient.js";

const form = document.getElementById("signupForm");
const msg = document.getElementById("signupMsg");
const toLogin = document.getElementById("toLogin");

function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.classList.remove("ok", "err");
  if (type) msg.classList.add(type);
}

function getReturnTo() {
  const u = new URL(window.location.href);
  return u.searchParams.get("returnTo");
}

function setLoginLink() {
  const returnTo = getReturnTo();
  if (!returnTo) return;
  toLogin.href = `/login.html?returnTo=${encodeURIComponent(returnTo)}`;
}

setLoginLink();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const password2 = form.password2.value.trim();

  if (password !== password2) {
    setMsg("Passwords matcher ikke.", "err");
    return;
  }

  try {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    setMsg("✅ Konto oprettet! Sender dig til login…", "ok");

    const returnTo = getReturnTo();
    const url = returnTo ? `/login.html?returnTo=${encodeURIComponent(returnTo)}` : "/login.html";

    setTimeout(() => (window.location.href = url), 700);
  } catch (err) {
    setMsg(err.message, "err");
  }
});
