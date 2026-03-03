import { supabase } from "./supabaseClient.js";
import { isAdmin } from "./api.js";

async function requireAdminOrRedirect() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?returnTo=${returnTo}`;
    return false;
  }

  const ok = await isAdmin();
  if (!ok) {
    window.location.href = "/index.html";
    return false;
  }

  return true;
}

import { listEvents, createEvent, updateEvent, uploadEventCover, getPublicImageUrl, deleteEvent, listTasksWithCountsForEvent, createTask, updateTask, deleteTask, listSlotsForTask, createSlot, deleteSlot, listRegistrationsForTask, deleteRegistration } from "./api.js";

/* ---------------- DEV ADMIN LOGIN (UI gate) ---------------- */
const DEV_ADMIN_EMAIL = "valby@if.dk";
const DEV_ADMIN_PASSWORD = "12344321";

const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const logoutBtn = document.getElementById("logoutBtn");

function setLoginMsg(msg, type) {
  loginMsg.textContent = msg || "";
  loginMsg.classList.remove("ok", "err");
  if (type) loginMsg.classList.add(type);
}
function setLoggedIn(isIn) {
  if (isIn) {
    document.body.classList.add("admin-ok");
    sessionStorage.setItem("dev_admin_login", "true");
  } else {
    document.body.classList.remove("admin-ok");
    sessionStorage.removeItem("dev_admin_login");
  }
}
function isLoggedIn() {
  return sessionStorage.getItem("dev_admin_login") === "true";
}
async function requireLoginOrThrow() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Du er ikke logget ind.");
}

/* ---------------- DOM ---------------- */
const eventsEl = document.getElementById("events");
const tasksEl = document.getElementById("tasks");
const detailsEl = document.getElementById("details");
const addEventBtn = document.getElementById("addEvent");
const addTaskBtn = document.getElementById("addTask");

/* ---------------- State ---------------- */
let selectedEvent = null;
let selectedTask = null;
let currentEvents = [];
let currentTasks = [];

/* ---------------- Utils ---------------- */
function safe(s) {
  return (s ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}
function fmtDatePretty(ts) {
  if (!ts) return "";

  const d = new Date(ts);

  return d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// input type="datetime-local" expects YYYY-MM-DDTHH:mm
function toDatetimeLocalValue(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function debounce(fn, ms = 450) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function showError(err) {
  console.error(err);
  detailsEl.innerHTML = `
      <div class="admin-row">
        <div class="left">
          <div class="title">Fejl</div>
          <div class="sub">${safe(err?.message || String(err))}</div>
        </div>
      </div>
    `;
}

/* ---------------- Load + Render: EVENTS ---------------- */
async function loadEvents() {
  await requireLoginOrThrow();
  currentEvents = await listEvents();

  eventsEl.innerHTML = currentEvents.length
    ? currentEvents
        .map(
          (e) => `
          <div class="row ${selectedEvent?.id === e.id ? "active" : ""}" data-ev="${e.id}">
            ${safe(e.title || "Uden titel")}
          </div>
        `
        )
        .join("")
    : `<div class="muted">Ingen events endnu.</div>`;
}

/* ---------------- Load + Render: TASKS (+ counts) ---------------- */
async function loadTasks() {
  await requireLoginOrThrow();

  if (!selectedEvent) {
    tasksEl.innerHTML = `<div class="muted">Vælg et event.</div>`;
    currentTasks = [];
    return;
  }

  currentTasks = await listTasksWithCountsForEvent(selectedEvent.id);

  tasksEl.innerHTML = currentTasks.length
    ? currentTasks
        .map((t) => {
          const reg = t.registered_total ?? 0;
          const cap = t.capacity_total ?? 0;
          const avail = t.available ?? Math.max(0, cap - reg);

          return `
            <div class="row ${selectedTask?.id === t.id ? "active" : ""}" data-task="${t.id}">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${safe(t.title || "Uden titel")}
                </div>
                <div class="pill" title="Tilmeldte / pladser">${reg}/${cap}</div>
              </div>
              <div class="muted" style="font-size:12px; margin-top:4px;">
                ${avail} ledige
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="muted">Ingen opgaver endnu.</div>`;
}

/* ---------------- DETAILS: Event editor OR Task editor ---------------- */
async function loadDetails() {
  await requireLoginOrThrow();

  if (!selectedEvent) {
    detailsEl.innerHTML = `<div class="muted">Vælg et event for at redigere.</div>`;
    return;
  }

  if (!selectedTask) {
    renderEventEditor();
    return;
  }

  const [slots, regsBySlot] = await Promise.all([listSlotsForTask(selectedTask.id), listRegistrationsForTask(selectedTask.id)]);

  renderTaskEditor(slots, regsBySlot);
}

/* ---------------- Event editor (autosave) ---------------- */
function renderEventEditor() {
  const coverUrl = selectedEvent.image_path ? getPublicImageUrl(selectedEvent.image_path) : null;

  detailsEl.innerHTML = `
      <h3 style="margin-top:0;">Event</h3>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Titel</div>
          <input id="ev_title" class="input" value="${safe(selectedEvent.title || "")}" />
        </div>
      </div>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Slug</div>
          <input id="ev_slug" class="input" value="${safe(selectedEvent.slug || "")}" />
        </div>
      </div>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Dato</div>
          <input id="ev_date" type="date" class="input" value="${safe(selectedEvent.date || "")}" />
        </div>
      </div>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Lokation</div>
          <input id="ev_loc" class="input" value="${safe(selectedEvent.location || "")}" />
        </div>
      </div>

      <div class="admin-row">
  <div class="left" style="width:100%;">
    <div class="sub">Kort beskrivelse (forside)</div>
    <textarea id="ev_short_desc" class="input" rows="2">${safe(selectedEvent.short_description || "")}</textarea>
  </div>
