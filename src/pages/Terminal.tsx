import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Github, Linkedin, Mail } from 'lucide-react';
import { useFinePointer } from '@/hooks/use-fine-pointer';
import { profile } from '@/data/profile';
import { ARCADE_URL, SPACE_GAME_URL } from '@/lib/sites';
import { useMotionPaused } from '@/lib/motion-pause';
import { ASCII_ART, COMMANDS, runCommand } from '@/lib/terminal-commands';
import { LabHero } from '@/sites/cyan/lab/LabParts';
import { useLabTheme } from '@/sites/cyan/lab/LabShell';
import { pointerLight } from '@/sites/cyan/lab/kit';
import { LocalClock } from '@/sites/cyan/motion/LocalClock';
import { BootScreen } from '@/sites/cyan/lab/terminal/BootScreen';
import { KeyTrace, type KeyTraceHandle } from '@/sites/cyan/lab/terminal/KeyTrace';
import { OutputBlock, type TerminalEntry } from '@/sites/cyan/lab/terminal/OutputBlock';
import { bootLength, buildBootLines } from '@/sites/cyan/lab/terminal/boot';
import { formatUptime, useUptime } from '@/sites/cyan/lab/terminal/useUptime';
import '@/sites/cyan/lab/terminal.css';

const QUICK_COMMANDS = [
  'help',
  'about',
  'experience',
  'skills',
  'projects',
  'education',
  'contact',
  'play',
  'resume',
  'github',
  'linkedin',
];

/** Commands only this page answers: they leave the portfolio for a game. */
const GAMES: Record<string, string> = {
  play: ARCADE_URL,
  tetris: ARCADE_URL,
  space: SPACE_GAME_URL,
};

const NAMES = [...Object.keys(COMMANDS), ...Object.keys(GAMES)];
const NAME_SET: ReadonlySet<string> = new Set(NAMES);

const WELCOME = 'Welcome to Varun\'s terminal v3.0\nType "help" for available commands, or tap a preset.\n';

/** Characters per tick and the tick length: the boot report types in about a second. */
const BOOT_STEP = 3;
const BOOT_TICK_MS = 16;

/** Box drawing and block art read as noise aloud, so the spoken copy drops them. */
const DRAWING = /[█╗╔╝╚═║┌┐└┘├┤─│▸→★]/g;
const speakable = (text: string) =>
  text
    .replace(DRAWING, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('. ');

const commonPrefix = (words: string[]) =>
  words.reduce((prefix, word) => {
    let i = 0;
    while (i < prefix.length && prefix[i] === word[i]) i++;
    return prefix.slice(0, i);
  });

const reducedMotionNow = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const finePointerNow = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);

