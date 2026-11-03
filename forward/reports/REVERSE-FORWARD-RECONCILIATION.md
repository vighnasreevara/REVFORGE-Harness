# Reverse-engineering vs forward-engineering artifact reconciliation

**Equivalence status:** COBOL runtime equivalence is **not established**. No COBOL compiler or captured legacy execution results exist, so every forward verification below is either structural (a Java element at the same source identity) or source-derived (scenarios written from the COBOL by test-design agents and executed against the Java).

Machine-readable detail is in `forward/reports/reverse-forward/`:

| File | Contents |
|---|---|
| `summary.json` | counts, provenance, remediation backlog, captured check runs |
| `program-mapping.json` | programs |
| `paragraph-mapping.json` | paragraphs, PERFORM edges, branches, loops, statements |
| `business-rule-mapping.json` | business rules |
| `data-mapping.json` | fields, level-88 conditions, records, files |
| `copybook-mapping.json` | copybooks |
| `diagram-mapping.json` | diagrams |
| `jcl-mapping.json` | JCL jobs |
| `dependency-mapping.json` | call graph and external operations |
| `gap-reconciliation.json` | reverse and forward gaps |
| `verification-runs.jsonl` | commands and exit codes of the checks run for this report |

The mappings are produced by `forward/tools/reverse-forward-reconcile.py`, and this report by `forward/tools/reverse-forward-report.py`. Both are read-only with respect to sources, reverse artifacts and generated code.

## 1. Source snapshot and provenance

| Check | Result |
|---|---|
| Reverse artifacts vs the forward baseline manifest (`forward/runs/FWD-20261031T172520Z-66b3/baseline_manifest.json`) | **11 / 11 unchanged** (SHA-256): inventory, parser, data, logic, rules, diagrams, gap register and others |
| Reverse inventory files vs the forward source root | **83 / 83** present with the recorded size |
| Authorised manifest (`forward/pilot/authorizations/APPLICATION.authorization-manifest.json`) | **223 hashes, 0 mismatches** |

**Snapshot identity.** The reverse inventory records its source root as `references/upstream-harness`; forward used `references/udara-legacy-modernization-harness`. Every inventory file is present in the forward root with the recorded size. The inventory records sizes, not hashes, so file identity rests on path plus size. The forward manifest then binds each file by SHA-256 from conversion onwards.

**Permanent IDs.** The forward mappings key on the reverse IDs (file, paragraph, statement, record, field, condition, rule). No permanent ID was created, altered or removed.

## 2. Inventory: recalculated counts vs reported baselines

Every count is recalculated from the artifact records, not taken from stats.

| Artifact | Recalculated | Reported baseline | Note |
|---|---|---|---|
| Programs | 42 | 42 | inventory `file_registry` |
| Paragraphs | 402 | 402 | parser raw structures |
| Sections | 0 PROCEDURE DIVISION sections | 140 | the 140 are division sections (ENVIRONMENT/DATA); the source has no procedure sections |
| PERFORM edges | 524 | 503 | control-flow-graph edges, 21 of them inline PERFORMs |
| Statements | 1936 | 1936 | |
| Branches | 254 | 255 | logic `branch_map` |
| Loops | 32 | 32 | |
| Business rules | 154 | 154 | all 154 Step 17 identities present: 0 missing, 0 extra |
| Fields | 1009 | 1009 | 30 at level 01, 979 subordinate (field_catalogue) |
| Level-88 conditions | 259 | 259 | |
| Records | 231 | 231 | |
| Copybooks | 25 | 20 copybooks + 5 DB2 includes | forward counted 25 because it includes the DB2 includes |
| Diagrams | 65 | 65 | process_flow 45, component 5, component_neighbourhood 10, sequence 2, erd 3 |
| JCL jobs | 15 | 15 | |
| Call-graph edges | 130 | 130 | COPY 89, STATIC_CALL 17, SQL_INCLUDE 10, CICS_LINK 14 |
| Reverse gaps | 217 | 217 | |

## 3. Reconciliation by category

**Status columns:**

| Column | Meaning |
|---|---|
| Fully | Implemented with test evidence (a passing source-derived scenario or generated check) |
| Partial | Implemented, but only structurally or on paths ending at a gap |
| Missing | No Java counterpart |
| Blocked | Java site is an explicit gap |
| Unassessable | Cannot be compared from machine-readable evidence |

