# Pilot-first modernization: planning and the synthetic pilot

This guide is for the operator and the reviewers. The principle is: **convert what is verified, preserve what is unknown, never fabricate missing behaviour.** Nothing in this guide approves, resolves, excludes or authorises anything.

## 1. Source-backed modernization plan

```sh
pilot plan --scope programs:<P> [--export-dir DIR]     # writes modernization-plan-<scope>.json (contract pilot/modernization-plan)
```

The command is read-only on the workflow. For each requirement and runtime requirement in the scope it reports:

- **What it checks:**
  - **evidence:** whether the cited evidence establishes the claim (the deterministic claim check, or a current `SOURCE_CHAIN_VERIFIED` adjudication);
  - the cited statement, its dependencies (condition names, VALUEs, declaring files), and the sha256 of every source involved.
- **What it reaches:** the paragraph that contains the cited statement, and every paragraph it PERFORMs (THRU ranges, transitively).
- **Which statements depend on a decision:** a statement depends on a decision when it uses a name that an **open blocking decision's** fact sheet shows is declared nowhere in the repository. Statements nested under such an IF or EVALUATE depend on it too. Inside embedded SQL, only `:host` variables count as COBOL names.
- **External interfaces:** embedded SQL, with the table definition found in the source tree.
- **What is still needed:** the missing information, the human decisions required, the expected Java responsibility, and test cases implied by the branches.

| Class | Category | Meaning |
|---|---|---|
| FULLY_SOURCE_SUPPORTED | VERIFIED | evidence established; nothing reached depends on an open decision |
| PARTIALLY_SUPPORTED | PARTIAL | only the independent portion may later be implemented; the dependent portion stays a preserved gap |
| DEPENDENT_ON_TECHNICAL_DECISION | GAP | every reached statement waits for a decision |
| INSUFFICIENT_EVIDENCE | GAP | the cited evidence does not establish the claim |
| CONTRADICTED | GAP | the source contradicts the cited evidence |

**A category is not an approval.** Every category, VERIFIED included, may be implemented only after the scope passes G1, then G2, with genuine signed approvals, a valid F4 story set (automated validation) and an explicit generation authorisation. The plan reports the G1 outcome next to each class and never changes it.

## 1b. Behaviour scopes for granular G1 approval (Step 13)

```sh
approval scope     --scope behaviour:PROGRAM:PARAGRAPH:requirement=ID,runtime_requirement=ID [--compare programs:PROGRAM] [--json] [--export-dir D]
approval readiness --scope <same>        # checklist (readiness is not approval)
approval package   --scope <same>        # review package and fresh unsigned requests
approval export-request --scope <same> --requested-by <operator>   # only for a READY scope
```

**Selector.** Items are typed: `requirement=` or `runtime_requirement=`. A wrong kind, ID or program is refused. The selector text is canonical (order-independent).

**Units.** They come from the dependency closure (`approval/closure.ts`):
- **direct:** the PERFORM range;
- **transitive:** performed paragraphs, the dispatch trigger, every program statement that writes a consumed input (with its own SQL and undeclared-name dependencies), CALLed programs, the declaring copybooks, and the SQL communication area whenever SQL is involved.

**Fail-closed.** An unknown name, ambiguous reference, GO TO, ALTER, dynamic CALL, EXEC CICS or missing target makes the closure UNRESOLVED, and the scope cannot be READY.

**Decision attribution.** Every decision is attributed, with a reason and the dependency edges.
- **Applies when it:**
  - names a selected item, or is an open decision of one;
  - owns an undeclared name the closure uses;
  - names something in the closure;
  - is global;
  - concerns a copybook the closure includes.
- **Excluded only when** the analysis places it outside the closure.
- **Unlocatable subjects apply.**
- **Nothing is resolved;** excluded decisions keep blocking the program scope.

**Additional blocking findings:**
- an unselected requirement or runtime requirement that cites a statement inside the behaviour (`missing_required_item`);
- a rule whose source lies inside it but whose requirements are not selected (`omitted_rule`);
- every blocking gap in the closure.