</div>

  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Beskrivelse</div>
          <textarea id="ev_desc" class="input" rows="4">${safe(selectedEvent.description || "")}</textarea>
        </div>
      </div>
  
      <hr class="admin-hr"/>
  
      <h4 style="margin:0 0 10px;">Cover billede</h4>
  
      <div class="admin-row" style="align-items:center;">
        <div class="left" style="width:100%;">
          <div class="sub">Upload (kun til event)</div>
          <input id="ev_cover" type="file" accept="image/*" class="input" />
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Tip: vælg et billede, så uploader vi automatisk.
          </div>
        </div>
      </div>
  
      <div class="admin-row" style="gap:12px; align-items:center;">
        <div class="left" style="width:100%;">
          <div class="sub">Preview</div>
          <div style="border:1px solid var(--line); border-radius:14px; overflow:hidden; background:rgba(255,255,255,.03);">
            <img id="ev_cover_preview" src="${coverUrl ? coverUrl : ""}" alt=""
                 style="width:100%; height:180px; object-fit:cover; display:${coverUrl ? "block" : "none"};">
            <div id="ev_cover_empty" class="muted" style="padding:14px; display:${coverUrl ? "none" : "block"};">
              Intet cover endnu.
            </div>
          </div>
        </div>
      </div>
  
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button id="ev_delete" class="button" type="button">Slet event</button>
        <span id="ev_status" class="muted" style="align-self:center;"></span>
      </div>
  
      <hr class="admin-hr"/>
  
      <div class="muted">Vælg en opgave for at redigere opgave + tidsrum + tilmeldinger.</div>
    `;

  const evTitle = document.getElementById("ev_title");
  const evSlug = document.getElementById("ev_slug");
  const evDate = document.getElementById("ev_date");
  const evLoc = document.getElementById("ev_loc");
  const evShortDesc = document.getElementById("ev_short_desc");

  const evDesc = document.getElementById("ev_desc");
  const evStatus = document.getElementById("ev_status");
  const evDelete = document.getElementById("ev_delete");

  const evCoverInput = document.getElementById("ev_cover");
  const previewImg = document.getElementById("ev_cover_preview");
  const emptyBox = document.getElementById("ev_cover_empty");

  evTitle.addEventListener("input", () => {
    if (!evSlug.value.trim()) evSlug.value = slugify(evTitle.value);
  });

  const save = debounce(async () => {
    try {
      evStatus.textContent = "Gemmer...";
      const patch = {
        title: evTitle.value.trim(),
        slug: evSlug.value.trim(),
        date: evDate.value || null,
        location: evLoc.value.trim() || null,
        short_description: evShortDesc.value.trim() || null,

        description: evDesc.value.trim() || null,
      };
      const updated = await updateEvent(selectedEvent.id, patch);
      selectedEvent = updated;
      evStatus.textContent = "✅ Gemt";
      await loadEvents();
    } catch (err) {
      evStatus.textContent = "❌ Fejl";
      alert(err.message);
    }
  }, 500);

  [evTitle, evSlug, evDate, evLoc, evDesc].forEach((el) => el.addEventListener("input", save));

  // Upload cover on file select
  evCoverInput.addEventListener("change", async () => {
    const file = evCoverInput.files?.[0];
    if (!file) return;

    try {
      evStatus.textContent = "Uploader billede...";

      const { path } = await uploadEventCover(selectedEvent.id, file);
      const updated = await updateEvent(selectedEvent.id, { image_path: path });
      selectedEvent = updated;

      const url = getPublicImageUrl(path);
      previewImg.src = url;
      previewImg.style.display = "block";
      emptyBox.style.display = "none";

      evStatus.textContent = "✅ Cover opdateret";
      await loadEvents();
    } catch (err) {
      console.error(err);
      evStatus.textContent = "❌ Upload fejlede";
      alert(err.message);
    } finally {
      evCoverInput.value = "";
    }
  });

  evDelete.onclick = async () => {
    if (!confirm("Slet eventet? (alt under det slettes også)")) return;
    await deleteEvent(selectedEvent.id);

    selectedEvent = null;
    selectedTask = null;

    await loadEvents();
    await loadTasks();
    await loadDetails();
  };
}

/* ---------------- Task editor + pretty slots + custom slot create ---------------- */
function renderTaskEditor(slots, regsBySlot) {
  const regsFlat = regsBySlot.flatMap((s) => s.registrations || []);

  detailsEl.innerHTML = `
      <h3 style="margin-top:0;">Opgave</h3>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Titel</div>
          <input id="t_title" class="input" value="${safe(selectedTask.title || "")}" />
        </div>
      </div>
  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Slug</div>
          <input id="t_slug" class="input" value="${safe(selectedTask.slug || "")}" />
        </div>
      </div>

      <div class="admin-row">
  <div class="left" style="width:100%;">
    <div class="sub">Kort beskrivelse (kort-visning)</div>
    <textarea id="t_short_desc" class="input" rows="2">${safe(selectedTask.short_description || "")}</textarea>
  </div>