| Category | Reverse total | Forward mapped | Fully | Partial | Missing | Blocked | Unassessable | Coverage formula |
|---|---|---|---|---|---|---|---|---|
| Programs | 42 | 41 | 2 | 39 | 1 | 0 | 0 | COMPLETE ÷ 42 = 4.8%; Java generated ÷ 42 = 97.6% |
| Paragraphs | 402 | 390 | 95 | 295 | 12 | 173 contain a gap | 0 | structural ÷ 402 = 97.0%; test-executed ÷ 402 = 23.6% |
| PERFORM edges | 524 | 524 | 95 | 302 | 0 | 127 | 0 | structural target match ÷ 524 = 75.8% |
| Branches | 254 | 254 | 86 | 104 | 0 | 64 | 0 | structural ÷ 254 = 74.8% |
| Loops | 32 | 32 | – | 26 | 0 | 6 | 0 | structural ÷ 32 |
| Statements | 1936 | 1936 | – | 1337 | 0 | 599 | 0 | mapped (incl. gap sites) ÷ 1936 = 100.0% |
| Business rules | 154 | 154 | 67 | 15 to-gap + 40 unreachable | 0 | 32 | 0 | verified ÷ 154 = 43.5%; verified incl. to-gap ÷ 154 = 53.2% |
| Fields | 1009 | 966 | 966 attribute-consistent | 0 with discrepancies | 43 | – | 0 | consistent ÷ 1009 = 95.7% |
| Level-88 conditions | 259 | 259 | 257 | 2 | 0 | 0 | 0 | value-checked ÷ 259 = 99.2% |
| Records | 231 | 196 | – | 196 | 35 | – | 0 | represented ÷ 231 = 84.8% |
| Copybooks | 25 | 19 | 19 complete (13 shared model, 6 in-program) | 0 | 6 not COPYed by any program | – | 0 | complete ÷ 25 |
| Diagrams | 65 | 60 | 33 structural | 27 | 0 | – | 5 | see section 6 |
| JCL jobs | 15 | 15 | 3 | 11 blocked at a program gap | 0 | 1 utility | 0 | end-to-end verified ÷ 15 |
| Call-graph edges | 130 | 130 | 12 CALLs to converted programs | 95 COPY/INCLUDE resolved | 4 unresolved members | 17 | 0 | – |

## 4. Programs, paragraphs and control flow

**Programs.**
- 2 are COMPLETE: PORTREAD and PROGNAME.
- 39 are PARTIAL: Java is generated, compiled and tested, but explicit gaps remain open.
- POSUPDT is MISSING: its source is empty (1 byte), which matches reverse GAP-001.

Per program, `program-mapping.json` records the Java class and files, the authorization record, compilation, check counts, scenario counts, statement coverage and integration.

**Paragraphs.** 390 of 402 map structurally: the same name at the same COBOL start line, with a Java method.
- 12 are unmapped:
  - 11 are reverse `(UNNAMED)` lead-in paragraphs (statements before the first paragraph label). Their statements are mapped individually (section 4, statements), but there is no named Java method to match the paragraph to.
  - CURSMGR P200-EXIT (line 91, GAP-CURSMGR-0008): the paragraph header is a forward gap site.
- 95 paragraphs have a statement executed by a passing scenario.
- 103 run only on paths that end at a gap.
- 192 are not executed.

**PERFORM edges.** An edge counts as STRUCTURAL only when the Java `perform(a, b)` at the mapped line targets the same paragraph range:
- 397 of 524 match, including 21 inline PERFORMs translated as Java loops.
- 127 are explicit gaps. Most are PERFORMs of paragraphs that do not exist in the source.
- No mapped edge targets a different paragraph than the reverse graph says.

**Branches and loops.** 190 of 254 branches map to Java conditions; AT END and INVALID KEY phrases are attached to the I/O statement. 64 branches sit on gap sites. Loops: 26 of 32 map to structural Java loops and 6 are gaps.

**Statements (permanent statement IDs).** 1337 of 1,936 map to Java statements and 599 map to explicit gap sites. 0 are unmapped: EXIT statements in ERRHNDL, a column-1 free-format source, listed in the JSON.

## 5. Business rules, data and copybooks

**Business rules.** All 154 identities are preserved, and the Step 17 statuses are unchanged by this audit:

| Status | Rules |
|---|---|
| Verified | 67 |
| Verified to gap | 15 |
| Unreachable (38 behind gaps, 2 dead code) | 40 |
| Blocked | 32 |

Each rule in `business-rule-mapping.json` adds the reverse confidence, SME flag, condition and statement ID to its forward location, tests and reasons.

**Fields.** 966 of 1,009 reverse fields have a Java Field at the same source line and name, with identical length, sign, scale, storage class (DISPLAY/BINARY/PACKED) and OCCURS. **0 attribute discrepancies.** The other 43 are not represented, each with a reason:
- 35 belong to COMMON.cpy, which no program COPYs.
- 8 are in records with no determinable layout.

