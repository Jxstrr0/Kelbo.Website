// Contact form Worker: takes a message from the home page's contact form and
// emails it to Kelbo with Cloudflare Email Routing. No outside form service.
//
// This copy is the reference. The live one is the contact-form Worker in
// Cloudflare (Workers & Pages > contact-form), served at
// https://contact.longlight.games/; keep the two the same.
//
// Kelbo's email address is NOT in this file or anywhere in the repo. It lives
// only in the Worker's settings in Cloudflare: the TO variable, and the EMAIL
// binding, which is locked so it can only ever send to that one address.
//
// Spam protection: a hidden "botcheck" box that people never see (bots tick
// it and get a fake "sent"), messages only from the site's own pages, and
// length limits. Sending to your own verified address is free.

const SITES = ["https://longlight.games", "https://www.longlight.games"];
const LIMITS = { name: 100, email: 200, message: 5000 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = SITES.includes(origin);
    const cors = allowed ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
    const wantsJson = (request.headers.get("Accept") || "").includes("application/json");

    // Answer in the form main.js expects, or as a small page when the form
    // was posted without JavaScript.
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

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Accept" } });
    if (request.method !== "POST") return reply(false, "This address only takes messages from the contact form.", 405);
    if (!allowed) return reply(false, "Please send your message from longlight.games.", 403);

    let form;
    try { form = await request.formData(); } catch { return reply(false, "That message couldn't be read.", 400); }
    const field = (k) => String(form.get(k) || "").trim();
    const name = field("name"), email = field("email"), message = field("message");

    // A bot filled in the hidden box: say "sent" so it moves on, send nothing.
    if (form.get("botcheck")) return reply(true, "Sent. Thanks for reaching out!", 200);

    if (!name || !message) return reply(false, "Please fill in your name and a message.", 400);
    if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) {
      return reply(false, "That message is too long.", 400);
    }
    const emailOk = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
    if (email && !emailOk) return reply(false, "That email address doesn't look right.", 400);

    const oneLine = (s) => s.replace(/[\r\n]+/g, " ");
    try {
      await env.EMAIL.send({
        from: { email: "form@longlight.games", name: "Longlight contact form" },
        to: env.TO,
        ...(emailOk ? { replyTo: { email, name: oneLine(name) } } : {}),
        subject: `New message from ${oneLine(name)} (longlight.games)`,
        text: `${message}\n\n-- \nFrom: ${name}\nEmail: ${email || "(none left)"}\nSent from the contact form on longlight.games`,
      });
    } catch (err) {
      console.error("Send failed:", err && err.message);
      return reply(false, "That didn't send. Please try again in a minute.", 502);
    }
    return reply(true, "Sent. Thanks for reaching out!", 200);
  },
};
