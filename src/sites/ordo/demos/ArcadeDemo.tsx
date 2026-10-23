import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import "./arcade.css";

type GameId = "tetris" | "space";
type CabinetSize = "compact" | "full";

interface KeyCap {
  /** What is printed on the key. */
  cap: string;
  /** Spoken name, when the cap is a symbol or an abbreviation. */
  name?: string;
  wide?: boolean;
}

interface Binding {
  /** Alternatives, each a set of keys shown together (for example ← →). */
  keys: KeyCap[][];
  action: string;
}

interface Game {
  id: GameId;
  slot: string;
  genre: string;
  name: string;
  blurb: string;
  metaLabel: string;
  meta: string[];
  /** The game-only page, designed for a popup window of width × height. */
  src: string;
  /** The full portal page for this game. */
  portal: string;
  width: number;
  height: number;
  boot: string;
  leave: string;
  bindings: Binding[];
  pointer?: string;
  touch: string;
  keysNote: string;
  details: [string, string][];
}

const cap = (label: string, name?: string, wide = false): KeyCap => ({ cap: label, name, wide });
const LEFT = cap("←", "Left arrow");
const RIGHT = cap("→", "Right arrow");
const UP = cap("↑", "Up arrow");
const DOWN = cap("↓", "Down arrow");
const SPACE = cap("Space", undefined, true);
const ENTER = cap("Enter", undefined, true);
const SHIFT = cap("Shift", undefined, true);
const ESC = cap("Esc", "Escape");
const CTRL = cap("L Ctrl", "Left Control", true);
const [A, B, C, D, M, P, R, S, W, X, Z] = ["A", "B", "C", "D", "M", "P", "R", "S", "W", "X", "Z"].map(
  (letter) => cap(letter),
);

/*
 * Both games live in public/play/arcade. Key bindings were read from the game
 * code: Tetris uses the defaults in js/storage.js (handled in js/ui.js, and
 * rebindable in the game); Star Vanguard's keys are fixed in js/space_ui.js.
 */
const GAMES: Record<GameId, Game> = {
  tetris: {
    id: "tetris",
    slot: "01",
    genre: "Puzzle",
    name: "Tetris-89 Mini",
    blurb: "Falling-block puzzle with hold, a ghost piece and a next queue.",
    metaLabel: "Modes",
    meta: ["Marathon", "40-Line Sprint", "2-Minute Blitz", "Zen", "Daily"],
    src: "/play/arcade/popup.html",
    portal: "/play/arcade/index.html",
    width: 380,
    height: 640,
    boot: "Starts a game straight away. A saved game waits, paused, for you to resume it.",
    leave: "Tetris pauses itself when you leave.",
    bindings: [
      { keys: [[LEFT, RIGHT], [A, D]], action: "Move" },
      { keys: [[DOWN], [S]], action: "Soft drop" },
      { keys: [[SPACE]], action: "Hard drop" },
      { keys: [[UP], [W], [X]], action: "Rotate clockwise" },
      { keys: [[Z], [CTRL]], action: "Rotate anticlockwise" },
      { keys: [[C], [SHIFT]], action: "Hold" },
      { keys: [[P], [ESC]], action: "Pause" },
      { keys: [[R]], action: "Restart" },
      { keys: [[M]], action: "Mute" },
    ],
    touch:
      "Use the game's own buttons, or on the board drag to move, tap to rotate, flick down to drop and flick up to hold.",
    keysNote: "Default keys. Rebind them, and pick the mode and theme, under OPTS in the game.",
    details: [
      [
        "Modes",
        "Marathon, 40-Line Sprint, 2-Minute Blitz, Zen (no game over) and a Daily challenge that deals the same pieces all day.",
      ],
      ["Sound", "Three chiptune tracks and every effect are synthesised live with Web Audio. There are no audio files."],
      ["Themes", "Four colour themes: Game Boy, NES, Cyberpunk Neon and Matrix Phosphor."],
      ["Options", "Rebindable keys, three shape sets (up to all 14 polyominoes) and a ghost piece, under OPTS."],
      ["Built with", "Plain HTML, CSS and JavaScript, with no build step."],
    ],
  },
  space: {
    id: "space",
    slot: "02",
    genre: "Shooter",
    name: "Star Vanguard Mini",
    blurb: "Galaga-style space shooter: waves swoop in, hold formation, then dive at you.",
    metaLabel: "Modes",
    meta: ["Campaign", "Endless", "Boss Rush", "3 ships"],
    src: "/play/arcade/space_popup.html",
    portal: "/play/arcade/space.html",
    width: 480,
    height: 700,
    boot: "Boots to its title screen (any key skips the boot). Enter or a tap launches a mission.",
    leave: "Star Vanguard keeps running, so press P first.",
    bindings: [
      { keys: [[LEFT, RIGHT, UP, DOWN], [W, A, S, D]], action: "Fly" },
      { keys: [[SPACE], [Z]], action: "Fire (hold)" },
      { keys: [[X], [B]], action: "Nova bomb" },
      { keys: [[P], [ESC]], action: "Pause" },
      { keys: [[ENTER], [SPACE], [Z]], action: "Select in menus" },
    ],
    pointer: "Hold the left button to fly toward the pointer and fire; right-click for a Nova bomb.",
    touch:
      "Drag on the screen to fly; the ship fires while your finger is down. Tap to start, and use the NOVA BOMB button for bombs.",
    keysNote: "Keys are fixed. The speaker button at the top of the game mutes it.",
    details: [
      ["Modes", "Campaign, Endless and Boss Rush, flown in one of three ships: Viper, Titan or Phantom."],
      [
        "Waves",
        "Enemies swoop in, hold formation and dive. A tractor beam can take your fighter; win it back to fly two at once. Every fifth campaign stage is a Dreadnought boss.",
      ],
      [
        "Sound",
        "A four-voice chiptune engine (two pulse channels, triangle and noise) synthesised with Web Audio. No audio files.",
      ],
      ["Scores", "The Hall of Aces keeps the top ten scores for each mode, with initials, in your browser."],
      ["Built with", "Plain HTML, CSS and JavaScript, drawn on a 240 × 320 pixel buffer."],
    ],
  },
};

