import { Fragment, useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "../content";
import { formatJourneyDate } from "../journey";
import { findPost, posts, type WritingBlock } from "../writing";
import NotFoundPage from "./NotFoundPage";
import "./writing.css";

/** `code` in backticks becomes <code>; everything else stays text. */
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={index}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function Block({ block }: { block: WritingBlock }) {
  const reduced = useReducedMotion();
  switch (block.type) {
    case "p":
      return <p>{inline(block.text)}</p>;
    case "h2":
      return <h2>{block.text}</h2>;
    case "list":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <figure className="writing-table">
          <div className="writing-table-scroll">
            <table>
              <thead>
                <tr>
                  {block.head.map((cell) => (
                    <th key={cell} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, index) => (
                  <tr key={row[0]} className={index === block.highlight ? "is-highlight" : undefined}>
                    {row.map((cell, column) =>
                      column === 0 ? (
                        <th key={cell} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={column}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="mono">{block.caption}</figcaption>
        </figure>
      );
    case "bars":
      return (
        <figure className="writing-bars">
          <ol>
            {block.bars.map((bar, index) => (
              <li key={bar.label} className={index === block.highlight ? "is-highlight" : undefined}>
                <span className="writing-bar-label">{bar.label}</span>
                <span className="writing-bar-track" aria-hidden="true">
                  {reduced ? (
                    <i style={{ transform: `scaleX(${bar.value / block.max})` }} />
                  ) : (
                    <motion.i
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: bar.value / block.max }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.8, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </span>
                <span className="writing-bar-value mono">
                  {bar.value} / {block.max}
                </span>
              </li>
            ))}
          </ol>
          <figcaption className="mono">{block.caption}</figcaption>
        </figure>
      );
  }
}

/** One write-up, or the list of them at /writing. */
export default function WritingPage() {
  const { slug } = useParams();
  const post = slug ? findPost(slug) : undefined;
  useEffect(() => {
    document.title = post ? `${post.title.join(" ").replace(/\.$/, "")} | Varun Darji` : "Writing | Varun Darji";
  }, [post]);

  if (slug && !post) return <NotFoundPage />;

  if (!post) {
    const { writingPage } = content;
    return (
      <article className="writing-index">
        <header className="page-hero section-wrap">
          <div className="ordo-section-label">
            <span>{writingPage.label[0]}</span>
            <span>{writingPage.label[1]}</span>
          </div>
          <h1>
            {writingPage.title[0]}
            <br />
            <span>{writingPage.title[1]}</span>
          </h1>
          <p className="project-lede">{writingPage.intro}</p>
        </header>
        <section className="section-wrap writing-list" aria-label="Write-ups">
          {posts.map((item) => (
            <Link key={item.slug} to={`/writing/${item.slug}`} className="writing-card">
              <span className="mono">
                {formatJourneyDate(item.date)} · {item.readingMinutes} min read
              </span>
              <strong>
                {item.title[0]} <span>{item.title[1]}</span>
              </strong>
              <p>{item.summary}</p>
              <span className="writing-card-action mono">
                Read it <ArrowUpRight size={13} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </section>
      </article>
    );
  }

  return (
    <article className="writing-post">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ WRITING / {formatJourneyDate(post.date).toUpperCase()} ]</span>
          <span>{post.readingMinutes} MIN READ</span>
        </div>
        <h1>
          {post.title[0]}
          <br />
          <span>{post.title[1]}</span>
        </h1>
        <p className="project-lede">{post.summary}</p>
        {post.project && (
          <div className="project-actions">
            <Link to={`/work/${post.project}`} className="text-button">
              The project and its demo <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </header>
      <div className="section-wrap writing-body">
        {post.body.map((block, index) => (
          <Block key={index} block={block} />
        ))}
        <footer className="writing-sources">
          <h2>Sources</h2>
          <ul>
            {post.sources.map((source) => (
              <li key={source.href}>
                <a href={source.href} target="_blank" rel="noreferrer">
                  {source.label} <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Link to="/journey" className="section-link">
            <ArrowLeft size={14} aria-hidden="true" /> Back to the journey
          </Link>
        </footer>
      </div>
    </article>
  );
}
