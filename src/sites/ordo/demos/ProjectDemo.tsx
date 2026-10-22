import { Component, lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";

// Each demo is its own chunk, loaded only when a visitor opens that project.
const loaders = import.meta.glob<{ default: ComponentType }>(["./*Demo.tsx", "!./ProjectDemo.tsx"]);

/** Project id (as used in projectShowcase) → demo file. */
const FILES: Record<string, string> = {
  studyforge: "./StudyForgeDemo.tsx",
  fintrack: "./FinTrackDemo.tsx",
  mara: "./MaraDemo.tsx",
  axiomquant: "./AxiomQuantDemo.tsx",
  sprachweg: "./SprachwegDemo.tsx",
  tetris: "./ArcadeDemo.tsx",
};

const cache = new Map<string, LazyExoticComponent<ComponentType>>();

function demoFor(id: string) {
  const load = loaders[FILES[id] ?? ""];
  if (!load) return null;
  if (!cache.has(id)) cache.set(id, lazy(load));
  return cache.get(id)!;
}

export function hasDemo(id: string) {
  return Boolean(loaders[FILES[id] ?? ""]);
}

/** A broken demo should never take the project page down with it. */
class DemoBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="demo-fallback mono">The demo could not start in this browser.</p>
    ) : (
      this.props.children
    );
  }
}

export function ProjectDemo({ id }: { id: string }) {
  const Demo = demoFor(id);
  if (!Demo) return null;
  return (
    <DemoBoundary>
      <Suspense fallback={<p className="demo-fallback mono">Loading the demo…</p>}>
        <Demo />
      </Suspense>
    </DemoBoundary>
  );
}
