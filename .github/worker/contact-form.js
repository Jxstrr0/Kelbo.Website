// Contact form Worker: takes a message from the site's contact form
// (contact.html, "Say hello" in every footer) and emails it to Kelbo with
// Cloudflare Email Routing. No outside form service.
//
// This copy is the reference. The live one is the contact-form Worker in
// Cloudflare (Workers & Pages > contact-form), served at
// https://contact.longlight.games/; keep the two the same.
//
// Kelbo's email address is NOT in this file or anywhere in the repo. It lives
// only in the Worker's settings in Cloudflare: the TO variable, and the EMAIL
// binding, which is locked so it can only ever send to that one address.
//
// Spam protection: Cloudflare Turnstile (the free "I'm human" check on the
// form; its secret is the TURNSTILE_SECRET setting, never in the repo), a
// hidden "botcheck" box that people never see (bots tick it and get a fake
// "sent"), messages only from the site's own pages, length limits, a size
// limit on the whole upload, a cap on how many messages can be sent in one
// day, and a Cloudflare rate-limit rule on contact.longlight.games. Sending
// to your own verified address is free.
//
// The daily cap needs one extra setting: the SendCounter class at the bottom
// of this file, bound to this Worker as SENDS (a Durable Object: a tiny
// worker with its own storage; free). Without it the form still works, just
// with no daily cap.
//
// Logs: Workers Logs are on for this Worker (Cloudflare > contact-form >
// Logs). Each refusal logs a short reason, never the name, email or message.

import { DurableObject } from "cloudflare:workers";

const SITES = ["https://longlight.games"];
const LIMITS = { name: 100, email: 200, message: 5000 };
// The biggest upload the Worker will read. A full-length message in any
// language fits: 5,000 Chinese or Japanese characters come to about 45 KB in
// the worst case (a form sent without JavaScript spells each one out as nine
// characters). 64 KB leaves room and still stops someone posting megabytes.
const MAX_BODY_BYTES = 64 * 1024;
// The most messages the form will email in one day (UTC). Turnstile and the
// rate-limit rule stop ordinary bots; this limits the damage if someone gets
// past both, so the inbox can't be flooded.
const DAILY_CAP = 50;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = SITES.includes(origin);
    const cors = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const wantsJson = (request.headers.get("Accept") || "").includes("application/json");

    // Answer in the form main.js expects, or as a small page when the form
    // was posted without JavaScript. `text` is always one of the fixed
    // sentences in this file, never anything the visitor typed.
    function reply(ok, text, status) {
      if (wantsJson) {
        return Response.json({ success: ok, message: text }, { status, headers: cors });
      }
      const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "Message sent" : "Not sent"} · Longlight Interactive</title>
