import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import {
  skills,
  skillCategories,
  softSkills,
  type Skill,
} from '@/data/profile';

/**
 * Graph coordinates are percentages of the canvas. The canvas itself only
 * renders on large screens — below that the same data is shown as a grouped
 * grid, which is far more usable with a thumb.
 */
const nodePositions: Record<string, { x: number; y: number }> = {
  java: { x: 12, y: 12 },
  python: { x: 32, y: 16 },
  cpp: { x: 52, y: 10 },
  js: { x: 72, y: 14 },
  llm: { x: 88, y: 27 },
  frameworks: { x: 68, y: 33 },
  rag: { x: 46, y: 35 },
  fastapi: { x: 26, y: 37 },
  react: { x: 8, y: 35 },
  vector: { x: 60, y: 53 },
  nlp: { x: 38, y: 55 },
  databases: { x: 16, y: 57 },
  data: { x: 84, y: 53 },
  gcp: { x: 30, y: 77 },
  docker: { x: 54, y: 75 },
  cicd: { x: 76, y: 75 },
};

const categoryAccent: Record<string, string> = {
  Languages: 'text-primary',
  'AI/ML': 'text-primary',
  Web: 'text-primary',
  'Cloud & DevOps': 'text-primary',
  Data: 'text-primary',
};

const SkillDetail = ({
  skill,
  onPick,
}: {
  skill: Skill;
  onPick: (skill: Skill) => void;
}) => (
  <div className="glass-intense rounded-2xl p-5 sm:p-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
          {skill.name}
        </h3>
        <p className="text-muted-foreground text-sm mt-1">{skill.category}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-full md:w-auto">
          Connected to:
        </span>
        {skill.connections.map((id) => {
          const linked = skills.find((s) => s.id === id);
          return linked ? (
            <button
              key={id}
              onClick={() => onPick(linked)}
              className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs hover:bg-primary/20 transition-colors"
            >
              {linked.name}
            </button>
          ) : null;
        })}
      </div>
    </div>

    <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
      {skill.description}
    </p>
  </div>
);

const Vault = () => {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const activeId = selectedSkill?.id ?? hoveredSkill;
  const activeSkill = skills.find((s) => s.id === activeId);

  const isLinked = (id: string) =>
    !!activeSkill &&
    (activeSkill.id === id || activeSkill.connections.includes(id));

  return (
    <PageTransition>
      <div className="page-shell">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 md:mb-12"
          >
            <div className="section-eyebrow">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground tracking-widest">
                VAULT / TECHNICAL STACK
              </span>
            </div>

            <h1 className="section-title">
              <span className="gradient-text text-glow">Technical Stack</span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              Sixteen capabilities and how they connect. Select any node to see
              what it is used for and what it pairs with.
            </p>
          </motion.div>

          {/* Network canvas — large screens only */}
          <div className="relative w-full h-[680px] glass rounded-2xl overflow-hidden mb-8 hidden lg:block">
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {skills.map((skill) =>
                skill.connections.map((connectionId) => {
                  const start = nodePositions[skill.id];
                  const end = nodePositions[connectionId];
                  if (!start || !end) return null;

                  const highlighted =
                    activeId === skill.id || activeId === connectionId;

                  return (
                    <motion.line
                      key={`${skill.id}-${connectionId}`}
                      x1={`${start.x}%`}
                      y1={`${start.y}%`}
                      x2={`${end.x}%`}
                      y2={`${end.y}%`}
                      stroke={
                        highlighted
                          ? 'hsl(180, 100%, 50%)'
                          : 'hsl(180, 30%, 20%)'
                      }
                      strokeWidth={highlighted ? 2 : 1}
                      strokeDasharray={highlighted ? '0' : '5,5'}
                      initial={{ pathLength: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: highlighted ? 1 : activeId ? 0.12 : 0.3,
                      }}
                      transition={{ duration: 0.8 }}
                    />
                  );
                }),
              )}
            </svg>

            {skills.map((skill, index) => {
              const pos = nodePositions[skill.id];
              if (!pos) return null;

              const selected = selectedSkill?.id === skill.id;
              const linked = isLinked(skill.id);

              return (
                <motion.button
                  key={skill.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: activeId && !linked ? 0.35 : 1,
                    scale: 1,
                  }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-28 flex flex-col items-center"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onMouseEnter={() => setHoveredSkill(skill.id)}
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={() =>
                    setSelectedSkill(selected ? null : skill)
                  }
                >
                  <div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      selected
                        ? 'bg-primary/30 border-primary shadow-[0_0_30px_hsl(180,100%,50%/0.5)]'
                        : linked
                          ? 'bg-primary/20 border-primary/60'
                          : 'bg-muted/50 border-border hover:border-primary/50'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold tracking-wider ${
                        selected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {skill.short}
                    </span>
                  </div>

                  <span
                    className={`mt-2 text-[11px] leading-tight text-center ${
                      selected ? 'text-primary text-glow' : 'text-muted-foreground'
                    }`}
                  >
                    {skill.name}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {selectedSkill && (
              <motion.div
                key={selectedSkill.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mb-10 md:mb-12"
              >
                <SkillDetail skill={selectedSkill} onPick={setSelectedSkill} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grouped grid — the primary view on phones and tablets */}
          <div className="space-y-8 md:space-y-10">
            {skillCategories.map((category) => {
              const group = skills.filter((s) => s.category === category);
              if (!group.length) return null;

              return (
                <section key={category}>
                  <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <span className={categoryAccent[category]}>&gt;</span>
                    {category}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({group.length})
                    </span>
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {group.map((skill, index) => {
                      const selected = selectedSkill?.id === skill.id;
                      return (
                        <motion.button
                          key={skill.id}
                          initial={{ opacity: 0, y: 16 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          onClick={() =>
                            setSelectedSkill(selected ? null : skill)
                          }
                          className={`bento-card text-left ${
                            selected ? 'border-primary/50 glass-intense' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center text-[10px] font-bold ${
                                selected
                                  ? 'bg-primary/25 border-primary text-primary'
                                  : 'bg-muted/50 border-border text-muted-foreground'
                              }`}
                            >
                              {skill.short}
                            </span>
                            <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
                              {skill.name}
                            </h3>
                          </div>

                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                            {skill.description}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Soft skills */}
          <section className="mt-12 md:mt-16">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="text-primary">&gt;</span> Core Strengths
            </h2>

            <div className="flex flex-wrap gap-2.5">
              {softSkills.map((skill) => (
                <span
                  key={skill}
                  className="px-3.5 py-2 rounded-xl glass text-sm text-muted-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
};

export default Vault;
