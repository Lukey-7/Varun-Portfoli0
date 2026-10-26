import { useEffect } from "react";
// Built by the cv-vault plugin in vite.config.ts: ciphertext, or null when CV_PASSPHRASE is unset.
import vault from "virtual:cv-vault";
import { CvGate } from "./CvGate";
import "./cv.css";

/** /cv: the private CV. Not in the navigation, the sitemap or search results. */
export default function CvPage() {
  useEffect(() => {
    document.title = "Private | Varun Darji";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow, noarchive, nosnippet";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return <CvGate vault={vault} />;
}
