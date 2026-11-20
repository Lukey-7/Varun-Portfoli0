import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DecodeText } from "../motion/DecodeText";

/**
 * The opening of every lab page: a decoded mono eyebrow, a large title whose
 * second half is muted, a short intro and an optional instrument on the right.
 */
export function LabHero({
  code,
  eyebrow,
  title,
  muted,
  intro,
  aside,
}: {
  code: string;
  eyebrow: string;
  title: string;
  muted?: string;
  intro: ReactNode;
  aside?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <section className="lab-hero" aria-labelledby="lab-title">
      <motion.div
        className="lab-hero-copy"
        initial={reduced ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="lab-eyebrow mono">
          <DecodeText text={`Lab / ${code} / ${eyebrow}`} duration={650} />
        </p>
        <h1 id="lab-title" className="lab-title">
          {title}
          {muted && (
            <>
              {" "}
              <span>{muted}</span>
            </>
          )}
        </h1>
        <div className="lab-intro">{intro}</div>
      </motion.div>
      {aside && (
        <motion.div
          className="lab-hero-aside"
          initial={reduced ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          {aside}
        </motion.div>
      )}
    </section>
  );
}

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}

/** A section heading in the lab's style: a mono index, then the title. */
export function LabSectionTitle({ index, children, id }: { index: string; children: ReactNode; id?: string }) {
  return (
    <h2 className="lab-section-title" id={id}>
      <span className="mono">{index}</span>
      {children}
    </h2>
  );
}