Defaults (VALUE clauses) are checked by the generated INIT tests, with expected bytes encoded independently of the runtime.

**Level-88 conditions.** All 259 are represented as `Cond88` objects. 257 pass a generated value check: SET TO TRUE stores the declared value, encoded independently, and the condition then tests true. 2 are represented but have no generated value check: PSR-DEP-HARD (src/copybook/batch/PRCSEQ.cpy:29), PSR-DEP-SOFT (src/copybook/batch/PRCSEQ.cpy:30).

**Records.** 196 of 231 are represented. 35 are not:
- 7 COMMON.cpy records that are never COPYed.
- 28 empty-group or unresolved-include records. An example is `01 WS-DB2-AREA.` followed by `EXEC SQL INCLUDE SQLCA`, whose member starts with its own 01. These match reverse GAP-002 and GAP-004.

**File status semantics.** These are implemented in `forward/runtime/java/revforge/cobol/CobolFile.java` (00, 10, 2x, 35, 4x) and tested by the runtime unit tests. Each converted file and its FILE STATUS item are listed in `data-mapping.json` under `files`.

**Copybooks:**
- 13 have every field represented through a shared model class.
- 6 have every field represented with identical attributes, but the converter generates their items inside each program because the COPY sits inside an outer record or table. Before STEP 20 these were reported as partial.
- 0 are partial (some fields not represented).
- 6 are not COPYed by any program: COMMON, ERRLOG, PORTPLAN, POSHIST, RTNCODES and DB2-DEFINITIONS.

Layout identity was checked: each shared model class is byte-identical across all its users.

## 6. Diagrams (65)

**Method.** Edges are parsed from the Mermaid sources, and nodes are bound to source IDs through `diagrams_artifact.json` `node_sources`. No diagram is judged equivalent by its name or how it looks.

| Type | Count | What was compared | Result |
|---|---|---|---|
| Process flow | 45 | Each node's statement ID against the forward statement; each edge, by the paragraphs of its end nodes, against the Java PERFORM graph | 439 nodes on mapped Java statements, 164 on gap sites, 34 paragraph-only, 48 unbound; 143 nodes executed by passing scenarios. 912 edges: 639 supported by Java structure, 162 through or into gaps, 80 unassessable, **31 not found in Java** |
| Component and neighbourhood | 15 | Program-to-program edges against Java CALLs and CICS/external boundaries | IMPLEMENTED_CALL 28, CALL_SITE_GAP (CALL statement is a forward gap) 3, BOUNDARY_GAP (CICS LINK / external call) 35, UNASSESSABLE (not program-to-program) 85, BOUNDARY_GAP (return from CICS LINK / external call) 12 |
| Sequence | 2 | Programs in flow and messages | Every message in the CICS inquiry flows crosses an EXEC CICS LINK boundary, so the mapping is structural only and the behaviour is blocked |
| ERD | 3 | Entities against records | 17 of 88 bound entities represented. Relationships are data-model inferences with no Java counterpart, so they are unassessable. |

**The 31 process-flow edges not found in Java** come from:
- runtime transfers that are themselves gaps: CICS HANDLE CONDITION in INQPORT and SQL error routing in DB2HNDL;
- PERFORMs nested inside a blocked statement: PORTADD 2100 is reached only from inside its ambiguous READ;
- diagram simplifications, such as a shared decision node reused across paragraphs in DB2CMT;
- one edge to an unnamed paragraph (DB2ONLN).

They are listed per diagram in `diagram-mapping.json`.

**Component and sequence edges not found in Java:** none.
- PORTMSTR → ERRPROC and PORTMSTR → AUDPROC are CALL statements whose USING arguments are undeclared in the source, so they are classed as CALL_SITE_GAP, not as implemented calls.
- Sequence reply messages (`-->>`) are compared against the call they return from.

**Unmappable diagrams (5):** FLOW-POSUPDT, COMP-OVERVIEW-JOBS-PORTFOLIO, COMP-OVERVIEW-JOBS-REPORTING, COMP-UNRESOLVED, COMP-OVERVIEW-ISOLATED. FLOW-POSUPDT has no program; the other four are overview or summary diagrams with no program-to-program edges.

## 7. JCL, external operations and dependencies

**JCL** (15 jobs). Each job has a Java job definition (`revforge.app.batch.Jobs`):
- 3 run end-to-end with passing integration tests: PORTREAD, PORTUPDT and PORTDEL.
- 11 run and stop where the program's own gap is.
- PORTDEF needs the IDCAMS utility, which is not converted.

