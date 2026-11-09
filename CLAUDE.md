# REVFORGE: project rules for Claude Code

## Dashboard layout rule (HARD RULE, client requirement)

Every REVFORGE dashboard uses the layout and framework of the **Forward Engineering Dashboard** reference in
`references/reference/Forward Engineering Dashboard/`. This rule has no exceptions. Do not change the format or the layout of
that dashboard at any cost, and do not bring in any other layout or framework.

**Must stay exactly as in the reference:**
- **Framework:**
  - React 19, TypeScript, Vite 6 and Tailwind CSS 3 (`darkMode: "class"`);
  - `lucide-react` icons;
  - the Inter font.

  Do not add or switch to another UI framework, component library, router or CSS system.
- **Page structure, in this order (`src/App.tsx`):**
  1. **Sidebar** on the left: navy `#1e2536`, 290 px, sticky. It holds the harness identity, the workspace, the overall progress bar and the phase cards, with stages and stories inside each card.
  2. **Main column:**
     1. **HeaderBar:** rows of rounded-full chips, a Live pill, Export PDF and JSON buttons.
     2. **DataSourceBanner.**
     3. **DemoBar.**
     4. **KpiTiles.**
     5. **StatusCard.**
     6. **TabBar:** grouped tabs in one white rounded-2xl card, with a group label pill followed by rounded-full tab buttons.
     7. **TabPanel**, containing **TabContent**.
  3. **StoryDrawer** on the right.
- **Tab groups:** Overview, Delivery, Architecture, Agents & Skills, Activity, System. The active tab is kept in the URL hash.
- **Visual style:**
  - slate-100 page background;
  - white rounded-2xl cards with a slate-200 border and `shadow-sm`;
  - status pills and dots;
  - the reference's spacing and type sizes.

**One approved change (user decision, 2026-11-07):** the left panel is a **section menu** instead of phase cards.
- **Style:** it keeps the reference's look: navy `#1e2536` at 290 px, the same harness identity block, the workspace line and the overall progress bar on top.
- **Main sections, in order:** Overview, Pipeline, Reverse Engineering, BRD, Forward Engineering, Results, Issues & Tickets.
- **Secondary links:** Agents & Skills, and Evidence & Audit.
- **Agent progress:** the phase and agent flow moves into the **Pipeline** section, as live flow, timeline, events and run history.
- **Tab bar:** it shows the views inside the selected section.
- **Everything else is unchanged:** the HeaderBar, DataSourceBanner, DemoBar, KpiTiles, StatusCard, TabBar and TabPanel styling, and the StoryDrawer, used as the agent detail panel.

**Second approved change (user decision, 2026-11-09):**
- **Live agent flow (revised again 2026-11-09):** no right-side panel or flow drawer. The agent flow (running agent, 2–3 line brief, output files, hand-off to the next agent) is shown in the middle of the Reverse engineering and Forward engineering pages, with agent details opening there. A run starts on the Reverse engineering page. The slide-in drawer remains only for the approval form and the JSON view.
- **Left menu additions:** an "Outputs" group with Reverse output and Forward output; while a run is active, a flow of the running phase (reverse flow, then hidden and replaced by the forward flow).
- **Middle summaries:** after reverse engineering, a results page (outputs, comparison with the Udara reference harness outputs) before forward starts; after F7, a forward results page (outputs, gaps, actions, achieved, pending).

**Client gate numbering (user decision, 2026-11-09):** the dashboard displays the runtime's approval gates G2 (requirements) and G3 (architecture) as **G1** and **G2**. Only the displayed text changes; the runtime, its records, contracts and file names keep G2/G3.

**Fifth approved change (user decision, 2026-11-09):** a Home section comes first in the menu and is the landing page. The Run bar, KPI tiles and Status card appear only on Home; other sections show only their content (a thin run strip with Pause/Stop appears there only while a run is in progress). The tab bar is hidden for sections with a single view.

**Fourth approved change (user decision, 2026-11-09), for a non-technical client audience:** the left menu sections are, in order: The problem, Architecture, How it works, Agent pipeline, Reverse engineering, Reverse outputs, Forward engineering, Forward outputs, Udara vs REVFORGE. Overview, BRD, Results, Issues & Tickets, Agents & Skills and Evidence & Audit move under "More". The Udara comparison is its own section, not part of Reverse outputs. Explanations use plain language and simple diagrams.

**Third approved change (user decision, 2026-11-09):** the HeaderBar chips row and the DataSourceBanner are removed. The top of the main column is a large Run bar (Run live pipeline demo; Pause / Restart / Back to real data while running) with small Export PDF and JSON buttons.

No other layout change is approved.

**May change: the content.** This means the data, agents, skills, phases, stages, stories, tab contents, labels, metrics and REVFORGE wording. Tabs may be added or changed inside the existing groups, provided they render in the same structure.

**Must not:**
- change, replace or redesign the layout, structure, styling or framework above;
- adopt the layout of any other dashboard;
- edit anything under `references/`.

The other reference folder under `references/reference/` (listed in `references/REFERENCE_SOURCES.md`) is an architecture and content reference only. Its layout is not used, and its project name and its author's name must never appear in REVFORGE deliverables.

If a request seems to need a layout or framework change, stop and ask the user first.
