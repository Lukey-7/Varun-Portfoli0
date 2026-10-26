/**
 * Passphrase encryption for the private CV. The build encrypts the CV with
 * the CV_PASSPHRASE environment variable and the browser decrypts it, so the
 * shipped files hold ciphertext only.
 *
 * PBKDF2-SHA256 turns the passphrase into an AES-GCM 256 key; AES-GCM also
 * authenticates, so a wrong passphrase fails instead of returning noise.
 * Only `globalThis.crypto.subtle` is used, which exists in browsers (on
 * https and localhost) and in Node, where the build runs.
 */

/** What the build ships: every field but `v` and `iter` is base64. */
export interface CvVault {
  v: 1;
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

/**
 * The one way a passphrase is cleaned before it becomes a key, at build time and in the
 * browser: surrounding whitespace is dropped (a pasted value often ends in a newline) and the
 * text is put in NFC, so the same word typed on different keyboards derives the same key.
 */
export const normalisePassphrase = (value: string) => value.trim().normalize("NFC");

/** OWASP's recommended count for PBKDF2-SHA256: slow to guess, quick enough to unlock once. */
const DEFAULT_ITERATIONS = 600000;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usage: "encrypt" | "decrypt") {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** Encrypt any JSON value with a fresh 16-byte salt and 12-byte IV. */
export async function encryptJson(value: unknown, passphrase: string, iter = DEFAULT_ITERATIONS): Promise<CvVault> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iter, "encrypt");
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return { v: 1, iter, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data) };
}

/** Decrypt a vault. Throws on a wrong passphrase or a damaged vault. */
export async function decryptJson<T>(vault: CvVault, passphrase: string): Promise<T> {
  if (vault?.v !== 1) throw new Error("Unknown vault format.");
  const key = await deriveKey(passphrase, fromBase64(vault.salt), vault.iter, "decrypt");
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(vault.iv) },
    key,
    fromBase64(vault.data),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