The JCL has no PARM, COND or RESTART parameters. Restart and checkpoint behaviour is not emulated. Each job lists its steps, datasets and status in `jcl-mapping.json`.

**External operations** (EXEC SQL, EXEC CICS, CALL). 99 reverse statements: IMPLEMENTED 12, GAP EXTERNAL_SYSTEM_BOUNDARY 78, DECLARATIVE (no run-time effect) 3, GAP UNDEFINED_EXTERNAL_CALL 2, GAP UNDECLARED_NAME 3, GAP UNTRANSLATED_STATEMENT 1.
- No SQL or CICS operation is stubbed as successful.
- The 12 implemented operations are CALLs to converted programs, resolved through the program registry.
- The 3 declarative ones are cursor and table declarations.

**Call graph.** All 14 CICS LINKs are boundaries. Every other COPY, INCLUDE and static CALL edge resolves in the Java build or reaches a converted program, except these:

| Type | From | To | Forward |
|---|---|---|---|
| COPY | RPTSTA00 | DB2STAT | UNRESOLVED |
| STATIC_CALL | DB2CONN | DELAY | GAP (UNDEFINED_EXTERNAL_CALL / untranslated) |
| SQL_INCLUDE | INQPORT | SQLPOS | UNRESOLVED |
| STATIC_CALL | PORTMSTR | ERRPROC | GAP (CALL site is a forward gap; callee converted) |
| STATIC_CALL | PORTMSTR | AUDPROC | GAP (CALL site is a forward gap; callee converted) |
| COPY | PORTTRAN | PORTREC | UNRESOLVED |
| COPY | UTLMON00 | DB2STAT | UNRESOLVED |
| STATIC_CALL | UTLMON00 | ILBOABN0 | GAP (UNDEFINED_EXTERNAL_CALL / untranslated) |
| STATIC_CALL | ERRHANDL | CEE3ABD | GAP (UNDEFINED_EXTERNAL_CALL / untranslated) |

## 8. Gap reconciliation

Reverse gaps (217, analysis scope) and forward gaps (391, conversion scope) differ in scope, so their counts are compared, not subtracted.

| Reverse gap classification | Count |
|---|---|
| STILL_UNRESOLVED | 138 |
| RECLASSIFIED_OR_GROUPED | 42 |
| NOT_COMPARABLE | 27 |
| RESOLVED_WITH_CODE_EVIDENCE | 10 |

- **No reverse gap is classed RESOLVED_WITH_TEST_EVIDENCE.**
- The 10 RESOLVED_WITH_CODE_EVIDENCE are the UNSTRUCTURED_FLOW gaps: PERFORM THRU and fall-through are translated by the paragraph-range executor.
- SME_REVIEW_REQUIRED and MEDIUM_CONFIDENCE_RULE stay unresolved: forward tests verify only source-as-written behaviour, not business intent.
- Diagram-quality gaps are NOT_COMPARABLE.

**Forward gaps with no reverse gap at the same location:** RECLASSIFIED_OR_GROUPED 280, NEWLY_INTRODUCED_IN_FORWARD 81. NEWLY_INTRODUCED_IN_FORWARD covers the DB2/CICS boundaries and the converter limitations that exist only because of the forward environment.

**Recursive PERFORM (reverse GAP-016 INQHIST, GAP-024 FILEHNDL).** A PERFORM that executes itself recursively has no defined result in standard COBOL, and termination depends on DB2 recovery results (INQHIST) or file statuses (FILEHNDL) the source does not establish.
- Since STEP 20 the Java runtime blocks such a path with the runtime gap `RUNTIME-RECURSIVE-PERFORM` when a PERFORM starts while the same range is still active.
- It is neither executed as Java recursion nor bounded by a limit; non-recursive executions of the same PERFORM are unchanged.
- Both reverse gaps remain unresolved: their intended termination is a question for the owner.

## 9. Verification runs (this audit)

**CONVERSION_VALIDATION** (`pilot validate --out generated/java/<P>`): 42 runs.
- 41 PASS.
- FAIL (exit 1): `node dist/runtime/src/cli.js pilot validate --out generated/java/POSUPDT`: CONVERSION_VALIDATION ? (D:\PROJECTS\REVFORGE-Harness\forward\generated\java\POSUPDT): FAIL (label FAILED). POSUPDT has an empty source, so no conversion was produced to validate.

