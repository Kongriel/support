import { supabase } from "./supabaseClient.js";
import { isAdmin } from "./api.js";

const loginLink = document.getElementById("loginLink");
const profileLink = document.getElementById("profileLink");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

async function initNavbar() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (user) {
    loginLink?.classList.add("hidden");
    profileLink?.classList.remove("hidden");
    logoutBtn?.classList.remove("hidden");

    if (await isAdmin()) {
      adminLink?.classList.remove("hidden");
    }
  }

  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  });

  toggle?.addEventListener("click", () => {
    links?.classList.toggle("open");
  });
}

initNavbar();
