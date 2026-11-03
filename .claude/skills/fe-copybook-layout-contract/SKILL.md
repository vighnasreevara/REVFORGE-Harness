---
name: fe-copybook-layout-contract
description: REVFORGE F2 skill. Produces COBOL-to-Java data contracts for the records of one dispatch packet - field categories, PIC, usage, sign, implied decimals, COMP/COMP-3, OCCURS, REDEFINES, 88-levels, lengths, offsets, encoding and permitted Java types - with an explicit evidence status per field. Never invents layouts or lossy types.
allowed-tools: Read, Grep, Glob, Write
---

# fe-copybook-layout-contract

Owned by agent **fe-data-mapping-specialist** (F2). Executed only on a dispatchable packet prepared by the REVFORGE Forward Orchestrator.

```json revforge-skill
{
  "skill": "fe-copybook-layout-contract",
  "owner_agent": "F2",
  "version": "1.0",
  "output_contracts": ["forward/data-contracts", "forward/decision-requests"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/extracts/<packet>/data_extract.json",
    "workflow/extracts/<packet>/file_context.json",
    "output/data/data_artifact.json",
    "output/data/data_layouts/*.json",
    "output/parser/raw_structure/*.json",
    "output/inventory/inventory_artifact.json",
    "<packet.source.root>/<unit relative_path> (only when packet.source.available)"
  ],
  "executes": []
}
```

## Purpose and responsibility

For every record owned by the packet's units (program working-storage/file/linkage records and copybook records), document the exact legacy data representation and the Java representation it requires. For every field, state whether the fact is `verified_from_source`, `reverse_artifact_supported`, `inferred` or `unresolved`. Missing copybooks, self-including copybooks and COPY statements that name a program stay unresolved, and are recorded as findings and decision requests, never filled in.

## Required input artifacts

- `workflow/extracts/<packet>/data_extract.json`: `records[]` with `record` (catalogue entry with `record_id`, `file_id`, `total_bytes`), `catalogue_fields` (field catalogue entries), `condition_names` (88-levels), `layout_worksheet` (per item: `field_id`, `level`, `cobol_category`, `pic`, `usage`, `signed`, `digits`, `decimals`, `byte_length`, `occurs`, `offset`, `offset_basis`, `redefines_field_id`, `value`, `allowed_java_types`, `source_line`), `worksheet_notes`; plus `issues` and `unresolved_copy_stubs`;
- `workflow/extracts/<packet>/file_context.json` (FD and SELECT context, layout file per unit);
- the data layout files listed under input kind `reverse:data_layouts`;
- original COBOL source under `packet.source.root` when `packet.source.available` is true.

## Input validation

1. Stop with `blocked` if the packet is not dispatchable, a skill is not `INSTALLED` or a required input is missing.
2. Confirm that every `records[].record.file_id` is one of the packet units' File IDs.
3. Confirm that every `layout_worksheet` entry with a `field_id` also appears in `catalogue_fields` or `condition_names`, unless it is a group item; otherwise record a verification finding.
4. Copy `path`/`sha256` of each input you read into `inputs_used` exactly as listed in the packet.

## Execution procedure

