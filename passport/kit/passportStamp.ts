/* ==========================================================================
   Longlight Passport kit: passportStamp.ts (TypeScript, ES module)
   --------------------------------------------------------------------------
   The same as passport-stamp.js, for the TypeScript games (Vite builds).
   Copy it into the game unchanged (for example src/passportStamp.ts).

     const stamp = makeStamp({ game, ver, headline, stats, flags });
     saveStamp("<the game's stamp key>", stamp);     // on every game save
     void openPassport(stamp);                        // on a button tap

   Headline numbers only: never save data, a name the player typed, a seed
   or anything personal. No dependencies, no network calls, and it never
   touches any storage key but the one the game hands it.

   Adapted from Kelbo.Website passport/js/codec.js and passport/js/validate.js (2026-11-25)
   Spec: https://github.com/Jxstrr0/Kelbo.Website/blob/main/.github/PASSPORT.md
   ========================================================================== */

export interface PassportStat {
  /** a-z, 0-9 and _, up to 32 characters, unique in the stamp */
  id: string;
  /** up to 32 characters */
  label: string;
  /** a number, or text of up to 24 characters */
  value: number | string;
  /** optional, up to 8 characters ("hp", "%") */
  unit?: string;
}

export interface PassportStamp {
  v: 1;
  game: string;
  ver: string;
  updated: string;
  headline?: string;
  stats: PassportStat[];
  flags?: string[];
}

export interface PassportStampInput {
  /** the game's Passport id ("lombard", "seasonticket", ...) */
  game: string;
  /** the game's version, numbers and dots ("1.2.5.0") */
  ver: string;
  /** optional, up to 60 characters */
  headline?: string;
  /** 1 to 6 */
  stats: PassportStat[];
  /** optional, up to 8 ids ("career_complete") */
  flags?: string[];
  /** optional YYYY-MM-DD; today on this phone if left out */
  updated?: string;
}

const PASSPORT_URL = "https://longlight.games/passport";
const PREFIX = "LLP1.";

/** The Passport's limits (the studio site refuses anything past them). */
export const PASSPORT_LIMITS = { jsonBytes: 2048, headline: 60, stats: 6, label: 32, unit: 8, textValue: 24, flags: 8 };
const ID = /^[a-z0-9_]{1,32}$/;
const VERSION = /^\d{1,6}(\.\d{1,6}){0,4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BAD_CHARS = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/;

function warn(problem: string): null {
  console.warn("Longlight Passport: " + problem + " The stamp was not made.");
  return null;
}

function okText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.trim().length <= max && !BAD_CHARS.test(value);
}

