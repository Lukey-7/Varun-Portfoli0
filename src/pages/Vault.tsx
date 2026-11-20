import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { skillCategories, softSkills, type SkillCategory } from "@/data/profile";
import { LabHero, LabSectionTitle, Reveal } from "@/sites/cyan/lab/LabParts";
import { AreaSpectrum } from "@/sites/cyan/lab/vault/AreaSpectrum";
import { NODES, NODE_BY_ID, TOTALS } from "@/sites/cyan/lab/vault/graph";
import { SkillConstellation } from "@/sites/cyan/lab/vault/SkillConstellation";
import { SkillDossier } from "@/sites/cyan/lab/vault/SkillDossier";
import { SkillIndex } from "@/sites/cyan/lab/vault/SkillIndex";
import "@/sites/cyan/lab/vault.css";

const NUMBERS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
const inWords = (n: number) => NUMBERS[n] ?? String(n);

/**
 * Lab / 03: the skill map. A radar-style star chart of every skill, a readout
 * for the selected one, and the same skills as a plain index below. The
 * selection lives in the address (?skill=python) so a view can be shared.
 */
const Vault = () => {
  const [params, setParams] = useSearchParams();
  const raw = params.get("skill");
  const selected = raw && NODE_BY_ID.has(raw) ? raw : null;
  const [filter, setFilter] = useState<SkillCategory | null>(null);
  const chartRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const select = useCallback(
    (id: string | null) => {
      if (id && filter && NODE_BY_ID.get(id)?.skill.category !== filter) setFilter(null);
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set("skill", id);
          else next.delete("skill");
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [filter, setParams],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) select(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, select]);

  const showOnChart = (id: string) => {
    select(id);
    chartRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const node = selected ? NODE_BY_ID.get(selected) : undefined;

  return (
    <div className="vault-page">
      <LabHero
        code="03"
        eyebrow="Skill map"
        title="What I build with,"
        muted="and how it all connects."
        intro={
          <>
            <p>
              {inWords(TOTALS.skills)} skills across {inWords(TOTALS.areas).toLowerCase()} areas, plotted like a star
              chart. Each area holds a sector of the dial, the best-linked skills sit nearest the centre, and a line
              joins every pair that relate.
            </p>
            <p>Select a skill to bring it to the middle and read what it covers.</p>
          </>
        }
        aside={<AreaSpectrum filter={filter} />}
      />

      <section ref={chartRef} className="lab-section vault-chart" aria-labelledby="vault-chart-title">
        <div className="vault-chart-head">
          <LabSectionTitle index="01" id="vault-chart-title">
            The chart
          </LabSectionTitle>
          <div className="vault-filters" role="group" aria-label="Show one area">
            <button type="button" className="lab-chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
              All <span className="vault-chip-count">{String(TOTALS.skills).padStart(2, "0")}</span>
            </button>
            {skillCategories.map((category) => (
              <button
                key={category}
                type="button"
                className="lab-chip"
                aria-pressed={filter === category}
                onClick={() => setFilter(filter === category ? null : category)}
              >
                {category}
                <span className="vault-chip-count">
                  {String(NODES.filter((n) => n.skill.category === category).length).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="vault-chart-grid">
          <SkillConstellation selected={selected} filter={filter} onSelect={select} />
          <SkillDossier selected={selected} onSelect={select} />
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {node ? `Chart centred on ${node.skill.name}, with ${node.links.length} linked skills.` : ""}
        </p>
      </section>

      <section className="lab-section vault-index-section" aria-labelledby="vault-index-title">
        <LabSectionTitle index="02" id="vault-index-title">
          Index
        </LabSectionTitle>
        <p className="vault-section-intro">Every skill on the chart, in plain text, grouped by area.</p>
        <SkillIndex selected={selected} onShow={showOnChart} />
      </section>

      <Reveal as="section" className="lab-section vault-strengths">
        <LabSectionTitle index="03">Working strengths</LabSectionTitle>
        <ul className="vault-strength-list">
          {softSkills.map((skill, k) => (
            <li key={skill}>
              <span className="mono">{String(k + 1).padStart(2, "0")}</span>
              {skill}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
};

export default Vault;
