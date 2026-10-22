import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";

const COLS = 8;
const ROWS = 8;

// Tetromino cells as [row, col] offsets.
const PIECES = [
  [[0, 0], [0, 1], [0, 2], [0, 3]], // I
  [[0, 0], [0, 1], [1, 0], [1, 1]], // O
  [[0, 1], [1, 0], [1, 1], [1, 2]], // T
  [[0, 0], [1, 0], [1, 1], [1, 2]], // J
  [[0, 2], [1, 0], [1, 1], [1, 2]], // L
  [[0, 1], [0, 2], [1, 0], [1, 1]], // S
  [[0, 0], [0, 1], [1, 1], [1, 2]], // Z
];

/** The card's original still pattern; its lower half is the starting stack. */
const START = [
  0, 1, 2, 9, 10, 13, 14, 17, 21, 22, 24, 25, 29, 30, 33, 34, 35, 38, 40, 41,
  44, 45, 46, 49, 52, 53, 56, 57, 58, 59, 60, 61, 62, 63,
];
const startBoard = () => {
  const board = Array<number>(COLS * ROWS).fill(0);
  START.filter((n) => n >= 40).forEach((n) => (board[n] = 1));
  return board;
};

interface Falling {
  cells: number[][];
  row: number;
  col: number;
}

const fits = (board: number[], { cells, row, col }: Falling) =>
  cells.every(([r, c]) => {
    const y = row + r,
      x = col + c;
    return x >= 0 && x < COLS && y < ROWS && (y < 0 || !board[y * COLS + x]);
  });

/** A tiny self-playing Tetris for the arcade card: pieces fall, lock and clear lines. */
export default function TetrisMini() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const ref = useRef<HTMLDivElement>(null);
  const board = useRef(startBoard());
  const piece = useRef<Falling | null>(null);
  const seed = useRef(3);
  const [cleared, setCleared] = useState<number[]>([]);
  const [visible, setVisible] = useState(false);
  const [, setFrame] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || paused || !visible) return;
    let clearTimer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = piece.current;
      if (!current) {
        seed.current = (seed.current * 7 + 5) % 97;
        const cells = PIECES[seed.current % PIECES.length];
        const width = Math.max(...cells.map(([, c]) => c)) + 1;
        piece.current = { cells, row: -1, col: seed.current % (COLS - width + 1) };
      } else if (fits(board.current, { ...current, row: current.row + 1 })) {
        piece.current = { ...current, row: current.row + 1 };
      } else {
        // Lock the piece; restart if it locked at the top, else clear full rows.
        piece.current = null;
        if (current.row <= 0) {
          board.current = startBoard();
        } else {
          const next = [...board.current];
          current.cells.forEach(([r, c]) => {
            next[(current.row + r) * COLS + current.col + c] = 1;
          });
          const full = Array.from({ length: ROWS }, (_, y) => y).filter((y) =>
            next.slice(y * COLS, y * COLS + COLS).every(Boolean),
          );
          if (full.length) {
            setCleared(full);
            clearTimeout(clearTimer);
            clearTimer = setTimeout(() => {
              const kept = board.current.filter((_, i) => !full.includes(Math.floor(i / COLS)));
              board.current = [...Array<number>(full.length * COLS).fill(0), ...kept];
              setCleared([]);
            }, 260);
          }
          board.current = next;
        }
      }
      setFrame((f) => f + 1);
    };
    const timer = setInterval(tick, 230);
    return () => {
      clearInterval(timer);
      clearTimeout(clearTimer);
    };
  }, [reduced, paused, visible]);

  const p = piece.current;
  const falling = new Set(p ? p.cells.map(([r, c]) => (p.row + r) * COLS + p.col + c) : []);

  return (
    <div ref={ref} className="tetris-matrix is-live" aria-hidden="true">
      {board.current.map((filled, n) => (
        <i
          key={n}
          className={[
            filled ? "filled" : "",
            falling.has(n) ? "falling" : "",
            cleared.includes(Math.floor(n / COLS)) ? "clearing" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