**Domain restrictions.** Binary truncation that depends on the TRUNC option is a non-blocking `deferred_domain` finding: an input outside the supported domain must fail explicitly as unsupported, and no legacy behaviour is implied.

**Approval binding.** The digest, and the approval request, bind:
- the closure hash and source;
- the typed items and their hashes;
- the decision attribution;
- the deferred gaps.

Any change makes an earlier request stale.

**What an approval covers.** A behaviour approval covers that subset only, and never the program. G2 and the F4 story validation consume exactly its requirements.

## 2. The synthetic pilot

```sh
pilot run [--dir forward/pilot/<name>] [--out forward/pilot/<name>/out]
```

**Inputs** (`forward/pilot/synthetic-rc/`):

| File | Contents |
|---|---|
| `pilot.json` | `synthetic: true` |
| `cobol/SYNRC01.cbl` | the program |
| `cobol/SYNDRV01.cbl` | the test driver, used only for a COBOL reference run |
| `SPEC.md` | the full behaviour |
| `fixtures/cases.json` | specification-derived expectations, written before any Java existed |

**Steps:**
1. **Parse** a strict COBOL subset. Anything outside it is refused (`FAILED`, with the construct), never guessed.
2. **Extract** the dispatch and decision tables.
3. **Find gaps:**
   - a CALL to a program without source is an `UNDEFINED_EXTERNAL_CALL`;
   - a name declared nowhere is an `UNDECLARED_NAME`.

   Each gap gets a `GAP-<PROGRAM>-NNNN` ID, its original context, and the statements and dispatch branches that depend on it.
4. **Generate Java.** Each COBOL statement is mapped to a Java line (`source-map.json`). An undefined call becomes a Java interface plus an **INCOMPLETE PLACEHOLDER** that throws `UnresolvedGapException`, so the path stays blocked. No default value replaces missing behaviour.
5. **Compile** with `javac -Werror` (JDK from `REVFORGE_JAVA_HOME`, then `JAVA_HOME`, then `PATH`).
6. **Run** every fixture case and compare it with the expectation.
7. **Capture a COBOL reference** only with a real compiler (`REVFORGE_COBC` or `cobc`). Without one: `COBOL_COMPILER_UNAVAILABLE`, `FIXTURE_BASED` validation, and `EQUIVALENCE_UNVERIFIED`.
8. **Audit the trace** (every statement mapped, every gap traced and still blocked by a fixture), then write an evidence manifest (sha256 of every input and output).

**Status:**

| Status | Meaning |
|---|---|
| `COMPLETE` | no gap and every fixture passed |
| `PARTIAL` | compiles and all verified paths pass, but gaps remain (blocked) |
| `FAILED` | refused construct, compilation error or fixture mismatch |
| `NOT_EXECUTED` | no JDK |

The contract `pilot/pilot-result` rejects `COMPLETE` with open gaps, and rejects any equivalence claim from fixture-only validation.

**Isolation:**
- **Refusals:** the pilot refuses a definition without `synthetic: true`, and any program under the configured COBOL source root, `output/` or `references/`.
- **Output location:** generated output never leaves `forward/pilot/`.
- **Nothing else is used:** the pilot uses no workflow, gate, approval, agent, BMad or AI provider.
- **Not evidence for any gate or check:** pilot results must never be used as workflow build or independent-test evidence (the former G5/G6).
- **Not backed up:** pilot output is reproducible and excluded from backups.

## 3. Authorised local generation of a real program (Step 16)

Policy `program_scoped_local_v1` applies to deterministic **local** conversion only. Under it, a project-owner-accepted record bound to exact source and copybook hashes and to one output directory replaces the workflow's signature requirements (G1 and G2; G2-G4 under the nine-gate design in force at Step 16). No Ed25519 signature is needed.

What the policy does not change:
- the workflow's pre-check and gate records;
- the global `generation.java_generation_allowed` flag (still `false`);
- the orchestrator guard. F5 and any AI-agent generation still require G1 and G2 PASS, a valid story set and the generation flag.

```
pilot authorize --input pilot/authorizations/<PROGRAM>.authorization-input.json
pilot authorization --program <PROGRAM>
pilot generate --program <PROGRAM> --cases <reviewed-test-cases.json>
pilot validate --out generated/java/<PROGRAM>
pilot application --export-dir reports/step-16
```