1. For each record in `data_extract.records`, write one entry in `records`: `record_id`, `record_name`, `owner` (the packet unit with the record's File ID), `total_bytes` (from the catalogue), `length_evidence_status`, `evidence_status`.
2. For each worksheet item that is not a level-88 condition, write one field entry. Include every catalogued field and every group item.
   - Copy `field_id`, `field_name`, `level`, `cobol_category`, `pic`, `usage`, `signed`, `digits`, `decimals`, `byte_length`, `occurs` and `redefines_field_id` from the worksheet.
   - Copy `offset` and `offset_basis`. The runtime computed offsets from reverse item sizes (`computed_from_reverse_layout`). Use `verified_from_source` only when the source is available and you recomputed the offset from the PIC clauses in the source.
3. Attach the level-88 items that follow a field as its `condition_names`: `{name, field_id, values}`.
4. Choose `java_type` from that item's `allowed_java_types` only:
   - fractional numbers (`decimals > 0`) use `BigDecimal`, with the scale equal to the decimals;
   - integers of 9 digits or fewer may use `int`; up to 18 digits use `long`; larger ones use `BigDecimal` or `BigInteger`;
   - packed (`numeric_packed`) and binary (`numeric_binary`) fields use the same numeric rule and keep their storage format in the codec;
   - `alphanumeric` uses `String` (or `byte[]` when bytes must be preserved, for example a FILLER or a binary key);
   - `numeric_edited` uses `String`;
   - groups use `Group`.
   If `allowed_java_types` is empty, set `java_type: null`, `evidence_status: "unresolved"` and an `unresolved_reason`. Never use `float` or `double`.
5. Explain each choice in `java_type_rationale`: the digits, decimals, sign and storage, and any overflow or precision consideration.
6. Set `default_value` from the worksheet `value` (a VALUE clause), or `null`. Describe initialisation behaviour (INITIALIZE or VALUE) in `notes` only where the logic or source shows it.
7. Add `test_vectors` only where the representation rules alone determine the bytes, for example a packed or signed-display encoding of a chosen value. Give the PIC, the value and the expected hex, and state the `basis`. Skip fields whose evidence is unresolved.
8. **Encoding:** state an `encoding_assumption`, for example EBCDIC code page 037 for z/OS DISPLAY data. Its `evidence_status` is `inferred` unless the source, JCL or documentation states the encoding.
9. **Findings:** record every worksheet note, record-length mismatch, VALUE literal longer than its PIC and duplicate name from `issues` in `verification_findings`. Record every entry of `unresolved_copy_stubs` in the header `unresolved_findings`, naming the copybook in the description, with `evidence_status: "unresolved"`.
10. Write `data_mappings.json` (contract `forward/data-contracts`).
11. Write `unresolved_layout_findings.json` (contract `forward/decision-requests`) with one open `data_layout` decision for each unresolved copybook, unknown representation or layout conflict. Mark it blocking when the affected record has no layout at all. Fill its `blocker_report`.

## Source grounding

Every field fact comes from the data artifact and layouts, or from the original source when available. If the source contradicts the reverse layout (PIC, usage, OCCURS or REDEFINES), record the finding and keep both values visible. Do not replace the reverse value silently. A source path existing is not verification: claim `verified_from_source` only for facts you actually read.

## Outputs and contracts

Write both files inside `packet.permissions.output_dir`:
- `data_mappings.json`, contract `forward/data-contracts`;
- `unresolved_layout_findings.json`, contract `forward/decision-requests`.

Both start with the common forward header. It contains `authoring_agent` (F2), `packet_id`, `baseline`, `generated_at`, `skills_used`, `inputs_used`, `units_covered` (equal to `packet.units`) and `unresolved_findings`.

## Allowed tools and operations

- Read, Grep and Glob on the packet inputs, the reverse data and the parser artifacts.
- Read the original source under `packet.source.root` when it is available.
- Write inside the output directory only.

No Bash, no network, no Neo4j.

## Forbidden operations

- Inventing a record layout for a missing or self-including copybook.
- Inventing a Field ID, or assigning one to an unregistered item.
- Choosing a Java type outside `allowed_java_types`.
- Changing digits, decimals, sign or category from the catalogue.
- Claiming `verified_from_source` without available source text.
- Writing code or modifying reverse artifacts.

## Error handling and stop conditions

- A record has no layout file: keep the record with an `unresolved` evidence status, add a verification finding and add a decision.
- An extract is inconsistent with the catalogue: record a finding and continue with the catalogue values.
- The packet is undispatchable or an input is missing: return `blocked`.
- You run out of capacity: return `incomplete`. Never return `completed` with omitted records or fields.

## Quality checks

1. Every catalogued record of every unit appears.
2. Every catalogued field of every record appears with its Field ID.
3. Every `java_type` is in the permitted set.
4. Categories, decimals and sign match the catalogue.
5. Fields without a Field ID are unresolved and have `java_type` null.
6. Every unresolved copybook stub is named in `unresolved_findings`.
7. `verified_from_source` appears only if `packet.source.available` is true.

The runtime re-checks all of these and rejects the receipt on any failure.

## Source-ID traceability

- Record IDs and Field IDs (including the IDs of level-88 conditions) are copied exactly.
- `redefines_field_id` comes from the worksheet; it is `null` where the target has no ID.
- Test vectors cite the Field ID they exercise.
- Each decision request cites the File ID and the line of the unresolved COPY or INCLUDE.

## Orchestrator integration

Return `receipt.json` at `packet.receipt_path` (contract `agent-receipt`, agent `F2`). It lists `data_mappings.json`, `unresolved_layout_findings.json` and `file_operation_requirements.json` (produced by `fe-cobol-runtime-file-semantics`), each with `sha256: null` and its contract. The runtime then hashes, schema-validates and semantically checks the outputs, updates the F2 coverage ledger and records provenance. Data contracts become "verified data mappings" only through later gates, never by this skill.
