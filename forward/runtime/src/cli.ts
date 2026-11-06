#!/usr/bin/env node
/**
 * REVFORGE forward-engineering CLI (STEP 1).
 *   doctor    inspect the environment and required files
 *   validate  validate reverse artifacts and cross-references
 *   plan      discover the system and produce draft planning/readiness outputs
 *   generate  refused in STEP 1 (no Java generation)
 */
import { MirrorScope, mirrorStatus, syncMirror, unexpectedDiscoveryEntries } from './orchestrator/mirror';
import { assertGenerationAllowed, GenerationNotAuthorizedError } from './core/guard';
import { ConfigError, ContextOptions, loadContext } from './core/config';
import { runDoctor } from './commands/doctor';
import { PlanError, runPlan } from './commands/plan';
import { runValidation } from './commands/validate';
import { agentsCommand, skillsCommand, workflowCommand } from './commands/workflow';
import { verificationCommand } from './commands/verification';
import { workbenchCommand } from './commands/workbench';
import { bmadCommand } from './commands/bmad';
import { operationsCommand } from './commands/operations';
import { pilotCommand } from './commands/pilot';
import { demoCommand } from './commands/demo';

export const EXIT = { OK: 0, CHECK_FAILED: 1, USAGE: 2, NOT_AUTHORIZED: 3, CONFIG: 4 } as const;

