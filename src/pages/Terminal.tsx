import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Linkedin, Mail } from 'lucide-react';
import PageTransition from '@/components/PageTransition';

interface CommandOutput {
  command: string;
  output: string | JSX.Element;
  isError?: boolean;
}

const ASCII_ART = `
██╗   ██╗ █████╗ ██████╗ ██╗   ██╗███╗   ██╗
██║   ██║██╔══██╗██╔══██╗██║   ██║████╗  ██║
██║   ██║███████║██████╔╝██║   ██║██╔██╗ ██║
╚██╗ ██╔╝██╔══██║██╔══██╗██║   ██║██║╚██╗██║
 ╚████╔╝ ██║  ██║██║  ██║╚██████╔╝██║ ╚████║
  ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`;

const COMMANDS: { [key: string]: () => string | JSX.Element } = {
  help: () => `
Available commands:
  help        - Show this help message
  about       - Display information about Varun
  skills      - List technical skills
  projects    - List featured projects
  contact     - Show contact information
  github      - Open GitHub profile
  linkedin    - Open LinkedIn profile
  email       - Get email address
  clear       - Clear terminal
  sudo        - Try it ;)
  exit        - Close terminal session
`,
  about: () => `
┌─────────────────────────────────────────────────┐
│  VARUN DARJI                                    │
│  MSc Computer Science Student                   │
│  Somaiya Vidyavihar University                  │
├─────────────────────────────────────────────────┤
│  Location: Mumbai, India                        │
│  Focus: AI Research, RAG Pipelines,             │
│         NLP & Intelligent Systems                │
│  Status: Available for opportunities            │
└─────────────────────────────────────────────────┘
`,
  skills: () => `
Technical Stack:
  ├── Languages
  │   ├── Python (Advanced, 3+ years)
  │   └── TypeScript (Proficient)
  ├── AI/ML
  │   ├── LLM Integration (Advanced)
  │   ├── RAG Architecture
  │   └── LangChain / OpenAI
  ├── Frontend
  │   ├── React (Proficient)
  │   └── Tailwind CSS
  ├── Academic
  │   ├── Data Structures & Algorithms
  │   └── Information Retrieval
  └── Security
      └── Cybersecurity (1-Year Diploma)
`,
  projects: () => `
Featured Projects:
  1. Intelligent Notes
     → Automated Document Intelligence Pipeline
     → Tech: Python, LangChain, RAG, OpenAI, FastAPI

  2. D&D Companion App [WIP]
     → Dungeons & Dragons Game Management System
     → Tech: React, Tailwind CSS, TypeScript, PostgreSQL
`,
  contact: () => `
Contact Information:
  GitHub:   github.com/Lukey-7
  LinkedIn: linkedin.com/in/varun-darji-5713472a9
  Email:    varun.darji@somaiya.edu
`,
  github: () => 'Opening GitHub... → github.com/Lukey-7',
  linkedin: () => 'Opening LinkedIn... → linkedin.com/in/varun-darji-5713472a9',
  email: () => 'Contact: varun.darji@somaiya.edu',
  sudo: () => 'Nice try. Permission denied. 🔒',
  exit: () => 'Session terminated. Goodbye.',
  clear: () => '__CLEAR__',
};

const Terminal = () => {
  const [history, setHistory] = useState<CommandOutput[]>([
    { command: '', output: ASCII_ART },
    { command: '', output: 'Welcome to Varun\'s Terminal v2.0\nType "help" for available commands.\n' },
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
    const trimmedCmd = cmd.trim().toLowerCase();
    
    if (!trimmedCmd) return;
    
    setCommandHistory((prev) => [...prev, trimmedCmd]);
    setHistoryIndex(-1);
    
    if (trimmedCmd === 'clear') {
      setHistory([
        { command: '', output: ASCII_ART },
        { command: '', output: 'Terminal cleared.\n' },
      ]);
      return;
    }
    
    const commandFn = COMMANDS[trimmedCmd];
    
    if (commandFn) {
      const output = commandFn();
      
      if (trimmedCmd === 'github') {
        window.open('https://github.com/Lukey-7', '_blank');
      } else if (trimmedCmd === 'linkedin') {
        window.open('https://www.linkedin.com/in/varun-darji-5713472a9/', '_blank');
      }
      
      setHistory((prev) => [...prev, { command: cmd, output }]);
    } else {
      setHistory((prev) => [
        ...prev, 
        { 
          command: cmd, 
          output: `Command not found: ${trimmedCmd}\nType "help" for available commands.`,
          isError: true,
        }
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
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
      const matches = Object.keys(COMMANDS).filter((cmd) => 
        cmd.startsWith(currentInput.toLowerCase())
      );
      if (matches.length === 1) {
        setCurrentInput(matches[0]);
      }
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 pb-20 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground tracking-widest">TERMINAL / CONTACT</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              <span className="gradient-text text-glow">Command Line</span>
            </h1>
            
            <p className="text-muted-foreground max-w-2xl">
              Interact with the system directly. Use commands to navigate, 
              retrieve information, or establish connection.
            </p>
          </motion.div>

          {/* Terminal Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass-intense rounded-2xl overflow-hidden"
          >
            {/* Terminal Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-status-error/80" />
                <div className="w-3 h-3 rounded-full bg-status-warning/80" />
                <div className="w-3 h-3 rounded-full bg-status-success/80" />
              </div>
              <span className="text-xs text-muted-foreground ml-4 font-mono">
                varun@somaiya:~$
              </span>
            </div>

            {/* Terminal Body */}
            <div
              ref={terminalRef}
              className="h-[500px] overflow-y-auto p-6 font-mono text-sm cursor-text"
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
                    className={`whitespace-pre-wrap mt-1 ${
                      entry.isError ? 'text-red-400' : 'text-muted-foreground'
                    }`}
                  >
                    {entry.output}
                  </pre>
                </div>
              ))}

              {/* Input Line */}
              <div className="flex items-center gap-2">
                <span className="text-primary">❯</span>
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent outline-none text-foreground caret-primary"
                    autoFocus
                    spellCheck={false}
                  />
                  <motion.span
                    className="absolute right-0 top-0 w-2 h-5 bg-primary"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Commands */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8"
          >
            <p className="text-xs text-muted-foreground mb-4">Quick commands:</p>
            <div className="flex flex-wrap gap-2">
              {['help', 'about', 'skills', 'projects', 'contact', 'github', 'linkedin'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setCurrentInput(cmd);
                    executeCommand(cmd);
                  }}
                  className="px-4 py-2 glass rounded-lg text-sm text-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Contact Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <a
              href="https://github.com/Lukey-7"
              target="_blank"
              rel="noopener noreferrer"
              className="bento-card group cursor-pointer"
            >
              <div className="mb-3">
                <Github size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                GitHub
              </h3>
              <p className="text-sm text-muted-foreground">@Lukey-7</p>
            </a>
            
            <a
              href="https://www.linkedin.com/in/varun-darji-5713472a9/"
              target="_blank"
              rel="noopener noreferrer"
              className="bento-card group cursor-pointer"
            >
              <div className="mb-3">
                <Linkedin size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                LinkedIn
              </h3>
              <p className="text-sm text-muted-foreground">/in/varun-darji</p>
            </a>
            
            <a
              href="mailto:varun.darji@somaiya.edu"
              className="bento-card group cursor-pointer"
            >
              <div className="mb-3">
                <Mail size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Email
              </h3>
              <p className="text-sm text-muted-foreground">varun.darji@somaiya.edu</p>
            </a>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Terminal;
