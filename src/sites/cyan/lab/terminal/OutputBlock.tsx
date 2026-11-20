import type { CSSProperties, ReactNode } from "react";

export interface TerminalEntry {
  id: number;
  command: string;
  output: string;
  isError?: boolean;
  /** "art" is the wordmark, "matches" a Tab completion list, "load" a game starting. */
  kind?: "art" | "matches" | "load";
}

/** Block art and boxes need their columns; everything else can wrap. */
const isDrawn = (text: string) => /[█┌│]/.test(text);

/** A help line: two spaces, a command name, padding, its description. */
const HELP_LINE = /^(\s{2})([a-z]+)(\s.*)$/;

/**
 * One command and what it printed. Each line is its own row, so a fresh entry
 * can print itself line by line (see terminal.css). In the help list and a
 * Tab completion list, every command name is also a button that runs it; those
 * buttons are a pointer shortcut and stay out of the Tab order, since the
 * input does the same job from the keyboard.
 */
export function OutputBlock({
  entry,
  fresh,
  commands,
  onRun,
}: {
  entry: TerminalEntry;
  fresh: boolean;
  commands: ReadonlySet<string>;
  onRun: (command: string) => void;
}) {
  const drawn = isDrawn(entry.output);
  const linkHelp = entry.command.trim().toLowerCase() === "help";
  const lines = entry.output.split("\n");
  // The commands' output opens and closes with a blank line; keep one leading gap, drop the trailing one.
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  const run = (name: string) => (
    <button type="button" tabIndex={-1} className="term-cmdlink" onClick={() => onRun(name)}>
      {name}
    </button>
  );

  const renderLine = (line: string): ReactNode => {
    if (entry.kind === "matches") {
      return line.split(/(\s+)/).map((part, i) => (commands.has(part) ? <span key={i}>{run(part)}</span> : part));
    }
    if (linkHelp) {
      const match = HELP_LINE.exec(line);
      if (match && commands.has(match[2])) {
        return (
          <>
            {match[1]}
            {run(match[2])}
            {match[3]}
          </>
        );
      }
    }
    return line || " ";
  };

  const className = [
    "term-out",
    drawn && "is-drawn",
    entry.kind === "art" && "is-art",
    entry.kind === "load" && "is-load",
    entry.isError && "is-error",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="term-entry" data-fresh={fresh ? "" : undefined}>
      {entry.command && (
        <p className="term-echo">
          <span className="term-ps" aria-hidden="true">
            ❯
          </span>
          <span className="term-echo-text">{entry.command}</span>
        </p>
      )}
      <pre className={className} aria-hidden={entry.kind === "art" || undefined}>
        {lines.map((line, i) => (
          <span key={i} className="term-line" style={{ "--i": i } as CSSProperties}>
            {renderLine(line)}
          </span>
        ))}
      </pre>
    </div>
  );
}
