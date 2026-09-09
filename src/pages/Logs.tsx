import { motion } from 'framer-motion';
import { GraduationCap, Briefcase, Sparkles } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { experience, education, softSkills, profile } from '@/data/profile';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const Logs = () => {
  return (
    <PageTransition>
      <div className="page-shell">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="mb-10 md:mb-14">
            <div className="section-eyebrow">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground tracking-widest">
                LOGS / EXPERIENCE
              </span>
            </div>

            <h1 className="section-title">
              <span className="gradient-text text-glow">Career Log</span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              {profile.summary}
            </p>
          </motion.div>

          {/* Experience timeline */}
          <section className="mb-14 md:mb-20">
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <Briefcase size={18} className="text-primary" />
              Professional Experience
            </h2>

            <div className="relative">
              {/* Rail: hidden on the narrowest screens where it only steals width */}
              <div className="hidden sm:block absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />

              <div className="space-y-5 md:space-y-6">
                {experience.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="relative sm:pl-10"
                  >
                    {/* Node */}
                    <span
                      className={`hidden sm:block absolute left-0 top-6 w-[15px] h-[15px] rounded-full border-2 ${
                        job.current
                          ? 'bg-primary border-primary shadow-[0_0_16px_hsl(var(--primary)/0.7)]'
                          : 'bg-background border-primary/40'
                      }`}
                    />

                    <div className="bento-card">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 mb-3">
                        <div>
                          <h3 className="text-lg md:text-xl font-semibold text-foreground">
                            {job.role}
                          </h3>
                          <p className="text-sm text-primary/90">
                            {job.company}
                            <span className="text-muted-foreground">
                              {' '}
                              · {job.location}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {job.current && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-success/15 border border-status-success/30 text-status-success text-[10px] tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
                              CURRENT
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {job.period}
                          </span>
                        </div>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {job.highlights.map((point) => (
                          <li
                            key={point}
                            className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed"
                          >
                            <span className="text-primary shrink-0 mt-0.5">▸</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap gap-2">
                        {job.stack.map((tech) => (
                          <span
                            key={tech}
                            className="px-2.5 py-1 text-[11px] rounded-full bg-primary/10 border border-primary/20 text-primary"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Education */}
          <section className="mb-14 md:mb-20">
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" />
              Education
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {education.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="bento-card flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs text-muted-foreground tracking-widest">
                      {item.year}
                    </span>
                    {item.detail && (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-primary/10 border border-primary/25 text-primary whitespace-nowrap">
                        {item.detail}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-foreground mb-1.5 leading-snug">
                    {item.degree}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.institution}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Soft skills */}
          <section>
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              How I Work
            </h2>

            <div className="flex flex-wrap gap-2.5">
              {softSkills.map((skill, index) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="px-3.5 py-2 rounded-xl glass text-sm text-muted-foreground"
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  );
};

export default Logs;
