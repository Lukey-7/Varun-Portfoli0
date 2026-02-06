import { useState } from 'react';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'Advanced' | 'Expert' | 'Proficient';
  experience: string;
  description: string;
  connections: string[];
}

const skills: Skill[] = [
  {
    id: 'python',
    name: 'Python',
    category: 'Core',
    level: 'Advanced',
    experience: '3+ years',
    description: 'Primary language for AI/ML pipelines, data processing, and backend development. Comfortable with asyncio, type annotations, and scientific computing libraries.',
    connections: ['llm', 'dsa', 'ir', 'databases', 'docker'],
  },
  {
    id: 'llm',
    name: 'LLM Integration',
    category: 'AI/ML',
    level: 'Advanced',
    experience: '1+ year',
    description: 'Hands-on experience with RAG architectures, LangChain orchestration, OpenAI APIs, prompt engineering, and semantic retrieval pipelines.',
    connections: ['python', 'ir', 'cloud', 'databases'],
  },
  {
    id: 'react',
    name: 'React / Tailwind',
    category: 'Frontend',
    level: 'Proficient',
    experience: '2+ years',
    description: 'Component-driven UI development with React, Tailwind CSS, and TypeScript. Experience building responsive, accessible interfaces for complex applications.',
    connections: ['python', 'dsa', 'docker'],
  },
  {
    id: 'security',
    name: 'Cybersecurity',
    category: 'Security',
    level: 'Proficient',
    experience: '1-Year Diploma',
    description: 'Formal training in network security, vulnerability assessment, secure coding practices, and OWASP fundamentals through a dedicated diploma program.',
    connections: ['python', 'dsa', 'docker'],
  },
  {
    id: 'dsa',
    name: 'DSA',
    category: 'Academic',
    level: 'Advanced',
    experience: '3+ years',
    description: 'Strong foundation in data structures and algorithms. Proficient in problem-solving, competitive programming concepts, and algorithmic complexity analysis.',
    connections: ['python', 'react', 'security', 'ir'],
  },
  {
    id: 'ir',
    name: 'Information Retrieval',
    category: 'Academic',
    level: 'Advanced',
    experience: '1+ year',
    description: 'Academic specialization in IR systems including vector search, TF-IDF, BM25, semantic embeddings, and evaluation metrics for search relevance.',
    connections: ['python', 'llm', 'dsa'],
  },
  {
    id: 'nlp',
    name: 'NLP & Text Mining',
    category: 'AI/ML',
    level: 'Advanced',
    experience: '1+ year',
    description: 'Text preprocessing, named entity recognition, sentiment analysis, and transformer-based models. Experience with spaCy, Hugging Face, and building custom NLP pipelines for domain-specific tasks.',
    connections: ['python', 'llm', 'ir'],
  },
  {
    id: 'docker',
    name: 'Docker & DevOps',
    category: 'Infrastructure',
    level: 'Proficient',
    experience: '1+ year',
    description: 'Containerized deployments with Docker and Docker Compose. Familiar with CI/CD pipelines, GitHub Actions, and infrastructure-as-code workflows for reproducible environments.',
    connections: ['python', 'cloud', 'security'],
  },
  {
    id: 'cloud',
    name: 'Cloud Platforms',
    category: 'Infrastructure',
    level: 'Proficient',
    experience: '1+ year',
    description: 'Working knowledge of AWS and GCP services — EC2, S3, Lambda, Cloud Functions, and managed databases. Experienced in deploying ML models and APIs to cloud environments.',
    connections: ['docker', 'python', 'llm'],
  },
  {
    id: 'databases',
    name: 'SQL & NoSQL',
    category: 'Core',
    level: 'Advanced',
    experience: '2+ years',
    description: 'Proficient with PostgreSQL, MongoDB, and Redis. Experience designing schemas, writing optimized queries, managing migrations, and integrating vector databases like Pinecone for ML workloads.',
    connections: ['python', 'ir', 'cloud'],
  },
];

const skillPositions: { [key: string]: { x: number; y: number } } = {
  python: { x: 50, y: 15 },
  llm: { x: 20, y: 35 },
  react: { x: 80, y: 35 },
  security: { x: 90, y: 60 },
  dsa: { x: 50, y: 50 },
  ir: { x: 10, y: 60 },
  nlp: { x: 80, y: 75 },
  docker: { x: 50, y: 80 },
  cloud: { x: 25, y: 75 },
  databases: { x: 35, y: 55 },
};

