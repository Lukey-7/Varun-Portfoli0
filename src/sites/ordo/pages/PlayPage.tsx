import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

const GAMES = [
  { id: "tetris", label: "Tetris-89", src: "/play/arcade/index.html" },
  { id: "space", label: "Star Vanguard", src: "/play/arcade/space.html" },
] as const;

/** Lukey Arcade, full width: a playable copy of the public Lukey-tetris repository. */
export default function PlayPage() {
  const [game, setGame] = useState<(typeof GAMES)[number]>(GAMES[0]);
  useEffect(() => {
    document.title = "Play | Varun Darji";
  }, []);

  return (
    <article className="play-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ PLAY / LUKEY ARCADE ]</span>
          <span>NO BUILD STEP · WEB AUDIO</span>
        </div>
        <div className="play-head">
          <h1>
            Play the arcade.
            <br />
            <span>Two games, one page.</span>
          </h1>
          <div>
            <div className="play-switch" role="group" aria-label="Game">
              {GAMES.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={game.id === item.id}
                  onClick={() => setGame(item)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mono play-help">
              Click the game to give it the keyboard; press Tab to leave it.
              Sound starts only when you press play.
            </p>
          </div>
        </div>
      </header>
      <section className="section-wrap play-stage">
        <iframe key={game.id} src={game.src} title={`${game.label}, playable`} />
        <div className="play-links">
          <a href={game.src} target="_blank" rel="noreferrer">
            Open full screen <ArrowUpRight size={13} aria-hidden="true" />
          </a>
          <Link to="/work/arcade">
            About the project <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </article>
  );
}
