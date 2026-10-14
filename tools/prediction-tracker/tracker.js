/* ==========================================================================
   tracker.js — the Prediction Tracker.
   --------------------------------------------------------------------------
   Everything runs in the visitor's own browser. Calls are saved with
   localStorage, which keeps them on this device only. Nothing is sent
   anywhere, so there's no server and no API key.

   Each saved call looks like this:
     {
       id:         a random ID so we can find it again
       text:       "The Riders make the playoffs this year"
       confidence: 50 to 99 (how sure, in %)
       category:   "Sports" or "" for none
       dueDate:    "2026-11-01" or "" for none
       createdAt:  when it was logged
       outcome:    null = still waiting, true = right, false = wrong
       resolvedAt: when it was graded, or ""
     }
   ========================================================================== */

// Where the calls are saved in the browser. Changing this would make
// the page "forget" everything already saved, so leave it alone.
const STORAGE_KEY = "kelbo.prediction-tracker.v1";

// Confidence groups for the calibration part of the scorecard.
const BUCKETS = [
  { label: "50–59%", min: 50, max: 59 },
  { label: "60–69%", min: 60, max: 69 },
  { label: "70–79%", min: 70, max: 79 },
  { label: "80–89%", min: 80, max: 89 },
  { label: "90–99%", min: 90, max: 99 },
];

// A group needs this many graded calls before we judge it.
const MIN_CALLS_FOR_VERDICT = 5;

// How many percentage points "how often right" can be away from
// "how sure" and still count as on target.
const ON_TARGET_RANGE = 10;

let calls = [];

/* ---------- Small helpers ---------- */

// Make an element with a class and optional text. textContent (not
// innerHTML) means whatever someone types is always shown as plain
// text, never run as code.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Today as "YYYY-MM-DD" in the visitor's own time zone.
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-11-01" -> "Nov 1, 2026" (in the visitor's own date style).
function formatDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function percent(n) {
  return Math.round(n * 100) + "%";
}

// Announce a short message to screen readers.
function announce(message) {
  const status = document.querySelector("[data-status]");
  if (!status) return;
  status.textContent = "";
  // Small delay so the same message twice in a row is still read out.
  setTimeout(() => (status.textContent = message), 50);
}

/* ---------- Saving and loading ---------- */

// Check one saved or imported call and fix it up. Returns null if it's
// missing the basics (text and a confidence number).
function cleanCall(item) {
  if (!item || typeof item !== "object") return null;
  const text = String(item.text || "").trim().slice(0, 280);
  const confidence = Math.round(Number(item.confidence));
  if (!text || !Number.isFinite(confidence)) return null;

  const isDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
  const outcome = item.outcome === true || item.outcome === false ? item.outcome : null;

  return {
    id: typeof item.id === "string" && item.id ? item.id : makeId(),
    text,
    confidence: Math.min(99, Math.max(50, confidence)),
    category: String(item.category || "").trim().slice(0, 40),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ? item.dueDate : "",
    createdAt: isDate(item.createdAt) ? item.createdAt : new Date().toISOString(),
    outcome,
    resolvedAt: outcome !== null && isDate(item.resolvedAt) ? item.resolvedAt : "",
  };
}

function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    showStorageWarning();
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(cleanCall).filter(Boolean) : [];
  } catch (err) {
    // The saved data is damaged. Keep a copy instead of overwriting it,
    // so it could still be recovered by hand.
    console.error("Saved predictions couldn't be read:", err);
    try {
      localStorage.setItem(STORAGE_KEY + ".damaged", raw);
    } catch (e) {
      /* nothing more we can do */
    }
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  } catch (err) {
    showStorageWarning();
  }
}

function showStorageWarning() {
  const warning = document.querySelector("[data-storage-warning]");
  if (warning) warning.hidden = false;
}

/* ---------- Showing the calls ---------- */