</div>

  
      <div class="admin-row">
        <div class="left" style="width:100%;">
          <div class="sub">Beskrivelse</div>
          <textarea id="t_desc" class="input" rows="4">${safe(selectedTask.description || "")}</textarea>
        </div>
      </div>
  
      <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
  <button id="taskPrintOverview" class="button" type="button">📄 Deltageroversigt</button>
  <button id="t_delete" class="button" type="button">Slet opgave</button>
  <span id="t_status" class="muted" style="align-self:center;"></span>
</div>

  
      <hr class="admin-hr"/>
  
      <h4 style="margin:0 0 10px;">Tidsrum</h4>
  
      <form id="slotForm" class="form" style="margin-bottom:10px;">
        <label class="label">Start (dato+tid)
          <input id="slotStart" type="datetime-local" class="input" required />
        </label>
  
        <label class="label">Slut (dato+tid)
          <input id="slotEnd" type="datetime-local" class="input" required />
        </label>
  
        <label class="label">Pladser (capacity)
          <input id="slotCap" type="number" min="1" value="2" class="input" required />
        </label>
  
        <button class="button" type="submit">+ Tilføj tidsrum</button>
        <div id="slotMsg" class="form-msg" aria-live="polite"></div>
      </form>
  
      <div class="admin-list" id="slotsList">
        ${
          slots.length
            ? slots
                .map(
                  (s) => `
                <div class="admin-row">
                  <div class="left">
                    <div class="title">${fmtTime(s.start_time)}–${fmtTime(s.end_time)}</div>
                    <div class="sub">${fmtDatePretty(s.start_time)} · capacity: ${s.capacity}</div>
                  </div>
                  <button class="button" type="button" data-del-slot="${s.id}">Slet</button>
                </div>
              `
                )
                .join("")
            : `<div class="muted">Ingen tidsrum endnu.</div>`
        }
      </div>
  
      <hr class="admin-hr"/>
  
      <h4 style="margin:0 0 10px;">Tilmeldinger</h4>
  
      ${
        regsFlat.length
          ? regsBySlot
              .map((s) => {
                const regs = s.registrations || [];
                return `
                <div class="admin-row">
                  <div class="left">
                    <div class="title">${fmtTime(s.start_time)}–${fmtTime(s.end_time)}</div>
                    <div class="sub">${fmtDatePretty(s.start_time)} · ${regs.length} tilmeldt · cap ${s.capacity}</div>
                  </div>
                </div>
                ${
                  regs.length
                    ? regs
                        .map(
                          (r) => `
                        <div class="admin-row">
                          <div class="left">
                            <div class="title">${safe(r.name)} <span class="muted" style="font-weight:400;">(${safe(r.email)})</span></div>
                            <div class="sub">${safe(r.phone || "")} ${r.note ? "· " + safe(r.note) : ""}</div>
                          </div>
                          <button class="button" type="button" data-del-reg="${r.id}">Slet</button>
                        </div>
                      `
                        )
                        .join("")
                    : `<div class="muted" style="margin:0 0 12px;">Ingen tilmeldinger på dette tidsrum.</div>`
                }
              `;
              })
              .join("")
          : `<div class="muted">Ingen tilmeldinger.</div>`
      }
    `;

  // Prefill slot times: next whole hour + 1 hour
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const slotStart = document.getElementById("slotStart");
  const slotEnd = document.getElementById("slotEnd");
  const slotCap = document.getElementById("slotCap");
  const slotForm = document.getElementById("slotForm");
  const slotMsg = document.getElementById("slotMsg");

  slotStart.value = toDatetimeLocalValue(start);
  slotEnd.value = toDatetimeLocalValue(end);

  // Autosave task
  const tTitle = document.getElementById("t_title");
  const tSlug = document.getElementById("t_slug");
  const tShortDesc = document.getElementById("t_short_desc");

  const tDesc = document.getElementById("t_desc");
  const tStatus = document.getElementById("t_status");
  const tDelete = document.getElementById("t_delete");

  tTitle.addEventListener("input", () => {
    if (!tSlug.value.trim()) tSlug.value = slugify(tTitle.value);
  });

  const saveTask = debounce(async () => {
    try {
      tStatus.textContent = "Gemmer...";
      const patch = {
        title: tTitle.value.trim(),
        slug: tSlug.value.trim(),
        short_description: tShortDesc.value.trim() || null,
        description: tDesc.value.trim() || null,
      };

      const updated = await updateTask(selectedTask.id, patch);
      // NOTE: updateTask returnerer ikke counts, men det er ok
      selectedTask = { ...selectedTask, ...updated };
      tStatus.textContent = "✅ Gemt";
      await loadTasks(); // så midterkolonnen opdaterer titel og counts
    } catch (err) {
      tStatus.textContent = "❌ Fejl";
      alert(err.message);
    }
  }, 500);

  [tTitle, tSlug, tShortDesc, tDesc].forEach((el) => el.addEventListener("input", saveTask));

  tDelete.onclick = async () => {
    if (!confirm("Slet opgaven? (tidsrum + tilmeldinger slettes også)")) return;
    await deleteTask(selectedTask.id);
    selectedTask = null;
    await loadTasks();
    await loadDetails();
  };

  const printBtn = document.getElementById("taskPrintOverview");

  printBtn.onclick = async () => {
    const modal = document.getElementById("printModal");
    const content = document.getElementById("printContent");

    const regsBySlotFresh = await listRegistrationsForTask(selectedTask.id);

    content.innerHTML = `
    <h1 style="margin-bottom:6px;">${safe(selectedTask.title)}</h1>
    <p style="margin-top:0;">${safe(selectedTask.description || "")}</p>
    <hr/>
    ${regsBySlotFresh
      .map((slot) => {
        const regs = slot.registrations || [];

        return `
        <h3 style="margin-top:30px;">
          ${fmtDatePretty(slot.start_time)} 
          ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)}
        </h3>

        <table style="width:100%; border-collapse:collapse; margin-top:10px;" border="1">
          <thead>
            <tr>
              <th style="padding:8px;">Navn</th>
              <th style="padding:8px;">Email</th>
              <th style="padding:8px;">Telefon</th>
            </tr>
          </thead>
          <tbody>
            ${
              regs.length
                ? regs
                    .map(
                      (r) => `
                    <tr>
                      <td style="padding:8px;">${safe(r.name)}</td>
                      <td style="padding:8px;">${safe(r.email)}</td>
                      <td style="padding:8px;">${safe(r.phone || "")}</td>
                    </tr>
                  `
                    )
                    .join("")
                : `<tr><td colspan="3" style="padding:8px;">Ingen tilmeldinger</td></tr>`
            }
          </tbody>
        </table>
      `;
      })
      .join("")}
  `;

    modal.classList.remove("hidden");
  };

  // Create custom slot
  slotForm.onsubmit = async (e) => {
    e.preventDefault();
    slotMsg.textContent = "";
    slotMsg.classList.remove("ok", "err");

    try {
      const startVal = slotStart.value;
      const endVal = slotEnd.value;
      const capVal = Number(slotCap.value);

      if (!startVal || !endVal) throw new Error("Vælg start og slut.");
      if (!capVal || capVal < 1) throw new Error("Capacity skal være mindst 1.");

      const startISO = new Date(startVal).toISOString();
      const endISO = new Date(endVal).toISOString();
      if (new Date(endISO) <= new Date(startISO)) throw new Error("Slut skal være efter start.");

      await createSlot({
        task_id: selectedTask.id,
        start_time: startISO,
        end_time: endISO,
        capacity: capVal,
      });

      slotMsg.textContent = "✅ Tidsrum oprettet";
      slotMsg.classList.add("ok");

      await loadDetails();
      await loadTasks(); // counts kan ændre sig hvis du har cap_total
    } catch (err) {
      slotMsg.textContent = "❌ " + err.message;
      slotMsg.classList.add("err");
    }
  };

  // Delete slot / delete registration (event delegation)
  detailsEl.onclick = async (e) => {
    const delSlot = e.target.closest("[data-del-slot]")?.getAttribute("data-del-slot");
    const delReg = e.target.closest("[data-del-reg]")?.getAttribute("data-del-reg");

    if (delSlot) {
      if (!confirm("Slet dette tidsrum? (tilmeldinger på det slettes også)")) return;
      await deleteSlot(delSlot);
      await loadDetails();
      await loadTasks();
      return;
    }

    if (delReg) {
      if (!confirm("Slet denne tilmelding?")) return;
      await deleteRegistration(delReg);
      await loadDetails();
      await loadTasks(); // counts opdateres
      return;
    }
  };
}

/* ---------------- Column clicks ---------------- */
eventsEl.onclick = async (e) => {
  const id = e.target.closest("[data-ev]")?.getAttribute("data-ev");
  if (!id) return;

  selectedEvent = currentEvents.find((x) => x.id === id);
  selectedTask = null;

  await loadEvents();
  await loadTasks();
  await loadDetails();
};

tasksEl.onclick = async (e) => {
  const id = e.target.closest("[data-task]")?.getAttribute("data-task");
  if (!id) return;

  selectedTask = currentTasks.find((x) => x.id === id);

  await loadTasks();
  await loadDetails();
};

/* ---------------- Add buttons ---------------- */
addEventBtn.onclick = async () => {
  try {
    await requireLoginOrThrow();

    const ev = await createEvent({
      title: "Nyt event",
      slug: "nyt-" + Date.now(),
      description: "",
      location: "",
      date: null,
      image_path: null,
    });

    selectedEvent = ev;
    selectedTask = null;

    await loadEvents();
    await loadTasks();
    await loadDetails();
  } catch (err) {
    showError(err);
    alert(err.message);
  }
};

addTaskBtn.onclick = async () => {
  try {
    await requireLoginOrThrow();
    if (!selectedEvent) return alert("Vælg et event først.");

    const t = await createTask({
      event_id: selectedEvent.id,
      title: "Ny opgave",
      slug: `${selectedEvent.slug}-opgave-${Date.now()}`,
      description: "",
    });

    selectedTask = t;

    await loadTasks();
    await loadDetails();
  } catch (err) {
    showError(err);
    alert(err.message);
  }
};

/* ---------------- Login handlers ---------------- */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginMsg("");

  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (email === DEV_ADMIN_EMAIL && password === DEV_ADMIN_PASSWORD) {
    setLoggedIn(true);
    setLoginMsg("");

    try {
      await loadEvents();
      await loadTasks();
      await loadDetails();
    } catch (err) {
      showError(err);
    }
  } else {
    setLoggedIn(false);
    setLoginMsg("Forkert email eller kode.", "err");
  }
});

logoutBtn?.addEventListener("click", () => {
  setLoggedIn(false);
  loginForm.reset();
  selectedEvent = null;
  selectedTask = null;
  eventsEl.innerHTML = "";
  tasksEl.innerHTML = "";
  detailsEl.innerHTML = "";
});

/* ---------------- Init ---------------- */
(async function init() {
  try {
    const ok = await requireAdminOrRedirect();
    if (!ok) return;

    document.body.classList.add("admin-ok");

    await loadEvents();
    await loadTasks();
    await loadDetails();
  } catch (err) {
    showError(err);
  }
})();

document.getElementById("closePrint").onclick = () => {
  document.getElementById("printModal").classList.add("hidden");
};

document.getElementById("printBtn").onclick = () => {
  window.print();
};
