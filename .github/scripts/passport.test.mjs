// Tests for the Longlight Passport (spec: .github/PASSPORT.md).
// Plain node:test, no packages. Run: node --test .github/scripts/passport.test.mjs
// The Site check runs it on every pull request.
//
// Covers the stamp code (passport/js/codec.js), the stamp check
// (passport/js/validate.js), the bridge's address and message checks
// (passport/js/bridge.js) and its page (passport/kit/passport-stamp.html),
// the badges (passport/js/badges.js and passport/badges.json), the kit
// games copy in (passport/kit/),
// the registry, and a guard that the Passport's code never puts text on
// the page as markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const Codec = require(join(ROOT, "passport/js/codec.js"));
const Check = require(join(ROOT, "passport/js/validate.js"));
const Bridge = require(join(ROOT, "passport/js/bridge.js"));
const Badges = require(join(ROOT, "passport/js/badges.js"));
const badgeFile = JSON.parse(readFileSync(join(ROOT, "passport/badges.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(ROOT, "passport/registry.json"), "utf8"));
const IDS = registry.games.map((g) => g.id);
const TODAY = "2026-11-25";

// The example stamp from the spec (section 4).
const example = () => ({
  v: 1,
  game: "pew",
  ver: "1.76.142.2",
  updated: "2026-11-24",
  headline: "Race-team career, season 4",
  stats: [
    { id: "best_hp", label: "Best engine", value: 1140, unit: "hp" },
    { id: "wins_24h", label: "24-hour wins", value: 2 },
  ],
  flags: ["career_complete"],
});

const check = (raw) => Check.check(raw, IDS, { today: TODAY });

// Builds a code around any bytes with a correct checksum (to test what
// happens after the checksum passes).
async function codeAround(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  const payload = Codec.toBase64Url(packed);
  return Codec.PREFIX + payload + "." + Codec.checksum(Codec.PREFIX + payload);
}

// ---- the code ----------------------------------------------------------------

test("base64url round-trips every length", () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    assert.deepEqual(Codec.fromBase64Url(Codec.toBase64Url(bytes)), bytes);
  }
});

test("checksum is 7 base-36 characters", () => {
  for (const text of ["", "LLP1.", "LLP1.abc", "x".repeat(500)]) assert.match(Codec.checksum(text), /^[0-9a-z]{7}$/);
  assert.notEqual(Codec.checksum("LLP1.a"), Codec.checksum("LLP1.b"));
});

test("a stamp survives encode and decode unchanged", async () => {
  const code = await Codec.encode(example());
  assert.match(code, /^LLP1\.[A-Za-z0-9_-]+\.[0-9a-z]{7}$/);
  assert.deepEqual(await Codec.decode(code), example());
});

test("what chat apps do to a link is undone", async () => {
  const code = await Codec.encode(example());
  const mid = Math.floor(code.length / 2);
  const messy = " " + code.slice(0, mid) + "\n​" + code.slice(mid) + " ";
  assert.deepEqual(await Codec.decode(messy), example());
  assert.deepEqual(await Codec.decode(encodeURIComponent(code)), example());
});

test("a damaged, cut-off or foreign code is refused with a plain message", async () => {
  const code = await Codec.encode(example());
  const flipped = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  await assert.rejects(Codec.decode(flipped), { name: "CodecError", code: "damaged" });
  await assert.rejects(Codec.decode(code.slice(0, code.length - 3)), { name: "CodecError", code: "cut-off" });
  await assert.rejects(Codec.decode(code.slice(0, 20)), { name: "CodecError", code: "cut-off" });
  await assert.rejects(Codec.decode("LMB1.abc.0000000"), { name: "CodecError", code: "not-a-stamp" });
  await assert.rejects(Codec.decode(""), { name: "CodecError", code: "empty" });
  await assert.rejects(Codec.decode(null), { name: "CodecError", code: "empty" });
});

test("bytes that aren't JSON are refused after the checksum passes", async () => {
  await assert.rejects(Codec.decode(await codeAround("not json {")), { name: "CodecError", code: "damaged" });
  // A correct checksum around rubbish that isn't deflate at all.
  const payload = "AAAA_bad_";
  await assert.rejects(Codec.decode(Codec.PREFIX + payload + "." + Codec.checksum(Codec.PREFIX + payload)), { name: "CodecError" });
});

test("a code that unpacks to more than 2 KB is stopped (no zip bombs)", async () => {
  const bomb = await codeAround(JSON.stringify({ v: 1, pad: "0".repeat(200000) }));
  assert.ok(bomb.length < 4096, "the bomb is small when packed");
  await assert.rejects(Codec.decode(bomb), { name: "CodecError", code: "too-big" });
  await assert.rejects(Codec.decode("LLP1." + "A".repeat(20000) + ".0000000"), { name: "CodecError", code: "too-big" });
});

test("encode refuses a stamp over 2 KB", async () => {
  await assert.rejects(Codec.encode({ ...example(), headline: "x".repeat(3000) }), { name: "CodecError", code: "too-big" });
});

// ---- the stamp check ---------------------------------------------------------

test("the spec's example stamp passes", () => {
  const result = check(example());
  assert.equal(result.ok, true);
  assert.deepEqual(result.stamp, example());
});

test("unknown fields are dropped, text is trimmed", () => {
  const raw = { ...example(), seed: 12345, save: "PEW1:...", headline: "  Season 4  " };
  raw.stats = [{ ...raw.stats[0], colour: "red" }];
  const { ok, stamp } = check(raw);
  assert.equal(ok, true);
  assert.equal(stamp.seed, undefined);
  assert.equal(stamp.save, undefined);
  assert.equal(stamp.headline, "Season 4");
  assert.deepEqual(Object.keys(stamp.stats[0]).sort(), ["id", "label", "unit", "value"]);
});

test("a newer stamp version gets the friendly note", () => {
  const result = check({ ...example(), v: 2 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "newer");
  assert.match(result.message, /newer version of the Passport/);
});

const refusals = {
  "not an object": () => "a string",
  "an array": () => [],
  "no version number": () => ({ ...example(), v: undefined }),
  "v as text": () => ({ ...example(), v: "1" }),
  "an unknown game": () => ({ ...example(), game: "tetris" }),
  "a prototype as the game": () => ({ ...example(), game: "__proto__" }),
  "a version with letters": () => ({ ...example(), ver: "1.0<script>" }),
  "no version": () => ({ ...example(), ver: undefined }),
  "a date that isn't real": () => ({ ...example(), updated: "2026-02-30" }),
  "a date in another shape": () => ({ ...example(), updated: "24/11/2026" }),
  "a date that is a number": () => ({ ...example(), updated: 20261124 }),
  // What JSON.parse makes of {"toString":1}: turning it into text throws.
  "a date that throws when read": () => ({ ...example(), updated: { toString: 1 } }),
  "a version that throws when read": () => ({ ...example(), ver: { toString: 1 } }),
  "a stamp that throws when read": () => ({ ...example(), toJSON: 1, stats: [{ id: "a", label: "L", value: 1, toJSON: () => { throw new Error("no"); } }] }),
  "a date years ahead": () => ({ ...example(), updated: "2031-01-01" }),
  "a headline over 60": () => ({ ...example(), headline: "x".repeat(61) }),
  "a headline that isn't text": () => ({ ...example(), headline: 42 }),
  "no stats": () => ({ ...example(), stats: [] }),
  "seven stats": () => ({ ...example(), stats: Array.from({ length: 7 }, (_, i) => ({ id: "s" + i, label: "L", value: i })) }),
  "a label over 32": () => ({ ...example(), stats: [{ id: "a", label: "x".repeat(33), value: 1 }] }),
  "an empty label": () => ({ ...example(), stats: [{ id: "a", label: "  ", value: 1 }] }),
  "a unit over 8": () => ({ ...example(), stats: [{ id: "a", label: "L", value: 1, unit: "horsepowr" }] }),
  "a text value over 24": () => ({ ...example(), stats: [{ id: "a", label: "L", value: "x".repeat(25) }] }),
  "a value that isn't a number": () => ({ ...example(), stats: [{ id: "a", label: "L", value: NaN }] }),
  "an infinite value": () => ({ ...example(), stats: [{ id: "a", label: "L", value: Infinity }] }),
  "a value that's an object": () => ({ ...example(), stats: [{ id: "a", label: "L", value: { x: 1 } }] }),
  "a stat id with capitals": () => ({ ...example(), stats: [{ id: "BestHP", label: "L", value: 1 }] }),
  "the same stat twice": () => ({ ...example(), stats: [{ id: "a", label: "L", value: 1 }, { id: "a", label: "M", value: 2 }] }),
  "nine flags": () => ({ ...example(), flags: Array.from({ length: 9 }, (_, i) => "f" + i) }),
  "a flag with spaces": () => ({ ...example(), flags: ["career complete"] }),
  "a control character": () => ({ ...example(), headline: "Season\u0007 4" }),
  "a right-to-left trick": () => ({ ...example(), headline: "Season ‮4" }),
  "more than 2 KB": () => ({ ...example(), extra: "x".repeat(2100) }),
};
for (const [name, make] of Object.entries(refusals)) {
  test(`refused: ${name}`, () => {
    const result = check(make());
    assert.equal(result.ok, false);
    assert.equal(typeof result.message, "string");
  });
}

test("text values and missing optional fields are fine", () => {
  const raw = { v: 1, game: "scrapline", ver: "0.1.68.5", updated: "2026-11-25", stats: [{ id: "title", label: "Open title", value: "Champion" }] };
  const { ok, stamp } = check(raw);
  assert.equal(ok, true);
  assert.equal(stamp.headline, undefined);
  assert.equal(stamp.flags, undefined);
});

test("tomorrow's date is allowed (time zones), the day after isn't", () => {
  assert.equal(check({ ...example(), updated: "2026-11-26" }).ok, true);
  assert.equal(check({ ...example(), updated: "2026-11-27" }).ok, false);
});

// ---- the replace rule ----------------------------------------------------------

test("versions compare number by number", () => {
  assert.equal(Check.compareVersions("1.10.0.0", "1.9.0.0"), 1);
  assert.equal(Check.compareVersions("1.2", "1.2.0.0"), 0);
  assert.equal(Check.compareVersions("0.1.68.4", "0.1.68.5"), -1);
});

test("a newer date or the same date with a newer version replaces; nothing else does", () => {
  const old = example();
  assert.equal(Check.isNewer(old, null), true);
  assert.equal(Check.isNewer({ ...old, updated: "2026-11-25" }, old), true);
  assert.equal(Check.isNewer({ ...old, ver: "1.76.143.0" }, old), true);
  assert.equal(Check.isNewer({ ...old }, old), false);
  assert.equal(Check.isNewer({ ...old, updated: "2026-11-23", ver: "9.0.0.0" }, old), false);
  assert.equal(Check.isNewer({ ...old, ver: "1.76.142.1" }, old), false);
});

// ---- the registry and the page code -----------------------------------------------

test("every registry entry has a unique id, a title and a stamp key", () => {
  assert.equal(new Set(IDS).size, IDS.length);
  for (const g of registry.games) {
    assert.match(g.id, /^[a-z0-9]+$/);
    assert.ok(g.title, `${g.id} has a title`);
    assert.ok(g.stampKey && /passport$/.test(g.stampKey), `${g.id} has a stamp key`);
    assert.ok(g.bridgeUrl === null || /^https:\/\/[a-z0-9-]+\.longlight\.games\//.test(g.bridgeUrl), `${g.id} bridge is null or a longlight.games address`);
  }
});

test("the Passport's code never writes markup and only touches kelbo.passport.* storage", () => {
  const files = ["passport/passport.js", ...readdirSync(join(ROOT, "passport/js")).map((f) => "passport/js/" + f)];
  for (const f of files.filter((f) => f.endsWith(".js"))) {
    const code = readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, `${f} must put text on the page with textContent`);
    for (const m of code.matchAll(/["'](kelbo\.[^"']*)["']/g)) assert.ok(m[1].startsWith("kelbo.passport."), `${f} uses ${m[1]}`);
    assert.doesNotMatch(code, /localStorage\.clear|fetch\([^)]*(https?:)/, `${f} clears all storage or calls out`);
  }
});

// ---- the bridge ------------------------------------------------------------------

test("a bridge address must be https on a longlight.games game address", () => {
  assert.equal(Bridge.originOf("https://pew.longlight.games/passport-stamp.html"), "https://pew.longlight.games");
  for (const bad of [
    "http://pew.longlight.games/passport-stamp.html",
    "https://longlight.games/passport-stamp.html",
    "https://pew.longlight.games.evil.example/x.html",
    "https://evil.example/?pew.longlight.games",
    "https://pew.longlight.games:8443/x.html",
    "https://user:pw" + "@" + "pew.longlight.games/x.html", // a login in the address (split so the privacy scan doesn't read it as an email)
    "https://a.b.longlight.games/x.html",
    "javascript:alert(1)",
    "",
    null,
  ]) assert.equal(Bridge.originOf(bad), "", String(bad));
});

test("only a small, well-shaped bridge message is read", () => {
  assert.deepEqual(Bridge.readMessage({ type: "llp-stamp", v: 1, stamp: example() }), { stamp: example() });
  assert.deepEqual(Bridge.readMessage({ type: "llp-stamp", v: 1, stamp: null }), { stamp: null });
  for (const bad of [
    null,
    "llp-stamp",
    [],
    { type: "other", v: 1, stamp: example() },
    { type: "llp-stamp", v: 2, stamp: example() },
    { type: "llp-stamp", v: 1, stamp: "LLP1.abc" },
    { type: "llp-stamp", v: 1, stamp: [example()] },
    { type: "llp-stamp", v: 1, stamp: { ...example(), pad: "x".repeat(5000) } },
  ]) assert.equal(Bridge.readMessage(bad), null, JSON.stringify(bad)?.slice(0, 60));
});

test("the bridge page is small, posts only to longlight.games, and its script is allowed by its own tag", () => {
  const html = readFileSync(join(ROOT, "passport/kit/passport-stamp.html"), "utf8");
  assert.ok(Buffer.byteLength(html) < 2048, "under 2 KB");
  const scripts = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, "one inline script, no files");
  const hash = "sha256-" + createHash("sha256").update(scripts[0][2]).digest("base64");
  const tag = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(tag, /default-src 'none'/);
  assert.ok(tag.includes(`script-src '${hash}'`), "the tag lists the script's fingerprint (recompute it after editing the script)");
  const code = scripts[0][2];
  assert.match(code, /postMessage\(\{ type: "llp-stamp", v: 1, stamp: stamp \}, "https:\/\/longlight\.games"\)/);
  assert.doesNotMatch(code, /postMessage\([^)]*"\*"/, "never posts to any page");
  assert.doesNotMatch(code, /fetch|XMLHttpRequest|sendBeacon|indexedDB|cookie|setItem|removeItem/, "only reads one key");
  assert.match(html, /<meta name="llp-stamp-key" content="[^"]+">/);
});

test("every game's stamp key starts with that game's storage prefix", () => {
  const prefix = { pew: "pew2-", scrapline: "scr-", seasonticket: "seasonticket.", funded: "funded.", lombard: "lombard.", burnrate: "brn-", frontierlab: "frontierlab.", hulldown: "hulldown.", laminar: "laminar.", outwash: "outwash.", mainline: "mainline.", thewhip: "whip:" };
  for (const g of registry.games) assert.ok(prefix[g.id] && g.stampKey.startsWith(prefix[g.id]), `${g.id}: ${g.stampKey}`);
});

// ---- badges ------------------------------------------------------------------------

const SITE = ["pew", "scrapline", "seasonticket", "funded", "lombard", "burnrate"];
const stampOf = (game, extra = {}) => ({ v: 1, game, ver: "1.0.0.0", updated: "2026-11-25", stats: [{ id: "x", label: "X", value: 1 }], ...extra });
const stampsFor = (ids, extra = {}) => Object.fromEntries(ids.map((id) => [id, stampOf(id, extra[id])]));
const earnedIds = (ctx) => Badges.evaluate(Badges.rules(badgeFile), { gameIds: SITE, updates: 0, ...ctx }).filter((b) => b.earned).map((b) => b.id);

test("badges.json has Kelbo's eight starter badges, all valid", () => {
  const list = Badges.rules(badgeFile);
  assert.equal(list.length, 8, "every badge in the file passes the rule check");
  assert.deepEqual(list.map((b) => b.name), ["First Light", "Three on the Horizon", "Long Light", "Full Sky", "Closing Time", "Thousand Horses", "Title Fight", "Regular"]);
  for (const b of list) {
    if (b.rule.game) assert.ok(IDS.includes(b.rule.game), `${b.id} names a game the registry knows`);
  }
});

test("no stamps, no badges", () => {
  assert.deepEqual(earnedIds({ stamps: {} }), []);
});

test("game-count badges: 1, 3, 5 and every game on the site", () => {
  assert.deepEqual(earnedIds({ stamps: stampsFor(["pew"]) }), ["first_light"]);
  assert.deepEqual(earnedIds({ stamps: stampsFor(SITE.slice(0, 3)) }), ["first_light", "three_on_the_horizon"]);
  assert.deepEqual(earnedIds({ stamps: stampsFor(SITE.slice(0, 5)) }), ["first_light", "three_on_the_horizon", "long_light"]);
  assert.deepEqual(earnedIds({ stamps: stampsFor(SITE) }), ["first_light", "three_on_the_horizon", "long_light", "full_sky"]);
});

test("a hidden game's stamp counts for nothing", () => {
  const stamps = stampsFor(["pew", "frontierlab", "hulldown"]);
  assert.deepEqual(earnedIds({ stamps }), ["first_light"]);
  const r = Badges.evaluate(Badges.rules(badgeFile), { stamps, gameIds: SITE }).find((b) => b.id === "three_on_the_horizon");
  assert.equal(r.have, 1);
  assert.equal(r.need, 3);
});

test("Full Sky follows the games on the site, and needs at least one", () => {
  const rules = [{ id: "full", name: "Full", rule: { type: "gamesStamped", all: true } }];
  const clean = Badges.rules({ badges: rules });
  assert.equal(Badges.evaluate(clean, { stamps: {}, gameIds: [] })[0].earned, false);
  assert.equal(Badges.evaluate(clean, { stamps: stampsFor(["pew", "funded"]), gameIds: ["pew", "funded"] })[0].earned, true);
  assert.equal(Badges.evaluate(clean, { stamps: stampsFor(["pew", "funded"]), gameIds: ["pew", "funded", "lombard"] })[0].earned, false);
});

test("Thousand Horses needs pew's best_hp at 1,000 or more, as a number", () => {
  const hp = (value) => stampsFor(["pew"], { pew: { stats: [{ id: "best_hp", label: "Best engine", value, unit: "hp" }] } });
  assert.ok(!earnedIds({ stamps: hp(999) }).includes("thousand_horses"));
  assert.ok(earnedIds({ stamps: hp(1000) }).includes("thousand_horses"));
  assert.ok(!earnedIds({ stamps: hp("1000") }).includes("thousand_horses"), "a text value doesn't count");
  const other = stampsFor(["scrapline"], { scrapline: { stats: [{ id: "best_hp", label: "Best", value: 5000 }] } });
  assert.ok(!earnedIds({ stamps: other }).includes("thousand_horses"), "only pew's number counts");
});

test("Closing Time needs career_complete in two games", () => {
  const flags = { pew: { flags: ["career_complete"] }, funded: { flags: ["career_complete"] } };
  assert.ok(!earnedIds({ stamps: stampsFor(["pew", "funded"], { pew: flags.pew }) }).includes("closing_time"));
  assert.ok(earnedIds({ stamps: stampsFor(["pew", "funded"], flags) }).includes("closing_time"));
});

test("Title Fight needs open_won in Scrapline's own stamp", () => {
  assert.ok(earnedIds({ stamps: stampsFor(["scrapline"], { scrapline: { flags: ["open_won"] } }) }).includes("title_fight"));
  assert.ok(!earnedIds({ stamps: stampsFor(["pew"], { pew: { flags: ["open_won"] } }) }).includes("title_fight"));
});

test("Regular needs five updates", () => {
  assert.ok(!earnedIds({ stamps: stampsFor(["pew"]), updates: 4 }).includes("regular"));
  assert.ok(earnedIds({ stamps: stampsFor(["pew"]), updates: 5 }).includes("regular"));
  assert.ok(!earnedIds({ stamps: stampsFor(["pew"]), updates: "lots" }).includes("regular"));
});

test("a badge with a broken or unknown rule is left out, not fatal", () => {
  const list = Badges.rules({
    badges: [
      { id: "ok", name: "OK", rule: { type: "updates", min: 2 } },
      { id: "ok", name: "Twice", rule: { type: "updates", min: 2 } },
      { id: "Bad id", name: "X", rule: { type: "updates", min: 2 } },
      { id: "noname", rule: { type: "updates", min: 2 } },
      { id: "unknown", name: "X", rule: { type: "secret" } },
      { id: "zero", name: "X", rule: { type: "gamesStamped", min: 0 } },
      { id: "nan", name: "X", rule: { type: "stat", game: "pew", stat: "best_hp", gte: "lots" } },
      { id: "flagless", name: "X", rule: { type: "flag", flag: "career_complete" } },
      null,
    ],
  });
  assert.deepEqual(list.map((b) => b.id), ["ok"]);
  assert.deepEqual(Badges.rules(null), []);
  assert.deepEqual(Badges.rules({ badges: "no" }), []);
});

// ---- the kit games copy in (passport/kit/) -----------------------------------------

const Kit = require(join(ROOT, "passport/kit/passport-stamp.js"));
async function loadTsKit() {
  const { stripTypeScriptTypes } = await import("node:module");
  const js = stripTypeScriptTypes(readFileSync(join(ROOT, "passport/kit/passportStamp.ts"), "utf8"));
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(js));
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test("the kit's limits are the Passport's limits", async () => {
  assert.deepEqual(Kit.LIMITS, Check.LIMITS);
  assert.deepEqual((await loadTsKit()).PASSPORT_LIMITS, Check.LIMITS);
});

test("a stamp made by the kit (JS and TypeScript) passes the Passport's check, and its link decodes", async () => {
  const Ts = await loadTsKit();
  const input = { ...example(), updated: undefined };
  for (const [name, make, link] of [["js", Kit.make, Kit.link], ["ts", Ts.makeStamp, Ts.stampLink]]) {
    const stamp = make(input);
    assert.ok(stamp, `${name} made a stamp`);
    assert.match(stamp.updated, /^\d{4}-\d{2}-\d{2}$/, `${name} dated it today`);
    const url = await link(stamp);
    assert.ok(url.startsWith("https://longlight.games/passport#stamp=LLP1."), `${name} link`);
    const raw = await Codec.decode(url.split("#stamp=")[1]);
    const result = Check.check(raw, IDS, { today: "9999-12-31" });
    assert.ok(result.ok, `${name}: ${result.message}`);
    assert.deepEqual(result.stamp, stamp, `${name} stamp arrives unchanged`);
  }
});

test("the kit catches a bad stamp in the game, with null and a warning", async () => {
  const Ts = await loadTsKit();
  const bad = [
    { ...example(), game: "Bad Game" },
    { ...example(), ver: "v1" },
    { ...example(), headline: "x".repeat(61) },
    { ...example(), stats: [] },
    { ...example(), stats: Array.from({ length: 7 }, (_, i) => ({ id: "s" + i, label: "S", value: i })) },
    { ...example(), stats: [{ id: "a", label: "A", value: 1 }, { id: "a", label: "B", value: 2 }] },
    { ...example(), stats: [{ id: "a", label: "A", value: Infinity }] },
    { ...example(), stats: [{ id: "a", label: "A", value: { nested: true } }] },
    { ...example(), stats: [{ id: "a", label: "A‮", value: 1 }] },
    { ...example(), stats: [{ id: "a", label: "A", value: 1, unit: "horsepower" }] },
    { ...example(), flags: ["Not An Id"] },
    { ...example(), updated: "25/11/2026" },
  ];
  for (const input of bad) {
    assert.equal(quiet(() => Kit.make(input)), null, JSON.stringify(input).slice(0, 80));
    assert.equal(quiet(() => Ts.makeStamp(input)), null, "ts: " + JSON.stringify(input).slice(0, 80));
  }
});

test("the kit only ever writes the key it's given, and never calls out", () => {
  for (const f of ["passport/kit/passport-stamp.js", "passport/kit/passportStamp.ts"]) {
    const raw = readFileSync(join(ROOT, f), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|indexedDB|document\.cookie|localStorage\.(clear|removeItem)|sessionStorage/, f);
    assert.deepEqual([...code.matchAll(/localStorage\.\w+\(([^,)]*)/g)].map((m) => m[1].trim()), ["key"], `${f} only writes the key it's handed`);
    assert.match(raw, /const PASSPORT_URL = "https:\/\/longlight\.games\/passport";|var PASSPORT_URL = "https:\/\/longlight\.games\/passport";/, `${f} links to the Passport`);
  }
});

// ---- The share card (PR 6) ---------------------------------------------------

const Share = require(join(ROOT, "passport/js/sharecard.js"));

test("the share card counts only games on the site, in their order", () => {
  const games = [{ id: "pew", name: "Prairie Engine Works" }, { id: "scrapline", name: "Scrapline" }, { id: "funded", name: "Funded" }];
  const words = Share.card({
    games,
    stamps: { funded: {}, pew: {}, hulldown: {} }, // hulldown is hidden: not on the card
    badges: [{ earned: true }, { earned: false }, { earned: true }],
  });
  assert.deepEqual(words.names, ["Prairie Engine Works", "Funded"]);
  assert.equal(words.games, "2 of 3 games stamped");
  assert.equal(words.badges, "2 of 3 studio badges");
  assert.equal(words.address, "longlight.games/passport");
  assert.equal(words.stamped, 2);
  assert.equal(Share.card({ games: [games[0]], stamps: { pew: {} } }).games, "1 of 1 game stamped");
  assert.equal(Share.card({ games, stamps: {} }).badges, "");
});

test("the share card carries names and counts only, never what's in a stamp", () => {
  const stamp = { v: 1, game: "pew", ver: "1.0", updated: "2026-11-25", headline: "Secret headline", stats: [{ id: "best_hp", label: "Best engine", value: 98765, unit: "hp" }] };
  const words = Share.card({ games: [{ id: "pew", name: "Prairie Engine Works" }], stamps: { pew: stamp }, badges: [] });
  const text = JSON.stringify(words);
  assert.doesNotMatch(text, /Secret headline|98765|Best engine|2026-11-25/);
});

test("a long list of games folds into '+ N more'", () => {
  const games = Array.from({ length: 11 }, (_, i) => ({ id: "g" + i, name: "Game " + i }));
  const stamps = Object.fromEntries(games.map((g) => [g.id, {}]));
  const words = Share.card({ games, stamps, badges: [] });
  assert.equal(words.names.length, 8);
  assert.equal(words.names[7], "+ 4 more");
  assert.equal(words.games, "11 of 11 games stamped");
});

test("the share card and the home chip never write storage or call out but for the registry", () => {
  const raw = readFileSync(join(ROOT, "passport/js/sharecard.js"), "utf8");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|document\.cookie/);
  const main = readFileSync(join(ROOT, "main.js"), "utf8");
  const chip = main.slice(main.indexOf("async function setUpPassportChip"), main.indexOf("// Once per page: note today"));
  assert.ok(chip.length > 200, "found setUpPassportChip");
  assert.doesNotMatch(chip, /innerHTML|writeJSON|localStorage\.setItem|removeItem/);
  assert.deepEqual([...chip.matchAll(/fetch\("([^"]+)"/g)].map((m) => m[1]), ["passport/registry.json"]);
});