**SOURCE_READINESS** (`pilot readiness --program <P>`): 42 runs, 6 PASS, 36 FAIL. This is the pre-conversion readiness gate; it is unchanged and was not relaxed. Failing checks across the programs (`readiness-failed-checks.txt`): dependencies_identified 30, copybooks_resolved 18, complete_program 2, source_available 1.
- `dependencies_identified` fails on names declared nowhere, PERFORM targets missing from the source, EXEC CICS and the non-standard ACCEPT FROM TIME STAMP. STEP 20 corrected the analyser misclassifying RETURN-CODE, reserved words, SPECIAL-NAMES mnemonics and INDEXED BY index names (`forward/reports/STEP-20-REMEDIATION-ASSESSMENT.md`).
- `copybooks_resolved` fails on the circular SQLCA member (it includes itself: `SQLCA@6`) in the DB2 programs, and on the missing PORTREC, SQLPOS and DB2STAT members.
- `complete_program` fails for CKPRST and FILEHNDL, which have paragraphs without statements; `source_available` fails for POSUPDT, whose source is empty.
- Each run also reports that generation is not authorised through the workflow: `java_generation_allowed` is false and G4 is BLOCKED without trusted signers. The Step 17 Java exists under the separate LGA authorizations.

**Other checks:**

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34,"BLOCKED_AS_EXPECTED":0,"FAIL":0,"total":34}   program test |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad executor doctor` | 0 | bmad executor: isolated installation VERIFIED; LIVE execution BLOCKED; [FAIL] provider_disclosure_authorization: no signed AI-provider disclosure authorization exists for anthropic (claude-code-cli); signed source-export authorizat [FAIL] live_requested: bindi |
| `npm test` | 0 | ℹ tests 383 ℹ pass 383 ℹ fail 0 ℹ skipped 0  |

All commands and exit codes are in `verification-runs.jsonl`; the commands ran sequentially, one at a time. No check was weakened. The STEP 19 run records are kept in `forward/reports/step-20/baseline-step19/`.

## 10. Remediation backlog

Ordered by dependency and impact, not by artifact count. The impact score is 3 × blocked rules + 2 × unreachable rules unlocked + programs affected. D8 ranks first because without it no equivalence claim is possible.
A blocked rule is counted under every dependency it waits on, so the blocked column sums to more than the 32 blocked rules.

| # | Missing dependency | What is needed | Forward gaps | Programs | Blocked rules | Unreachable rules unlocked |
|---|---|---|---|---|---|---|
| 1 | D8 COBOL runtime for differential testing | a COBOL compiler (or captured legacy executions) to run the original programs on the same inputs as the source-derived scenarios | 0 | 42 | 0 | 0 |
| 2 | D3 Corrected source (declarations, paragraphs, layouts, invalid statements) | corrected COBOL from the owner (missing paragraphs and declarations, empty-group layouts, SELECTs without FD, statements invalid as written) | 211 | 23 | 16 | 10 |
| 3 | D2 CICS runtime | a CICS environment or an approved replacement design for COMMAREA, RESP, LINK, HANDLE CONDITION and the EIB | 44 | 8 | 5 | 11 |
| 4 | D1 DB2 runtime | a DB2 instance (or an approved, DB2-validated data-access layer) plus the precompiler SQLCA and the missing DCLGEN | 74 | 13 | 7 | 2 |
| 5 | D4 Missing COPY/INCLUDE members | the members PORTREC, SQLPOS and the intended DB2STAT layout from the original libraries | 45 | 4 | 3 | 9 |
| 6 | D5 Legacy environment definitions | the legacy definitions of ACCEPT FROM TIME STAMP, FUNCTION RANDOM and FUNCTION USER-ID | 12 | 9 | 2 | 3 |
| 7 | D6 Platform services and utilities | CEE3ABD, ILBOABN0, DELAY and IDCAMS behaviour (or approved replacements) | 3 | 3 | 0 | 3 |
| 8 | D7 Business decisions | owner/SME decisions: non-digit amounts (PORTVALD, PORTUPDT); whether PORTTRAN should post positions (2200 is never performed) | 2 | 2 | 0 | 2 |

## 11. Recommended next engineering milestone

**COBOL-runtime differential testing for the gap-free paths.**
1. Obtain a COBOL compiler or captured legacy runs (D8).
2. Replay the 210 source-derived scenarios and the 3 end-to-end JCL jobs against both the original COBOL and the Java.
3. Start with the 67 verified rules and the batch file workflows (PORTREAD, PORTUPDT, PORTDEL, PORTMSTR, PRCSEQ00, RCVPRC00, RTNCDE00, PORTVALD).
4. In parallel, request the D3/D4 source corrections, which unlock the most blocked and unreachable rules without new infrastructure.

DB2 and CICS (D1, D2) need an environment decision before any further conversion work on the online and database programs.

