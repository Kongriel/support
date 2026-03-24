import { getEventBySlug, listTasksWithCountsForEvent, getPublicImageUrl } from "./api.js";

const stateEl = document.getElementById("state");
const headerEl = document.getElementById("eventHeader");
const imgEl = document.getElementById("eventImg");
const titleEl = document.getElementById("eventTitle");
const metaEl = document.getElementById("eventMeta");
const descEl = document.getElementById("eventDesc");
const tasksEl = document.getElementById("tasks");

function safe(s) {
  return (s ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function excerpt(text, max = 160) {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(dateStr) {
  if (!dateStr) return "Dato ikke sat";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("da-DK", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function placeholderSvg(title = "Event") {
  const safeTitle = (title || "Event").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#66b2ff" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#7cdbb9" stop-opacity="0.25"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50" y="110" fill="#e7eefc" opacity="0.95"
      font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="54" font-weight="800">${safeTitle}</text>
    <text x="50" y="170" fill="#e7eefc" opacity="0.72"
      font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="26">Opgaver og tilmelding</text>
  </svg>`;

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function taskCardHtml(task) {
  const desc = task.short_description?.trim() ? task.short_description : excerpt(task.description, 160);

  const reg = task.registered_total ?? 0;
  const cap = task.capacity_total ?? 0;
  const available = task.available ?? Math.max(0, cap - reg);
  const isFull = available <= 0;

  return `
      <article class="task-card ${isFull ? "task-card-full" : ""}">
        <div class="task-top">
          <h4 class="task-title">${safe(task.title)}</h4>
  
          <div style="display:flex; gap:8px; align-items:center;">
            <div class="pill">${reg}/${cap}</div>
            ${isFull ? `<span class="pill">Fyldt</span>` : ""}
          </div>
        </div>
  
        <p class="task-desc">
          ${safe(desc)}
        </p>
  
        <div class="task-actions">
          <a class="event-btn" href="./task.html?slug=${encodeURIComponent(task.slug)}">
            Tilmeld / Læs mere
          </a>
        </div>
      </article>
    `;
}

async function init() {
  const slug = getQueryParam("slug");
  if (!slug) {
    stateEl.textContent = "Mangler ?slug= i URL’en.";
    return;
  }

  try {
    stateEl.textContent = "Henter event...";
    const ev = await getEventBySlug(slug);

    document.title = ev.title ? `${ev.title} – Event` : "Event";

    const imageUrl = getPublicImageUrl(ev.image_path) || placeholderSvg(ev.title);
    imgEl.src = imageUrl;
    imgEl.alt = ev.title ?? "Event billede";

    titleEl.textContent = ev.title ?? "Uden titel";
    descEl.textContent = ev.description ?? "";

    const parts = [];
    parts.push(`📅 ${formatDate(ev.date)}`);
    if (ev.location) parts.push(`📍 ${ev.location}`);
    metaEl.innerHTML = parts.map((p) => `<span>${p}</span>`).join("");

    headerEl.hidden = false;

    stateEl.textContent = "Henter opgaver...";
    const tasks = await listTasksWithCountsForEvent(ev.id);

    if (!tasks.length) {
      stateEl.textContent = "Ingen opgaver endnu.";
      tasksEl.innerHTML = "";
      return;
    }

    const sortedTasks = [...tasks].sort((a, b) => {
      const aAvailable = a.available ?? (a.capacity_total ?? 0) - (a.registered_total ?? 0);
      const bAvailable = b.available ?? (b.capacity_total ?? 0) - (b.registered_total ?? 0);

      const aFull = aAvailable <= 0;
      const bFull = bAvailable <= 0;

      if (aFull === bFull) return 0;
      return aFull ? 1 : -1; // fyldte nederst
    });

    tasksEl.innerHTML = sortedTasks.map(taskCardHtml).join("");
    stateEl.textContent = "";
  } catch (err) {
    console.error(err);
    stateEl.textContent = "Kunne ikke hente event/opgaver. Tjek console (F12) for fejl.";
  }
}

init();

