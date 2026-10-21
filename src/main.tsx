import { createRoot } from "react-dom/client";
// Which site this build serves is chosen by the Vite mode (see vite.config.ts).
import App from "@site/App";
import "./index.css";
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

createRoot(document.getElementById("root")!).render(<App />);
