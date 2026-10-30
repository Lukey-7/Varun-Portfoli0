import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdoRoutes } from "@/sites/ordo/App";
import { CvGate } from "@/sites/ordo/cv/CvGate";
import { encryptJson, type CvVault } from "@/sites/ordo/cv/crypto";
import type { CvDocument } from "@/sites/ordo/cv/cvDocument";
import { applyShareHead, privateHead, sharePages, sitemap } from "@/sites/ordo/share";

beforeAll(async () => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  // jsdom has no SubtleCrypto; Node's WebCrypto is the same API the browser has.
  vi.stubGlobal("crypto", (await import("node:crypto")).webcrypto);
  HTMLCanvasElement.prototype.getContext = () => null;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrdoRoutes />
    </MemoryRouter>,
  );

const sample: CvDocument = {
  name: "Ada Sample",
  role: "Engineer",
  location: "Somewhere",
  email: "ada@example.com",
  phone: "+44 7700 900123",
  github: "https://github.com/ada",
  linkedin: "https://www.linkedin.com/in/ada/",
  summary: "Builds things and checks them.",
  experience: [{ role: "Engineer", company: "Example Ltd", period: "2024 — Present", highlights: ["Shipped a thing."] }],
  education: [{ degree: "B.Sc.", institution: "Example University", year: "2023", detail: "First class" }],
  projects: [{ name: "Widget", line: "A widget that works." }],
  skills: ["Testing", "Writing"],
};

const passphraseField = () => screen.getByLabelText("Passphrase");
const unlockButton = () => screen.getByRole("button", { name: "Unlock" });

