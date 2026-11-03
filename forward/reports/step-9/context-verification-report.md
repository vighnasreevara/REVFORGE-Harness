# Source-context verification: programs:RTNCDE00

Generated 2026-11-01T18:26:55.277Z; baseline `352b97f0bbcbdb14…`; source available: true.

| Item | Existing claim check | Dependency-aware result | Values supported through a dependency chain | Contradictions |
|---|---|---|---|---|
| REQ-RTNCDE00-001 | verified | CONTEXT_SUPPORTED | 'I', 'S', 'G', 'L', 'A' | 0 |
| REQ-RTNCDE00-002 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-RTNCDE00-003 | unverified | CONTEXT_SUPPORTED | 'S', 'W', 'E', 'F' | 0 |
| REQ-RTNCDE00-004 | contradicted | CITATION_MISMATCH | - | 0 |
| RT-RTNCDE00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNCDE00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNCDE00-003 | verified | CONTEXT_SUPPORTED | - | 0 |

## Dependency chains

**REQ-RTNCDE00-001** (CONTEXT_SUPPORTED)

- `tested` RC-INITIALIZE → `src/copybook/common/RTNCODE.cpy:6` VALUE ["I"], parent RC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000002`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `tested` RC-SET-CODE → `src/copybook/common/RTNCODE.cpy:7` VALUE ["S"], parent RC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000003`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `tested` RC-GET-CODE → `src/copybook/common/RTNCODE.cpy:8` VALUE ["G"], parent RC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000004`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `tested` RC-LOG-CODE → `src/copybook/common/RTNCODE.cpy:9` VALUE ["L"], parent RC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000005`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `tested` RC-ANALYZE → `src/copybook/common/RTNCODE.cpy:10` VALUE ["A"], parent RC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000006`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- Source hashes: `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/RTNCDE00.cbl` 7cb951ea1f41…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-RTNCDE00-003** (CONTEXT_SUPPORTED)

- `sets_true` RC-STATUS-SUCCESS → `src/copybook/common/RTNCODE.cpy:17` VALUE ["S"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000013`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-WARNING → `src/copybook/common/RTNCODE.cpy:18` VALUE ["W"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000014`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-ERROR → `src/copybook/common/RTNCODE.cpy:19` VALUE ["E"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000015`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-SEVERE → `src/copybook/common/RTNCODE.cpy:20` VALUE ["F"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000016`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- Source hashes: `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/RTNCDE00.cbl` 7cb951ea1f41…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-RTNCDE00-001** (CONTEXT_SUPPORTED)

- `sets_true` RC-STATUS-SUCCESS → `src/copybook/common/RTNCODE.cpy:17` VALUE ["S"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000013`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-WARNING → `src/copybook/common/RTNCODE.cpy:18` VALUE ["W"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000014`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-ERROR → `src/copybook/common/RTNCODE.cpy:19` VALUE ["E"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000015`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-SEVERE → `src/copybook/common/RTNCODE.cpy:20` VALUE ["F"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000016`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- Source hashes: `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/RTNCDE00.cbl` 7cb951ea1f41…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

## Uncertainties and metadata disagreements

- REQ-RTNCDE00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-002: 'S' is declared by RC-SET-CODE (RTNCODE.cpy:7), RC-STATUS-SUCCESS (RTNCODE.cpy:17), but no cited statement references it: not counted as evidence
- REQ-RTNCDE00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-004: 'A' is declared by RC-ANALYZE (RTNCODE.cpy:10), but no cited statement references it: not counted as evidence
- RT-RTNCDE00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNCDE00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNCDE00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved

## Evidence supplements

- `ESU-0001` v1 for REQ-RTNCDE00-002: CONTEXT_UNSUPPORTED; acceptance not possible via advisory: the existing claim check accepted this item, the dependency-aware check does not (CONTEXT_UNSUPPORTED); a reviewer should confirm or correct the citation. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.
- `ESU-0002` v1 for REQ-RTNCDE00-003: CONTEXT_SUPPORTED; acceptance possible via a signed resolution of RVW-REQ-RTNCDE00-003 with outcome resolved_no_change and selected_option ESU-0002. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.
- `ESU-0003` v1 for REQ-RTNCDE00-004: CITATION_MISMATCH; acceptance not possible via a signed resolution of RVW-REQ-RTNCDE00-004 with outcome resolved_no_change and selected_option ESU-0003. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.

Recorded in this run: ESU-0001, ESU-0002, ESU-0003.