const Vault = () => {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Expert': return 'text-primary border-primary bg-primary/20';
      case 'Advanced': return 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10';
      case 'Proficient': return 'text-cyan-600 border-cyan-600/50 bg-cyan-600/10';
      default: return 'text-muted-foreground border-border bg-muted';
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
              <span className="text-xs text-muted-foreground tracking-widest">VAULT / SYSTEM DIAGNOSTICS</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              <span className="gradient-text text-glow">Technical Stack</span>
            </h1>
            
            <p className="text-muted-foreground max-w-2xl">
              Core competencies and interconnected skill nodes. Each capability 
              links to complementary technologies in the system architecture.
            </p>
          </motion.div>

          {/* Network Visualization */}
          <div className="relative w-full h-[500px] md:h-[600px] glass rounded-2xl overflow-hidden mb-12">
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {skills.map((skill) =>
                skill.connections.map((connectionId) => {
                  const targetSkill = skills.find((s) => s.id === connectionId);
                  if (!targetSkill) return null;
                  
                  const startPos = skillPositions[skill.id];
                  const endPos = skillPositions[connectionId];
                  
                  const isHighlighted = 
                    hoveredSkill === skill.id || 
                    hoveredSkill === connectionId ||
                    selectedSkill?.id === skill.id ||
                    selectedSkill?.id === connectionId;
                  
                  return (
                    <motion.line
                      key={`${skill.id}-${connectionId}`}
                      x1={`${startPos.x}%`}
                      y1={`${startPos.y}%`}
                      x2={`${endPos.x}%`}
                      y2={`${endPos.y}%`}
                      stroke={isHighlighted ? 'hsl(180, 100%, 50%)' : 'hsl(180, 30%, 20%)'}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeDasharray={isHighlighted ? '0' : '5,5'}
                      initial={{ pathLength: 0 }}
                      animate={{ 
                        pathLength: 1,
                        opacity: isHighlighted ? 1 : 0.3,
                      }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  );
                })
              )}
            </svg>

            {/* Skill Nodes */}
            {skills.map((skill, index) => {
              const pos = skillPositions[skill.id];
              const isSelected = selectedSkill?.id === skill.id;
              const isConnected = selectedSkill?.connections.includes(skill.id) || 
                                  skills.find(s => s.id === selectedSkill?.id)?.connections.includes(skill.id);
              
              return (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onMouseEnter={() => setHoveredSkill(skill.id)}
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={() => setSelectedSkill(isSelected ? null : skill)}
                >
                  <motion.div
                    className={`relative flex flex-col items-center ${
                      isSelected ? 'z-10' : ''
                    }`}
                    whileHover={{ scale: 1.1 }}
                    animate={{ scale: isSelected ? 1.15 : 1 }}
                  >
                    {/* Glow effect */}
                    <div 
                      className={`absolute inset-0 rounded-full blur-xl transition-opacity duration-300 ${
                        isSelected || isConnected ? 'opacity-60' : 'opacity-0'
                      }`}
                      style={{ background: 'hsl(180, 100%, 50%)', transform: 'scale(2)' }}
                    />
                    
                    {/* Node circle */}
                    <motion.div
                      className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isSelected 
                          ? 'bg-primary/30 border-primary shadow-[0_0_30px_hsl(180,100%,50%/0.5)]'
                          : isConnected
                          ? 'bg-primary/20 border-primary/50'
                          : 'bg-muted/50 border-border hover:border-primary/50'
                      }`}
                      animate={{
                        boxShadow: isSelected 
                          ? '0 0 40px hsl(180, 100%, 50%, 0.4)' 
                          : '0 0 0px transparent',
                      }}
                    >
                      <span className={`text-xs md:text-sm font-bold tracking-wider ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}>
                        {skill.name.slice(0, 3).toUpperCase()}
                      </span>
                    </motion.div>
                    
                    {/* Label */}
                    <motion.div 
                      className="mt-2 text-center"
                      animate={{ opacity: isSelected || hoveredSkill === skill.id ? 1 : 0.7 }}
                    >
                      <p className={`text-xs md:text-sm font-medium ${
                        isSelected ? 'text-primary text-glow' : 'text-foreground'
                      }`}>
                        {skill.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {skill.experience}
                      </p>
                    </motion.div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          {/* Skill Detail Panel */}
          <motion.div
            initial={false}
            animate={{ 
              height: selectedSkill ? 'auto' : 0,
              opacity: selectedSkill ? 1 : 0,
            }}
            className="overflow-hidden"
          >
            {selectedSkill && (
              <div className="glass-intense rounded-2xl p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-foreground">
                        {selectedSkill.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(selectedSkill.level)}`}>
                        {selectedSkill.level}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {selectedSkill.category} • {selectedSkill.experience}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Connected to:</span>
                    {selectedSkill.connections.map((connId) => {
                      const connSkill = skills.find(s => s.id === connId);
                      return connSkill ? (
                        <button
                          key={connId}
                          onClick={() => setSelectedSkill(connSkill)}
                          className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          {connSkill.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
                
                <p className="text-muted-foreground leading-relaxed">
                  {selectedSkill.description}
                </p>
              </div>
            )}
          </motion.div>

          {/* Skills Grid Alternative View */}
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              <span className="text-primary">&gt;</span> All Capabilities
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill, index) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedSkill(skill)}
                  className="bento-card cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getLevelColor(skill.level)}`}>
                      {skill.level}
                    </span>
                    <span className="text-xs text-muted-foreground">{skill.experience}</span>
                  </div>
                  
                  <h4 className="text-lg font-semibold text-foreground mb-2">{skill.name}</h4>
                  <p className="text-xs text-muted-foreground">{skill.category}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Vault;