const USAGE = `Usage: revforge-forward <command> [options]

Commands:
  doctor                 Inspect the environment and required files
  validate               Validate reverse artifacts and cross-references
  plan --all             Plan the complete discovered system
  plan --programs A,B    Plan a subset (Program IDs or File IDs)
  generate               Refused (Java generation is not authorised)
  agents                 List forward agents, check definitions and skills
  skills                 Validate the fourteen forward skills and their ownership
  sync-agents [--check] [--scope forward|reverse|all]  Install forward/ and reverse/ agents and skills into the generated .claude/ discovery directories (--check: report drift)
  workflow init          Create the orchestrated workflow for a plan run (evaluates G0)
  workflow status        Show state, gates, packets, receipts and checkpoint
  workflow gate --gate G1|all     Evaluate gates (G2-G4 need verified signed approvals; G5-G8 fail closed)
  workflow advance --to STATE     Request a state transition (runtime-guarded)
  workflow transitions            List allowed transitions and their guards
  workflow prepare --agent F1     Prepare a validated agent input packet
  workflow batches --agent F1 [--size N]  Prepare packets for all pending unit batches
  workflow coverage --agent F1    Show the unit coverage ledger
  workflow record --receipt FILE  Validate and record an agent output receipt
  workflow g2 evaluate|blockers [--scope S] [--per-program]  G2 readiness of a scope (application | programs:A,B | requirements:R1,R2)
  workflow g2 report [--out FILE]                Readiness and blocker report (application and per-program scopes)
  workflow approval request --scope S --requested-by ID   Export an immutable approval request for a READY scope
  workflow approval statement --request AREQ-N --signer ID --role R --decision approved|rejected [--out FILE]
  workflow approval verify|import --file SIGNED.json      Verify / import a signed (Ed25519) G2, G3 or G4 approval
  workflow g3|g4 evaluate|blockers         G3 architecture / G4 story-set gate evaluation (read-only)
  workflow architecture approval-request --requested-by ID   Approval request for the validated F3 architecture (G3)
  workflow stories approval-request --requested-by ID        Approval request for the validated F4 story set (G4)
  workflow architecture|stories approval-statement --request DREQ-N --signer ID --role R --decision approved|rejected [--out FILE]
  workflow decisions list [--scope S] [--status X] [--origin X] [--blocking]
  workflow decisions template --decision ID [--out FILE]  Unsigned resolution template bound to the decision
  workflow decisions resolve --file SIGNED.json [--dry-run]  Verify and record a signed decision resolution
  workflow packets review          Record which receipt-less packets are superseded or still required
  verification blockers audit      Reconcile every G2 blocker count (sealed record)
  verification blockers root-causes  Canonical root-cause registry linking all decisions and findings
  verification blockers classify   Root-cause review queue (A technical, B semantic, C business, D technical decision, E missing source, Z approval)
  verification source deterministic  Read-only deterministic checks against the original COBOL source
  verification remediation prepare   Versioned remediation proposals (never applied or authorised)
  verification scope readiness     Readiness of application, program, shared-dependency and requirement scopes
  verification openai prepare      Prepare (never send) separated Pass A / Pass B independent-review packets
  verification report [--out FILE] [--export-dir DIR]  All of the above, sealed, exported and summarised
  workbench candidates             Rank program and requirement scopes for a first approval (proposal only)
  workbench package|decisions|corrections|trust|pilot|readiness|checklist [--scope S]  Human decision workbench for one scope
  workbench report [--scope S] [--export-dir DIR] [--out FILE]  All workbench outputs, sealed and exported
  verification openai doctor       OpenAI verification diagnostics (never prints keys or source)
  verification openai packets      Validate the prepared packet set; eligibility and selection preview
  verification openai review --mode OFFLINE|MOCK|LIVE [--max N] [--packets ...]  Pass A (independent interpretation)
  verification openai compare --review-run OVR-NNNN [--mode ...]  Pass B (comparison), advisory records
  verification openai report [--out FILE] | usage   Reports, usage and budget
  verification openai authorize|revoke --file SIGNED.json   Import a signed source-export authorization / revocation
  verification openai authorization-request --packets ... [--out FILE]  Unsigned authorization for a data owner to sign
  bmad doctor|workflows|bindings  Verify the pinned BMad release, its workflow catalogue and the agent bindings (DISCOVERY)
  bmad eligibility --workflow W --scope S [--mode MOCK|LIVE]  Gate, exact-scope and baseline eligibility (sealed)
  bmad dry-run --workflow W --scope S [--record]  Eligibility and mapping preview; executes nothing
  bmad prepare --workflow W --scope S --mode MOCK  Immutable execution packet (LIVE is refused)
  bmad mock --packet BPK-N         Deterministic mock result + receipt (never evidence)
  bmad record --packet BPK-N --file RESULT.json   Validate a returned result and record a receipt
  bmad report [--out FILE]         BMad integration status and record integrity
  bmad reconcile --scope S         Explain every unit, requirement and decision in a scope (direct / dependency / cross-scope / global)
  bmad executor doctor|eligibility|dry-run|report  Isolated LIVE executor diagnostics, eligibility and execution manifest (never executes)
  trust doctor [--file CANDIDATE] | roles | verify-signature --signer ID --message FILE --signature B64   Trust provisioning validation
  decisions review --scope S [--all]        Decision dossiers + unsigned scope/expiry-bound resolution requests (exported)
  decisions export-request --decision ID --scope S [--out FILE] | verify-resolution|import-resolution --file SIGNED.json
  decisions clarify --decision ID --requested-by ID --question TEXT [--to WHO] | impact --decision ID
  remediation review|impact [--scope S] [--proposal RP-...]   Citation corrections re-derived from the source now
  approval readiness --scope S              G2 approval checklist (readiness is not approval)
  approval scope --scope S [--compare S2] [--export-dir D]   Dependency closure, decision attribution, deferred gaps, subset vs program
                                            (S may be behaviour:PROGRAM:PARAGRAPH:requirement=ID,runtime_requirement=ID)
  approval export-request --scope S --requested-by ID | verify|import --file SIGNED.json
  provider authorization doctor|prepare|verify|import|revoke   Provider-specific AI disclosure authorization
  bmad executor preflight --workflow W --scope S   Sealed LIVE preflight (never launches)
  pilot plan --scope S            Source-backed VERIFIED / PARTIAL / GAP plan (non-authoritative, read-only)
  pilot run [--dir D] [--out O]   Isolated synthetic COBOL-to-Java pilot (no workflow, gates or approvals)
  pilot candidates                Rank complete real programs for the first conversion
  pilot readiness --program P     Engineering gate SOURCE_READINESS (+ unchanged generation authorisation status)
  pilot validate --out O [--dir D]  Engineering gate CONVERSION_VALIDATION on a conversion output
  demo gates [--out DIR]          Synthetic G0-G8 gate demonstration (SYNTHETIC_INTERVIEW_DEMO; no production authorisation)
  workflow blocked                Report blocked transitions, dispatches and receipts
  workflow resume                 Verify checkpoint and baseline, then resume

Options:
  --config <file>        Configuration file (default: forward/config/forward.config.json)
  --repo-root <dir>      Repository root override
  --source-root <dir>    Original COBOL source root (enables source availability checks)
  --runs-dir <dir>       Output directory for runs (default from config)
  --run-id <id>          Explicit run ID for plan (default: generated)
  --run <id|latest>      Plan run a workflow command operates on (default: latest)
  --json                 Machine-readable output
`;

