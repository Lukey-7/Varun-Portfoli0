import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * A two-line page title whose lines rise out of a hairline mask, one after
 * the other. The second line keeps the site's muted colour. The words are in
 * the DOM from the first render, so the heading's name never changes.
 */
export function MaskTitle({
  lines,
  delay = 0.05,
  as: Tag = "h1",
  className,
}: {
  lines: readonly [string, string];
  delay?: number;
  as?: "h1" | "h2";
  className?: string;
}) {
  const reduced = useReducedMotion();
  const rise = (index: number) =>
    reduced
      ? {}
      : {
          initial: { y: "105%" },
          animate: { y: "0%" },
          transition: { duration: 0.8, delay: delay + index * 0.09, ease: EASE },
        };
  return (
    <Tag className={className}>
      <span className="ct-mask ct-lead">
        <motion.span className="ct-mask-inner" {...rise(0)}>
          {lines[0]}
        </motion.span>
      </span>
      <br />
      <span className="ct-mask">
        <motion.span className="ct-mask-inner" {...rise(1)}>
          {lines[1]}
        </motion.span>
      </span>
    </Tag>
  );
}
