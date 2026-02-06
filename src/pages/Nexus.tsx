import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X, Github, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import PageTransition from '@/components/PageTransition';

interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string;
  technologies: string[];
  metrics: { label: string; value: string }[];
  links: { github?: string; live?: string };
  status: 'production' | 'development' | 'archived';
}

const projects: Project[] = [
  {
    id: 'intelligent-notes',
    title: 'Intelligent Notes',
    subtitle: 'Automated Document Intelligence Pipeline',
    description: 'Semantic knowledge extraction from complex documents using Python, LangChain, and RAG architecture.',
    longDescription: `A document intelligence pipeline that transforms unstructured academic and technical documents into searchable, semantically indexed knowledge.

    Built with Retrieval-Augmented Generation (RAG) architecture, the system uses LangChain for orchestration, OpenAI embeddings for semantic chunking, and FastAPI for the service layer.

    Key features include multi-format document ingestion, context-aware query resolution, and streaming response generation for real-time knowledge retrieval.`,
    technologies: ['Python', 'LangChain', 'RAG', 'OpenAI', 'FastAPI'],
    metrics: [
      { label: 'Query Latency', value: '<300ms' },
      { label: 'Retrieval Accuracy', value: '91%' },
      { label: 'Docs Indexed', value: '500+' },
    ],
    links: { github: 'https://github.com/Lukey-7' },
    status: 'production',
  },
  {
    id: 'dnd-companion',
    title: 'D&D Companion',
    subtitle: 'Dungeons & Dragons Game Management System',
    description: 'UI/UX for complex game states and database management for character and campaign tracking.',
    longDescription: `A comprehensive game management application for Dungeons & Dragons campaigns, designed to handle complex game state across multiple sessions.

    Features include character sheet management, campaign timeline tracking, encounter planning, and real-time session notes with collaborative editing support.

    Built with a focus on responsive UI for both desktop and tablet use during tabletop sessions, with PostgreSQL backing for persistent campaign data.`,
    technologies: ['React', 'Tailwind CSS', 'TypeScript', 'PostgreSQL'],
    metrics: [
      { label: 'Components', value: '40+' },
      { label: 'Game States', value: '12' },
      { label: 'Status', value: 'WIP' },
    ],
    links: { github: 'https://github.com/Lukey-7' },
    status: 'development',
  },
];

const Nexus = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('project-scroll');
    if (container) {
      const scrollAmount = 400;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground tracking-widest">NEXUS / PROJECTS</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              <span className="gradient-text text-glow">Project Archive</span>
            </h1>
            
            <p className="text-muted-foreground max-w-2xl">
              A curated collection of engineering projects — from AI-powered document
              intelligence to full-stack application development.
            </p>
          </motion.div>

          {/* Scroll Controls */}
          <div className="flex items-center justify-end gap-2 mb-6">
            <button
              onClick={() => scroll('left')}
              className="p-3 glass rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <ChevronLeft className="text-foreground" size={20} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-3 glass rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="text-foreground" size={20} />
            </button>
          </div>

          {/* Horizontal Scroll Gallery */}
          <div 
            id="project-scroll"
            className="horizontal-scroll"
            onScroll={(e) => setScrollPosition((e.target as HTMLDivElement).scrollLeft)}
          >
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onClick={() => setSelectedProject(project)}
                className="w-[350px] md:w-[450px] bento-card group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium tracking-wider ${
                    project.status === 'production' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : project.status === 'development'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {project.status.toUpperCase()}
                  </div>
                  <ArrowUpRight 
                    className="text-muted-foreground group-hover:text-primary transition-colors" 
                    size={20} 
                  />
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {project.title}
                </h3>
                
                <p className="text-sm text-primary/80 mb-4 font-medium">
                  {project.subtitle}
                </p>
                
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {project.technologies.slice(0, 4).map((tech) => (
                    <span 
                      key={tech}
                      className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.technologies.length > 4 && (
                    <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                      +{project.technologies.length - 4}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {project.metrics.map((metric) => (
                    <div key={metric.label} className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold text-primary">{metric.value}</div>
                      <div className="text-xs text-muted-foreground">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Detail Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProject(null)}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
            
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative glass-intense rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedProject(null)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="text-foreground" size={20} />
              </button>

              <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium tracking-wider mb-4 ${
                selectedProject.status === 'production' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              }`}>
                {selectedProject.status.toUpperCase()}
              </div>

              <h2 className="text-3xl font-bold text-foreground mb-2">
                {selectedProject.title}
              </h2>
              
              <p className="text-primary font-medium mb-6">
                {selectedProject.subtitle}
              </p>

              <div className="prose prose-invert prose-sm max-w-none mb-8">
                {selectedProject.longDescription.split('\n').map((paragraph, i) => (
                  paragraph.trim() && (
                    <p key={i} className="text-muted-foreground leading-relaxed mb-4">
                      {paragraph.trim()}
                    </p>
                  )
                ))}
              </div>

              <div className="mb-8">
                <h4 className="text-sm text-muted-foreground tracking-widest mb-3">TECHNOLOGY STACK</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.technologies.map((tech) => (
                    <span 
                      key={tech}
                      className="px-3 py-1 text-sm rounded-lg bg-primary/10 border border-primary/30 text-primary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {selectedProject.metrics.map((metric) => (
                  <div key={metric.label} className="text-center p-4 rounded-xl bg-muted/50">
                    <div className="text-2xl font-bold text-primary text-glow">{metric.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{metric.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                {selectedProject.links.github && (
                  <a
                    href={selectedProject.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer"
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    <ExternalLink size={18} />
                    <span className="text-sm">Live Demo</span>
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Nexus;
