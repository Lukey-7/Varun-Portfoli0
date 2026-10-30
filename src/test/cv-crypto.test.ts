// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, normalisePassphrase } from "@/sites/ordo/cv/crypto";
import { buildCvDocument } from "@/sites/ordo/cv/cvDocument";
import { experience, profile } from "@/data/profile";

// A low iteration count keeps the tests fast; the build uses the default.
const ITER = 1000;

describe("cv encryption", () => {
  it("round-trips a document", async () => {
    const cv = buildCvDocument();
    const vault = await encryptJson(cv, "correct horse", ITER);
    expect(await decryptJson(vault, "correct horse")).toEqual(cv);
  });

  it("rejects a wrong passphrase", async () => {
    const vault = await encryptJson(buildCvDocument(), "correct horse", ITER);
    await expect(decryptJson(vault, "wrong")).rejects.toThrow();
    await expect(decryptJson(vault, "")).rejects.toThrow();
  });

  it("never contains the plaintext", async () => {
    const cv = buildCvDocument();
    const vault = await encryptJson(cv, "correct horse", ITER);
    const shipped = JSON.stringify(vault);
    expect(shipped).not.toContain(cv.email);
    expect(shipped).not.toContain(cv.name);
    expect(shipped).not.toContain("correct horse");
  });

  it("uses a fresh salt and iv", async () => {
    const value = { name: "Same input" };
    const a = await encryptJson(value, "correct horse", ITER);
    const b = await encryptJson(value, "correct horse", ITER);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    // 16-byte salt and 12-byte IV, base64 encoded.
    expect(atob(a.salt)).toHaveLength(16);
    expect(atob(a.iv)).toHaveLength(12);
  });

  it("defaults to 600000 PBKDF2 iterations", async () => {
    const vault = await encryptJson({ name: "Default" }, "correct horse");
    expect(vault.v).toBe(1);
    expect(vault.iter).toBe(600000);
  });
});

describe("passphrase normalisation", () => {
  it("drops surrounding whitespace and line breaks, and nothing inside", () => {
    expect(normalisePassphrase("  correct horse \n")).toBe("correct horse");
    expect(normalisePassphrase("\tcorrect  horse\r\n")).toBe("correct  horse");
    expect(normalisePassphrase(" \n\t ")).toBe("");
  });

  it("puts accented letters in one form, so either keyboard derives the same key", async () => {
    const composed = "café horse";
    const decomposed = "café horse";
    expect(composed).not.toBe(decomposed);
    expect(normalisePassphrase(decomposed)).toBe(composed);

    const vault = await encryptJson({ ok: true }, normalisePassphrase(composed), ITER);
    expect(await decryptJson(vault, normalisePassphrase(decomposed))).toEqual({ ok: true });
  });
});

describe("cv document", () => {
  it("carries the phone number", () => {
    expect(buildCvDocument().phone).toBe(profile.phone);
  });

  it("includes every role", () => {
    const cv = buildCvDocument();
    expect(cv.experience).toHaveLength(experience.length);
    expect(cv.experience.map((role) => role.company)).toEqual(experience.map((role) => role.company));
    expect(cv.email).toBe(profile.email);
    expect(cv.projects.length).toBeGreaterThan(0);
  });
});
