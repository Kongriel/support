import { requireUserOrRedirect } from "./session.js";
import { listMyRegistrations, cancelMyRegistration } from "./api.js";
import { supabase } from "./supabaseClient.js";

const meEl = document.getElementById("me");
const regsEl = document.getElementById("myRegs");
const logoutBtn = document.getElementById("logoutBtn");

function safe(s) {
  return (s ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showError(err) {
  console.error(err);
  regsEl.innerHTML = `
    <div class="muted" style="margin-top:18px;">
      <b>Fejl:</b> ${safe(err?.message || String(err))}
    </div>
  `;
}

async function load() {
  const user = await requireUserOrRedirect();
  if (!user) return;

  meEl.innerHTML = `<div class="muted">Logget ind som <b>${safe(user.email)}</b></div>`;

  let regs = [];
  try {
    regs = await listMyRegistrations();
    console.log("my registrations:", regs);
  } catch (err) {
    showError(err);
    return;
  }

  if (!regs.length) {
    regsEl.innerHTML = `<div class="muted" style="margin-top:18px;">Ingen tilmeldinger endnu.</div>`;
    return;
  }

  regsEl.innerHTML = `
    <div class="events-wrap" style="padding-top:18px;">
      ${regs
        .map(
          (r) => `
        <article class="event-card" style="grid-template-columns: 1fr;">
          <div class="event-body">
            <div class="event-date">${safe(fmt(r.start_time))} – ${safe(fmt(r.end_time))}</div>
            <h2 class="event-title" style="font-size:28px;">${safe(r.task_title)}</h2>
            <div class="event-location">${safe(r.event_title)}</div>

            <div class="event-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
              <a class="event-btn" href="/event.html?slug=${encodeURIComponent(r.event_slug)}">Se event</a>
              <button class="event-btn" data-cancel="${r.registration_id}">Frameld</button>
            </div>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `;

  regsEl.onclick = async (e) => {
    const id = e.target.closest("[data-cancel]")?.getAttribute("data-cancel");
    if (!id) return;

    if (!confirm("Vil du framelde dig?")) return;

    try {
      await cancelMyRegistration(id);
      await load();
    } catch (err) {
      showError(err);
    }
  };
}

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

load();
