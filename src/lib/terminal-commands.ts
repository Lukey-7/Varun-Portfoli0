import {
  profile,
  skills,
  skillCategories,
  experience,
  education,
  projects,
} from '@/data/profile';
import { aiCapabilities, research } from '@/data/portfolio';

/** Command set shared by the /terminal page and the ORDO console. */

export const ASCII_ART = `
██╗   ██╗ █████╗ ██████╗ ██╗   ██╗███╗   ██╗
██║   ██║██╔══██╗██╔══██╗██║   ██║████╗  ██║
██║   ██║███████║██████╔╝██║   ██║██╔██╗ ██║
╚██╗ ██╔╝██╔══██║██╔══██╗██║   ██║██║╚██╗██║
 ╚████╔╝ ██║  ██║██║  ██║╚██████╔╝██║ ╚████║
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`;

const buildSkillTree = () =>
  skillCategories
    .map((category) => {
      const group = skills.filter((s) => s.category === category);
      const lines = group.map(
        (skill, i) =>
          `  ${i === group.length - 1 ? '└──' : '├──'} ${skill.name}`,
      );
      return `${category}\n${lines.join('\n')}`;
    })
    .join('\n\n');

const buildExperience = () =>
  experience
    .map(
      (job) =>
        `${job.role}\n  ${job.company} · ${job.location}\n  ${job.period}${
          job.current ? '  [CURRENT]' : ''
        }\n${job.highlights.map((h) => `    ▸ ${h}`).join('\n')}`,
    )
    .join('\n\n');

const buildEducation = () =>
  education
    .map(
      (item) =>
        `${item.year}  ${item.degree}\n      ${item.institution}${
          item.detail ? ` (${item.detail})` : ''
        }`,
    )
    .join('\n\n');

const buildProjects = () =>
  projects
    .map(
      (project, i) =>
        `${i + 1}. ${project.title}${project.featured ? ' ★' : ''}\n   → ${
          project.subtitle
        }\n   → ${project.technologies.join(', ')}`,
    )
    .join('\n\n');

const buildResearch = () =>
  `${research.title}
${research.status}

${research.studies
  .map(
    (study, i) =>
      `${String(i + 1).padStart(2, '0')}. ${study.name}\n    ? ${study.question}\n    ▸ ${study.method}\n    ▸ Measured by: ${study.measure}`,
  )
  .join('\n\n')}

${research.note}`;

const buildCapabilities = () =>
  aiCapabilities
    .map((item) => `▸ ${item.name.padEnd(28)} ${item.source}\n  ${item.text}`)
    .join('\n\n');

export const COMMANDS: Record<string, () => string> = {
  help: () => `
Available commands:
  help        Show this help message
  about       Who Varun is, in a box
  whoami      One-line summary
  ai          AI features I work on
  research    Research proposal
  experience  Professional experience log
  education   Degrees and diplomas
  skills      Full technical stack
  projects    Featured and side projects
  contact     Every way to reach out
  resume      Condensed resume dump
  github      Open GitHub profile
  linkedin    Open LinkedIn profile
  email       Email address
  clear       Clear the terminal
  sudo        Try it ;)
  exit        Close the session
`,
  about: () => `
┌────────────────────────────────────────────────┐
│  ${profile.name.toUpperCase().padEnd(46)}│
│  ${profile.role.padEnd(46)}│
├────────────────────────────────────────────────┤
│  Location: ${profile.location.padEnd(36)}│
│  Now:      AI Engineer @ LetsTute${' '.repeat(14)}│
│  Focus:    LLMs, RAG, hybrid retrieval${' '.repeat(9)}│
│  Research: LLM inference cost (proposal)${' '.repeat(7)}│
│  Degree:   M.Sc. Computer Science (CGPA 8.6)   │
│  Status:   Open to opportunities${' '.repeat(15)}│
└────────────────────────────────────────────────┘
`,
  whoami: () => `${profile.name} — ${profile.role}, ${profile.location}.\n\n${profile.summary}`,
  ai: () => `\nAI features:\n\n${buildCapabilities()}\n`,
  research: () => `\n${buildResearch()}\n`,
  experience: () => `\n${buildExperience()}\n`,
  education: () => `\n${buildEducation()}\n`,
  skills: () => `\nTechnical Stack:\n\n${buildSkillTree()}\n`,
  projects: () => `\nProjects:\n\n${buildProjects()}\n`,
  contact: () => `
Contact:
  Email:    ${profile.email}
  Phone:    ${profile.phone}
  GitHub:   github.com/${profile.githubHandle}
  LinkedIn: linkedin.com/in/${profile.linkedinHandle}
  Location: ${profile.location}
`,
  resume: () => `
${profile.name} — ${profile.role}
${profile.location} · ${profile.email} · ${profile.phone}

SUMMARY
${profile.summary}

EXPERIENCE
${buildExperience()}

EDUCATION
${buildEducation()}

PROJECTS
${buildProjects()}
`,
  github: () => `Opening GitHub... → github.com/${profile.githubHandle}`,
  linkedin: () => `Opening LinkedIn... → linkedin.com/in/${profile.linkedinHandle}`,
  email: () => `Contact: ${profile.email}`,
  sudo: () => 'Nice try. Permission denied. 🔒',
  exit: () => 'Session terminated. Thanks for stopping by.',
  clear: () => '__CLEAR__',
};

export interface CommandOutput {
  command: string;
  output: string;
  isError?: boolean;
}

/** Runs one command; returns null for "clear" so callers can reset history. */
export function runCommand(input: string): CommandOutput | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'clear') return null;
  const commandFn = COMMANDS[trimmed];
  if (!commandFn)
    return {
      command: input,
      output: `Command not found: ${trimmed}\nType "help" for available commands.`,
      isError: true,
    };
  if (trimmed === 'github') window.open(profile.github, '_blank', 'noopener,noreferrer');
  if (trimmed === 'linkedin') window.open(profile.linkedin, '_blank', 'noopener,noreferrer');
  return { command: input, output: commandFn() };
}

export const completeCommand = (partial: string) => {
  const matches = Object.keys(COMMANDS).filter((cmd) =>
    cmd.startsWith(partial.toLowerCase()),
  );
  return matches.length === 1 ? matches[0] : null;
};
