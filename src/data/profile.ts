import { selectedWork, otherWork } from './portfolio';

/**
 * Single source of truth for every piece of resume content on the site.
 * Pages read from here so the terminal, the cards and the meta tags can
 * never drift apart.
 */

export const profile = {
  name: 'Varun Rajesh Darji',
  shortName: 'VARUN',
  role: 'AI/ML Engineer',
  tagline: 'Building at the intersection of LLMs and production systems',
  location: 'Mumbai, Maharashtra',
  timezone: 'IST (UTC+5:30)',
  email: 'varun.darji07@gmail.com',
  phone: '+91 7977023495',
  github: 'https://github.com/Lukey-7',
  githubHandle: 'Lukey-7',
  linkedin: 'https://www.linkedin.com/in/varun-darji-5713472a9/',
  linkedinHandle: 'varun-darji-5713472a9',
  summary:
    'AI Engineer at LetsTute and M.Sc. Computer Science graduate. Building retrieval systems, agent workflows, backend APIs and client applications. My work includes extending existing platforms, testing ERP intelligence features and gaining hands-on AWS deployment experience.',
} as const;

/* ---------------------------------------------------------------- skills */

export type SkillCategory =
  | 'Languages'
  | 'AI/ML'
  | 'Web'
  | 'Cloud & DevOps'
  | 'Data';

export interface Skill {
  id: string;
  name: string;
  short: string;
  category: SkillCategory;
  description: string;
  connections: string[];
}

export const skillCategories: SkillCategory[] = [
  'Languages',
  'AI/ML',
  'Web',
  'Cloud & DevOps',
  'Data',
];

export const skills: Skill[] = [
  {
    id: 'python',
    name: 'Python',
    short: 'PY',
    category: 'Languages',
    description:
      'Primary language for AI/ML pipelines, retrieval systems and backend services. FastAPI, asyncio, typed codebases and the scientific stack.',
    connections: ['llm', 'rag', 'fastapi', 'gcp', 'data'],
  },
  {
    id: 'cpp',
    name: 'C++',
    short: 'C++',
    category: 'Languages',
    description:
      'C++20 for performance-critical numerical work. The quantitative trading engine leans on STL, Eigen, OpenMP and CMake.',
    connections: ['python', 'data'],
  },
  {
    id: 'java',
    name: 'Java / Spring Boot',
    short: 'JVA',
    category: 'Languages',
    description:
      'Backend services for a fintech platform: REST APIs, third-party payment integrations and agile delivery in a remote team.',
    connections: ['databases', 'docker'],
  },
  {
    id: 'js',
    name: 'JavaScript / TypeScript',
    short: 'TS',
    category: 'Languages',
    description:
      'Typed front-end development across React and Angular, plus the tooling and build pipelines behind production web apps.',
    connections: ['react', 'fastapi'],
  },
  {
    id: 'llm',
    name: 'LLMs & Prompt Engineering',
    short: 'LLM',
    category: 'AI/ML',
    description:
      'Structured prompt orchestration against Gemini and OpenAI models: content pipelines, tool use, evaluation and cost control.',
    connections: ['rag', 'python', 'vector'],
  },
  {
    id: 'rag',
    name: 'RAG & Retrieval',
    short: 'RAG',
    category: 'AI/ML',
    description:
      'Multi-layer retrieval: semantic chunking, hybrid dense and sparse search, metadata filtering and reranking over documents and knowledge bases.',
    connections: ['llm', 'vector', 'python', 'nlp'],
  },
  {
    id: 'frameworks',
    name: 'LangChain / LlamaIndex / Haystack',
    short: 'ORC',
    category: 'AI/ML',
    description:
      'Orchestration frameworks for agentic and retrieval workloads: planners, tool routing, document stores and citation-backed answers.',
    connections: ['rag', 'llm', 'python'],
  },
  {
    id: 'vector',
    name: 'Vector Databases',
    short: 'VEC',
    category: 'AI/ML',
    description:
      'ChromaDB and embedding stores in production: index design, text-embedding-004, similarity tuning and hybrid search strategies.',
    connections: ['rag', 'databases', 'llm'],
  },
  {
    id: 'nlp',
    name: 'NLP & Machine Learning',
    short: 'NLP',
    category: 'AI/ML',
    description:
      'Text preprocessing, embeddings, classical ML with NumPy and Pandas, and evaluation of retrieval and generation quality.',
    connections: ['python', 'rag', 'data'],
  },
  {
    id: 'react',
    name: 'React.js / Angular',
    short: 'RCT',
    category: 'Web',
    description:
      'Component-driven interfaces with React and Angular: responsive layouts, state management and design systems for AI-facing products.',
    connections: ['js', 'fastapi'],
  },
  {
    id: 'fastapi',
    name: 'FastAPI / Django',
    short: 'API',
    category: 'Web',
    description:
      'Python service layers for AI features: streaming responses, background jobs, auth and clean API contracts for front-end consumers.',
    connections: ['python', 'react', 'docker'],
  },
  {
    id: 'gcp',
    name: 'Google Cloud Platform',
    short: 'GCP',
    category: 'Cloud & DevOps',
    description:
      'Deploying and maintaining containerised AI applications on GCP, including build pipelines and runtime configuration.',
    connections: ['docker', 'cicd', 'python'],
  },
  {
    id: 'docker',
    name: 'Docker',
    short: 'DKR',
    category: 'Cloud & DevOps',
    description:
      'Reproducible containers for AI services and their dependencies: multi-stage builds, Compose for local stacks, image slimming.',
    connections: ['gcp', 'cicd', 'fastapi'],
  },
  {
    id: 'cicd',
    name: 'Git / Jenkins / CI-CD',
    short: 'CI',
    category: 'Cloud & DevOps',
    description:
      'Version control workflows and automated build and deploy pipelines, from commit through to a running API in the cloud.',
    connections: ['docker', 'gcp'],
  },
  {
    id: 'databases',
    name: 'PostgreSQL / SQLite',
    short: 'SQL',
    category: 'Data',
    description:
      'Relational schema design, query optimisation and migrations backing both AI products and financial simulation tooling.',
    connections: ['python', 'java', 'vector'],
  },
  {
    id: 'data',
    name: 'NumPy / Pandas / Tableau',
    short: 'DAT',
    category: 'Data',
    description:
      'Data wrangling, numerical analysis and visualisation, from feature preparation to dashboards non-engineers can actually read.',
    connections: ['python', 'nlp', 'cpp'],
  },
];

