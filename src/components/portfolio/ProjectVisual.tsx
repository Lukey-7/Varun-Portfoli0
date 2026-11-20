import {
  ArrowRight,
  BookOpen,
  Eye,
  FileText,
  Package,
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
  if (kind === "recon")
    return (
      <div
        className="project-visual recon-visual"
        aria-label="Reconciliation diagram: book and custodian ledgers are matched row by row, one break is sized in basis points of NAV, passes a four-eyes sign-off and is written to a hash-chained audit log"
        role="img"
      >
        <div className="recon-ledgers">
          <div className="recon-head">
            <b>book</b>
            <b>custodian</b>
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div
              className={`recon-row${i === 2 ? " is-break" : ""}`}
              key={i}
            >
              <span />
              <i />
              <span />
            </div>
          ))}
        </div>
        <div className="diagram-link">
          <i />
          <ArrowRight size={13} />
        </div>
        <div className="recon-gate">
          <span className="recon-break">Δ 3.2 bp</span>
          <span className="recon-eyes">
            <Eye size={14} strokeWidth={1.25} />
            <Eye size={14} strokeWidth={1.25} />
          </span>
          <small>four eyes</small>
        </div>
        <div className="diagram-link">
          <i />
          <ArrowRight size={13} />
        </div>
        <div className="recon-chain">
          {["#4e1a", "#9c07", "#d2b3"].map((hash) => (
            <span key={hash}>{hash}</span>
          ))}
        </div>
      </div>
    );
  if (kind === "inventory")
    return (
      <div
        className="project-visual inventory-visual"
        aria-label="Inventory diagram: an order rides a lead-time conveyor to the shelf, stock rises with each delivery and falls with daily demand, and a sale is lost when the shelf runs empty"
        role="img"
      >
        <span className="inv-chip inv-order">order</span>
        <div className="inv-belt">
          <span className="inv-crate">
            <Package size={14} strokeWidth={1.25} />
          </span>
          <div className="inv-slots">
            <i />
            <i />
            <i />
            <i />
          </div>
          <small>lead time</small>
        </div>
        <div className="inv-shelf">
          <b>stock</b>
          <div className="inv-tank">
            <span className="inv-level" />
            <i className="inv-mark inv-mark-max">S</i>
            <i className="inv-mark inv-mark-min">s</i>
          </div>
        </div>
        <div className="inv-demand">
          <span className="inv-chip inv-sold">
            demand <ArrowRight size={11} />
          </span>
          <span className="inv-chip inv-lost">lost sale ×</span>
        </div>
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