// Build the list item for one call.
function renderCall(call) {
  const item = el("li", "call");
  item.append(el("p", "call__text", call.text));

  const meta = el("p", "call__meta");
  meta.append(el("span", "call__conf", call.confidence + "% sure"));
  if (call.category) meta.append(el("span", null, call.category));

  if (call.outcome === null) {
    if (call.dueDate) {
      const overdue = call.dueDate <= todayString();
      meta.append(el("span", null, "Find out by " + formatDay(call.dueDate)));
      if (overdue) meta.append(el("span", "call__due", "Ready to grade"));
    }
  } else {
    const result = el(
      "span",
      "call__result " + (call.outcome ? "call__result--right" : "call__result--wrong"),
      call.outcome ? "Right" : "Wrong"
    );
    meta.prepend(result);
  }
  item.append(meta);

  // Buttons. data-action and data-id tell the click handler what to do.
  const actions = el("div", "call__actions");
  const button = (label, action, className, spokenLabel) => {
    const btn = el("button", "btn " + (className || ""), label);
    btn.type = "button";
    btn.dataset.action = action;
    btn.dataset.id = call.id;
    // Say which call the button is for, since every row has the same buttons.
    btn.setAttribute("aria-label", spokenLabel + ": " + call.text);
    return btn;
  };

  if (call.outcome === null) {
    actions.append(
      button("Right", "right", "btn--right", "Mark right"),
      button("Wrong", "wrong", "btn--wrong", "Mark wrong")
    );
  } else {
    actions.append(button("Undo grade", "undo", "", "Undo grade"));
  }
  actions.append(button("Delete", "delete", "btn--quiet", "Delete"));
  item.append(actions);

  return item;
}

function renderLists() {
  // Waiting on: soonest "find out by" date first, calls with no date
  // last, newest first within those.
  const open = calls
    .filter((c) => c.outcome === null)
    .sort(
      (a, b) =>
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        b.createdAt.localeCompare(a.createdAt)
    );
  // Graded: most recently graded first.
  const done = calls
    .filter((c) => c.outcome !== null)
    .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));

  fillList("[data-open-list]", open, "Nothing waiting. Make a call above.");
  fillList("[data-done-list]", done, "No graded calls yet.");
  document.querySelector("[data-open-count]").textContent = open.length ? `(${open.length})` : "";
  document.querySelector("[data-done-count]").textContent = done.length ? `(${done.length})` : "";
}

function fillList(selector, list, emptyMessage) {
  const listEl = document.querySelector(selector);
  listEl.replaceChildren();
  if (list.length === 0) {
    listEl.append(el("li", "call-list__note", emptyMessage));
    return;
  }
  list.forEach((c) => listEl.append(renderCall(c)));
}

/* ---------- Scorecard ---------- */

function renderScorecard() {
  const graded = calls.filter((c) => c.outcome !== null);
  const right = graded.filter((c) => c.outcome).length;

  // Brier score: the average of (confidence - result)^2, where result is
  // 1 if the call was right and 0 if wrong. Lower is better.
  const brier =
    graded.reduce((sum, c) => sum + (c.confidence / 100 - (c.outcome ? 1 : 0)) ** 2, 0) /
    (graded.length || 1);

  const stats = [
    ["Calls made", String(calls.length)],
    ["Graded", String(graded.length)],
    ["Right", graded.length ? percent(right / graded.length) : "–"],
    ["Brier score", graded.length ? brier.toFixed(2) : "–"],
  ];
  const statsEl = document.querySelector("[data-stats]");
  statsEl.replaceChildren();
  stats.forEach(([label, value]) => {
    const group = el("div");
    group.append(el("dt", null, label), el("dd", null, value));
    statsEl.append(group);
  });
  document.querySelector("[data-brier-hint]").hidden = graded.length === 0;

  // Calibration: one row per confidence group that has graded calls.
  const calEl = document.querySelector("[data-calibration]");
  calEl.replaceChildren();

  BUCKETS.forEach((bucket) => {
    const inBucket = graded.filter((c) => c.confidence >= bucket.min && c.confidence <= bucket.max);
    if (inBucket.length === 0) return;

    const n = inBucket.length;
    const rightCount = inBucket.filter((c) => c.outcome).length;
    const avgSure = inBucket.reduce((sum, c) => sum + c.confidence, 0) / n;
    const hitRate = (rightCount / n) * 100;

    let verdict;
    if (n < MIN_CALLS_FOR_VERDICT) verdict = `Need ${MIN_CALLS_FOR_VERDICT} calls to judge`;
    else if (hitRate < avgSure - ON_TARGET_RANGE) verdict = "Overconfident";
    else if (hitRate > avgSure + ON_TARGET_RANGE) verdict = "Underconfident";
    else verdict = "On target";

    const row = el("li");
    const head = el("p", "calibration__head");
    head.append(
      el("span", "calibration__label", bucket.label + " sure"),
      el("span", "calibration__verdict", verdict)
    );
    const noun = n === 1 ? "call" : "calls";
    const detail = el(
      "p",
      "calibration__detail",
      `${n} ${noun}, ${rightCount} right (${Math.round(hitRate)}%). You said ${Math.round(avgSure)}% on average.`
    );

    // The little field: yellow line at how sure, ball at how often right.
    // Decoration only, since the sentence above says the same thing.
    const field = el("div", "field field--score");
    field.setAttribute("aria-hidden", "true");
    field.style.setProperty("--progress", hitRate);
    field.style.setProperty("--line", avgSure);
    field.append(el("span", "field__line"), el("span", "field__ball"));

    row.append(head, detail, field);
    calEl.append(row);
  });

  if (!calEl.children.length) {
    calEl.append(el("li", "call-list__note", "Grade a few calls and this fills in."));
  }
}