**`pilot authorize`**
- Checks the current source and copybook hashes against the accepted record.
- Writes `workflow/generation/LGP-NNNN.json` (the policy adoption, once) and `LGA-NNNN.json` (the program authorisation).
- Seals both in the audit log.
- The input file holds the exact text presented to the owner. Its sha256 is recorded.

**`pilot authorization`** fails closed. It requires all of the following:
- an adopted policy;
- a record for that program;
- an intact audit seal;
- a record within its validity period;
- unchanged source and copybook hashes;
- exactly the authorised output directory;
- no external AI disclosure.

**`pilot generate`**
- Runs the same converter as the synthetic pilot, after the authorisation check.
- Resolves COPY members only from the record's hash-bound copybooks.
- Treats every CALL as a gap.
- Re-checks the hashes after generation.
- Seals a `local_generation_performed` audit event.

Output goes to `forward/generated/java/<PROGRAM>/`. This directory is git-ignored and excluded from code backups, because it derives from protected source; it can be rebuilt with `pilot generate`. A program counts as `COMPLETE`, `PARTIAL` or `FAILED` in the application status only when its authorisation is still valid and its output passes CONVERSION_VALIDATION.

## 4. Full-application conversion (Step 17)

The project owner accepted one consolidated record. It is bound by hash to `pilot/authorizations/APPLICATION.authorization-manifest.json`, which lists all 42 programs and their copybook, JCL and DB2 hashes. `pilot authorize --input pilot/authorizations/APPLICATION.authorization-input.json` turned it into one LGA record per program (PORTVALD keeps LGA-0001). Each record also binds its JCL and DB2 dependencies and the manifest hash. A changed file voids only that program.

```
pilot convert-app [--program P]      # every authorised program -> forward/generated/java/<P>/
pilot validate --out generated/java/<P>
pilot integrate                      # forward/generated/java/app/: build + runtime, program and integration tests
pilot application --export-dir reports/step-17
```

### The converter

The converter is the existing local converter, extended:

| Module | Role |
|---|---|
| `runtime/src/pilot/cobol-app.ts` | Front end: COPY REPLACING, continuation lines, full data division and procedure grammar |
| `runtime/src/pilot/java-app.ts` | Java back end |
| `runtime/java/revforge/cobol` | Hand-written runtime: storage views, zoned/binary/packed numerics, MOVE rules, arithmetic with SIZE ERROR, editing, EBCDIC collation, sequential and indexed files with FILE STATUS, CALL, PERFORM ranges, job runner |

The strict Step 11–15 subset converter still serves the synthetic pilots.

### Gaps

Behaviour the source does not define becomes a numbered gap. Each gap has a Java site that throws `UnresolvedGapException`, and a probe test.

| Kind | Cause |
|---|---|
| `EXTERNAL_SYSTEM_BOUNDARY` | Executable EXEC SQL / EXEC CICS |
| `UNDEFINED_PROCEDURE` | PERFORM or GO TO of a paragraph that does not exist |
| `UNDECLARED_NAME` | A name declared nowhere |
| `UNSUPPORTED_DATA` | An item with no determinable layout |
| `DATA_CONVERSION_UNDEFINED` | An undefined data conversion |
| `COMPILER_OPTION_DEPENDENT` | Behaviour that depends on the compiler (FUNCTION RANDOM, ACCEPT FROM TIME STAMP) |
| `UNTRANSLATED_STATEMENT` | A statement that is not valid COBOL as written |

### Tests per program

- **INIT:** VALUE clauses, encoded independently.
- **PROBE:** every gap site.
- **Scenarios:** source-derived, in `pilot/app-fixtures/<P>.json`; the contract is in `pilot/app-fixtures/README.md`.

A program is COMPLETE only when it has no gaps and at least one source-derived scenario passes.

### Integration tests

`pilot/app-fixtures/integration/*.json` covers CALLs into the converted callee and the converted JCL jobs. A job's DD statements map to `<data-root>/<DSN>`. System utilities such as IDCAMS are explicit boundaries.
