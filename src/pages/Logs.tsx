import { useState } from "react";
import { profile } from "@/data/profile";
import { LabHero, LabSectionTitle, Reveal } from "@/sites/cyan/lab/LabParts";
import { Calibration } from "@/sites/cyan/lab/logs/Calibration";
import { OperatingModes } from "@/sites/cyan/lab/logs/OperatingModes";
import { SignalSummary } from "@/sites/cyan/lab/logs/SignalSummary";
import { SignalTrace } from "@/sites/cyan/lab/logs/SignalTrace";
import "@/sites/cyan/lab/logs.css";

/**
 * Lab 02, the logs: the career log written as an oscilloscope trace, then
 * education as a calibration record and ways of working as a channel bank.
 * LabShell supplies the header, footer and graticule around it.
 */
const Logs = () => {
  // One clock for the whole page, so every "now" and every month count agree.
  const [now] = useState(() => new Date());

  return (
    <div className="logs-page">
      <LabHero
        code="02"
        eyebrow="Logs"
        title="Career log,"
        muted="written as a signal."
        intro={<p>{profile.summary}</p>}
        aside={<SignalSummary now={now} />}
      />

      <section className="lab-section" aria-labelledby="logs-trace-title">
        <LabSectionTitle index="01" id="logs-trace-title">
          The trace
        </LabSectionTitle>
        <p className="logs-lede">
          Every entry, oldest first. Scroll and the beam writes the log: each
          kind of entry has its own waveform, and a node lights when the signal
          reaches it. Roles open to show what the work was.
        </p>
        <SignalTrace now={now} />
      </section>

      <section className="lab-section" aria-labelledby="logs-education-title">
        <LabSectionTitle index="02" id="logs-education-title">
          Education
        </LabSectionTitle>
        <p className="logs-lede">
          The calibration record, oldest first so it reads in the same direction
          as the trace.
        </p>
        <Reveal>
          <Calibration />
        </Reveal>
      </section>

      <section className="lab-section" aria-labelledby="logs-modes-title">
        <LabSectionTitle index="03" id="logs-modes-title">
          How I work
        </LabSectionTitle>
        <Reveal>
          <OperatingModes />
        </Reveal>
      </section>
    </div>
  );
};

export default Logs;