function today(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Builds a stamp and checks it against the Passport's rules; null (with a console warning) if something is wrong. */
export function makeStamp(input: PassportStampInput): PassportStamp | null {
  if (!input || !ID.test(String(input.game))) return warn("game must be the game's Passport id.");
  const ver = String(input.ver ?? "").trim();
  if (!VERSION.test(ver)) return warn("ver must be numbers and dots, like 1.2.0.0.");
  const updated = input.updated == null ? today() : String(input.updated);
  if (!DATE.test(updated)) return warn("updated must be a date, YYYY-MM-DD.");

  const stamp: PassportStamp = { v: 1, game: input.game, ver, updated, stats: [] };
  if (input.headline != null && input.headline !== "") {
    if (!okText(input.headline, PASSPORT_LIMITS.headline)) return warn("headline must be plain text, at most 60 characters.");
    stamp.headline = input.headline.trim();
  }

  if (!Array.isArray(input.stats) || input.stats.length < 1 || input.stats.length > PASSPORT_LIMITS.stats) return warn("stats must have 1 to 6 items.");
  const seen = new Set<string>();
  for (const s of input.stats) {
    if (!s || !ID.test(String(s.id)) || seen.has(s.id)) return warn("each stat needs its own id (a-z, 0-9, _).");
    seen.add(s.id);
    if (!okText(s.label, PASSPORT_LIMITS.label)) return warn("stat " + s.id + " needs a label of at most 32 characters.");
    let value: number | string;
    if (typeof s.value === "number") {
      if (!Number.isFinite(s.value)) return warn("stat " + s.id + " has a value that isn't a real number.");
      value = s.value;
    } else if (okText(s.value, PASSPORT_LIMITS.textValue)) {
      value = s.value.trim();
    } else {
      return warn("stat " + s.id + " needs a number, or text of at most 24 characters.");
    }
    const stat: PassportStat = { id: s.id, label: s.label.trim(), value };
    if (s.unit != null && s.unit !== "") {
      if (!okText(s.unit, PASSPORT_LIMITS.unit)) return warn("stat " + s.id + " has a unit longer than 8 characters.");
      stat.unit = s.unit.trim();
    }
    stamp.stats.push(stat);
  }

  if (input.flags != null) {
    if (!Array.isArray(input.flags) || input.flags.length > PASSPORT_LIMITS.flags) return warn("flags must be a list of at most 8 ids.");
    const flags: string[] = [];
    for (const f of input.flags) {
      if (!ID.test(String(f))) return warn("each flag must be an id (a-z, 0-9, _).");
      if (!flags.includes(f)) flags.push(f);
    }
    if (flags.length) stamp.flags = flags;
  }

  if (new TextEncoder().encode(JSON.stringify(stamp)).length > PASSPORT_LIMITS.jsonBytes) return warn("the stamp is over 2 KB.");
  return stamp;
}

/** Keeps the stamp in this game's own localStorage, for the bridge page. True if saved. */
export function saveStamp(key: string, stamp: PassportStamp | null): boolean {
  if (!stamp || !key) return false;
  try {
    localStorage.setItem(key, JSON.stringify(stamp));
    return true;
  } catch {
    return false; // private mode or storage full: the link still works
  }
}

// ---- the stamp code (the same as the studio site's codec) -------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
    if (i + 1 < bytes.length) out += B64.charAt((n >> 6) & 63);
    if (i + 2 < bytes.length) out += B64.charAt(n & 63);
  }
  return out;
}

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

/** Can this browser make stamp links? (Every current phone browser can.) */
export function passportSupported(): boolean {
  return typeof CompressionStream === "function" && typeof TextEncoder === "function";
}

/** A stamp → its LLP1. code. */
export async function encodeStamp(stamp: PassportStamp): Promise<string> {
  if (!passportSupported()) throw new Error("This browser is too old to make Passport links.");
  const bytes = new TextEncoder().encode(JSON.stringify(stamp));
  if (bytes.length > PASSPORT_LIMITS.jsonBytes) throw new Error("The stamp is over 2 KB.");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const payload = toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
  return PREFIX + payload + "." + checksum(PREFIX + payload);
}

/** A stamp → the full Passport link. */
export async function stampLink(stamp: PassportStamp | null): Promise<string> {
  if (!stamp) throw new Error("There's no stamp to send.");
  return PASSPORT_URL + "#stamp=" + (await encodeStamp(stamp));
}

/**
 * Opens the Passport with this stamp in a new tab. Call it straight from a
 * tap: the tab opens at once (so the browser allows it) and is pointed at
 * the link a moment later. If new tabs are blocked, this page goes there.
 */
export async function openPassport(stamp: PassportStamp | null): Promise<string> {
  let tab: Window | null = null;
  try { tab = window.open("", "_blank"); } catch { tab = null; }
  if (tab) {
    try { tab.opener = null; } catch { /* some browsers don't allow it */ }
  }
  try {
    const url = await stampLink(stamp);
    if (tab && !tab.closed) tab.location.replace(url);
    else window.location.href = url;
    return url;
  } catch (err) {
    if (tab) {
      try { tab.close(); } catch { /* already gone */ }
    }
    throw err;
  }
}