<body style="font:18px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px">
<p>${text}</p><p><a href="https://longlight.games/">Back to Longlight Interactive</a></p>`;
      return new Response(page, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    // A refusal worth seeing in the logs: note why (never what was sent), then answer.
    function refuse(why, text, status) {
      console.warn("Refused:", why);
      return reply(false, text, status);
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Accept" } });
    // Someone opening the bare address in a browser is sent to the contact page.
    if (request.method === "GET" || request.method === "HEAD") return Response.redirect("https://longlight.games/contact.html", 302);
    // Any other method that isn't a form post gets a plain 404.
    if (request.method !== "POST") return new Response("Not found", { status: 404 });
    if (!allowed) return refuse("wrong origin", "Please send your message from longlight.games.", 403);

    // Too big to be a real message: refuse before reading any of it.
    if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
      return refuse("too big (stated size)", "That message is too long.", 413);
    }

    let form;
    try {
      // The size above is only what the sender claims, so the upload is also
      // counted as it arrives and dropped the moment it goes over.
      const body = await readUpTo(request, MAX_BODY_BYTES);
      if (!body) return refuse("too big (counted)", "That message is too long.", 413);
      form = await new Response(body, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
    } catch { return refuse("unreadable", "That message couldn't be read.", 400); }
    const field = (k) => String(form.get(k) || "").trim();
    const name = tidy(field("name")), email = field("email");
    // The message keeps its line breaks and tabs; other invisible characters go.
    const message = field("message").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "");

    // A bot filled in the hidden box: say "sent" so it moves on, send nothing.
    if (form.get("botcheck")) return reply(true, "Sent. Thanks for reaching out!", 200);

    // Turnstile: ask Cloudflare whether this visitor passed the check. A
    // script can fake the Origin header, but it can't fake a pass.
    if (!(await passedCheck(form.get("cf-turnstile-response"), request, env))) {
      return refuse("turnstile", "Please tick the “I'm human” check above Send, then try again.", 403);
    }

    if (!name || !message) return reply(false, "Please fill in your name and a message.", 400);
    if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) {
      return refuse("field too long", "That message is too long.", 400);
    }
    // One address, made of letters and digits (in any alphabet) and the few
    // marks real addresses use. Commas, semicolons, brackets and quotes are
    // refused, so the "reply to" line can only ever hold one plain address.
    const emailOk = /^[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+$/u.test(email) && tidy(email) === email;
    if (email && !emailOk) return reply(false, "That email address doesn't look right.", 400);

    if (!(await underDailyCap(env))) {
      return refuse("daily cap", "The form has had a lot of messages today. Please try again tomorrow.", 429);
    }

    try {
      await env.EMAIL.send({
        from: { email: "form@longlight.games", name: "Longlight contact form" },
        to: env.TO,
        ...(emailOk ? { replyTo: { email, name } } : {}),
        subject: `New message from ${name} (longlight.games)`,
        // The sender's details go first, above the marker, so nothing typed
        // into the message can pass itself off as them.
        text: `From: ${name}\nEmail: ${email || "(none left)"}\nSent from the contact form on longlight.games\n\n----- Message -----\n${message}`,
      });
    } catch (err) {
      console.error("Send failed:", err && err.message);
      return reply(false, "That didn't send. Please try again in a minute.", 502);
    }
    return reply(true, "Sent. Thanks for reaching out!", 200);
  },
};

// Makes a short field safe for an email's subject and "reply to" lines: swaps
// out characters nobody can see but that can cause mischief (line breaks and
// other control characters, the marks that make text display backwards, and
// zero-width characters that can hide inside a name to disguise it).
// The two joiners real writing needs are kept: \u200c and \u200d
// (Persian and Indian scripts, and family emoji).
function tidy(s) {
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b\u200e\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff]+/g, " ").trim();
}

// Reads the upload piece by piece and gives up (returns null) as soon as it
// passes `max` bytes, so an oversized post is never held in memory.
async function readUpTo(request, max) {
  if (!request.body) return new Blob([]);
  const reader = request.body.getReader();
  const pieces = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    pieces.push(value);
  }
  return new Blob(pieces);
}

// True while today's count of sent messages is under DAILY_CAP, and adds one
// to the count. The counting is done by SendCounter (below), so it stays
// exact even when messages arrive at the same moment. If SENDS isn't set up
// or can't be reached, the message is let through: Turnstile is still the
// main guard, and a storage hiccup shouldn't break the form.
async function underDailyCap(env) {
  if (!env.SENDS) return true;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const counter = env.SENDS.get(env.SENDS.idFromName("contact-form"));
    return await counter.take(day, DAILY_CAP);
  } catch (err) {
    console.error("Daily cap check failed:", err && err.message);
    return true;
  }
}

// Keeps the day's count of sent messages (UTC day). A Durable Object deals
// with one call at a time and has its own storage, so two messages arriving
// together can never both read the same count. (The earlier KV counter could:
// ten messages sent at once were counted as one.)
export class SendCounter extends DurableObject {
  // Takes one of the day's slots. True if there was one left, false at the
  // cap. Other calls wait while this one reads and writes the count.
  async take(day, cap) {
    let today = await this.ctx.storage.get("today");
    if (!today || today.day !== day) today = { day, count: 0 };
    if (today.count >= cap) return false;
    today.count += 1;
    await this.ctx.storage.put("today", today);
    return true;
  }
}

// True when Cloudflare confirms the Turnstile pass is real, fresh and for
// this site. No secret set, or Cloudflare unreachable: refuse (fail closed).
async function passedCheck(token, request, env) {
  if (!token || !env.TURNSTILE_SECRET) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", String(token));
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const out = await res.json();
    return out.success === true && out.hostname === "longlight.games";
  } catch {
    return false;
  }
}
