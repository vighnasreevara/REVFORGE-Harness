# REVFORGE client dashboard (prototype)

`index.html` is the approved client-facing dashboard prototype. It is written for a
non-technical audience and explains the project in plain language with simple
diagrams. Open it in a browser; it needs no build step.

| Section | What it shows |
|---|---|
| Home | Run the live pipeline demo, the headline figures, and a guide to every page |
| The problem | Why decades-old COBOL systems with missing documentation are a business risk |
| Architecture | The reverse and forward halves of REVFORGE as one system diagram |
| How it works | The five steps and what each of the fourteen agents does |
| Agent pipeline | The run as it happens: live flow, timeline, events, run history |
| Reverse engineering | The seven reverse agents, each with its brief, output and hand-off |
| Reverse outputs | What the reverse agents produced, and the files per agent |
| Forward engineering | The pre-checks, F1–F7 and the two human approvals, live |
| Forward outputs | What was delivered, achieved and still pending, with the gaps and actions |
| Udara vs REVFORGE | The same measures taken on both reverse-engineering outputs |

Notes:

- **Demo run.** "Run live pipeline demo" replays a simulated run (labelled as such). Nothing is
  executed and no real approval is recorded. "Show the real project status" switches to the data
  captured from this repository.
- **Gate numbering.** The dashboard shows the two human approval gates as **G1** (requirements) and
  **G2** (architecture). In the runtime, its records, contracts and file names they are G2 and G3.
- **Data.** The figures are a snapshot taken from this repository (`output/`, the forward workflow
  records and the reports) when the prototype was built. They do not update by themselves.
- **Framework.** This is a single HTML file (Tailwind CSS and Lucide icons loaded from public
  CDNs, plain JavaScript). It is a prototype outside the React dashboard app in `forward/dashboard/`;
  the layout decisions it implements are recorded in the repository's `CLAUDE.md`.
- **Downloads.** Export PDF / JSON and the per-page Download PDF button save through the viewer
  when hosted as a claude.ai artifact; opened as a local file, PDF export falls back to the
  browser's print dialog.
