import ProjectVisual from "@/components/portfolio/ProjectVisual";
import type { ProjectArtKind } from "../projects";
import TetrisMini from "./TetrisMini";

/**
 * A project's animated icon. The same artwork appears on its card and,
 * larger, at the top of its project page.
 */
export default function ProjectArt({ art }: { art: ProjectArtKind }) {
  if (art.type === "visual") return <ProjectVisual kind={art.visual} />;
  if (art.type === "language")
    return (
      <div className="language-orbit">
        <span>ß</span>
        <i>lernen</i>
        <i>verstehen</i>
        <i>wiederholen</i>
      </div>
    );
  return <TetrisMini />;
}
