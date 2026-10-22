import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { education, experience } from "@/data/profile";

/**
 * Education as a path rather than a list: oldest first, a line that draws
 * itself as the visitor scrolls, and today's role as the last stop.
 */
export function EducationTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const current = experience.find((job) => job.current);
  const stops = [...education].reverse();

  return (
    <div className="edu-timeline">
      <h3>Education</h3>
      <ol ref={ref}>
        <motion.i
          className="edu-line"
          aria-hidden="true"
          style={reduced ? undefined : { scaleY: progress }}
        />
        {stops.map((item, index) => (
          <motion.li
            key={item.id}
            initial={reduced ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
          >
            <span className="edu-year mono">{item.year}</span>
            <span className="edu-node" aria-hidden="true" />
            <div className="edu-copy">
              <strong>{item.degree}</strong>
              <span>{item.institution}</span>
              {item.detail && <span className="edu-detail mono">{item.detail}</span>}
            </div>
          </motion.li>
        ))}
        {current && (
          <motion.li
            className="is-now"
            initial={reduced ? false : { opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: stops.length * 0.08 }}
          >
            <span className="edu-year mono">Now</span>
            <span className="edu-node" aria-hidden="true" />
            <div className="edu-copy">
              <strong>{current.role}</strong>
              <span>
                {current.company}, since {current.period.split(/\s[—–-]\s/)[0]}
              </span>
            </div>
          </motion.li>
        )}
      </ol>
    </div>
  );
}
