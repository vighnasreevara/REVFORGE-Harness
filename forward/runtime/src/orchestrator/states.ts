/**
 * Workflow state machine. Every allowed transition names the evidence the
 * runtime requires (a pre-check or gate PASS on the current baseline, an
 * accepted agent receipt, or nothing for moves into BLOCKED/FAILED). The only
 * gates are the human approvals G1 (requirements) and G2 (architecture); the
 * baseline and evidence pre-checks guard the start of the workflow, and the
 * run completes when F7's review receipt is accepted. No transition can be
 * triggered by an agent's own assertion: guards are evaluated by the runtime
 * from its own records.
 */
import { AgentId } from './agents';

export const STATES = [
  'BASELINE_LOADED',
  'EVIDENCE_VALIDATED',
  'REQUIREMENTS_DRAFTED',
  'REQUIREMENTS_APPROVED',
  'ARCHITECTURE_DRAFTED',
  'ARCHITECTURE_APPROVED',
  'STORIES_DRAFTED',
  'IMPLEMENTING',
  'IMPLEMENTATION_BUILT',
  'TESTING',
  'REVIEWING',
  'COMPLETED',
  'BLOCKED',
  'FAILED',
] as const;

export type WorkflowState = (typeof STATES)[number];

/** Initial pseudo-state of a workflow that has not loaded its baseline yet. */
export const INITIAL = 'INITIALIZED' as const;
export type AnyState = WorkflowState | typeof INITIAL;

export type Guard =
  | { kind: 'gate'; gate: string }
  | { kind: 'precheck'; check: 'BASELINE' | 'EVIDENCE' }
  | { kind: 'receipt'; agent: AgentId }
  | { kind: 'dispatch'; agent: AgentId }
  | { kind: 'none'; note: string };

export interface Transition {
  from: AnyState;
  to: WorkflowState;
  guard: Guard;
}

export const APPROVAL_STATES: WorkflowState[] = ['REQUIREMENTS_APPROVED', 'ARCHITECTURE_APPROVED'];
export const TERMINAL_STATES: WorkflowState[] = ['COMPLETED', 'FAILED'];

const T = (from: AnyState, to: WorkflowState, guard: Guard): Transition => ({ from, to, guard });
const gate = (g: string): Guard => ({ kind: 'gate', gate: g });
const precheck = (c: 'BASELINE' | 'EVIDENCE'): Guard => ({ kind: 'precheck', check: c });
const receipt = (a: AgentId): Guard => ({ kind: 'receipt', agent: a });

export const TRANSITIONS: Transition[] = [
  T(INITIAL, 'BASELINE_LOADED', precheck('BASELINE')),
  T('BASELINE_LOADED', 'EVIDENCE_VALIDATED', precheck('EVIDENCE')),
  T('EVIDENCE_VALIDATED', 'REQUIREMENTS_DRAFTED', receipt('F1')),
  T('REQUIREMENTS_DRAFTED', 'REQUIREMENTS_APPROVED', gate('G1')),
  T('REQUIREMENTS_APPROVED', 'ARCHITECTURE_DRAFTED', receipt('F3')),
  T('ARCHITECTURE_DRAFTED', 'ARCHITECTURE_APPROVED', gate('G2')),
  T('ARCHITECTURE_DRAFTED', 'REQUIREMENTS_DRAFTED', receipt('F1')),
  T('ARCHITECTURE_APPROVED', 'STORIES_DRAFTED', receipt('F4')),
  T('STORIES_DRAFTED', 'ARCHITECTURE_DRAFTED', receipt('F3')),
  T('STORIES_DRAFTED', 'IMPLEMENTING', { kind: 'dispatch', agent: 'F5' }),
  T('IMPLEMENTING', 'IMPLEMENTATION_BUILT', receipt('F5')),
  T('IMPLEMENTATION_BUILT', 'TESTING', { kind: 'dispatch', agent: 'F6' }),
  T('TESTING', 'REVIEWING', receipt('F6')),
  T('TESTING', 'IMPLEMENTING', receipt('F6')),
  T('REVIEWING', 'COMPLETED', receipt('F7')),
  T('REVIEWING', 'IMPLEMENTING', receipt('F7')),
];

/** Any non-terminal state may move to BLOCKED or FAILED; BLOCKED may only return to the state it blocked. */
export function allowedTargets(from: AnyState, blockedFrom: WorkflowState | null): Transition[] {
  if (from === 'COMPLETED' || from === 'FAILED') return [];
  if (from === 'BLOCKED') {
    if (!blockedFrom) return [T('BLOCKED', 'FAILED', { kind: 'none', note: 'abandon' })];
    return [
      T('BLOCKED', blockedFrom, { kind: 'none', note: 'unblock: blockers cleared and checkpoint verified' }),
      T('BLOCKED', 'FAILED', { kind: 'none', note: 'abandon' }),
    ];
  }
  const out = TRANSITIONS.filter((t) => t.from === from);
  out.push(T(from, 'BLOCKED', { kind: 'none', note: 'blocker recorded' }));
  if (from !== INITIAL) out.push(T(from, 'FAILED', { kind: 'none', note: 'failure recorded' }));
  return out;
}

export function findTransition(from: AnyState, to: string, blockedFrom: WorkflowState | null): Transition | null {
  return allowedTargets(from, blockedFrom).find((t) => t.to === to) ?? null;
}

export function isState(s: string): s is WorkflowState {
  return (STATES as readonly string[]).includes(s);
}
