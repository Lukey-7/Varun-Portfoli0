import {
  ArrowRight,
  BookOpen,
  FileText,
  ScanLine,
  Wallet,
  Network,
  BarChart3,
} from "lucide-react";

/** Editorial diagrams of the architecture, not fabricated product screenshots. */
export default function ProjectVisual({ kind }: { kind: string }) {
  if (kind === "retrieval")
    return (
      <div
        className="project-visual retrieval-visual"
        aria-label="Architecture diagram: source documents become indexed passages and cited learning material"
        role="img"
      >
        <div className="document-stack">
          <FileText />
          <FileText />
          <FileText />
        </div>
        <div className="diagram-link">
          <i />
          <ArrowRight size={17} />
        </div>
        <div className="retrieval-core">
          <BookOpen strokeWidth={1} size={48} />
          <span>
            retrieve
            <br />& ground
          </span>
        </div>
        <div className="diagram-link">
          <i />
          <ArrowRight size={17} />
        </div>
        <div className="source-lines">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} />
          ))}
          <b>source linked</b>
        </div>
      </div>
    );
  if (kind === "finance")
    return (
      <div
        className="project-visual finance-visual"
        aria-label="Conceptual illustration of transaction classification and bill scanning"
        role="img"
      >
        <div className="finance-orbit orbit-one" />
        <div className="finance-orbit orbit-two" />
        <div className="finance-chip">
          <Wallet size={45} strokeWidth={1} />
        </div>
        <div className="finance-label income">
          income <span>+</span>
        </div>
        <div className="finance-label transfer">
          transfer <ArrowRight size={13} />
        </div>
        <div className="finance-label scan">
          <ScanLine size={16} /> bill scan
        </div>
        <div className="finance-label review">review queue</div>
      </div>
    );
  if (kind === "agents")
    return (
      <div
        className="project-visual agent-visual"
        aria-label="Five-agent research architecture"
        role="img"
      >
        <div className="agent-ring" />
        <div className="agent-hub">
          <Network size={34} strokeWidth={1} />
        </div>
        {["plan", "retrieve", "summarise", "verify", "write"].map(
          (label, i) => (
            <span className={`agent-node agent-node-${i}`} key={label}>
              {label}
            </span>
          ),
        )}
      </div>
    );
  return (
    <div
      className="project-visual quant-visual"
      aria-label="Conceptual backtesting diagram, not a performance chart"
      role="img"
    >
      <div className="quant-grid">
        {Array.from({ length: 36 }, (_, i) => (
          <span
            key={i}
            style={{
              opacity: 0.15 + ((i * 13) % 17) / 20,
              transform: `scaleY(${0.2 + ((i * 7) % 13) / 13})`,
            }}
          />
        ))}
      </div>
      <div className="quant-label">
        <BarChart3 size={19} /> walk-forward validation
      </div>
    </div>
  );
}