const Terminal = () => {
  const isFinePointer = useFinePointer();
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const theme = useLabTheme();
  const still = Boolean(reduced) || paused;

  // The cold-start report, read once from the visitor's browser.
  const [bootLines] = useState(() =>
    buildBootLines({
      commandCount: Object.keys(COMMANDS).length,
      games: Object.keys(GAMES),
      theme,
      motion: reducedMotionNow() ? 'reduced' : paused ? 'paused' : 'running',
      finePointer: finePointerNow(),
    }),
  );
  const bootTotal = bootLength(bootLines);
  const [booted, setBooted] = useState(still);
  // Pausing part-way through finishes the boot at once.
  if (still && !booted) setBooted(true);
  const [typed, setTyped] = useState(0);
  const [bootShown, setBootShown] = useState(true);

  const nextId = useRef(2);
  const [history, setHistory] = useState<TerminalEntry[]>(() => [
    { id: 0, command: '', output: ASCII_ART, kind: 'art' },
    { id: 1, command: '', output: WELCOME },
  ]);
  // Entries newer than this print themselves line by line; older ones are simply there.
  const [settled, setSettled] = useState(-1);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [caret, setCaret] = useState({ pos: 0, scroll: 0 });
  const [keystrokes, setKeystrokes] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const announceCount = useRef(0);
  const uptime = useUptime(paused);

  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const tubeRef = useRef<HTMLDivElement>(null);
  const ledRef = useRef<HTMLSpanElement>(null);
  const traceRef = useRef<KeyTraceHandle>(null);
  const lastListed = useRef('');
  const focusedOnce = useRef(false);

  const announce = (text: string) => {
    // A trailing no-break space alternates, so the same output twice is still read twice.
    announceCount.current += 1;
    setAnnouncement(text + (announceCount.current % 2 ? ' ' : ''));
  };

  /** Plays a short Web Animation on an element, unless motion is off. */
  const flash = (el: HTMLElement | null, frames: Keyframe[], duration: number) => {
    if (!el || still || typeof el.animate !== 'function') return;
    el.animate(frames, { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  };

  // Power on: the picture opens from a bright line, as a tube warms up.
  useEffect(() => {
    const tube = tubeRef.current;
    if (!tube || reducedMotionNow() || document.documentElement.dataset.motion === 'paused') return;
    if (typeof tube.animate !== 'function') return;
    const animation = tube.animate(
      [
        { transform: 'scale(0.62, 0.004)', filter: 'brightness(4)', opacity: 0.5 },
        { transform: 'scale(1, 0.004)', filter: 'brightness(3)', opacity: 1, offset: 0.32 },
        { transform: 'scale(1, 1.02)', filter: 'brightness(1.7)', offset: 0.7 },
        { transform: 'none', filter: 'none', opacity: 1 },
      ],
      { duration: 680, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    return () => animation.cancel();
  }, []);

  // Type the boot report, then hold a beat before the prompt goes live.
  const typingDone = typed >= bootTotal;
  useEffect(() => {
    if (booted || typingDone) return;
    const timer = window.setInterval(
      () => setTyped((count) => Math.min(count + BOOT_STEP, bootTotal)),
      BOOT_TICK_MS,
    );
    return () => window.clearInterval(timer);
  }, [booted, typingDone, bootTotal]);
  useEffect(() => {
    if (booted || !typingDone) return;
    const timer = window.setTimeout(() => setBooted(true), 280);
    return () => window.clearTimeout(timer);
  }, [booted, typingDone]);

  // Any key skips the boot. The key itself still does its normal job.
  useEffect(() => {
    if (booted) return;
    const skip = () => setBooted(true);
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [booted]);

  // Once ready: say so once, and on a desktop put the cursor in the prompt, unless
  // the visitor has already moved focus somewhere. Phones are left alone, since
  // focusing would throw the keyboard up over the page.
  useEffect(() => {
    if (!booted) return;
    setAnnouncement('Terminal ready. Type help for available commands.');
  }, [booted]);
  useEffect(() => {
    if (!booted || !isFinePointer || focusedOnce.current) return;
    focusedOnce.current = true;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [booted, isFinePointer]);

  // Let fresh output finish printing, then mark it settled so it never replays.
  useEffect(() => {
    if (!booted) return;
    const latest = history[history.length - 1]?.id ?? -1;
    if (latest <= settled) return;
    const timer = window.setTimeout(() => setSettled(latest), 1400);
    return () => window.clearTimeout(timer);
  }, [booted, history, settled]);

  // Scroll only the screen, never the page.
  useEffect(() => {
    const screen = screenRef.current;
    if (screen) screen.scrollTop = screen.scrollHeight;
  }, [history, typed, booted]);

  const syncCaret = () => {
    const el = inputRef.current;
    if (!el) return;
    setCaret({ pos: el.selectionStart ?? el.value.length, scroll: el.scrollLeft });
  };
  // A value set from history or completion puts the cursor at the end.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el) setCaret({ pos: el.selectionStart ?? el.value.length, scroll: el.scrollLeft });
  }, [currentInput]);

  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    if (!trimmed) return;
    if (!booted) setBooted(true);

    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    lastListed.current = '';
    traceRef.current?.bump(0.95);
    flash(ledRef.current, [{ transform: 'scale(1.9)', filter: 'brightness(2)' }, { transform: 'none' }], 420);

    // An own-property check, so typing "constructor" is not taken for a game.
    if (Object.prototype.hasOwnProperty.call(GAMES, trimmed)) {
      setHistory((prev) => [
        ...prev,
        { id: nextId.current++, command: cmd, output: 'Loading cartridge...', kind: 'load' },
      ]);
      announce('Loading cartridge...');
      setTimeout(() => window.location.assign(GAMES[trimmed]), 450);
      return;
    }

    const result = runCommand(cmd);
    if (!result) {
      setHistory([
        { id: nextId.current++, command: '', output: ASCII_ART, kind: 'art' },
        { id: nextId.current++, command: '', output: 'Terminal cleared.\n' },
      ]);
      setBootShown(false);
      announce('Terminal cleared.');
      // A degauss: the picture shudders and settles.
      flash(
        tubeRef.current,
        [
          { transform: 'none', filter: 'none' },
          { transform: 'skewX(4deg) scale(1.015)', filter: 'hue-rotate(70deg) brightness(1.6)', offset: 0.18 },
          { transform: 'skewX(-3deg)', filter: 'hue-rotate(-50deg) brightness(1.3)', offset: 0.38 },
          { transform: 'skewX(1.2deg)', filter: 'hue-rotate(20deg)', offset: 0.62 },
          { transform: 'none', filter: 'none' },
        ],
        620,
      );
      return;
    }
    if (trimmed === 'help') {
      result.output += '  play        Play Tetris-89\n  space       Play Star Vanguard\n';
    }
    setHistory((prev) => [...prev, { ...result, id: nextId.current++ }]);
    announce(speakable(result.output));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setKeystrokes((count) => count + 1);
    traceRef.current?.bump(e.key === 'Backspace' ? 0.22 : 0.4);

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
    } else if (e.key === 'Tab' && !e.shiftKey && currentInput) {
      // Tab is only held back while there is something to complete or list, so
      // focus can always move on from the prompt (WCAG 2.1.2).
      const partial = currentInput.toLowerCase();
      const matches = NAMES.filter((name) => name.startsWith(partial));
      if (matches.length === 1) {
        if (matches[0] !== partial) {
          e.preventDefault();
          setCurrentInput(matches[0]);
        }
      } else if (matches.length > 1) {
        const prefix = commonPrefix(matches);
        if (prefix.length > partial.length) {
          e.preventDefault();
          setCurrentInput(prefix);
        } else if (lastListed.current !== partial) {
          e.preventDefault();
          lastListed.current = partial;
          setHistory((prev) => [
            ...prev,
            { id: nextId.current++, command: currentInput, output: matches.join('  '), kind: 'matches' },
          ]);
          announce(`${matches.length} matches: ${matches.join(', ')}`);
        }
      }
    } else if (e.key === 'Escape' && currentInput) {
      e.preventDefault();
      setCurrentInput('');
      setHistoryIndex(-1);
    } else if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      executeCommand('clear');
    }
  };

  const caretChar = currentInput[caret.pos] ?? ' ';
  const fieldStyle = { '--caret': caret.pos, '--scroll': `${caret.scroll}px` } as CSSProperties;

  return (
    <div className="term">
      <LabHero
        code="04"
        eyebrow="Terminal"
        title="Command line."
        muted="The résumé, queryable."
        intro={
          <p>
            The résumé, the projects and the research, as plain text. Type a command or tap a preset;{' '}
            <code className="term-inline mono">help</code> lists them all, and{' '}
            <code className="term-inline mono">play</code> or <code className="term-inline mono">space</code> load a
            game from the arcade.
          </p>
        }
        aside={
          <div className="term-keys lab-panel" {...pointerLight}>
            <p className="term-kicker mono">Controls</p>
            <dl>
              <div>
                <dt>
                  <kbd>Enter</kbd>
                </dt>
                <dd>run the line</dd>
              </div>
              <div>
                <dt>
                  <kbd>Tab</kbd>
                </dt>
                <dd>complete a command</dd>
              </div>
              <div>
                <dt>
                  <kbd>↑</kbd> <kbd>↓</kbd>
                </dt>
                <dd>step through earlier commands</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                </dt>
                <dd>clear the line</dd>
              </div>
              <div>
                <dt>
                  <kbd>Ctrl</kbd> <kbd>L</kbd>
                </dt>
                <dd>clear the screen</dd>
              </div>
            </dl>
          </div>
        }
      />

      <section className="lab-section" aria-label="Terminal">
        <div className="term-grid">
          <div className="term-presets">
            <p className="term-kicker mono" id="term-presets-label">
              Presets
            </p>
            <div className="term-chips" role="group" aria-labelledby="term-presets-label">
              {QUICK_COMMANDS.map((cmd) => (
                <button key={cmd} type="button" className="lab-chip" onClick={() => executeCommand(cmd)}>
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          <div className="term-crt lab-panel" {...pointerLight}>
            <div className="term-bar">
              <span ref={ledRef} className="term-led" data-state={booted ? 'ready' : 'boot'} aria-hidden="true" />
              <span className="term-id mono">
                CH-04 <span aria-hidden="true">·</span> varun@portfolio:~
              </span>
              <dl className="term-readouts mono">
                <div>
                  <dt>Uptime</dt>
                  <dd className="lab-readout">{formatUptime(uptime)}</dd>
                </div>
                <div>
                  <dt>Cmds</dt>
                  <dd className="lab-readout">{String(commandHistory.length).padStart(2, '0')}</dd>
                </div>
                <div className="term-readout-clock">
                  <dt>Mumbai</dt>
                  <dd className="lab-readout">
                    <LocalClock />
                  </dd>
                </div>
              </dl>
            </div>

            <div
              ref={tubeRef}
              className="term-tube"
              data-booting={booted ? undefined : ''}
              onPointerDown={() => {
                if (!booted) setBooted(true);
              }}
            >
              <div
                ref={screenRef}
                className="term-screen"
                onClick={() => {
                  // Leave a text selection alone, so output can be copied.
                  if (window.getSelection()?.isCollapsed === false) return;
                  inputRef.current?.focus({ preventScroll: true });
                }}
              >
                {bootShown && <BootScreen lines={bootLines} typed={typed} done={booted} />}
                {booted && (
                  <div className="term-log">
                    {history.map((entry) => (
                      <OutputBlock
                        key={entry.id}
                        entry={entry}
                        fresh={!still && entry.id > settled}
                        commands={NAME_SET}
                        onRun={executeCommand}
                      />
                    ))}
                  </div>
                )}
                <label className="term-prompt" data-booting={booted ? undefined : ''}>
                  <span className="term-ps" aria-hidden="true">
                    ❯
                  </span>
                  <span className="term-field" style={fieldStyle}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentInput}
                      onChange={(e) => {
                        setCurrentInput(e.target.value);
                        lastListed.current = '';
                      }}
                      onKeyDown={handleKeyDown}
                      onSelect={syncCaret}
                      onKeyUp={syncCaret}
                      onScroll={syncCaret}
                      /* Auto-focusing on a phone throws the keyboard up over the
                         content the moment the page loads, so only a fine pointer
                         gets the cursor placed for it (see the effect above). */
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      enterKeyHint="go"
                      aria-label="Terminal command input"
                      aria-describedby="term-hints"
                      placeholder="type a command..."
                    />
                    <span key={`${caret.pos}:${currentInput}`} className="term-caret" aria-hidden="true">
                      {caretChar}
                    </span>
                  </span>
                </label>
              </div>
              <span className="term-scan" aria-hidden="true" />
              <span className="term-roll" aria-hidden="true" />
              <span className="term-corners" aria-hidden="true" />
            </div>

            <div className="term-foot">
              <div className="term-meter" aria-hidden="true">
                <span className="mono">Keys</span>
                <KeyTrace ref={traceRef} still={still} />
                <span className="lab-readout mono">{String(keystrokes).padStart(3, '0')}</span>
              </div>
              <p className="term-hints mono" id="term-hints">
                <kbd>Enter</kbd> runs, <kbd>Tab</kbd> completes, <kbd>↑</kbd>
                <kbd>↓</kbd> recall, <kbd>Ctrl L</kbd> clears.
              </p>
            </div>
          </div>

          <div className="term-channels">
            <p className="term-kicker mono">Open channels</p>
            <ul>
              <li>
                <a
                  href={profile.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="term-channel lab-panel"
                  {...pointerLight}
                >
                  <Github size={20} aria-hidden="true" />
                  <span className="term-channel-text">
                    <strong>GitHub</strong>
                    <span className="mono">@{profile.githubHandle}</span>
                  </span>
                  <ArrowUpRight className="term-channel-arrow" size={16} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={profile.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="term-channel lab-panel"
                  {...pointerLight}
                >
                  <Linkedin size={20} aria-hidden="true" />
                  <span className="term-channel-text">
                    <strong>LinkedIn</strong>
                    <span className="mono">/in/{profile.linkedinHandle}</span>
                  </span>
                  <ArrowUpRight className="term-channel-arrow" size={16} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a href={`mailto:${profile.email}`} className="term-channel lab-panel" {...pointerLight}>
                  <Mail size={20} aria-hidden="true" />
                  <span className="term-channel-text">
                    <strong>Email</strong>
                    <span className="mono">{profile.email}</span>
                  </span>
                  <ArrowUpRight className="term-channel-arrow" size={16} aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </section>
    </div>
  );
};

export default Terminal;