describe("cv gate", () => {
  let vault: CvVault;
  beforeAll(async () => {
    vault = await encryptJson({ ...sample }, "correct horse", 1000);
  });

  it("says so plainly when the build has no vault", () => {
    render(<CvGate vault={null} />);
    expect(screen.getByText("This page is not set up.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Passphrase")).toBeNull();
  });

  it("asks for a passphrase and keeps Unlock disabled while it is empty", () => {
    render(<CvGate vault={vault} />);
    const field = passphraseField();
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(unlockButton()).toBeDisabled();
    fireEvent.change(field, { target: { value: "x" } });
    expect(unlockButton()).toBeEnabled();
    fireEvent.change(field, { target: { value: "" } });
    expect(unlockButton()).toBeDisabled();
  });

  it("keeps Unlock disabled for a passphrase that is only whitespace", () => {
    render(<CvGate vault={vault} />);
    fireEvent.change(passphraseField(), { target: { value: " \t  " } });
    expect(unlockButton()).toBeDisabled();
    fireEvent.change(passphraseField(), { target: { value: " a " } });
    expect(unlockButton()).toBeEnabled();
  });

  it("ignores spaces and line breaks around the right passphrase", async () => {
    render(<CvGate vault={vault} />);
    // A pasted line break is stripped by the input itself; the spaces and tab are ours to ignore.
    fireEvent.change(passphraseField(), { target: { value: "  correct horse \t\n" } });
    fireEvent.click(unlockButton());
    expect(await screen.findByRole("heading", { name: sample.name })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("returns to the field with the cursor at the end after a wrong passphrase", async () => {
    render(<CvGate vault={vault} />);
    const field = passphraseField() as HTMLInputElement;
    fireEvent.change(field, { target: { value: "wrong one" } });
    fireEvent.click(unlockButton());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(field).toHaveFocus();
    // Nothing is selected, so the next key adds to the entry instead of wiping it.
    expect(field.selectionStart).toBe("wrong one".length);
    expect(field.selectionEnd).toBe("wrong one".length);
  });

  it("rejects a wrong passphrase, then unlocks with the right one", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const storage = window.localStorage.length + window.sessionStorage.length;
    render(<CvGate vault={vault} />);

    fireEvent.change(passphraseField(), { target: { value: "wrong" } });
    fireEvent.click(unlockButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("That passphrase didn't work.");
    expect(screen.queryByRole("heading", { name: sample.name })).toBeNull();
    expect(document.body.textContent).not.toContain(sample.email);
    expect(document.body.textContent).not.toContain(sample.phone);

    fireEvent.change(passphraseField(), { target: { value: "correct horse" } });
    fireEvent.click(unlockButton());
    expect(await screen.findByRole("heading", { name: sample.name })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByLabelText("Passphrase")).toBeNull();
    expect(screen.getByRole("link", { name: sample.email })).toHaveAttribute("href", `mailto:${sample.email}`);
    expect(screen.getByRole("link", { name: sample.phone })).toHaveAttribute("href", "tel:+447700900123");
    expect(screen.getByText("Example Ltd", { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalledTimes(1);

    // The decrypted CV lives in React state only: not in storage, not in the URL.
    expect(window.localStorage.length + window.sessionStorage.length).toBe(storage);
    expect(window.location.href).not.toContain("correct");
  });
});

describe("cv route", () => {
  it("loads lazily and says so plainly without a vault", async () => {
    const { container } = renderAt("/cv");
    // The first lazy import is transformed on demand, which can take seconds when every file runs at once.
    expect(await screen.findByText("This page is not set up.", {}, { timeout: 10000 })).toBeInTheDocument();
    // The page's effect sets these just after the first paint.
    await waitFor(() => {
      expect(document.title).toBe("Private | Varun Darji");
      expect(document.head.querySelector('meta[name="robots"][content*="noindex"]')).not.toBeNull();
    });
    // Not linked from the header, the contact block or the footer.
    expect(screen.getByRole("navigation", { name: "Main navigation" }).querySelector('a[href^="/cv"]')).toBeNull();
    expect(container.querySelector('a[href^="/cv"]')).toBeNull();

    cleanup();
    expect(document.head.querySelector('meta[name="robots"][content*="noindex"]')).toBeNull();
  });
});

describe("cv stays out of search and share previews", () => {
  it("is not a share page and not in the sitemap", () => {
    expect(sharePages.some((page) => page.path === "/cv")).toBe(false);
    expect(sitemap("https://example.com", "2026-10-24")).not.toContain("/cv");
  });

  it("gets a private head with no description, share tags or canonical link", () => {
    const raw =
      "<html><head><title>Varun Darji | AI Engineer</title>" +
      '<meta name="description" content="old" />\n    <meta\n      name="keywords"\n      content="a, b"\n    />' +
      '<meta property="og:title" content="old" /><meta name="twitter:card" content="old" /></head><body></body></html>';
    const home = sharePages.find((page) => page.path === "/")!;
    for (const template of [raw, applyShareHead(raw, home, "https://example.com")]) {
      const html = privateHead(template);
      expect(html).toContain("<title>Private | Varun Darji</title>");
      expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />');
      expect(html).not.toContain("og:");
      expect(html).not.toContain("twitter:");
      expect(html).not.toContain('<link rel="canonical"');
      expect(html).not.toMatch(/name="(description|keywords)"/);
    }
  });
});

describe("cv bundle", () => {
  // The CV's lazy chunk must hold ciphertext only, so app code never imports
  // the profile data or the build-time document builder.
  it("keeps plaintext data out of the page's imports", () => {
    const dir = resolve(__dirname, "../sites/ordo/cv");
    for (const name of ["CvPage.tsx", "CvGate.tsx", "crypto.ts"]) {
      const source = readFileSync(join(dir, name), "utf8");
      const imports = [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)];
      for (const [, typeOnly, from] of imports) {
        expect(from, `${name} imports ${from}`).not.toMatch(/data\/|content|share|projectShowcase|journey|writing/);
        if (/cvDocument/.test(from)) expect(typeOnly, `${name} imports cvDocument as a value`).toBeTruthy();
      }
    }

    const src = resolve(__dirname, "..");
    const appFiles: string[] = [];
    const walk = (folder: string) => {
      for (const entry of readdirSync(folder)) {
        const path = join(folder, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== "test") walk(path);
        } else if (/\.tsx?$/.test(entry) && entry !== "cvDocument.ts") appFiles.push(path);
      }
    };
    walk(src);
    const valueImports = appFiles.filter((file) =>
      /^import\s+(?!type\s)[^;]*from\s+"[^"]*cvDocument[^"]*"/m.test(readFileSync(file, "utf8")),
    );
    expect(valueImports).toEqual([]);
  });
});
