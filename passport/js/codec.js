/* ==========================================================================
   Longlight Passport: stamp codes (passport/js/codec.js)
   --------------------------------------------------------------------------
   Turns a stamp into the text that goes after "#stamp=" in a stamp link,
   and back again.

     LLP1.<payload>.<checksum>

   - payload: base64url (no padding) of the stamp's JSON, squeezed with the
     browser's own deflate (CompressionStream "deflate-raw").
   - checksum: FNV-1a (32 bit) of "LLP1." + payload, in base 36, always 7
     characters. A link cut short or edited fails the checksum instead of
     loading rubbish. (The same shape as Lombard's LMB1. save codes.)

   Reading a code is forgiving about what chat and notes apps do to text
   (spaces, line breaks, smart dashes, %-escapes) but strict about the
   content: anything that doesn't check out is refused with a message that
   is safe to show. Unpacking stops at 2 KB, so a huge code can't fill up
   the phone's memory.

   This file only packs and unpacks. Whether the stamp inside makes sense is
   validate.js's job.

   Works as a plain <script> (it sets window.LLPassportCodec) and in Node
   (module.exports), so .github/scripts/passport.test.mjs can test it.
   Spec: .github/PASSPORT.md, section 3.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LLPassportCodec = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PREFIX = "LLP1.";
  var CHECKSUM_LEN = 7;
  var MAX_JSON_BYTES = 2048; // a stamp is at most 2 KB of JSON (spec section 4)
  var MAX_CODE_CHARS = 4096; // far more than 2 KB packed can ever need

  // An error whose message is safe to show the player.
  function CodecError(code, message) {
    var err = new Error(message);
    err.name = "CodecError";
    err.code = code;
    return err;
  }

  // ---- base64url, by hand (the same in every browser and in Node) --------

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var B64_INDEX = {};
  for (var i = 0; i < B64.length; i++) B64_INDEX[B64.charAt(i)] = i;

  function toBase64Url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63);
      if (i + 1 < bytes.length) out += B64.charAt((n >> 6) & 63);
      if (i + 2 < bytes.length) out += B64.charAt(n & 63);
    }
    return out;
  }

  // Throws on a character outside the alphabet or a length that can't be.
  function fromBase64Url(text) {
    if (text.length % 4 === 1) throw new Error("bad length");
    var out = new Uint8Array(Math.floor((text.length * 3) / 4));
    var o = 0;
    for (var i = 0; i < text.length; i += 4) {
      var chunk = Math.min(4, text.length - i);
      var n = 0;
      for (var j = 0; j < 4; j++) {
        var v = j < chunk ? B64_INDEX[text.charAt(i + j)] : 0;
        if (v === undefined) throw new Error("bad character");
        n = (n << 6) | v;
      }
      out[o++] = (n >> 16) & 255;
      if (chunk > 2) out[o++] = (n >> 8) & 255;
      if (chunk > 3) out[o++] = n & 255;
    }
    return out;
  }

  // ---- checksum -------------------------------------------------------------

  // FNV-1a, 32 bit, over the text (which is plain ASCII), base 36, padded.
  function checksum(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    var s = h.toString(36);
    while (s.length < CHECKSUM_LEN) s = "0" + s;
    return s;
  }

  // ---- deflate, with the browser's own streams -------------------------------

  function canPack() {
    return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  }

  // Push bytes through a compression stream and collect what comes out,
  // stopping (and refusing) once more than `limit` bytes have come out.
  function pump(bytes, stream, limit) {
    var writer = stream.writable.getWriter();
    writer.write(bytes).catch(function () {});
    writer.close().catch(function () {});
    var reader = stream.readable.getReader();
    var chunks = [];
    var total = 0;
    function next() {
      return reader.read().then(function (step) {
        if (step.done) {
          var out = new Uint8Array(total);
          var at = 0;
          chunks.forEach(function (c) { out.set(c, at); at += c.length; });
          return out;
        }
        total += step.value.length;
        if (limit && total > limit) {
          reader.cancel().catch(function () {});
          throw CodecError("too-big", "That stamp is too big to be a real one.");
        }
        chunks.push(step.value);
        return next();
      });
    }
    return next();
  }

  // ---- encode ------------------------------------------------------------------

  // A stamp object → its LLP1. code. (The games do this; here it's for the
  // dev link builder and the tests.) Refuses anything over 2 KB of JSON.
  function encode(stamp) {
    if (!canPack()) return Promise.reject(CodecError("old-browser", "This browser is too old to make stamp links."));
    var bytes = new TextEncoder().encode(JSON.stringify(stamp));
    if (bytes.length > MAX_JSON_BYTES) return Promise.reject(CodecError("too-big", "That stamp is over 2 KB."));
    return pump(bytes, new CompressionStream("deflate-raw"), 0).then(function (packed) {
      var payload = toBase64Url(packed);
      return PREFIX + payload + "." + checksum(PREFIX + payload);
    });
  }

  // ---- decode ------------------------------------------------------------------

  // Undo what messaging and notes apps do to a link or a pasted code.
  function tidy(input) {
    var text = String(input);
    if (text.indexOf("%") >= 0) {
      try { text = decodeURIComponent(text); } catch (e) { /* leave it; the checks below will say */ }
    }
    return text
      .replace(/[\s​-‍⁠﻿]+/g, "") // spaces, line breaks, zero-width characters
      .replace(/[‐-―−]/g, "-"); // smart dashes back to a hyphen
  }

  // An LLP1. code → the plain object inside it (not yet checked as a stamp).
  // Rejects with a CodecError whose message can be shown as it is.
  function decode(code) {
    return Promise.resolve().then(function () {
      if (typeof code !== "string" || !code) throw CodecError("empty", "That stamp link is empty.");
      if (code.length > MAX_CODE_CHARS * 3) throw CodecError("too-big", "That stamp is too big to be a real one.");
      var text = tidy(code);
      if (!text) throw CodecError("empty", "That stamp link is empty.");
      if (text.length > MAX_CODE_CHARS) throw CodecError("too-big", "That stamp is too big to be a real one.");
      if (text.slice(0, PREFIX.length).toUpperCase() !== PREFIX) {
        throw CodecError("not-a-stamp", "That doesn't look like a Longlight stamp.");
      }
      var rest = text.slice(PREFIX.length);
      var dot = rest.indexOf(".");
      var given = dot < 0 ? "" : rest.slice(dot + 1).toLowerCase();
      if (dot < 0 || given.length < CHECKSUM_LEN) {
        throw CodecError("cut-off", "That stamp link looks cut off. Try the button in the game again.");
      }
      var payload = rest.slice(0, dot);
      if (given.slice(0, CHECKSUM_LEN) !== checksum(PREFIX + payload)) {
        throw CodecError("damaged", "That stamp link is damaged. Try the button in the game again.");
      }
      if (!canPack()) throw CodecError("old-browser", "This browser is too old to read stamps. Update it and try again.");
      var packed;
      try { packed = fromBase64Url(payload); } catch (e) {
        throw CodecError("damaged", "That stamp link is damaged. Try the button in the game again.");
      }
      return pump(packed, new DecompressionStream("deflate-raw"), MAX_JSON_BYTES).catch(function (err) {
        if (err && err.name === "CodecError") throw err;
        throw CodecError("damaged", "That stamp couldn't be unpacked. It may be damaged.");
      });
    }).then(function (bytes) {
      try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch (e) {
        throw CodecError("damaged", "That stamp couldn't be read. It may be damaged.");
      }
    });
  }

  return {
    PREFIX: PREFIX,
    MAX_JSON_BYTES: MAX_JSON_BYTES,
    encode: encode,
    decode: decode,
    checksum: checksum,
    toBase64Url: toBase64Url,
    fromBase64Url: fromBase64Url,
  };
});
