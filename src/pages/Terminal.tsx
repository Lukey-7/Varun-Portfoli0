import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Linkedin, Mail, Phone } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { useFinePointer } from '@/hooks/use-fine-pointer';
import { profile } from '@/data/profile';
import {
  ASCII_ART,
  completeCommand,
  runCommand,
  type CommandOutput,
} from '@/lib/terminal-commands';

const QUICK_COMMANDS = [
  'help',
  'about',
  'experience',
  'skills',
  'projects',
  'education',
  'contact',
];

const Terminal = () => {
  const isFinePointer = useFinePointer();

  const [history, setHistory] = useState<CommandOutput[]>([
    { command: '', output: ASCII_ART },
    {
      command: '',
      output:
        'Welcome to Varun\'s terminal v3.0\nType "help" for available commands, or tap a chip below.\n',
    },
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (!trimmed) return;

    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const result = runCommand(cmd);
    if (!result) {
      setHistory([
        { command: '', output: ASCII_ART },
        { command: '', output: 'Terminal cleared.\n' },
      ]);
      return;
    }
    setHistory((prev) => [...prev, result]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex =
          historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const match = completeCommand(currentInput);
      if (match) setCurrentInput(match);
    }
  };

  return (
    <PageTransition>
      <div className="page-shell">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 md:mb-8"
          >
            <div className="section-eyebrow">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground tracking-widest">
                TERMINAL / CONTACT
              </span>
            </div>

            <h1 className="section-title">
              <span className="gradient-text text-glow">Command Line</span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
              The whole résumé, queryable. Tap a command below or type one
              yourself — <span className="text-primary">help</span> lists them all.
            </p>
          </motion.div>

          {/* Quick commands sit above the window on mobile so they are
              reachable without scrolling past a 60vh terminal. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-4 md:hidden -mx-4 px-4"
          >
            <div className="flex gap-2 overflow-x-auto pb-2 scroll-x">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => executeCommand(cmd)}
                  className="shrink-0 px-4 py-2.5 glass rounded-lg text-sm text-foreground active:text-primary"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Terminal window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-intense rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-status-error/80" />
                <div className="w-3 h-3 rounded-full bg-status-warning/80" />
                <div className="w-3 h-3 rounded-full bg-status-success/80" />
              </div>
              <span className="text-[11px] sm:text-xs text-muted-foreground ml-2 sm:ml-4 font-mono truncate">
                varun@portfolio:~$
              </span>
            </div>

            <div
              ref={terminalRef}
              className="h-[55vh] min-h-[340px] md:h-[500px] overflow-y-auto overscroll-contain p-4 sm:p-6 font-mono text-[13px] sm:text-sm"
              onClick={() => inputRef.current?.focus()}
            >
              {history.map((entry, index) => (
                <div key={index} className="mb-4">
                  {entry.command && (
                    <div className="flex items-center gap-2 text-foreground">
                      <span className="text-primary">❯</span>
                      <span>{entry.command}</span>
                    </div>
                  )}
                  <pre
                    className={`whitespace-pre mt-1 scroll-x ${
                      entry.isError ? 'text-red-400' : 'text-muted-foreground'
                    }`}
                  >
                    {entry.output}
                  </pre>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <span className="text-primary">❯</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-w-0 bg-transparent outline-none text-foreground caret-primary"
                  /* Auto-focusing on a phone throws the keyboard up over the
                     content the moment the page loads. Desktop only. */
                  autoFocus={isFinePointer}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  aria-label="Terminal command input"
                  placeholder="type a command..."
                />
              </div>
            </div>
          </motion.div>

          {/* Quick commands (desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-6 hidden md:block"
          >
            <p className="text-xs text-muted-foreground mb-3">Quick commands:</p>
            <div className="flex flex-wrap gap-2">
              {[...QUICK_COMMANDS, 'resume', 'github', 'linkedin'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => executeCommand(cmd)}
                  className="px-4 py-2 glass rounded-lg text-sm text-foreground hover:text-primary hover:border-primary/50 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Contact cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 md:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4"
          >
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              className="bento-card group flex items-center gap-4"
            >
              <Github
                size={24}
                className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  GitHub
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  @{profile.githubHandle}
                </p>
              </div>
            </a>

            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="bento-card group flex items-center gap-4"
            >
              <Linkedin
                size={24}
                className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  LinkedIn
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  /in/varun-darji
                </p>
              </div>
            </a>

            <a
              href={`mailto:${profile.email}`}
              className="bento-card group flex items-center gap-4"
            >
              <Mail
                size={24}
                className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  Email
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {profile.email}
                </p>
              </div>
            </a>

            <a
              href={`tel:${profile.phone.replace(/\s/g, '')}`}
              className="bento-card group flex items-center gap-4"
            >
              <Phone
                size={24}
                className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                  Phone
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {profile.phone}
                </p>
              </div>
            </a>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Terminal;
