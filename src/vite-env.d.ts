/// <reference types="vite/client" />

/** The private CV, encrypted at build time by the cv-vault plugin in vite.config.ts. Null without CV_PASSPHRASE. */
declare module "virtual:cv-vault" {
  import type { CvVault } from "@/sites/ordo/cv/crypto";
  const vault: CvVault | null;
  export default vault;
}