export const softSkills = [
  'Client Communication',
  'Requirement Translation',
  'Cross-Functional Collaboration',
  'Fast Self-Directed Learning',
  'Adaptability',
  'Ownership & Accountability',
];

/* ------------------------------------------------------------ experience */

export interface Experience {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  current?: boolean;
  highlights: string[];
  stack: string[];
}

export const experience: Experience[] = [
  {
    id: 'letstute',
    role: 'AI Engineer',
    company: 'LetsTute',
    location: 'Mumbai',
    period: 'Aug 2026 — Present',
    current: true,
    highlights: [
      'Extending and restructuring the existing Webex platform, including AI workflows and application features.',
      'Leading implementation and testing of AI features for a secured client ERP.',
      'Developing the KiranOS iOS application and gaining hands-on AWS deployment experience for clients.',
    ],
    stack: ['Python', 'LLMs', 'RAG', 'AWS', 'Docker', 'FastAPI'],
  },
  {
    id: 'techit',
    role: 'Java Backend Developer Intern',
    company: 'Tech IT Research',
    location: 'Remote / Fintech',
    period: 'Dec 2025 — Apr 2026',
    highlights: [
      'Developed and maintained backend services in Java and Spring Boot for a fintech platform.',
      'Integrated the PayPal AddTracking API for shipment and order tracking.',
      'Collaborated in a remote, agile cross-functional team to deliver features on schedule.',
    ],
    stack: ['Java', 'Spring Boot', 'REST APIs', 'PayPal API', 'Git'],
  },
  {
    id: 'somaiya',
    role: 'Student Intern',
    company: 'Somaiya Vidyavihar University',
    location: 'Mumbai',
    period: 'Jul 2024 — Apr 2025',
    highlights: [
      'Automated administrative workflows, reducing manual effort by 30% and data errors by 20%.',
      'Managed and validated 500+ numerical and alphanumeric records per semester.',
    ],
    stack: ['Python', 'Automation', 'Data Validation'],
  },
];

/* ------------------------------------------------------------- education */

export interface Education {
  id: string;
  degree: string;
  institution: string;
  year: string;
  detail?: string;
}

export const education: Education[] = [
  {
    id: 'msc',
    degree: 'M.Sc. Computer Science',
    institution: 'Somaiya Vidyavihar University, Mumbai',
    year: '2026',
    detail: 'CGPA 8.6',
  },
  {
    id: 'pgd',
    degree: 'PG Diploma in Cyber Security',
    institution: 'St. Xavier’s Technical Institute',
    year: '2025',
  },
  {
    id: 'bca',
    degree: 'BCA',
    institution: 'Tilak Maharashtra Vidyapeeth',
    year: '2024',
    detail: 'CGPA 8.2',
  },
];

/* -------------------------------------------------------------- projects */

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  longDescription: string;
  technologies: string[];
  facts: { label: string; value: string }[];
  links: { github?: string; live?: string };
  status: 'production' | 'development' | 'research';
  featured: boolean;
}

export const projects: Project[] = [
  ...selectedWork.map((project): Project => ({
    id: project.id,
    title: project.name,
    subtitle: project.category,
    description: project.description,
    longDescription: [project.problem, project.approach, project.evidence, project.ownership].join('\n\n'),
    technologies: project.stack,
    facts: project.facts.map(([value, label]) => ({ label, value })),
    links: { github: project.github },
    status: 'development',
    featured: true,
  })),
  ...otherWork.map((project): Project => ({
    id: project.kind,
    title: project.name,
    subtitle: project.category,
    description: project.description,
    longDescription: project.description + (project.kind === 'language' ? '\n\nA personal learning application. Source code is not currently public.' : ''),
    technologies: project.tech.split(' / '),
    facts: [{ label: 'Project', value: 'Independent' }],
    links: project.href.startsWith('https://github.com/') ? { github: project.href } : {},
    status: project.kind === 'game' ? 'research' : 'development',
    featured: false,
  })),
];
