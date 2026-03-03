import { getTaskBySlug, getEventById, listSlotsWithCountsForTask, registerForSlot } from "./api.js";
import { requireUserOrRedirect } from "./session.js";

const stateEl = document.getElementById("state");
const pageEl = document.getElementById("taskPage");

const backLinkEl = document.getElementById("backLink");
const titleEl = document.getElementById("taskTitle");
const descEl = document.getElementById("taskDesc");
const slotsEl = document.getElementById("slots");

const selectedSlotLabelEl = document.getElementById("selectedSlotLabel");
const form = document.getElementById("regForm");
const submitBtn = document.getElementById("submitBtn");
const formMsg = document.getElementById("formMsg");

const nameEl = document.getElementById("name");
// emailEl findes måske stadig i HTML – vi bruger den ikke længere
const emailEl = document.getElementById("email");
const phoneEl = document.getElementById("phone");
const noteEl = document.getElementById("note");

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("da-DK", { weekday: "short", month: "short", day: "numeric" });
}

function humanError(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("not authenticated")) return "Du skal være logget ind for at tilmelde dig.";
  if (m.includes("slot is full")) return "Det tidsrum er desværre fyldt op.";
  if (m.includes("already")) return "Du er allerede tilmeldt dette tidsrum.";
  if (m.includes("slot not found")) return "Tidsrummet findes ikke længere.";
  return msg || "Noget gik galt.";
}

let selectedSlotId = null;
let selectedSlotText = "Ingen valgt";
let cachedSlots = [];

function setMessage(text, kind) {
  formMsg.textContent = text || "";
  formMsg.classList.remove("ok", "err");
  if (kind) formMsg.classList.add(kind);
}

function setSelected(slotId) {
  selectedSlotId = slotId;

  const slot = cachedSlots.find((s) => s.id === slotId);
  if (slot) {
    const left = Math.max(0, (slot.capacity ?? 0) - (slot.registered ?? 0));
    selectedSlotText = `${fmtDate(slot.start_time)} ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)} (${left} ledige)`;
  } else {
    selectedSlotText = "Valgt";
  }

  selectedSlotLabelEl.textContent = selectedSlotText;
  submitBtn.disabled = !selectedSlotId;

  [...slotsEl.querySelectorAll(".slot")].forEach((el) => {
    el.classList.toggle("selected", el.dataset.slotId === slotId);
  });
}

function slotRow(slot) {
  const left = Math.max(0, (slot.capacity ?? 0) - (slot.registered ?? 0));
  const time = `${fmtDate(slot.start_time)} · ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}`;

  const disabled = left <= 0 ? "disabled" : "";
  const btnText = left <= 0 ? "Fyldt" : "Vælg";

  return `
    <div class="slot" data-slot-id="${slot.id}">
      <div class="slot-left">
        <div class="slot-time">${time}</div>
        <div class="slot-sub">${left} ledige / ${slot.capacity} pladser</div>
      </div>
      <div class="slot-right">
        <span class="pill">${left} ledige</span>
        <button class="slot-btn" data-pick="${slot.id}" ${disabled}>${btnText}</button>
      </div>
    </div>
  `;
}

async function loadSlots(taskId) {
  cachedSlots = await listSlotsWithCountsForTask(taskId);

  if (!cachedSlots.length) {
    slotsEl.innerHTML = `<div class="muted">Ingen tidsrum oprettet endnu.</div>`;
    return;
  }

  slotsEl.innerHTML = cachedSlots.map(slotRow).join("");

  slotsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pick]");
    if (!btn) return;
    const slotId = btn.getAttribute("data-pick");
    if (btn.disabled) return;

    setSelected(slotId);
    setMessage("");
  });
}

async function init() {
  const slug = getQueryParam("slug");
  if (!slug) {
    stateEl.textContent = "Mangler ?slug= i URL’en.";
    return;
  }

  try {
    stateEl.textContent = "Henter opgave...";
    const task = await getTaskBySlug(slug);

    document.title = task.title ? `${task.title} – Opgave` : "Opgave";
    titleEl.textContent = task.title ?? "Uden titel";
    descEl.textContent = task.description ?? "";

    // Backlink til event
    const ev = await getEventById(task.event_id);
    backLinkEl.href = `./event.html?slug=${encodeURIComponent(ev.slug)}`;

    // Skjul email input hvis det findes (auth tager email)
    if (emailEl) {
      const wrap = emailEl.closest("label") || emailEl.closest(".field") || emailEl.parentElement;
      if (wrap) wrap.style.display = "none";
      emailEl.value = "";
    }

    stateEl.textContent = "Henter tidsrum...";
    await loadSlots(task.id);

    pageEl.hidden = false;
    stateEl.textContent = "";
  } catch (err) {
    console.error(err);
    stateEl.textContent = "Kunne ikke hente opgaven. Tjek console (F12).";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("");

  // KRÆV LOGIN — ellers redirect
  const user = await requireUserOrRedirect();
  if (!user) return;

  if (!selectedSlotId) {
    setMessage("Vælg et tidsrum først.", "err");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Tilmeld...";

  try {
    const payload = {
      slotId: selectedSlotId,
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim() || null,
      note: noteEl.value.trim() || null,
    };

    if (!payload.name) {
      throw new Error("Udfyld navn.");
    }

    await registerForSlot(payload);

    setMessage("✅ Du er tilmeldt! Tak 🙌", "ok");
    form.reset();
    selectedSlotId = null;
    selectedSlotLabelEl.textContent = "Ingen valgt";

    // Reload slots for fresh counts
    const slug = getQueryParam("slug");
    const task = await getTaskBySlug(slug);
    await loadSlots(task.id);
  } catch (err) {
    console.error(err);
    setMessage("❌ " + humanError(err?.message), "err");
  } finally {
    submitBtn.textContent = "Tilmeld";
    submitBtn.disabled = !selectedSlotId;
  }
});

init();
