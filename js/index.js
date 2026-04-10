import { listEvents, getPublicImageUrl } from "./api.js";

const eventsEl = document.getElementById("events");
const countdownTitle = document.getElementById("countdownTitle");
const countdownSub = document.getElementById("countdownSub");

/* ---------- Helpers ---------- */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
}

function safe(s) {
  return (s ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function excerpt(text, max = 160) {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

function placeholderImg() {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b2340"/>
          <stop offset="1" stop-color="#123b66"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        fill="rgba(255,255,255,.75)" font-family="Arial" font-size="56" font-weight="700">
        Intet billede
      </text>
    </svg>
  `)
  );
}

function parseEventDateLocal(dateStr) {
  // dateStr: YYYY-MM-DD -> local midnight
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/* ---------- Count-up “dage til næste event” ---------- */

const todayMessages = ["Wup Wup! Det sker i dag! 🎉", "Opvisningsdag day baby! 🚀", "Let’s gooo – det er i dag! ⚡", "I dag går det ned! 😎", "Dagen er kommet – vi ses derude! ✨"];

function getRandomTodayMessage() {
  return todayMessages[Math.floor(Math.random() * todayMessages.length)];
}

function launchConfetti() {
  const existing = document.querySelector(".confetti-layer");
  if (existing) existing.remove();

  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);

  const colors = ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#8338ec", "#ff9f1c"];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
    piece.style.opacity = `${0.7 + Math.random() * 0.3}`;
    piece.style.width = `${6 + Math.random() * 6}px`;
    piece.style.height = `${10 + Math.random() * 8}px`;
    layer.appendChild(piece);
  }

  setTimeout(() => {
    layer.remove();
  }, 5000);
}

function ensureConfettiStyles() {
  if (document.getElementById("confetti-styles")) return;

  const style = document.createElement("style");
  style.id = "confetti-styles";
  style.textContent = `
      .confetti-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 9999;
      }
  
      .confetti-piece {
        position: absolute;
        top: -20px;
        border-radius: 2px;
        animation-name: confettiFall;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
        will-change: transform, opacity;
      }
  
      @keyframes confettiFall {
        0% {
          transform: translateY(-20px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(110vh) rotate(720deg);
          opacity: 0;
        }
      }
    `;
  document.head.appendChild(style);
}

function animateCountUpDays(targetDays, labelText = "dage til næste event") {
  if (!countdownTitle) return;

  ensureConfettiStyles();

  // Edge cases
  if (!Number.isFinite(targetDays) || targetDays < 0) {
    countdownTitle.textContent = "Ingen kommende events";
    return;
  }

  // If 0 days, show instantly
  if (targetDays === 0) {
    countdownTitle.textContent = getRandomTodayMessage();
    launchConfetti();
    return;
  }

  const durationMs = Math.min(1200, 300 + targetDays * 40);
  const start = 0;
  const end = targetDays;

  const t0 = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function format(value) {
    if (value === 1) return "1 dag til næste event";
    return `${value} ${labelText}`;
  }

  function frame(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = easeOutCubic(t);
    const value = Math.max(start, Math.min(end, Math.round(start + (end - start) * eased)));

    countdownTitle.textContent = format(value);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      countdownTitle.textContent = format(end);
    }
  }

  requestAnimationFrame(frame);
}

function startDaysToNextEvent(events) {
  if (!countdownTitle) return;

  ensureConfettiStyles();

  function computeTarget() {
    const now = new Date();

    // Ignorér klokkeslæt → hele dagen tæller som "i dag"
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcoming = (events || [])
      .filter((e) => e.date)
      .map((e) => {
        const d = parseEventDateLocal(e.date);
        const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return { ...e, _dateObj: dMidnight };
      })
      .filter((e) => e._dateObj.getTime() >= today.getTime())
      .sort((a, b) => a._dateObj - b._dateObj)[0];

    if (!upcoming) {
      countdownTitle.textContent = "Ingen kommende events";
      if (countdownSub) countdownSub.textContent = "";
      return null;
    }

    const diffMs = upcoming._dateObj.getTime() - today.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (countdownSub) {
      countdownSub.textContent = upcoming.title ? `Næste event: ${upcoming.title}` : "";
    }

    return { days, upcoming };
  }

  // First render
  const first = computeTarget();
  if (first) animateCountUpDays(first.days);

  let lastDays = first?.days ?? null;

  setInterval(() => {
    const res = computeTarget();
    if (!res) return;

    if (lastDays === null || res.days !== lastDays) {
      lastDays = res.days;
      animateCountUpDays(res.days);
    } else {
      if (res.days === 0) {
        countdownTitle.textContent = getRandomTodayMessage();
      } else if (res.days === 1) {
        countdownTitle.textContent = "1 dag til næste event";
      } else {
        countdownTitle.textContent = `${res.days} dage til næste event`;
      }
    }
  }, 1000 * 60 * 60);
}

/* ---------- Main ---------- */
async function main() {
  const events = await listEvents();

  // Start the animated “days to next event”
  startDaysToNextEvent(events);

  if (!events.length) {
    eventsEl.innerHTML = `<div class="muted">Ingen events endnu.</div>`;
    return;
  }

  eventsEl.innerHTML = events
    .map((ev) => {
      const dateText = formatDate(ev.date);
      const img = getPublicImageUrl(ev.image_path) || placeholderImg();

      return `
        <article class="event-card">
          <div class="event-media">
            <img src="${img}" alt="${safe(ev.title)}" loading="lazy" />
          </div>

          <div class="event-body">
            <div class="event-date">${safe(dateText)}</div>
            <h2 class="event-title">${safe(ev.title)}</h2>
            <div class="event-location">${safe(ev.location || "")}</div>
            <div class="event-desc">
              ${safe(ev.short_description?.trim() ? ev.short_description : excerpt(ev.description, 170))}
            </div>

            <div class="event-actions">
              <a class="event-btn" href="./event.html?slug=${encodeURIComponent(ev.slug)}">Læs Mere</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

main().catch((err) => {
  console.error(err);
  eventsEl.innerHTML = `<div class="muted">Fejl ved indlæsning af events.</div>`;
});
