import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { experience } from "@/data/profile";
import { deliveryWork } from "@/data/portfolio";
import { ExperienceTimeline } from "../motion/ExperienceTimeline";

/**
 * The timeline and the list of jobs under it. The job being hovered or focused
 * (`active`) and the one open (`openJob`) are state of this section, so a hover
 * re-renders it and not the whole page.
 */
export function ExperienceSection() {
  // The job being hovered or focused, by id, in the timeline or its list.
  const [active, setActive] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<string | null>("letstute");
  // Leaving one job row must not clear the job that has since taken over.
  const releaseJob = (id: string) =>
    setActive((current) => (current === id ? null : current));

  return (
    <>
      <ExperienceTimeline jobs={experience} active={active} onActive={setActive} />
      <div className="experience-list">
        {experience.map((job) => (
          <article
            className="experience-item"
            key={job.id}
            data-active={active === job.id ? "" : undefined}
            onMouseEnter={() => setActive(job.id)}
            onMouseLeave={() => releaseJob(job.id)}
            onFocus={() => setActive(job.id)}
            onBlur={() => releaseJob(job.id)}
          >
            <button
              aria-expanded={openJob === job.id}
              aria-controls={`job-${job.id}`}
              onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
            >
              <span className="experience-period mono">
                {job.period.replace(/[—–]/g, "-")}
              </span>
              <span className="experience-title">
                <strong>{job.role}</strong>
                <span>{job.company}</span>
              </span>
              {openJob === job.id ? <Minus size={20} /> : <Plus size={20} />}
            </button>
            <div id={`job-${job.id}`} hidden={openJob !== job.id}>
              {job.id === "letstute" ? (
                <>
                  <div className="delivery-grid">
                    {deliveryWork.map((item) => (
                      <div key={item.title}>
                        <h3>{item.title}</h3>
                        <p>{item.text}</p>
                        <span className="mono">{item.tags}</span>
                      </div>
                    ))}
                  </div>
                  <p className="confidential-note">
                    Client systems are private. I can talk through the
                    architecture, my part and the engineering decisions
                    without sharing confidential access or data.
                  </p>
                </>
              ) : (
                <ul className="experience-details">
                  {job.highlights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