interface Args {
  command: string | null;
  positionals: string[];
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | true> = {};
  let command: string | null = null;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && !['all', 'json', 'help', 'corrected', 'per-program', 'dry-run', 'blocking', 'no-requirements', 'record', 'no-record', 'no-export'].includes(key)) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else {
      if (!command) command = a;
      positionals.push(a);
    }
  }
  return { command, positionals, flags };
}

function contextOptions(flags: Args['flags']): ContextOptions {
  const s = (k: string): string | undefined => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
  const programs = s('programs');
  return {
    configPath: s('config'),
    repoRoot: s('repo-root'),
    sourceRoot: s('source-root'),
    runsDir: s('runs-dir'),
    programs: flags.all ? 'all' : programs ? programs.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
  };
}

export function main(argv: string[], out: (s: string) => void = console.log, err: (s: string) => void = console.error): number | Promise<number> {
  const { command, positionals, flags } = parseArgs(argv);
  if (!command || flags.help || command === 'help') {
    out(USAGE);
    return command ? EXIT.OK : EXIT.USAGE;
  }
  const json = flags.json === true;
  try {
    const ctx = loadContext(contextOptions(flags));
    switch (command) {
      case 'doctor': {
        const r = runDoctor(ctx);
        if (json) out(JSON.stringify(r, null, 2));
        else {
          for (const c of r.checks) out(`[${c.status.toUpperCase().padEnd(4)}] ${c.id}: ${c.detail}`);
          out(r.ok ? 'doctor: OK' : 'doctor: FAILED');
        }
        return r.ok ? EXIT.OK : EXIT.CHECK_FAILED;
      }
      case 'validate': {
        const r = runValidation(ctx);
        if (json) out(JSON.stringify({ ok: r.ok, findings: r.findings }, null, 2));
        else {
          for (const f of r.findings) out(`[${f.severity.toUpperCase()}] ${f.code}${f.artifact ? ` (${f.artifact})` : ''}: ${f.message}`);
          const n = (s: string) => r.findings.filter((f) => f.severity === s).length;
          out(`validate: ${r.ok ? 'OK' : 'FAILED'} — ${n('error')} error(s), ${n('warning')} warning(s), ${n('info')} info`);
        }
        return r.ok ? EXIT.OK : EXIT.CHECK_FAILED;
      }
      case 'plan': {
        if (!flags.all && !flags.programs && ctx.config.selection.programs !== 'all') {
          // Config-defined subset is allowed.
        } else if (!flags.all && !flags.programs) {
          err('plan: specify --all or --programs <list>');
          return EXIT.USAGE;
        }
        const r = runPlan(ctx, { runId: typeof flags['run-id'] === 'string' ? (flags['run-id'] as string) : undefined });
        if (json) out(JSON.stringify(r, null, 2));
        else {
          out(`plan: run ${r.runId}`);
          out(`  output: ${r.runDir}`);
          for (const [k, v] of Object.entries(r.counts)) out(`  ${k}: ${v}`);
          out(`  decisions: ${r.decisions.total} open (${r.decisions.blocking} blocking)`);
          out(`  overall readiness: ${r.overall.status}`);
          for (const x of r.overall.reasons) out(`    - ${x}`);
          out(`  files written: ${r.files.length}`);
        }
        return EXIT.OK;
      }
      case 'generate': {
        assertGenerationAllowed(ctx.config.generation);
        err('generate: no generator is implemented in this step');
        return EXIT.NOT_AUTHORIZED;
      }
      case 'sync-agents': {
        // forward/agents, forward/skills, reverse/agents and reverse/skills are authoritative;
        // .claude/ keeps the copy Claude Code discovers. --scope forward|reverse|all (default all).
        const scopeFlag = typeof flags['scope'] === 'string' ? (flags['scope'] as string) : 'all';
        if (!['forward', 'reverse', 'all'].includes(scopeFlag)) {
          err('sync-agents: --scope must be forward, reverse or all');
          return EXIT.USAGE;
        }
        const scope = scopeFlag as MirrorScope;
        if (flags['check'] === true) {
          const st = mirrorStatus(ctx, scope);
          // .claude/agents and .claude/skills are generated: anything there that no registry declares is reported.
          const unexpected = unexpectedDiscoveryEntries(ctx);
          if (json) out(JSON.stringify({ ...st, unexpected }, null, 2));
          else {
            for (const e of st.entries) out(`${e.status.padEnd(9)} ${e.side.padEnd(7)} ${e.kind} ${e.name}`);
            for (const u of unexpected) out(`UNEXPECTED ${u} (not a registered forward or reverse definition)`);
            const n = (side: string, kind: string) => st.entries.filter((e) => e.side === side && e.kind === kind).length;
            out(`${st.entries.filter((e) => e.status === 'IN_SYNC').length}/${st.entries.length} in sync (forward: ${n('forward', 'agent')} agents, ${n('forward', 'skill')} skills; reverse: ${n('reverse', 'agent')} agents, ${n('reverse', 'skill')} skills)${unexpected.length ? `; ${unexpected.length} unexpected` : ''}`);
            if (st.entries.some((e) => e.status === 'MISSING')) out('the .claude/ discovery copies are generated, not committed: run `npm run setup` (or `sync-agents`) to install them');
          }
          return st.in_sync && !unexpected.length ? EXIT.OK : EXIT.CHECK_FAILED;
        }
        const r = syncMirror(ctx, scope);
        if (json) out(JSON.stringify(r, null, 2));
        else out(r.written.length ? `updated ${r.written.length} mirror(s) under .claude/: ${r.written.join(', ')}` : `all ${scope === 'all' ? 'forward and reverse' : scope} agents and skills already in sync with .claude/`);
        return EXIT.OK;
      }
      case 'agents':
        return agentsCommand(ctx, json, out);
      case 'skills':
        return skillsCommand(ctx, json, out);
      case 'workflow':
        return workflowCommand(ctx, positionals[1], flags, json, out, err, positionals[2]);
      case 'workbench':
        return workbenchCommand(ctx, positionals[1], flags, json, out, err);
      case 'trust':
      case 'decisions':
      case 'remediation':
      case 'approval':
      case 'provider':
        return operationsCommand(ctx, command, positionals[1], positionals[2], flags, json, out, err);
      case 'bmad':
        return bmadCommand(ctx, positionals[1], flags, json, out, err, positionals[2]);
      case 'pilot':
        return pilotCommand(ctx, positionals[1], flags, json, out, err);
      case 'demo':
        return demoCommand(ctx, positionals[1], flags, json, out, err);
      case 'verification':
        return verificationCommand(ctx, positionals[1], positionals[2], flags, json, out, err);
      default:
        err(`unknown command: ${command}\n\n${USAGE}`);
        return EXIT.USAGE;
    }
  } catch (e) {
    if (e instanceof GenerationNotAuthorizedError) {
      err(`refused: ${e.message}`);
      return EXIT.NOT_AUTHORIZED;
    }
    if (e instanceof ConfigError) {
      err(`configuration error: ${e.message}`);
      return EXIT.CONFIG;
    }
    if (e instanceof PlanError) {
      err(`plan failed: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return EXIT.CHECK_FAILED;
    }
    throw e;
  }
}

if (require.main === module) {
  Promise.resolve(main(process.argv.slice(2))).then((code) => (process.exitCode = code));
}
