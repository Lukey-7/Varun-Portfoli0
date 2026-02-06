import { motion } from 'framer-motion';
import { MapPin, Zap, ArrowUpRight, Terminal } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { Link } from 'react-router-dom';

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const Index = () => {
  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="space-y-12"
          >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-4">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground tracking-widest">SYSTEM ACTIVE</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter">
                <span className="gradient-text text-glow-intense">VARUN</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto tracking-wide">
                Building at the intersection of <span className="text-primary">AI</span> <span className="text-primary">&</span> <span className="text-primary">Intelligent Systems</span>
              </p>
              <p className="text-sm text-muted-foreground tracking-wide">
                Grad CS Researcher <span className="text-primary">·</span> ML Engineer <span className="text-primary">·</span> Mumbai
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Terminal size={14} className="text-primary" />
                <span className="font-mono">~/varun --version 2.0</span>
              </div>
            </motion.div>

            {/* Bento Grid */}
            <motion.div 
              variants={itemVariants}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
            >
              {/* Status Card - Large */}
              <motion.div 
                className="bento-card lg:col-span-2 group cursor-pointer"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <Zap className="text-primary" size={20} />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground tracking-widest">CURRENT STATUS</span>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                        <span className="text-xs text-status-success">ACTIVE</span>
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
                </div>
                
                <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-3">
                  Currently architecting <span className="text-primary text-glow">RAG pipelines</span>
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Building intelligent document retrieval systems leveraging vector embeddings, 
                  semantic search, and large language models for enterprise-scale knowledge extraction.
                </p>
                
                <div className="flex flex-wrap gap-2 mt-6">
                  {['Python', 'LangChain', 'RAG', 'OpenAI'].map((tech) => (
                    <span 
                      key={tech}
                      className="px-3 py-1 text-xs rounded-full bg-primary/10 border border-primary/20 text-primary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Location Card */}
              <motion.div 
                className="bento-card group cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <MapPin className="text-primary" size={20} />
                  </div>
                  <span className="text-xs text-muted-foreground tracking-widest">LOCATION</span>
                </div>
                
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Mumbai, <span className="text-primary">India</span>
                </h3>
                
                <p className="text-muted-foreground text-sm">
                  IST (UTC+5:30)
                </p>
                
                <div className="mt-6 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">Available for remote work globally</span>
                </div>
              </motion.div>

              {/* Quick Connect Card */}
              <Link to="/terminal" className="cursor-pointer">
                <motion.div 
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="h-full flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground tracking-widest">QUICK ACTIONS</span>
                      <h3 className="text-xl font-semibold text-foreground mt-4 mb-2">
                        Establish Connection
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Access the terminal for direct communication
                      </p>
                    </div>
                    
                    <motion.button
                      className="w-full mt-6 py-3 px-6 rounded-xl bg-primary/10 border border-primary/50 text-primary font-medium text-sm tracking-wider transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-glow-intense cursor-pointer"
                      whileHover={{ boxShadow: '0 0 30px hsl(var(--primary) / 0.4)' }}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Terminal size={16} />
                        QUICK CONNECT
                      </span>
                    </motion.button>
                  </div>
                </motion.div>
              </Link>

              {/* Projects Preview Card */}
              <Link to="/nexus" className="lg:col-span-2 cursor-pointer">
                <motion.div 
                  className="bento-card group h-full"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-xs text-muted-foreground tracking-widest">FEATURED PROJECT</span>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
                  </div>
                  
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                    Intelligent Notes <span className="text-primary text-glow">→</span>
                  </h3>
                  
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                    Automated Document Intelligence Pipeline — Semantic knowledge retrieval 
                    powered by LLMs and RAG architecture.
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div 
                          key={i}
                          className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center"
                        >
                          <span className="text-xs text-primary">{i}</span>
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">View all projects in Nexus →</span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>

            {/* Bottom CTA */}
            <motion.div variants={itemVariants} className="text-center pt-8">
              <p className="text-sm text-muted-foreground tracking-wide">
                <span className="text-primary font-mono">$</span> Explore the system. Navigate with purpose.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Index;
