import { motion } from 'framer-motion';
import {
  MapPin,
  Zap,
  ArrowUpRight,
  Terminal,
  GraduationCap,
  Github,
  Linkedin,
  Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';
import { profile, projects, experience, education } from '@/data/profile';

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const currentRole = experience[0];
const featured = projects.filter((project) => project.featured);
const highestDegree = education[0];

const Index = () => {
  return (
    <PageTransition>
      <div className="page-shell">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="space-y-10 md:space-y-12"
          >
            {/* Hero */}
            <motion.div
              variants={itemVariants}
              className="text-center space-y-5 md:space-y-6"
            >
              <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full">
                <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                  AI ENGINEER @ LETSTUTE
                </span>
              </div>

              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-none">
                <span className="gradient-text text-glow-intense">
                  {profile.shortName}
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto tracking-wide leading-relaxed px-2">
                Building at the intersection of{' '}
                <span className="text-primary">LLMs</span>,{' '}
                <span className="text-primary">retrieval</span> and{' '}
                <span className="text-primary">production systems</span>
              </p>

              <p className="text-xs sm:text-sm text-muted-foreground tracking-wide">
                M.Sc. Computer Science <span className="text-primary">·</span> RAG &
                Vector Search <span className="text-primary">·</span> Mumbai
              </p>

              {/* Primary actions — thumb-reachable on mobile */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2 max-w-md mx-auto sm:max-w-none">
                <Link
                  to="/nexus"
                  className="px-6 py-3 rounded-xl bg-primary/15 border border-primary/50 text-primary text-sm font-medium tracking-wider transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  VIEW PROJECTS
                </Link>
                <Link
                  to="/terminal"
                  className="px-6 py-3 rounded-xl glass text-foreground text-sm font-medium tracking-wider transition-colors hover:text-primary"
                >
                  GET IN TOUCH
                </Link>
              </div>

              {/* Social row */}
              <div className="flex items-center justify-center gap-3 pt-1">
                <a
                  href={profile.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="p-2.5 rounded-lg glass text-muted-foreground hover:text-primary transition-colors"
                >
                  <Github size={18} />
                </a>
                <a
                  href={profile.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="p-2.5 rounded-lg glass text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin size={18} />
                </a>
                <a
                  href={`mailto:${profile.email}`}
                  aria-label="Email"
                  className="p-2.5 rounded-lg glass text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail size={18} />
                </a>
              </div>
            </motion.div>

            {/* Bento Grid */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
            >
              {/* Current role — wide */}
              <Link to="/logs" className="md:col-span-2">
                <motion.div
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                        <Zap className="text-primary" size={20} />
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                          CURRENT ROLE
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                          <span className="text-xs text-status-success">
                            {currentRole.period}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight
                      className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                      size={20}
                    />
                  </div>

                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground mb-3 leading-snug">
                    {currentRole.role} at{' '}
                    <span className="text-primary text-glow">
                      {currentRole.company}
                    </span>
                  </h3>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Shipping AI features for e-learning clients end to end — from
                    prototype through to containerised deployment on Google Cloud.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-5">
                    {currentRole.stack.map((tech) => (
                      <span
                        key={tech}
                        className="px-3 py-1 text-xs rounded-full bg-primary/10 border border-primary/20 text-primary"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </Link>

              {/* Location */}
              <motion.div
                className="bento-card"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <MapPin className="text-primary" size={20} />
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                    LOCATION
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
                  Mumbai, <span className="text-primary">India</span>
                </h3>

                <p className="text-muted-foreground text-sm">{profile.timezone}</p>

                <div className="mt-5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Available for remote work globally
                  </span>
                </div>
              </motion.div>

              {/* Education */}
              <Link to="/logs">
                <motion.div
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <GraduationCap className="text-primary" size={20} />
                    </div>
                    <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                      EDUCATION
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2 leading-snug">
                    {highestDegree.degree}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {highestDegree.institution}
                  </p>

                  <p className="mt-4 text-xs text-primary">
                    {highestDegree.detail} · Class of {highestDegree.year}
                  </p>
                </motion.div>
              </Link>

              {/* Featured projects — wide */}
              <Link to="/nexus" className="md:col-span-2">
                <motion.div
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                      FEATURED WORK
                    </span>
                    <ArrowUpRight
                      className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                      size={20}
                    />
                  </div>

                  <div className="space-y-3">
                    {featured.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-baseline justify-between gap-3 py-2 border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm sm:text-base font-semibold text-foreground truncate">
                            {project.title}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {project.subtitle}
                          </p>
                        </div>
                        <span className="text-[10px] text-primary/70 font-mono whitespace-nowrap shrink-0">
                          {project.technologies[0]}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    Open the Nexus for full write-ups
                    <span className="text-primary"> →</span>
                  </p>
                </motion.div>
              </Link>

              {/* Terminal CTA */}
              <Link to="/terminal">
                <motion.div
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="h-full flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground tracking-widest">
                        QUICK ACTIONS
                      </span>
                      <h3 className="text-lg sm:text-xl font-semibold text-foreground mt-4 mb-2">
                        Establish Connection
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Browse the résumé as a shell session, or just grab the
                        contact links.
                      </p>
                    </div>

                    <div className="w-full mt-6 py-3 px-6 rounded-xl bg-primary/10 border border-primary/50 text-primary font-medium text-sm tracking-wider transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                      <span className="flex items-center justify-center gap-2">
                        <Terminal size={16} />
                        QUICK CONNECT
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>

            {/* Footer line */}
            <motion.div variants={itemVariants} className="text-center pt-2">
              <p className="text-xs sm:text-sm text-muted-foreground tracking-wide">
                <span className="text-primary font-mono">$</span> Explore the system.
                Navigate with purpose.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Index;
