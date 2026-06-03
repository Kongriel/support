import { supabase } from "./supabaseClient.js";

const form = document.getElementById("resetForm");
const msg = document.getElementById("resetMsg");

function setMsg(text, type = "") {
  msg.textContent = text || "";
  msg.classList.remove("ok", "err");
  if (type) msg.classList.add(type);
}

let readyForRecovery = false;

supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
    readyForRecovery = true;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const password = form.password.value.trim();
  const password2 = form.password2.value.trim();

  if (password !== password2) {
    setMsg("❌ Passwords matcher ikke.", "err");
    return;
  }

  if (password.length < 8) {
    setMsg("❌ Password skal være mindst 8 tegn.", "err");
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) throw error;

    setMsg("✅ Dit password er opdateret. Sender dig til login…", "ok");

    await supabase.auth.signOut();

    setTimeout(() => {
      window.location.href = "/login.html";
    }, 900);
  } catch (err) {
    setMsg("❌ " + (err?.message || "Linket er udløbet eller ugyldigt."), "err");
  }
});