const ORDER: GameId[] = ["tetris", "space"];

/** Never enlarge a game page past this, so its pixels stay crisp. */
const MAX_SCALE = 1.25;
/** Screen height used before the frame has been measured (tests, hidden panels). */
const FALLBACK_MAX_HEIGHT: Record<CabinetSize, number> = { compact: 560, full: 760 };

/*
 * Keys that scroll a page. A game page that cannot scroll hands these up to the
 * page around it, so the host page would jump while you play. This guard only
 * stops that default scroll; the game still receives every key.
 */
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  " ",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function stopPageScroll(event: KeyboardEvent) {
  if (event.defaultPrevented || !SCROLL_KEYS.has(event.key)) return;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName;
  // Leave the game's own settings fields alone, and Space on its buttons.
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || target?.isContentEditable) return;
  if (event.key === " " && tag === "BUTTON") return;
  event.preventDefault();
}

function Keys({ keys }: { keys: KeyCap[][] }) {
  return (
    <>
      {keys.map((group, index) => (
        <Fragment key={group.map((k) => k.cap).join("")}>
          {index > 0 && (
            <>
              {" "}
              <span className="arcade-cabinet__or" aria-hidden="true">
                /
              </span>
              <span className="arcade-cabinet__sr">or</span>{" "}
            </>
          )}
          {group.map((k, keyIndex) => (
            <Fragment key={k.cap}>
              {keyIndex > 0 && " "}
              <kbd className={`arcade-cabinet__key${k.wide ? " is-wide" : ""}`}>
                {k.name ? (
                  <>
                    <span aria-hidden="true">{k.cap}</span>
                    <span className="arcade-cabinet__sr">{k.name}</span>
                  </>
                ) : (
                  k.cap
                )}
              </kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}

function Cartridge({
  game,
  chosen,
  uid,
  onChoose,
}: {
  game: Game;
  chosen: boolean;
  uid: string;
  onChoose: () => void;
}) {
  const nameId = `${uid}-${game.id}-name`;
  const blurbId = `${uid}-${game.id}-blurb`;
  const metaId = `${uid}-${game.id}-meta`;
  return (
    <button
      type="button"
      className="arcade-cabinet__cart"
      aria-pressed={chosen}
      aria-labelledby={nameId}
      aria-describedby={`${blurbId} ${metaId}`}
      onClick={onChoose}
    >
      <span className="arcade-cabinet__cart-top" aria-hidden="true">
        <span>
          Cart {game.slot} / {game.genre}
        </span>
        {chosen && <span>In the slot</span>}
      </span>
      <span className="arcade-cabinet__cart-name" id={nameId}>
        {game.name}
      </span>
      <span className="arcade-cabinet__cart-blurb" id={blurbId}>
        {game.blurb}
      </span>
      <span className="arcade-cabinet__cart-meta" id={metaId}>
        <b>{game.metaLabel}</b>{" "}
        {game.meta.map((item, index) => (
          <Fragment key={item}>
            {index > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="arcade-cabinet__sr">, </span>
              </>
            )}
            {item}
          </Fragment>
        ))}
      </span>
    </button>
  );
}

function Cover({ game, onStart }: { game: Game; onStart: () => void }) {
  return (
    // Clicking anywhere on the cover starts too; the button is the keyboard route.
    <div className="arcade-cabinet__cover" onClick={onStart}>
      <div className="arcade-cabinet__cover-top" aria-hidden="true">
        <span>Cart {game.slot}</span>
        <span>{game.genre}</span>
      </div>
      <div className="arcade-cabinet__cover-main">
        <p className="arcade-cabinet__cover-name">{game.name}</p>
        <p className="arcade-cabinet__cover-copy">{game.boot}</p>
      </div>
      <div className="arcade-cabinet__cover-foot">
        <button
          type="button"
          className="arcade-cabinet__start"
          onClick={(event) => {
            event.stopPropagation();
            onStart();
          }}
        >
          Press start
          <span className="arcade-cabinet__caret" aria-hidden="true" />
          <span className="arcade-cabinet__sr">: load {game.name}</span>
        </button>
        <p className="arcade-cabinet__cover-note">Nothing loads until you press start. The game has sound.</p>
      </div>
    </div>
  );
}

function Legend({ game, labelId }: { game: Game; labelId: string }) {
  return (
    <div className="arcade-cabinet__legend" role="group" aria-labelledby={labelId}>
      <p className="arcade-cabinet__label">
        <span id={labelId}>Controls</span>
        <span aria-hidden="true">{game.name}</span>
      </p>
      <dl className="arcade-cabinet__keys">
        {game.bindings.map((binding) => (
          <div className="arcade-cabinet__key-row" key={binding.action}>
            <dt>
              <Keys keys={binding.keys} />
            </dt>
            <dd>{binding.action}</dd>
          </div>
        ))}
      </dl>
      {game.pointer && (
        <p className="arcade-cabinet__aside">
          <b>Mouse</b> {game.pointer}
        </p>
      )}
      <p className="arcade-cabinet__aside">
        <b>Touch</b> {game.touch}
      </p>
      <p className="arcade-cabinet__fine">{game.keysNote}</p>
    </div>
  );
}

function Details({ game, labelId }: { game: Game; labelId: string }) {
  return (
    <div className="arcade-cabinet__details" role="group" aria-labelledby={labelId}>
      <p className="arcade-cabinet__label">
        <span id={labelId}>About this game</span>
        <span aria-hidden="true">Cart {game.slot}</span>
      </p>
      <dl className="arcade-cabinet__facts">
        {game.details.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * An arcade cabinet for the two Lukey Arcade games: pick a cartridge, press
 * start, play. The game's own game-only page is loaded at the window size it
 * was designed for and scaled uniformly to fit, so nothing overlaps or scrolls.
 * The iframe is only created when the visitor presses start.
 */
export function ArcadeCabinet({
  initialGame = "tetris",
  size = "compact",
}: {
  initialGame?: "tetris" | "space";
  size?: "compact" | "full";
}) {
  const uid = useId();
  const motionPaused = useMotionPaused();
  const [gameId, setGameId] = useState<GameId>(initialGame);
  const [started, setStarted] = useState(false);
  const [run, setRun] = useState(0);
  const [hasFocus, setHasFocus] = useState(false);
  const [fitWidth, setFitWidth] = useState(0);
  const fitRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const focusOnMount = useRef(false);

  const game = GAMES[gameId];
  const keysInGame = started && hasFocus;

  // One uniform scale from the measured width; the CSS caps that width so the
  // screen never passes the size's max height or MAX_SCALE.
  const scale =
    fitWidth > 0
      ? Math.min(MAX_SCALE, fitWidth / game.width)
      : Math.min(1, FALLBACK_MAX_HEIGHT[size] / game.height);
  const screenWidth = Math.max(1, Math.round(game.width * scale));
  const screenHeight = Math.max(1, Math.round(game.height * scale));
  const frameScale = screenWidth / game.width;

  useLayoutEffect(() => {
    const fit = fitRef.current;
    if (!fit) return;
    const measure = (width = fit.clientWidth) => {
      // A hidden cabinet measures 0; keep the last good size until it shows.
      if (width > 0) setFitWidth(Math.floor(width));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      const onResize = () => measure();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const observer = new ResizeObserver((entries) => measure(entries[0]?.contentRect.width));
    observer.observe(fit);
    return () => observer.disconnect();
  }, [gameId, size]);

  // Track whether the game holds the keyboard (focus inside the iframe).
  useEffect(() => {
    const frame = frameRef.current;
    if (!started || !frame) return;
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHasFocus(document.activeElement === frame), 0);
    };
    sync();
    frame.addEventListener("focus", sync);
    frame.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    return () => {
      window.clearTimeout(timer);
      frame.removeEventListener("focus", sync);
      frame.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("blur", sync);
    };
  }, [started, run, gameId]);

  // After Start or Restart, hand the keyboard to the game.
  useEffect(() => {
    if (!started || !focusOnMount.current) return;
    focusOnMount.current = false;
    frameRef.current?.focus();
  }, [started, run]);

  const start = () => {
    if (started) return;
    focusOnMount.current = true;
    setStarted(true);
  };

  const restart = () => {
    focusOnMount.current = true;
    setRun((count) => count + 1);
  };

  const choose = (next: GameId) => {
    if (next === gameId) return;
    setGameId(next);
    setStarted(false);
    setRun(0);
    setHasFocus(false);
  };

  const onFrameLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    try {
      const win = frame.contentWindow;
      if (!win) return;
      win.addEventListener("keydown", stopPageScroll);
      // Focus set before the page loaded can be dropped by some browsers.
      if (document.activeElement === frame) win.focus();
    } catch {
      // A page from another origin cannot be reached; it still plays.
    }
  };

  const ids = {
    carts: `${uid}-carts`,
    legend: `${uid}-legend`,
    details: `${uid}-details`,
    hint: `${uid}-hint`,
  };
  const status = !started ? "Ready" : keysInGame ? "Playing" : "Click to play";
  const led = !started ? "ready" : keysInGame ? "on" : "away";
  const vars = { "--arcade-w": game.width, "--arcade-h": game.height } as CSSProperties;

  return (
    <div className={`arcade-cabinet is-${size}${motionPaused ? " is-still" : ""}`} style={vars}>
      <div className="arcade-cabinet__layout">
        <div className="arcade-cabinet__carts" role="group" aria-labelledby={ids.carts}>
          <p className="arcade-cabinet__label">
            <span id={ids.carts}>Choose a game</span>
            <span aria-hidden="true">{ORDER.length} cartridges</span>
          </p>
          <div className="arcade-cabinet__cart-list">
            {ORDER.map((id) => (
              <Cartridge
                key={id}
                game={GAMES[id]}
                chosen={id === gameId}
                uid={uid}
                onChoose={() => choose(id)}
              />
            ))}
          </div>
        </div>

        <div className="arcade-cabinet__machine">
          <div className="arcade-cabinet__unit">
            <div className={`arcade-cabinet__bezel${keysInGame ? " has-keys" : ""}`}>
              <div className="arcade-cabinet__marquee">
                <span className="arcade-cabinet__status">
                  <i className="arcade-cabinet__led" data-state={led} aria-hidden="true" />
                  P1 / {status}
                </span>
                <span aria-hidden="true">
                  {game.width}×{game.height} · {Math.round(frameScale * 100)}%
                </span>
              </div>
              <div className="arcade-cabinet__fit" ref={fitRef}>
                <div className="arcade-cabinet__screen" style={{ width: screenWidth, height: screenHeight }}>
                  {started ? (
                    <>
                      <span className="arcade-cabinet__loading" aria-hidden="true">
                        Loading cart {game.slot}…
                      </span>
                      <iframe
                        key={`${gameId}-${run}`}
                        ref={frameRef}
                        className="arcade-cabinet__frame"
                        src={game.src}
                        title={`${game.name} (playable game)`}
                        width={game.width}
                        height={game.height}
                        style={{
                          width: game.width,
                          height: game.height,
                          transform: `scale(${frameScale})`,
                        }}
                        aria-describedby={ids.hint}
                        onLoad={onFrameLoad}
                      />
                    </>
                  ) : (
                    <Cover game={game} onStart={start} />
                  )}
                </div>
              </div>
              <div className="arcade-cabinet__deck">
                <button type="button" className="arcade-cabinet__btn" onClick={restart} disabled={!started}>
                  <RotateCcw size={14} aria-hidden="true" />
                  Restart<span className="arcade-cabinet__sr"> {game.name}</span>
                </button>
                <a className="arcade-cabinet__btn" href={game.portal} target="_blank" rel="noreferrer">
                  Open the full arcade
                  <ArrowUpRight size={14} aria-hidden="true" />
                  <span className="arcade-cabinet__sr"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
            <p className="arcade-cabinet__hint" id={ids.hint}>
              Click the game to give it the keyboard. To leave, Tab past its own buttons or click outside.{" "}
              {game.leave}
            </p>
          </div>
        </div>

        <Legend game={game} labelId={ids.legend} />
        {size === "full" && <Details game={game} labelId={ids.details} />}
      </div>
    </div>
  );
}

/** Lukey Arcade on a project page: the compact cabinet in the shared demo shell. */
export default function ArcadeDemo() {
  return (
    <DemoFrame
      project="Lukey Arcade"
      title="Play Tetris-89 or Star Vanguard"
      intro="Pick a cartridge and press start. Each game runs at its real size, scaled to fit the frame."
      note="The real games, unmodified, running from this site. Saves and settings stay in your browser."
      className="arcade-demo"
    >
      <ArcadeCabinet size="compact" />
    </DemoFrame>
  );
}