function render() {
  renderLists();
  renderScorecard();
}

/* ---------- Actions ---------- */

function addCall(form) {
  const data = new FormData(form);
  const call = cleanCall({
    id: makeId(),
    text: data.get("text"),
    confidence: data.get("confidence"),
    category: data.get("category"),
    dueDate: data.get("dueDate"),
    createdAt: new Date().toISOString(),
    outcome: null,
  });
  if (!call) return;

  calls.push(call);
  save();
  render();
  form.reset();
  updateConfidenceOutput();
  form.querySelector("textarea").focus();
  announce(`Logged at ${call.confidence}% sure.`);
}

function handleCallButton(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const call = calls.find((c) => c.id === btn.dataset.id);
  if (!call) return;

  const action = btn.dataset.action;
  if (action === "delete") {
    if (!window.confirm(`Delete this call?\n\n"${call.text}"\n\nThis can't be undone.`)) return;
    calls = calls.filter((c) => c.id !== call.id);
  } else if (action === "right" || action === "wrong") {
    call.outcome = action === "right";
    call.resolvedAt = new Date().toISOString();
  } else if (action === "undo") {
    call.outcome = null;
    call.resolvedAt = "";
  }

  save();
  render();

  // The button that was clicked is gone now, so move keyboard focus to
  // the heading of the list it was in.
  const listHeading = btn.closest("[data-done-list]") ? "#done-heading" : "#open-heading";
  document.querySelector(listHeading).focus();

  const messages = {
    delete: "Call deleted.",
    right: "Marked right.",
    wrong: "Marked wrong.",
    undo: "Moved back to waiting.",
  };
  announce(messages[action]);
}

function exportBackup() {
  const backup = {
    app: "prediction-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    calls,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a");
  link.href = url;
  link.download = `predictions-${todayString()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`Exported ${calls.length} calls.`);
}

async function importBackup(file) {
  let incoming;
  try {
    const parsed = JSON.parse(await file.text());
    // Accept a backup from Export, or a plain list of calls.
    incoming = Array.isArray(parsed) ? parsed : parsed && parsed.calls;
    if (!Array.isArray(incoming)) throw new Error("No list of calls in the file");
  } catch (err) {
    console.error("Import failed:", err);
    window.alert("That file doesn't look like a Prediction Tracker backup.");
    return;
  }

  // Add only the calls that aren't already here (matched by ID).
  const have = new Set(calls.map((c) => c.id));
  let added = 0;
  let skipped = 0;
  incoming.forEach((item) => {
    const call = cleanCall(item);
    if (!call || have.has(call.id)) {
      skipped++;
      return;
    }
    calls.push(call);
    have.add(call.id);
    added++;
  });

  save();
  render();
  const message =
    `Added ${added} ${added === 1 ? "call" : "calls"}` +
    (skipped ? `, skipped ${skipped} already here or unreadable.` : ".");
  window.alert(message);
  announce(message);
}

/* ---------- Start here ---------- */

function updateConfidenceOutput() {
  const range = document.querySelector("#call-confidence");
  document.querySelector("[data-confidence-output]").textContent = range.value + "%";
}

function init() {
  document.querySelectorAll("[data-year]").forEach((n) => {
    n.textContent = new Date().getFullYear();
  });

  calls = load();
  render();

  const form = document.querySelector("[data-form]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addCall(form);
  });
  document.querySelector("#call-confidence").addEventListener("input", updateConfidenceOutput);

  document.querySelector("[data-open-list]").addEventListener("click", handleCallButton);
  document.querySelector("[data-done-list]").addEventListener("click", handleCallButton);

  const fileInput = document.querySelector("[data-import-file]");
  document.querySelector("[data-export]").addEventListener("click", exportBackup);
  document.querySelector("[data-import]").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) importBackup(fileInput.files[0]);
    fileInput.value = ""; // so the same file can be picked again
  });
}

init();
