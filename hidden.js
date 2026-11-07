// =====================================================================
// HIDDEN PAGE (hidden.html)
// ---------------------------------------------------------------------
// A password-locked page on a public site. How it stays private:
//
// - What's inside lives in hidden.json, scrambled (encrypted) with
//   AES-GCM, using a key made from the password with PBKDF2 (600,000
//   rounds of SHA-256, so every guess is slow). Without the password the
//   file is gibberish, so it's safe in the public repo.
// - The password itself is never stored anywhere: not in the repo, not
//   on the phone. Typing it rebuilds the key; a wrong one simply fails.
// - Anyone can download the scrambled file and guess offline, so the
//   password must be long (four random words is good). There's one
//   shared password: to shut someone out, lock it again with a new one.
//
// The writer (Change what's inside, or the empty state) scrambles new
// content in the browser and hands back a new hidden.json to paste into
// GitHub. Nothing typed on this page is ever sent anywhere.
//
// The unlocked text is shown as plain text nodes (never as HTML), with a
// few simple rules: blank line = new paragraph, "# " / "## " = heading,
// "- " = list item, https:// links become links.
// =====================================================================
(function () {
  "use strict";

  const ROUNDS = 600000;       // PBKDF2 rounds; stored in the file so it can change later
  const MIN_PASS = 12;         // shortest password the writer accepts
  const $ = (sel) => document.querySelector(sel);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const box = {
    wait: $("[data-hidden-wait]"),
    unlock: $("[data-hidden-unlock]"),
    pass: $("#hidden-pass"),
    status: $("[data-hidden-status]"),
    content: $("[data-hidden-content]"),
    actions: $("[data-hidden-actions]"),
    writer: $("[data-hidden-writer]"),
    empty: $("[data-hidden-empty]"),
    title: $("#hidden-title"),
    body: $("#hidden-body"),
    newPass: $("#hidden-new"),
    again: $("#hidden-again"),
    wstatus: $("[data-hidden-wstatus]"),
    out: $("[data-hidden-out]"),
    json: $("[data-hidden-json]"),
  };
  if (!box.unlock) return;

  let locked = null;   // the scrambled entry from hidden.json
  let opened = null;   // {title, body} once unlocked

  // Only one panel shows at a time.
  function show(...names) {
    for (const k of ["wait", "unlock", "content", "actions", "writer", "out"]) box[k].hidden = !names.includes(k);
  }

  // ----- Base64 for the bytes in hidden.json -----
  const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  // ----- The key: password + salt, stretched by PBKDF2 -----
  async function keyFrom(password, salt, rounds) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }

  async function lock(content, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFrom(password, salt, ROUNDS);
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(content))));
    return { v: 1, rounds: ROUNDS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
  }

  // Returns {title, body}, or throws if the password is wrong.
  async function unlock(entry, password) {
    const key = await keyFrom(password, fromB64(entry.salt), entry.rounds);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(entry.iv) }, key, fromB64(entry.data));
    return JSON.parse(dec.decode(plain));
  }

  // ----- Showing the unlocked text, safely, as text nodes -----
  function addText(parent, text) {
    // Split out https:// links so they can be tapped.
    const parts = text.split(/(https:\/\/[^\s<>"]+)/g);
    parts.forEach((part, i) => {
      if (!part) return;
      if (i % 2) {
        const a = document.createElement("a");
        a.href = part.replace(/[.,;:!?)]+$/, "");
        a.textContent = part;
        a.rel = "noopener noreferrer";
        parent.append(a);
      } else parent.append(document.createTextNode(part));
    });
  }

  // The page head (eyebrow, big heading, line) changes once unlocked.
  const head = {
    eyebrow: $(".page-head .eyebrow"),
    h1: $(".page-head h1"),
    line: $(".page-head .page-head__line"),
  };
  const shut = { eyebrow: head.eyebrow.textContent, h1: head.h1.textContent, line: head.line.textContent };
  function setHead(eyebrow, h1, line) {
    head.eyebrow.textContent = eyebrow;
    head.h1.textContent = h1;
    head.line.textContent = line;
  }

  function render(content) {
    const art = box.content;
    art.replaceChildren();
    setHead("Unlocked", content.title || "Hidden", "Only for people with the password.");
    for (const block of String(content.body || "").split(/\n\s*\n/)) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      if (lines.every((l) => l.startsWith("- "))) {
        const ul = document.createElement("ul");
        for (const l of lines) { const li = document.createElement("li"); addText(li, l.slice(2)); ul.append(li); }
        art.append(ul);
      } else if (lines.length === 1 && /^#{1,2} /.test(lines[0])) {
        const head = document.createElement(lines[0].startsWith("## ") ? "h3" : "h2");
        head.textContent = lines[0].replace(/^#{1,2} /, "");
        art.append(head);
      } else {
        const p = document.createElement("p");
        lines.forEach((l, i) => { if (i) p.append(document.createElement("br")); addText(p, l); });
        art.append(p);
      }
    }
  }

  // ----- The lock form -----
  box.unlock.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = box.unlock.querySelector("button");
    button.disabled = true;
    box.status.className = "contact-form__status";
    box.status.textContent = "Checking…";
    try {
      opened = await unlock(locked, box.pass.value);
      box.pass.value = "";
      box.status.textContent = "";
      render(opened);
      show("content", "actions");
      box.content.focus();
    } catch (err) {
      box.status.className = "contact-form__status is-error";
      box.status.textContent = "That's not it.";
      box.pass.select();
    }
    button.disabled = false;
  });

  $("[data-hidden-lockup]").addEventListener("click", () => {
    opened = null;
    box.content.replaceChildren();
    setHead(shut.eyebrow, shut.h1, shut.line);
    show("unlock");
    box.pass.focus();
  });

  $("[data-hidden-edit]").addEventListener("click", () => openWriter(opened));

  // ----- The writer -----
  function openWriter(content) {
    box.empty.hidden = !!content;
    box.title.value = content ? content.title || "" : "";
    box.body.value = content ? content.body || "" : "";
    box.newPass.value = box.again.value = "";
    box.wstatus.textContent = "";
    show("writer");
    box.title.focus();
  }

  box.writer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const say = (msg, bad) => { box.wstatus.className = "contact-form__status" + (bad ? " is-error" : ""); box.wstatus.textContent = msg; };
    if (box.newPass.value.length < MIN_PASS) return say(`The password needs at least ${MIN_PASS} characters.`, true);
    if (box.newPass.value !== box.again.value) return say("The two passwords don't match.", true);
    say("Locking…");
    const content = { title: box.title.value.trim(), body: box.body.value };
    const entry = await lock(content, box.newPass.value);
    box.newPass.value = box.again.value = "";
    box.json.value = JSON.stringify({ locked: entry }, null, 2) + "\n";
    say("");
    show("out");
  });

  $("[data-hidden-copy]").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    try {
      await navigator.clipboard.writeText(box.json.value);
    } catch (err) {
      box.json.select();   // older phones: select it so a long-press copies
      document.execCommand?.("copy");
    }
    b.textContent = "Copied";
    setTimeout(() => (b.textContent = "Copy"), 2000);
  });

  // ----- Start: read hidden.json -----
  async function start() {
    if (!window.crypto || !crypto.subtle) {
      box.wait.textContent = "This browser can't open the lock (it needs a secure https page).";
      return;
    }
    try {
      const res = await fetch("hidden.json", { cache: "no-cache" });
      locked = (await res.json()).locked;
    } catch (err) {
      box.wait.textContent = "Couldn't load the lock. Check the connection and try again.";
      return;
    }
    if (locked && locked.data) { show("unlock"); }
    else openWriter(null);
  }
  start();
})();
