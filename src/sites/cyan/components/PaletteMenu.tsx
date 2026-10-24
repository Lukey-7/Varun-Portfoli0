import { useState } from "react";
import { Command } from "cmdk";
import {
  ArrowRight,
  ArrowUpRight,
  Copy,
  Download,
  FileText,
  Github,
  Keyboard,
  Linkedin,
  Moon,
  Pause,
  Search,
  SquareTerminal,
} from "lucide-react";
import { selectedWork, type SelectedWork } from "@/data/portfolio";
import { profile } from "@/data/profile";
import { ORDO_URL } from "@/lib/sites";

export interface PaletteActions {
  openProject: (project: SelectedWork) => void;
  copyEmail: () => void;
  toggleTheme: () => void;
  showShortcuts: () => void;
  toggleMotion: () => void;
  go: (path: string) => void;
}

const sections = [
  ["Selected work", "#work"],
  ["Results", "#results"],
  ["Signal map", "#signal"],
  ["Research", "#research"],
  ["Experience", "#experience"],
  ["About", "#about"],
  ["Contact", "#contact"],
] as const;

export default function PaletteMenu({
  actions,
  run,
}: {
  actions: PaletteActions;
  run: (fn: () => void) => void;
}) {
  const [query, setQuery] = useState("");
  return (
      <Command label="Command palette" loop>
        <div className="palette-input">
          <Search size={16} />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a section, open a project, run an action..."
          />
          <kbd className="mono">esc</kbd>
        </div>
        <Command.List className="palette-list">
          <Command.Empty className="palette-empty">
            No match. Try "research" or "resume".
          </Command.Empty>
          <Command.Group heading="Go to">
            {sections.map(([label, hash]) => (
              <Command.Item
                key={hash}
                value={`go ${label}`}
                onSelect={() => run(() => actions.go(hash))}
              >
                <ArrowRight size={15} />
                {label}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Case studies">
            {selectedWork.map((project) => (
              <Command.Item
                key={project.id}
                value={`case ${project.name} ${project.category}`}
                onSelect={() => run(() => actions.openProject(project))}
              >
                <FileText size={15} />
                {project.name}
                <span className="palette-hint mono">{project.category}</span>
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Actions">
            <Command.Item value="copy email address" onSelect={() => run(actions.copyEmail)}>
              <Copy size={15} />
              Copy email address
              <span className="palette-hint mono">{profile.email}</span>
            </Command.Item>
            <Command.Item
              value="download resume pdf"
              onSelect={() =>
                run(() => {
                  const link = document.createElement("a");
                  link.href = "/Varun-Darji-Resume.pdf";
                  link.download = "";
                  link.click();
                })
              }
            >
              <Download size={15} />
              Download resume
            </Command.Item>
            <Command.Item
              value="open github"
              onSelect={() => run(() => window.open(profile.github, "_blank", "noopener,noreferrer"))}
            >
              <Github size={15} />
              Open GitHub
            </Command.Item>
            <Command.Item
              value="open linkedin"
              onSelect={() => run(() => window.open(profile.linkedin, "_blank", "noopener,noreferrer"))}
            >
              <Linkedin size={15} />
              Open LinkedIn
            </Command.Item>
            <Command.Item value="interactive terminal shell" onSelect={() => run(() => actions.go("/terminal"))}>
              <SquareTerminal size={15} />
              Open the interactive terminal
            </Command.Item>
            <Command.Item value="toggle light dark theme appearance" onSelect={() => run(actions.toggleTheme)}>
              <Moon size={15} />
              Toggle light / dark
            </Command.Item>
            <Command.Item value="pause resume play motion animation" onSelect={() => run(actions.toggleMotion)}>
              <Pause size={15} />
              Pause / resume motion
              <span className="palette-hint mono">.</span>
            </Command.Item>
            <Command.Item value="show keyboard shortcuts keys help" onSelect={() => run(actions.showShortcuts)}>
              <Keyboard size={15} />
              Show keyboard shortcuts
              <span className="palette-hint mono">?</span>
            </Command.Item>
            <Command.Item value="switch monochrome ordo edition design" onSelect={() => run(() => window.location.assign(ORDO_URL))}>
              <ArrowUpRight size={15} />
              Switch to the monochrome edition
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
  );
}
