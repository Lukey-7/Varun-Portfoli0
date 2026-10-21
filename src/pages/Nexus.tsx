import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X, Github, ExternalLink } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { projects, type Project } from '@/data/profile';

const statusStyles: Record<Project['status'], string> = {
  production: 'bg-status-success/15 text-status-success border-status-success/30',
  development: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  research: 'bg-primary/15 text-primary border-primary/30',
};

const ProjectCard = ({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    }}
    className="bento-card group h-full flex flex-col text-left"
  >
    <div className="flex items-start justify-between gap-3 mb-4">
      <span
        className={`px-3 py-1 rounded-full text-[10px] font-medium tracking-wider border ${
          statusStyles[project.status]
        }`}
      >
        {project.status.toUpperCase()}
      </span>
      <ArrowUpRight
        className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
        size={20}
      />
    </div>

    <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-tight">
      {project.title}
    </h3>

    <p className="text-sm text-primary/80 mb-3 font-medium leading-snug">
      {project.subtitle}
    </p>

    <p className="text-muted-foreground text-sm leading-relaxed mb-5 flex-1">
      {project.description}
    </p>

    <div className="flex flex-wrap gap-2 mb-5">
      {project.technologies.slice(0, 4).map((tech) => (
        <span
          key={tech}
          className="px-2 py-1 text-[11px] rounded bg-muted text-muted-foreground"
        >
          {tech}
        </span>
      ))}
      {project.technologies.length > 4 && (
        <span className="px-2 py-1 text-[11px] rounded bg-muted text-muted-foreground">
          +{project.technologies.length - 4}
        </span>
      )}
    </div>

    <div className="grid grid-cols-3 gap-2">
      {project.facts.map((fact) => (
        <div key={fact.label} className="text-center p-2 rounded-lg bg-muted/50">
          <div className="text-sm sm:text-base font-bold text-primary leading-tight">
            {fact.value}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {fact.label}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Nexus = () => {
  const [searchParams] = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => projects.find(p => p.id === searchParams.get('project')) ?? null);

  const featured = projects.filter((project) => project.featured);
  const others = projects.filter((project) => !project.featured);

  // Lock background scroll and allow Escape to dismiss while the modal is open.
  useEffect(() => {
    if (!selectedProject) return;

    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedProject(null);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedProject]);

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
                NEXUS / PROJECTS
              </span>
            </div>

            <h1 className="section-title">
              <span className="gradient-text text-glow">Project Archive</span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              AI systems, retrieval pipelines and a quantitative engine — the work
              that best represents how I build. Tap any card for the full write-up.
            </p>
          </motion.div>

          {/* Featured */}
          <section className="mb-12 md:mb-16">
            <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
              <span className="text-primary">&gt;</span> Featured
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featured.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <ProjectCard
                    project={project}
                    onSelect={() => setSelectedProject(project)}
                  />
                </motion.div>
              ))}
            </div>
          </section>

          {/* Also built */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
              <span className="text-primary">&gt;</span> Also Built
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {others.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <ProjectCard
                    project={project}
                    onSelect={() => setSelectedProject(project)}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Detail modal — a bottom sheet on phones, a centred dialog above md */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={selectedProject.title}
            className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-4"
            onClick={() => setSelectedProject(null)}
          >
            <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />

            <motion.div
              initial={{ y: '100%', opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0.6 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="relative glass-intense w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl max-h-[88vh] md:max-h-[85vh] overflow-y-auto overscroll-contain"
            >
              {/* Drag affordance on mobile */}
              <div className="md:hidden sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-gradient-to-b from-background/80 to-transparent">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
              </div>

              <button
                onClick={() => setSelectedProject(null)}
                aria-label="Close"
                className="absolute top-3 right-3 z-20 p-2.5 rounded-lg bg-background/60 border border-border/50 text-foreground"
              >
                <X size={18} />
              </button>

              <div
                className="p-5 sm:p-7 md:p-8 pt-4 md:pt-8"
                style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
              >
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-[10px] font-medium tracking-wider border mb-4 ${
                    statusStyles[selectedProject.status]
                  }`}
                >
                  {selectedProject.status.toUpperCase()}
                </span>

                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 pr-10 leading-tight">
                  {selectedProject.title}
                </h2>

                <p className="text-primary font-medium mb-6 text-sm sm:text-base">
                  {selectedProject.subtitle}
                </p>

                <div className="mb-8">
                  {selectedProject.longDescription
                    .split('\n')
                    .map((paragraph, i) =>
                      paragraph.trim() ? (
                        <p
                          key={i}
                          className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-4"
                        >
                          {paragraph.trim()}
                        </p>
                      ) : null,
                    )}
                </div>

                <div className="mb-8">
                  <h4 className="text-xs text-muted-foreground tracking-widest mb-3">
                    TECHNOLOGY STACK
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 text-xs sm:text-sm rounded-lg bg-primary/10 border border-primary/30 text-primary"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
                  {selectedProject.facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="text-center p-3 sm:p-4 rounded-xl bg-muted/50"
                    >
                      <div className="text-base sm:text-xl font-bold text-primary text-glow leading-tight">
                        {fact.value}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        {fact.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {selectedProject.links.github && (
                    <a
                      href={selectedProject.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <Github size={18} />
                      <span className="text-sm">Source Code</span>
                    </a>
                  )}
                  {selectedProject.links.live && (
                    <a
                      href={selectedProject.links.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <ExternalLink size={18} />
                      <span className="text-sm">Live Demo</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Nexus;
