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
  email: 'varun.darji@somaiya.edu',
  phone: '+91 7977023495',
  github: 'https://github.com/Lukey-7',
  githubHandle: 'Lukey-7',
  linkedin: 'https://www.linkedin.com/in/varun-darji-5713472a9/',
  linkedinHandle: 'varun-darji-5713472a9',
  summary:
    'M.Sc. Computer Science graduate building AI systems with LLMs, RAG, hybrid retrieval and vector databases. Strong in Python, C++, full-stack development and cloud deployment (GCP, Docker), with a track record of turning business requirements into scalable, production-ready AI features under real deadlines.',
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
      'Developing AI-powered solutions for e-learning clients, from prototyping through to deployment.',
      'Deploying and maintaining applications on Google Cloud Platform using Docker.',
      'Working directly with client requirements to build AI-driven features for the platform.',
    ],
    stack: ['Python', 'LLMs', 'RAG', 'GCP', 'Docker', 'FastAPI'],
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
  {
    id: 'studyforge',
    title: 'StudyForge',
    subtitle: 'AI-Powered Document-to-Learning Platform',
    description:
      'A RAG platform that turns academic documents into 16 personalised content-generation pipelines built on structured prompts and retrieval.',
    longDescription: `StudyForge converts raw academic documents into structured, personalised learning material. A single upload fans out into sixteen distinct content-generation pipelines, each driven by its own structured prompt and retrieval strategy.

The retrieval layer is multi-stage: documents are chunked semantically, embedded with text-embedding-004 and indexed in ChromaDB, then re-ranked before reaching the generation step. Prompt orchestration sits on top, selecting context and enforcing the output contract for each pipeline.

The full architecture was presented and defended end-to-end at the master's viva.`,
    technologies: [
      'React.js',
      'FastAPI',
      'Gemini 2.5 Flash',
      'LangChainGo',
      'ChromaDB',
      'Supabase',
      'RAG',
      'Semantic Search',
    ],
    facts: [
      { label: 'Pipelines', value: '16' },
      { label: 'Retrieval', value: 'Multi-layer' },
      { label: 'Defended', value: 'M.Sc. viva' },
    ],
    links: { github: 'https://github.com/Lukey-7/StudyForge' },
    status: 'production',
    featured: true,
  },
  {
    id: 'multi-agent',
    title: 'Multi-Agent Research Assistant',
    subtitle: 'Planning, Retrieval and Citation-Backed Synthesis',
    description:
      'A multi-agent system that plans research tasks, gathers evidence, summarises findings and returns answers with citations attached.',
    longDescription: `A research assistant built as a set of cooperating agents rather than a single prompt. A planner decomposes the question into sub-tasks, retrieval agents gather evidence, and a synthesis agent produces an answer where every claim is traceable to a source.

Retrieval is hybrid: semantic chunking feeds a dense index, metadata filtering narrows the candidate set, and a reranking pass orders what actually reaches the model. The corpus spans PDFs, web pages and internal knowledge bases.

LlamaIndex and Haystack handle orchestration and document stores, with Redis for caching and Docker for reproducible deployment.`,
    technologies: [
      'Python',
      'FastAPI',
      'LlamaIndex',
      'Haystack',
      'ChromaDB',
      'Redis',
      'Docker',
      'OpenAI / Gemini',
    ],
    facts: [
      { label: 'Agents', value: 'Multi' },
      { label: 'Retrieval', value: 'Hybrid' },
      { label: 'Answers', value: 'Cited' },
    ],
    links: { github: 'https://github.com/Lukey-7' },
    status: 'development',
    featured: true,
  },
  {
    id: 'axiomquant',
    title: 'AxiomQuant',
    subtitle: 'Quantitative Trading and Portfolio Optimization Engine',
    description:
      'A C++20 engine for backtesting strategies, computing risk metrics and simulating portfolio performance on historical market data.',
    longDescription: `A quantitative finance engine written in modern C++ for people who care what the numbers cost to compute. It backtests trading strategies against historical market data, calculates statistical risk metrics and simulates portfolio behaviour under different assumptions.

The engine implements Monte Carlo simulation, constrained Markowitz portfolio optimisation, drawdown analysis and Sharpe-ratio evaluation, with transaction costs modelled rather than ignored so strategy results survive contact with reality.

Built on C++20 and the STL, with Eigen for linear algebra, OpenMP for parallel simulation, SQLite for market data and CMake for the build.`,
    technologies: [
      'C++20',
      'STL',
      'Eigen',
      'OpenMP',
      'SQLite',
      'CMake',
    ],
    facts: [
      { label: 'Language', value: 'C++20' },
      { label: 'Simulation', value: 'Monte Carlo' },
      { label: 'Parallel', value: 'OpenMP' },
    ],
    links: { github: 'https://github.com/Lukey-7/AxiomQuant' },
    status: 'production',
    featured: true,
  },
  {
    id: 'sprachweg',
    title: 'Sprachweg',
    subtitle: 'German Learning App, A0 to B2',
    description:
      'A language learning app combining the Gemini API with FSRS spaced repetition over a Prisma and SQLite store.',
    longDescription: `A German learning application covering the A0 to B2 range, built around a real spaced-repetition scheduler rather than a fixed lesson order.

Review scheduling uses FSRS, so cards surface based on predicted recall instead of a naive interval ladder. The Gemini API generates and adapts exercise content, and Prisma over SQLite keeps the learner's full review history queryable.`,
    technologies: ['TypeScript', 'Gemini API', 'FSRS', 'Prisma', 'SQLite'],
    facts: [
      { label: 'Range', value: 'A0-B2' },
      { label: 'Scheduler', value: 'FSRS' },
      { label: 'Store', value: 'Prisma' },
    ],
    links: { github: 'https://github.com/Lukey-7/sprachweg' },
    status: 'production',
    featured: false,
  },
  {
    id: 'dnd-ai',
    title: 'DND AI Game',
    subtitle: 'LLM-Driven Tabletop Campaign Engine',
    description:
      'An experimental Dungeons & Dragons game master driven by an LLM, holding narrative state across a campaign.',
    longDescription: `An experiment in using an LLM as a dungeon master: the model narrates encounters, adjudicates player actions and carries campaign state forward between sessions.

The interesting problem is memory. Keeping characters, world facts and prior decisions consistent across a long campaign, without stuffing the entire history into every prompt, is most of the work.`,
    technologies: ['TypeScript', 'LLM APIs', 'React'],
    facts: [
      { label: 'Type', value: 'Experiment' },
      { label: 'Core', value: 'LLM state' },
      { label: 'Mode', value: 'Campaign' },
    ],
    links: { github: 'https://github.com/Lukey-7/DND-AI-Game-beta' },
    status: 'research',
    featured: false,
  },
];
