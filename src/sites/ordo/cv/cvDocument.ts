/**
 * The private CV's content, assembled from the site's data files.
 *
 * Build time only: vite.config.ts encrypts this into the `virtual:cv-vault`
 * module. App code must never import it (a type import is fine), or the CV
 * would ship in plaintext in the page's JavaScript.
 *
 * Imports use relative paths with extensions so vite.config.ts can load this file.
 */
import { education, experience, profile, skills } from "../../../data/profile.ts";
import { selectedWork } from "../../../data/portfolio.ts";

export interface CvDocument {
  name: string;
  role: string;
  location: string;
  email: string;
  phone: string;
  github: string;
  linkedin: string;
  summary: string;
  experience: { role: string; company: string; period: string; highlights: string[] }[];
  education: { degree: string; institution: string; year: string; detail?: string }[];
  projects: { name: string; line: string }[];
  skills: string[];
}

export function buildCvDocument(): CvDocument {
  return {
    name: profile.name,
    role: profile.role,
    location: profile.location,
    email: profile.email,
    phone: profile.phone,
    github: profile.github,
    linkedin: profile.linkedin,
    summary: profile.summary,
    experience: experience.map((job) => ({
      role: job.role,
      company: job.company,
      period: job.period,
      highlights: [...job.highlights],
    })),
    education: education.map((item) => ({
      degree: item.degree,
      institution: item.institution,
      year: item.year,
      ...(item.detail ? { detail: item.detail } : {}),
    })),
    projects: selectedWork.map((project) => ({ name: project.name, line: project.description })),
    skills: skills.map((skill) => skill.name),
  };
}
