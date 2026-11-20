import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "../content";
import { formatJourneyDate } from "../journey";
import { findPost, posts, type WritingBlock } from "../writing";
import { ArticleToc, type TocItem } from "../content/ArticleToc";
import { MaskTitle } from "../content/MaskTitle";
import { ReadingProgress } from "../content/ReadingProgress";
import { slugify } from "../content/hooks";
import NotFoundPage from "./NotFoundPage";
import "./writing.css";
import "../content/content.css";

const EASE = [0.16, 1, 0.3, 1] as const;

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

/** A figure settles in as it reaches the reader; prose stays put so reading is never interrupted. */
function useFigureReveal() {
  const reduced = useReducedMotion();
  return reduced
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 0.6, ease: EASE },
      };
}

function Block({ block, heading, lede }: { block: WritingBlock; heading?: { id: string; index: number }; lede?: boolean }) {
  const reduced = useReducedMotion();
  const reveal = useFigureReveal();
  switch (block.type) {
    case "p":
      return <p className={lede ? "writing-lede" : undefined}>{inline(block.text)}</p>;
    case "h2":
      return (
        <h2 id={heading?.id} tabIndex={-1}>
          {heading && (
            <span className="writing-h2-index mono" aria-hidden="true">
              {String(heading.index + 1).padStart(2, "0")}
            </span>
          )}
          {block.text}
        </h2>
      );
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
        <motion.figure className="writing-table" {...reveal}>
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
        </motion.figure>
      );
    case "bars":
      return (
        <motion.figure className="writing-bars" {...reveal}>
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
                      transition={{ duration: 0.8, delay: index * 0.08, ease: EASE }}
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
        </motion.figure>
      );
  }
}

/** The list of write-ups at /writing. */
function WritingIndex() {
  const { writingPage } = content;
  const reduced = useReducedMotion();
  return (
    <article className="writing-index">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{writingPage.label[0]}</span>
          <span>{writingPage.label[1]}</span>
        </div>
        <MaskTitle lines={writingPage.title} />
        <p className="project-lede">{writingPage.intro}</p>
      </header>
      <section className="section-wrap writing-list" aria-label="Write-ups">
        {posts.map((item, index) => (
          <motion.div
            key={item.slug}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 + index * 0.08, ease: EASE }}
          >
            <Link to={`/writing/${item.slug}`} className="writing-card">
              <span className="writing-card-index mono" aria-hidden="true">
                {String(posts.length - index).padStart(2, "0")}
              </span>
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
              <i className="writing-card-rule" aria-hidden="true" />
            </Link>
          </motion.div>
        ))}
      </section>
    </article>
  );
}

/** One write-up, or the list of them at /writing. */
export default function WritingPage() {
  const { slug } = useParams();
  const post = slug ? findPost(slug) : undefined;
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.title = post ? `${post.title.join(" ").replace(/\.$/, "")} | Varun Darji` : "Writing | Varun Darji";
  }, [post]);

  // Section anchors come from the write-up's own headings, plus its sources.
  const outline = useMemo(() => {
    const headings = new Map<number, { id: string; index: number }>();
    const toc: TocItem[] = [];
    post?.body.forEach((block, position) => {
      if (block.type !== "h2") return;
      const id = slugify(block.text);
      headings.set(position, { id, index: toc.length });
      toc.push({ id, text: block.text });
    });
    if (post) toc.push({ id: "sources", text: "Sources" });
    return { headings, toc };
  }, [post]);

  if (slug && !post) return <NotFoundPage />;
  if (!post) return <WritingIndex />;

  const firstParagraph = post.body.findIndex((block) => block.type === "p");

  return (
    <article className="writing-post">
      <ReadingProgress target={bodyRef} />
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>
            [{" "}
            <Link to="/writing" className="writing-crumb">
              WRITING
            </Link>{" "}
            / {formatJourneyDate(post.date).toUpperCase()} ]
          </span>
          <span>{post.readingMinutes} MIN READ</span>
        </div>
        <MaskTitle lines={post.title} />
        <p className="project-lede">{post.summary}</p>
        {post.project && (
          <div className="project-actions">
            <Link to={`/work/${post.project}`} className="text-button">
              The project and its demo <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </header>
      <div className="section-wrap writing-layout">
        <ArticleToc items={outline.toc} />
        <div className="writing-body" ref={bodyRef}>
          {post.body.map((block, index) => (
            <Block
              key={index}
              block={block}
              heading={outline.headings.get(index)}
              lede={index === firstParagraph}
            />
          ))}
          <footer className="writing-sources">
            <h2 id="sources" tabIndex={-1}>
              Sources
            </h2>
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
      </div>
    </article>
  );
}
