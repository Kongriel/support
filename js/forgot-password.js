import { supabase } from "./supabaseClient.js";

const form = document.getElementById("forgotForm");
const msg = document.getElementById("forgotMsg");

function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.classList.remove("ok", "err");
  if (type) msg.classList.add(type);
}

function getBaseUrl() {
  return window.location.origin;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = form.email.value.trim();

  try {
    const redirectTo = `${getBaseUrl()}/reset-password.html`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;

    setMsg("✅ Tjek din mail — vi har sendt et link til at lave et nyt password.", "ok");
    form.reset();
  } catch (err) {
    setMsg("❌ " + (err?.message || "Noget gik galt."), "err");
  }
});
