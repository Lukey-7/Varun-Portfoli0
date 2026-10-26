import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { JourneyEntry } from "../journey";

/**
 * A dated entry's title: a router link for a page on this site (`to`), a
 * new-tab link for somewhere else (`href`), or plain text for neither. Shared
 * by the journey log and the research log.
 */
export function EntryTitle({ entry }: { entry: Pick<JourneyEntry, "title" | "to" | "href"> }) {
  if (entry.to) return <Link to={entry.to}>{entry.title}</Link>;
  if (entry.href)
    return (
      <a href={entry.href} target="_blank" rel="noreferrer">
        {entry.title} <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    );
  return <>{entry.title}</>;
}
