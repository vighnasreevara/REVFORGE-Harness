# Source-context verification: application

Generated 2026-11-01T18:27:05.271Z; baseline `352b97f0bbcbdb14…`; source available: true.

| Item | Existing claim check | Dependency-aware result | Values supported through a dependency chain | Contradictions |
|---|---|---|---|---|
| REQ-BCHCTL00-001 | unverified | CONTEXT_SUPPORTED | 'INIT', 'I', 'CHEK', 'C', 'UPDT', 'U', 'TERM', 'F' | 0 |
| REQ-HISTLD00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-HISTLD00-002 | contradicted | CITATION_MISMATCH | - | 0 |
| REQ-HISTLD00-003 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-HISTLD00-004 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PRCSEQ00-001 | verified | CONTEXT_SUPPORTED | 'INIT', 'NEXT', 'STAT', 'TERM' | 0 |
| REQ-PRCSEQ00-002 | contradicted | CITATION_MISMATCH | - | 0 |
| REQ-PRCSEQ00-003 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PRCSEQ00-004 | unverified | CONTEXT_PARTIAL | 'D' | 0 |
| REQ-PRCSEQ00-005 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PRCSEQ00-006 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PRCSEQ00-007 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-RCVPRC00-001 | verified | CONTEXT_SUPPORTED | 'INIT', 'RECV', 'TERM' | 0 |
| REQ-RCVPRC00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-RCVPRC00-003 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-RCVPRC00-004 | unverified | CONTEXT_PARTIAL | 'Y' | 0 |
| REQ-RCVPRC00-005 | contradicted | CITATION_MISMATCH | - | 0 |
| REQ-RCVPRC00-006 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-RPTAUD00-001 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-RPTPOS00-001 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-RPTSTA00-001 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-RTNANA00-001 | - | CITATION_MISMATCH | - | 0 |
| REQ-RTNANA00-002 | - | CITATION_MISMATCH | - | 0 |
| REQ-RTNCDE00-001 | verified | CONTEXT_SUPPORTED | 'I', 'S', 'G', 'L', 'A' | 0 |
| REQ-RTNCDE00-002 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-RTNCDE00-003 | unverified | CONTEXT_SUPPORTED | 'S', 'W', 'E', 'F' | 0 |
| REQ-RTNCDE00-004 | contradicted | CITATION_MISMATCH | - | 0 |
| REQ-AUDPROC-001 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-AUDPROC-002 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-DB2CMT-001 | unverified | CONTEXT_SUPPORTED | 'INIT', 'CMIT', 'RBAK', 'SAVE', 'REST', 'STAT' | 0 |
| REQ-DB2CMT-002 | unverified | CONTEXT_PARTIAL | 'Y' | 0 |
| REQ-DB2CMT-003 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-DB2CONN-001 | unverified | CONTEXT_SUPPORTED | 'CONN', 'DISC', 'STAT' | 0 |
| REQ-DB2CONN-002 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-DB2CONN-003 | unverified | CONTEXT_PARTIAL | 'Y' | 0 |
| REQ-DB2CONN-004 | - | CONTEXT_UNRESOLVED | - | 0 |
| REQ-DB2ERR-001 | unverified | CONTEXT_SUPPORTED | 'LOG ', 'DIAG', 'RETR' | 0 |
| REQ-DB2ERR-002 | unverified | CONTEXT_SUPPORTED | 'Y', 'N' | 0 |
| REQ-DB2ERR-003 | unverified | CONTEXT_SUPPORTED | 'N' | 0 |
| REQ-DB2ERR-004 | unverified | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2ERR-005 | unverified | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2ERR-006 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-DB2ERR-007 | - | CONTEXT_UNRESOLVED | - | 0 |
| REQ-DB2STAT-001 | - | CONTEXT_SUPPORTED | 'INIT', 'UPDT', 'TERM', 'DISP' | 0 |
| REQ-ERRPROC-001 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-ERRPROC-002 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-CURSMGR-001 | - | CONTEXT_SUPPORTED | 'D', 'O', 'F', 'C' | 0 |
| REQ-CURSMGR-002 | - | CONTEXT_SUPPORTED | 'Y' | 0 |
| REQ-DB2ONLN-001 | verified | CONTEXT_SUPPORTED | 'C', 'D', 'S' | 0 |
| REQ-DB2ONLN-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2ONLN-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2ONLN-004 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2RECV-001 | - | CONTEXT_SUPPORTED | 'C', 'T' | 0 |
| REQ-DB2RECV-002 | - | CONTEXT_SUPPORTED | 'F' | 0 |
| REQ-DB2RECV-003 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2RECV-004 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-DB2RECV-005 | - | CONTEXT_PARTIAL | 'S', 'R' | 0 |
| REQ-DB2RECV-006 | - | CONTEXT_SUPPORTED | 'C' | 0 |
| REQ-ERRHNDL-001 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-ERRHNDL-002 | - | CONTEXT_SUPPORTED | 'F', 'A', 'W', 'I', 'C', 'R' | 0 |
| REQ-ERRHNDL-003 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQHIST-001 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQHIST-002 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQHIST-003 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQONLN-001 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQONLN-002 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQONLN-003 | - | CONTEXT_SUPPORTED | 'A' | 0 |
| REQ-INQONLN-004 | - | CONTEXT_PARTIAL | - | 0 |
| REQ-INQONLN-005 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQPORT-001 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-INQPORT-002 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-SECMGR-001 | verified | CONTEXT_SUPPORTED | 'V', 'A', 'L' | 0 |
| REQ-SECMGR-002 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-SECMGR-003 | - | CONTEXT_PARTIAL | - | 0 |
| REQ-SECMGR-004 | - | CONTEXT_UNRESOLVED | - | 0 |
| REQ-PORTADD-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTADD-002 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTADD-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTADD-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTADD-005 | contradicted | CITATION_MISMATCH | - | 0 |
| REQ-PORTADD-006 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTDEL-001 | unverified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTDEL-002 | verified | CONTEXT_PARTIAL | - | 0 |
| REQ-PORTDEL-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTDEL-004 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTDEL-005 | verified | CONTEXT_UNRESOLVED | - | 0 |
| REQ-PORTDEL-006 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTMSTR-001 | verified | CONTEXT_SUPPORTED | 'C', 'R', 'U', 'D' | 0 |
| REQ-PORTMSTR-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTMSTR-003 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-PORTMSTR-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTMSTR-005 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTMSTR-006 | unverified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTMSTR-007 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-PORTMSTR-008 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTMSTR-009 | - | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTREAD-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTREAD-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-004 | - | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-005 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-006 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-007 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-008 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTTRAN-009 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTTRAN-010 | unverified | CONTEXT_PARTIAL | - | 0 |
| REQ-PORTUPDT-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| REQ-PORTUPDT-002 | unverified | CONTEXT_SUPPORTED | 'S', 'N', 'V' | 0 |
| REQ-PORTUPDT-003 | verified | CONTEXT_PARTIAL | - | 0 |
| REQ-PORTVALD-001 | verified | CONTEXT_SUPPORTED | 'I', 'A', 'T', 'M' | 0 |
| REQ-PORTVALD-002 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| REQ-PORTVALD-003 | unverified | CONTEXT_PARTIAL | - | 0 |
| RT-DB2ERR-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2ERR-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2ERR-003 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2STAT-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2STAT-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2STAT-003 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRPROC-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRPROC-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRPROC-003 | - | CONTEXT_UNRESOLVED | - | 0 |
| RT-CURSMGR-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-CURSMGR-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2ONLN-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2ONLN-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2RECV-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2RECV-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRHNDL-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRHNDL-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-INQHIST-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-INQHIST-002 | - | CONTEXT_UNRESOLVED | - | 0 |
| RT-INQONLN-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-INQONLN-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-INQPORT-001 | - | CONTEXT_UNSUPPORTED | - | 0 |
| RT-INQPORT-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-SECMGR-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-SECMGR-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTADD-001 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| RT-PORTADD-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTADD-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTADD-004 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PORTDEL-001 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTDEL-002 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| RT-PORTDEL-003 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PORTDEL-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTMSTR-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTMSTR-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTMSTR-003 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PORTMSTR-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTREAD-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTREAD-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTREAD-003 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTTEST-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTTEST-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTTRAN-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTTRAN-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTTRAN-003 | - | CONTEXT_UNSUPPORTED | - | 0 |
| RT-PORTUPDT-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-PORTUPDT-002 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PORTVALD-001 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PORTVALD-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-TSTGEN00-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-TSTGEN00-002 | - | CONTEXT_UNRESOLVED | - | 0 |
| RT-TSTVAL00-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-TSTVAL00-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-UTLMNT00-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-UTLMNT00-002 | - | CONTEXT_UNRESOLVED | - | 0 |
| RT-UTLMON00-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-UTLMON00-002 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-UTLMON00-003 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-UTLVAL00-001 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-UTLVAL00-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2HNDL-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2HNDL-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2HNDL-003 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-ERRHANDL-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-FILEHNDL-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-FILEHNDL-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PROGNAME-001 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-BCHCTL00-001 | verified | CONTEXT_SUPPORTED | 'INIT', 'CHEK', 'UPDT', 'TERM' | 0 |
| RT-BCHCTL00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-BCHCTL00-003 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-BCHCTL00-004 | unverified | CONTEXT_SUPPORTED | 'Y' | 0 |
| RT-CKPRST-001 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-CKPRST-002 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-HISTLD00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-HISTLD00-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-HISTLD00-003 | contradicted | CITATION_MISMATCH | - | 0 |
| RT-HISTLD00-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-HISTLD00-005 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-POSUPDT-001 | unverified | CONTEXT_UNRESOLVED | - | 0 |
| RT-PRCSEQ00-001 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PRCSEQ00-002 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-PRCSEQ00-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-PRCSEQ00-004 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RCVPRC00-001 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| RT-RCVPRC00-002 | verified | CONTEXT_UNSUPPORTED | - | 0 |
| RT-RCVPRC00-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTAUD00-001 | unverified | CONTEXT_UNSUPPORTED | - | 0 |
| RT-RPTAUD00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTAUD00-003 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-RPTPOS00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTPOS00-002 | unverified | CONTEXT_UNRESOLVED | - | 0 |
| RT-RPTPOS00-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTSTA00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTSTA00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RPTSTA00-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNANA00-001 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNANA00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNANA00-003 | unverified | CONTEXT_UNRESOLVED | - | 0 |
| RT-RTNANA00-004 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNCDE00-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNCDE00-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-RTNCDE00-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-AUDPROC-001 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-AUDPROC-002 | unverified | CONTEXT_UNRESOLVED | - | 0 |
| RT-AUDPROC-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2CMT-001 | unverified | CONTEXT_UNRESOLVED | - | 0 |
| RT-DB2CMT-002 | - | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2CMT-003 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2CMT-004 | verified | CONTEXT_UNRESOLVED | - | 0 |
| RT-DB2CONN-001 | unverified | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2CONN-002 | verified | CONTEXT_SUPPORTED | - | 0 |
| RT-DB2CONN-003 | contradicted | CITATION_MISMATCH | - | 0 |

## Dependency chains

**REQ-BCHCTL00-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/batch/BCHCTL00.cbl:50` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000012`
- `sets_true` MODE-INITIALIZE → `src/programs/batch/BCHCTL00.cbl:42` VALUE ["I"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000007`
- `tested` FUNC-CHEK → `src/programs/batch/BCHCTL00.cbl:51` VALUE ["CHEK"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000013`
- `sets_true` MODE-CHECK-PREREQ → `src/programs/batch/BCHCTL00.cbl:43` VALUE ["C"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000008`
- `tested` FUNC-UPDT → `src/programs/batch/BCHCTL00.cbl:52` VALUE ["UPDT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000014`
- `sets_true` MODE-UPDATE-STATUS → `src/programs/batch/BCHCTL00.cbl:44` VALUE ["U"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000009`
- `tested` FUNC-TERM → `src/programs/batch/BCHCTL00.cbl:53` VALUE ["TERM"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000015`
- `sets_true` MODE-FINALIZE → `src/programs/batch/BCHCTL00.cbl:45` VALUE ["F"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000010`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/BCHCTL00.cbl` 876e218a3c1a…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-HISTLD00-001** (CONTEXT_SUPPORTED)

- `tested` END-OF-FILE → `src/programs/batch/HISTLD00.cbl:63` VALUE ["Y"], parent WS-END-OF-FILE-SW, permanent ID `SYS-PORTFOLIO-001-FIL-0044-FLD-000008`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/HISTREC.cpy` ec0fef7e5a93…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/HISTLD00.cbl` 148f75d448f2…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PRCSEQ00-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/batch/PRCSEQ00.cbl:65` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0046-FLD-000014`
- `tested` FUNC-NEXT → `src/programs/batch/PRCSEQ00.cbl:66` VALUE ["NEXT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0046-FLD-000015`
- `tested` FUNC-STAT → `src/programs/batch/PRCSEQ00.cbl:67` VALUE ["STAT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0046-FLD-000016`
- `tested` FUNC-TERM → `src/programs/batch/PRCSEQ00.cbl:68` VALUE ["TERM"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0046-FLD-000017`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/PRCSEQ00.cbl` bf37a5d7a464…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PRCSEQ00-004** (CONTEXT_PARTIAL)

- `tested` BCT-STATUS-DONE → `src/copybook/batch/BCHCTL.cpy:19` VALUE ["D"], parent BCT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0002-FLD-000010`, via COPY BCHCTL (src/programs/batch/PRCSEQ00.cbl:37)
- `tested` PSR-DEP-HARD → `src/copybook/batch/PRCSEQ.cpy:29` VALUE ["H"], parent PSR-DEP-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0004-FLD-000023`, via COPY PRCSEQ (src/programs/batch/PRCSEQ00.cbl:34)
- `tested` PSR-DEP-HARD → `src/copybook/batch/PRCSEQ.cpy:29` VALUE ["H"], parent PSR-DEP-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0004-FLD-000023`, via COPY PRCSEQ (src/programs/batch/PRCSEQ00.cbl:34)
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/PRCSEQ00.cbl` bf37a5d7a464…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-RCVPRC00-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/batch/RCVPRC00.cbl:61` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000013`
- `tested` FUNC-RECV → `src/programs/batch/RCVPRC00.cbl:62` VALUE ["RECV"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000014`
- `tested` FUNC-TERM → `src/programs/batch/RCVPRC00.cbl:63` VALUE ["TERM"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000015`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/RCVPRC00.cbl` 7dd7e5cfb2b6…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-RCVPRC00-002** (CONTEXT_SUPPORTED)

- `tested` WS-RECOVER-PROCESS → `src/programs/batch/RCVPRC00.cbl:50` VALUE ["P"], parent WS-RECOVERY-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000005`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/RCVPRC00.cbl` 7dd7e5cfb2b6…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-RCVPRC00-004** (CONTEXT_PARTIAL)

- `tested` PSR-RESTARTABLE → `src/copybook/batch/PRCSEQ.cpy:37` VALUE ["Y"], parent PSR-RESTART, permanent ID `SYS-PORTFOLIO-001-FIL-0004-FLD-000031`, via COPY PRCSEQ (src/programs/batch/RCVPRC00.cbl:37)
- `sets_true` WS-ACTION-RESTART → `src/programs/batch/RCVPRC00.cbl:54` VALUE ["R"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000009`
- `sets_true` WS-ACTION-TERMINATE → `src/programs/batch/RCVPRC00.cbl:56` VALUE ["T"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000011`
- `sets_true` WS-ACTION-BYPASS → `src/programs/batch/RCVPRC00.cbl:55` VALUE ["B"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000010`
- `sets_true` WS-ACTION-TERMINATE → `src/programs/batch/RCVPRC00.cbl:56` VALUE ["T"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000011`
- `sets_true` WS-ACTION-BYPASS → `src/programs/batch/RCVPRC00.cbl:55` VALUE ["B"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000010`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/RCVPRC00.cbl` 7dd7e5cfb2b6…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-RCVPRC00-005** (CITATION_MISMATCH)

- `tested` WS-ACTION-RESTART → `src/programs/batch/RCVPRC00.cbl:54` VALUE ["R"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000009`
- `tested` WS-ACTION-BYPASS → `src/programs/batch/RCVPRC00.cbl:55` VALUE ["B"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000010`
- `tested` WS-ACTION-TERMINATE → `src/programs/batch/RCVPRC00.cbl:56` VALUE ["T"], parent WS-RECOVERY-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0047-FLD-000011`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/batch/PRCSEQ.cpy` f9cd772e7a23…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/RCVPRC00.cbl` 7dd7e5cfb2b6…
- Human decision: the cited line lies outside the cited statement: an authorised citation correction is needed before the evidence can count

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

**REQ-DB2CMT-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/common/DB2CMT.cbl:35` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000005`
- `tested` FUNC-CMIT → `src/programs/common/DB2CMT.cbl:36` VALUE ["CMIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000006`
- `tested` FUNC-RBACK → `src/programs/common/DB2CMT.cbl:37` VALUE ["RBAK"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000007`
- `tested` FUNC-SAVE → `src/programs/common/DB2CMT.cbl:38` VALUE ["SAVE"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000008`
- `tested` FUNC-REST → `src/programs/common/DB2CMT.cbl:39` VALUE ["REST"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000009`
- `tested` FUNC-STAT → `src/programs/common/DB2CMT.cbl:40` VALUE ["STAT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000010`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CMT.cbl` d753db038a2a…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2CMT-002** (CONTEXT_PARTIAL)

- `tested` LS-FORCE-COMMIT → `src/programs/common/DB2CMT.cbl:46` VALUE ["Y"], parent LS-FORCE-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0054-FLD-000016`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CMT.cbl` d753db038a2a…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-DB2CONN-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-CONN → `src/programs/common/DB2CONN.cbl:36` VALUE ["CONN"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000004`
- `tested` FUNC-DISC → `src/programs/common/DB2CONN.cbl:37` VALUE ["DISC"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000005`
- `tested` FUNC-STAT → `src/programs/common/DB2CONN.cbl:38` VALUE ["STAT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000006`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CONN.cbl` 488a9dcd9fa7…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2CONN-002** (CONTEXT_UNSUPPORTED)

- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `sets_true` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CONN.cbl` 488a9dcd9fa7…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-DB2CONN-003** (CONTEXT_PARTIAL)

- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `sets_true` WS-DISCONNECTED → `src/programs/common/DB2CONN.cbl:28` VALUE ["N"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000002`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CONN.cbl` 488a9dcd9fa7…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-DB2ERR-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-LOG → `src/programs/common/DB2ERR.cbl:41` VALUE ["LOG "], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000007`
- `tested` FUNC-DIAG → `src/programs/common/DB2ERR.cbl:42` VALUE ["DIAG"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000008`
- `tested` FUNC-RETR → `src/programs/common/DB2ERR.cbl:43` VALUE ["RETR"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000009`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2ERR.cbl` cb599435c5ae…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2ERR-002** (CONTEXT_SUPPORTED)

- `sets_true` LS-SHOULD-RETRY → `src/programs/common/DB2ERR.cbl:52` VALUE ["Y"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000018`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2ERR.cbl` cb599435c5ae…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2ERR-003** (CONTEXT_SUPPORTED)

- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- `sets_true` LS-NO-RETRY → `src/programs/common/DB2ERR.cbl:53` VALUE ["N"], parent LS-RETRY-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000019`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2ERR.cbl` cb599435c5ae…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2STAT-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/common/DB2STAT.cbl:43` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0057-FLD-000013`
- `tested` FUNC-UPDT → `src/programs/common/DB2STAT.cbl:44` VALUE ["UPDT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0057-FLD-000014`
- `tested` FUNC-TERM → `src/programs/common/DB2STAT.cbl:45` VALUE ["TERM"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0057-FLD-000015`
- `tested` FUNC-DISP → `src/programs/common/DB2STAT.cbl:46` VALUE ["DISP"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0057-FLD-000016`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2STAT.cbl` 082eb02647d2…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-CURSMGR-001** (CONTEXT_SUPPORTED)

- `tested` CURS-DECLARE → `src/programs/online/CURSMGR.cbl:30` VALUE ["D"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000007`
- `tested` CURS-OPEN → `src/programs/online/CURSMGR.cbl:31` VALUE ["O"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000008`
- `tested` CURS-FETCH → `src/programs/online/CURSMGR.cbl:32` VALUE ["F"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000009`
- `tested` CURS-CLOSE → `src/programs/online/CURSMGR.cbl:33` VALUE ["C"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000010`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/online/CURSMGR.cbl` 5e367102d18d…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-CURSMGR-002** (CONTEXT_SUPPORTED)

- `tested` USE-ARRAY-FETCH → `src/programs/online/CURSMGR.cbl:37` VALUE ["Y"], parent CURS-ARRAY-FETCH, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000014`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/online/CURSMGR.cbl` 5e367102d18d…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2ONLN-001** (CONTEXT_SUPPORTED)

- `tested` DB2-CONNECT → `src/programs/online/DB2ONLN.cbl:30` VALUE ["C"], parent DB2-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0060-FLD-000006`
- `tested` DB2-DISCONNECT → `src/programs/online/DB2ONLN.cbl:31` VALUE ["D"], parent DB2-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0060-FLD-000007`
- `tested` DB2-STATUS → `src/programs/online/DB2ONLN.cbl:32` VALUE ["S"], parent DB2-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0060-FLD-000008`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2ONLN.cbl` 651889f0e13a…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2RECV-001** (CONTEXT_SUPPORTED)

- `tested` RECV-CONNECTION → `src/programs/online/DB2RECV.cbl:33` VALUE ["C"], parent RECV-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000006`
- `tested` RECV-TRANSACTION → `src/programs/online/DB2RECV.cbl:34` VALUE ["T"], parent RECV-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000007`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/DB2REQ.cpy` 72a9d7b9eb91…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2RECV.cbl` ca0e1dc9a3e8…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2RECV-002** (CONTEXT_SUPPORTED)

- `sets_true` RECV-FAILED → `src/programs/online/DB2RECV.cbl:44` VALUE ["F"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000017`
- `tested` RECV-SUCCESS → `src/programs/online/DB2RECV.cbl:43` VALUE ["S"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000016`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/DB2REQ.cpy` 72a9d7b9eb91…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2RECV.cbl` ca0e1dc9a3e8…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2RECV-003** (CONTEXT_SUPPORTED)

- `tested` RECV-SUCCESS → `src/programs/online/DB2RECV.cbl:43` VALUE ["S"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000016`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/DB2REQ.cpy` 72a9d7b9eb91…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2RECV.cbl` ca0e1dc9a3e8…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-DB2RECV-005** (CONTEXT_PARTIAL)

- `sets_true` RECV-SUCCESS → `src/programs/online/DB2RECV.cbl:43` VALUE ["S"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000016`
- `sets_true` RECV-RETRY → `src/programs/online/DB2RECV.cbl:45` VALUE ["R"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000018`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/DB2REQ.cpy` 72a9d7b9eb91…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2RECV.cbl` ca0e1dc9a3e8…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-DB2RECV-006** (CONTEXT_SUPPORTED)

- `tested` ERR-CONTINUE → `src/copybook/online/ERRHND.cpy:17` VALUE ["C"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000013`, via COPY ERRHND (src/programs/online/DB2RECV.cbl:25)
- `sets_true` RECV-RETRY → `src/programs/online/DB2RECV.cbl:45` VALUE ["R"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000018`
- `sets_true` RECV-FAILED → `src/programs/online/DB2RECV.cbl:44` VALUE ["F"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0061-FLD-000017`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/DB2REQ.cpy` 72a9d7b9eb91…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/DB2RECV.cbl` ca0e1dc9a3e8…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-ERRHNDL-002** (CONTEXT_SUPPORTED)

- `tested` ERR-FATAL → `src/copybook/online/ERRHND.cpy:11` VALUE ["F"], parent ERR-SEVERITY, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000007`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `sets_true` ERR-ABEND → `src/copybook/online/ERRHND.cpy:18` VALUE ["A"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000014`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `tested` ERR-WARNING → `src/copybook/online/ERRHND.cpy:12` VALUE ["W"], parent ERR-SEVERITY, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000008`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `sets_true` ERR-CONTINUE → `src/copybook/online/ERRHND.cpy:17` VALUE ["C"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000013`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `tested` ERR-INFO → `src/copybook/online/ERRHND.cpy:13` VALUE ["I"], parent ERR-SEVERITY, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000009`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `sets_true` ERR-CONTINUE → `src/copybook/online/ERRHND.cpy:17` VALUE ["C"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000013`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- `sets_true` ERR-RETURN → `src/copybook/online/ERRHND.cpy:16` VALUE ["R"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000012`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/ERRHNDL.cbl` 11304d286466…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-ERRHNDL-003** (CONTEXT_SUPPORTED)

- `sets_true` ERR-FATAL → `src/copybook/online/ERRHND.cpy:11` VALUE ["F"], parent ERR-SEVERITY, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000007`, via COPY ERRHND (src/programs/online/ERRHNDL.cbl:16)
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/ERRHNDL.cbl` 11304d286466…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-INQHIST-001** (CONTEXT_SUPPORTED)

- `tested` RECV-SUCCESS → `src/programs/online/INQHIST.cbl:61` VALUE ["S"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0063-FLD-000033`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/INQCOM.cpy` b03fdd3ad2e6…, `src/programs/online/INQHIST.cbl` ab4b4e2072fb…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-INQHIST-002** (CONTEXT_SUPPORTED)

- `tested` RECV-SUCCESS → `src/programs/online/INQHIST.cbl:61` VALUE ["S"], parent RECV-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0063-FLD-000033`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/INQCOM.cpy` b03fdd3ad2e6…, `src/programs/online/INQHIST.cbl` ab4b4e2072fb…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-INQONLN-001** (CONTEXT_SUPPORTED)

- `sets_true` SESSION-TERMINATED → `src/programs/online/INQONLN.cbl:21` VALUE ["Y"], parent WS-END-OF-SESSION, permanent ID `SYS-PORTFOLIO-001-FIL-0064-FLD-000003`
- Source hashes: `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/copybook/online/INQCOM.cpy` b03fdd3ad2e6…, `src/programs/online/INQONLN.cbl` a05307ca63e1…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-INQONLN-003** (CONTEXT_SUPPORTED)

- `tested` ERR-ABEND → `src/copybook/online/ERRHND.cpy:18` VALUE ["A"], parent ERR-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0019-FLD-000014`, via COPY ERRHND (src/programs/online/INQONLN.cbl:25)
- Source hashes: `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/copybook/online/INQCOM.cpy` b03fdd3ad2e6…, `src/programs/online/INQONLN.cbl` a05307ca63e1…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-INQPORT-001** (CONTEXT_SUPPORTED)

- `tested` POSITION-EXISTS → `src/programs/online/INQPORT.cbl:26` VALUE ["Y"], parent WS-POSITION-FOUND, permanent ID `SYS-PORTFOLIO-001-FIL-0065-FLD-000003`
- Source hashes: `src/copybook/common/POSREC.cpy` 25abd2f34eef…, `src/copybook/online/INQCOM.cpy` b03fdd3ad2e6…, `src/programs/online/INQPORT.cbl` 5c752c924310…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-SECMGR-001** (CONTEXT_SUPPORTED)

- `tested` SEC-VALIDATE → `src/programs/online/SECMGR.cbl:32` VALUE ["V"], parent SEC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0066-FLD-000008`
- `tested` SEC-AUTHORIZE → `src/programs/online/SECMGR.cbl:33` VALUE ["A"], parent SEC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0066-FLD-000009`
- `tested` SEC-AUDIT → `src/programs/online/SECMGR.cbl:34` VALUE ["L"], parent SEC-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0066-FLD-000010`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/copybook/online/ERRHND.cpy` 57a539ec14c4…, `src/programs/online/SECMGR.cbl` 74281106e716…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTADD-002** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTADD.cbl:53` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0067-FLD-000005`
- `tested` WS-DUP-STATUS → `src/programs/portfolio/PORTADD.cbl:54` VALUE ["22"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0067-FLD-000006`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTADD.cbl` 86cd685a216b…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTDEL-001** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTDEL.cbl:75` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0068-FLD-000019`
- `tested` WS-REC-NOT-FND → `src/programs/portfolio/PORTDEL.cbl:76` VALUE ["23"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0068-FLD-000020`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTDEL.cbl` baaab39ebebe…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTDEL-002** (CONTEXT_PARTIAL)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTDEL.cbl:75` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0068-FLD-000019`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTDEL.cbl` baaab39ebebe…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-PORTMSTR-001** (CONTEXT_SUPPORTED)

- `tested` CREATE-PORT → `src/programs/portfolio/PORTMSTR.cbl:75` VALUE ["C"], parent LS-COMMAND, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000024`
- `tested` READ-PORT → `src/programs/portfolio/PORTMSTR.cbl:76` VALUE ["R"], parent LS-COMMAND, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000025`
- `tested` UPDATE-PORT → `src/programs/portfolio/PORTMSTR.cbl:77` VALUE ["U"], parent LS-COMMAND, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000026`
- `tested` DELETE-PORT → `src/programs/portfolio/PORTMSTR.cbl:78` VALUE ["D"], parent LS-COMMAND, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000027`
- Source hashes: `src/programs/portfolio/PORTMSTR.cbl` 9d1c7f7740ef…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTMSTR-003** (CONTEXT_PARTIAL)

- `tested` PORT-DUP-KEY → `src/programs/portfolio/PORTMSTR.cbl:56` VALUE ["22"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000015`
- Source hashes: `src/programs/portfolio/PORTMSTR.cbl` 9d1c7f7740ef…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-PORTMSTR-006** (CONTEXT_SUPPORTED)

- `tested` PORT-SUCCESS → `src/programs/portfolio/PORTMSTR.cbl:53` VALUE ["00"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000012`
- `tested` PORT-NOT-FOUND → `src/programs/portfolio/PORTMSTR.cbl:55` VALUE ["23"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000014`
- Source hashes: `src/programs/portfolio/PORTMSTR.cbl` 9d1c7f7740ef…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTMSTR-007** (CONTEXT_PARTIAL)

- `tested` PORT-NOT-FOUND → `src/programs/portfolio/PORTMSTR.cbl:55` VALUE ["23"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000014`
- `tested` PORT-NOT-FOUND → `src/programs/portfolio/PORTMSTR.cbl:55` VALUE ["23"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000014`
- Source hashes: `src/programs/portfolio/PORTMSTR.cbl` 9d1c7f7740ef…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-PORTREAD-001** (CONTEXT_SUPPORTED)

- `sets_true` END-OF-FILE → `src/programs/portfolio/PORTREAD.cbl:50` VALUE ["Y"], parent WS-END-OF-FILE-SW, permanent ID `SYS-PORTFOLIO-001-FIL-0070-FLD-000009`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTREAD.cbl` 1e90eef73115…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTREAD-002** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTREAD.cbl:45` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0070-FLD-000005`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTREAD.cbl` 1e90eef73115…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTTRAN-001** (CONTEXT_SUPPORTED)

- `tested` END-OF-FILE → `src/programs/portfolio/PORTTRAN.cbl:56` VALUE ["Y"], parent WS-EOF-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0072-FLD-000006`
- `tested` END-OF-FILE → `src/programs/portfolio/PORTTRAN.cbl:56` VALUE ["Y"], parent WS-EOF-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0072-FLD-000006`
- Source hashes: `src/copybook/common/AUDITLOG.cpy` 06199f6bda98…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/TRNREC.cpy` 03c470f3bf8a…, `src/programs/portfolio/PORTTRAN.cbl` 6e8485dfeb00…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTUPDT-001** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTUPDT.cbl:61` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000013`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTUPDT.cbl` e386049e473b…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTUPDT-002** (CONTEXT_SUPPORTED)

- `tested` UPDT-STATUS → `src/programs/portfolio/PORTUPDT.cbl:45` VALUE ["S"], parent UPDT-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000005`
- `tested` UPDT-NAME → `src/programs/portfolio/PORTUPDT.cbl:47` VALUE ["N"], parent UPDT-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000007`
- `tested` UPDT-VALUE → `src/programs/portfolio/PORTUPDT.cbl:46` VALUE ["V"], parent UPDT-ACTION, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000006`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTUPDT.cbl` e386049e473b…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**REQ-PORTUPDT-003** (CONTEXT_PARTIAL)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTUPDT.cbl:61` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000013`
- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTUPDT.cbl:61` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000013`
- `tested` WS-UPDT-SUCCESS → `src/programs/portfolio/PORTUPDT.cbl:66` VALUE ["00"], parent WS-UPDT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000017`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTUPDT.cbl` e386049e473b…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**REQ-PORTVALD-001** (CONTEXT_SUPPORTED)

- `tested` LS-VAL-ID → `src/programs/portfolio/PORTVALD.cbl:23` VALUE ["I"], parent LS-VALIDATE-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0074-FLD-000002`
- `tested` LS-VAL-ACCT → `src/programs/portfolio/PORTVALD.cbl:24` VALUE ["A"], parent LS-VALIDATE-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0074-FLD-000003`
- `tested` LS-VAL-TYPE → `src/programs/portfolio/PORTVALD.cbl:25` VALUE ["T"], parent LS-VALIDATE-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0074-FLD-000004`
- `tested` LS-VAL-AMT → `src/programs/portfolio/PORTVALD.cbl:26` VALUE ["M"], parent LS-VALIDATE-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0074-FLD-000005`
- Source hashes: `src/copybook/common/PORTVAL.cpy` 8d9c7666b015…, `src/programs/portfolio/PORTVALD.cbl` 5957fd225462…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-DB2ERR-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-LOG → `src/programs/common/DB2ERR.cbl:41` VALUE ["LOG "], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000007`
- `tested` FUNC-DIAG → `src/programs/common/DB2ERR.cbl:42` VALUE ["DIAG"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000008`
- `tested` FUNC-RETR → `src/programs/common/DB2ERR.cbl:43` VALUE ["RETR"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0056-FLD-000009`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2ERR.cbl` cb599435c5ae…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-CURSMGR-001** (CONTEXT_SUPPORTED)

- `tested` CURS-DECLARE → `src/programs/online/CURSMGR.cbl:30` VALUE ["D"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000007`
- `tested` CURS-OPEN → `src/programs/online/CURSMGR.cbl:31` VALUE ["O"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000008`
- `tested` CURS-FETCH → `src/programs/online/CURSMGR.cbl:32` VALUE ["F"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000009`
- `tested` CURS-CLOSE → `src/programs/online/CURSMGR.cbl:33` VALUE ["C"], parent CURS-REQUEST-TYPE, permanent ID `SYS-PORTFOLIO-001-FIL-0059-FLD-000010`
- Source hashes: `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/online/CURSMGR.cbl` 5e367102d18d…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTADD-001** (CONTEXT_UNSUPPORTED)

- `sets_true` END-OF-FILE → `src/programs/portfolio/PORTADD.cbl:62` VALUE ["Y"], parent WS-END-OF-FILE-SW, permanent ID `SYS-PORTFOLIO-001-FIL-0067-FLD-000012`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTADD.cbl` 86cd685a216b…
- Human decision: the source does not establish the claim deterministically; an authorised decision is still required

**RT-PORTADD-002** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTADD.cbl:53` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0067-FLD-000005`
- `tested` WS-DUP-STATUS → `src/programs/portfolio/PORTADD.cbl:54` VALUE ["22"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0067-FLD-000006`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTADD.cbl` 86cd685a216b…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTMSTR-002** (CONTEXT_SUPPORTED)

- `tested` PORT-DUP-KEY → `src/programs/portfolio/PORTMSTR.cbl:56` VALUE ["22"], parent WS-PORT-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0069-FLD-000015`
- Source hashes: `src/programs/portfolio/PORTMSTR.cbl` 9d1c7f7740ef…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTREAD-001** (CONTEXT_SUPPORTED)

- `sets_true` END-OF-FILE → `src/programs/portfolio/PORTREAD.cbl:50` VALUE ["Y"], parent WS-END-OF-FILE-SW, permanent ID `SYS-PORTFOLIO-001-FIL-0070-FLD-000009`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTREAD.cbl` 1e90eef73115…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTREAD-002** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTREAD.cbl:45` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0070-FLD-000005`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTREAD.cbl` 1e90eef73115…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTTRAN-001** (CONTEXT_SUPPORTED)

- `tested` END-OF-FILE → `src/programs/portfolio/PORTTRAN.cbl:56` VALUE ["Y"], parent WS-EOF-FLAG, permanent ID `SYS-PORTFOLIO-001-FIL-0072-FLD-000006`
- Source hashes: `src/copybook/common/AUDITLOG.cpy` 06199f6bda98…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/TRNREC.cpy` 03c470f3bf8a…, `src/programs/portfolio/PORTTRAN.cbl` 6e8485dfeb00…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-PORTUPDT-001** (CONTEXT_SUPPORTED)

- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTUPDT.cbl:61` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000013`
- `tested` WS-SUCCESS-STATUS → `src/programs/portfolio/PORTUPDT.cbl:61` VALUE ["00"], parent WS-FILE-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0073-FLD-000013`
- Source hashes: `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/programs/portfolio/PORTUPDT.cbl` e386049e473b…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-TSTGEN00-001** (CONTEXT_SUPPORTED)

- `sets_true` END-OF-CONFIG → `src/programs/test/TSTGEN00.cbl:83` VALUE ["Y"], parent WS-END-OF-CONFIG, permanent ID `SYS-PORTFOLIO-001-FIL-0075-FLD-000013`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/PORTFLIO.cpy` 030f0a0fb306…, `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/copybook/common/TRNREC.cpy` 03c470f3bf8a…, `src/programs/test/TSTGEN00.cbl` 9c6cd375f322…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-UTLMNT00-001** (CONTEXT_SUPPORTED)

- `sets_true` END-OF-CONTROL → `src/programs/utility/UTLMNT00.cbl:66` VALUE ["Y"], parent WS-END-OF-CTL, permanent ID `SYS-PORTFOLIO-001-FIL-0077-FLD-000008`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/programs/utility/UTLMNT00.cbl` ea0333db7c05…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-FILEHNDL-001** (CONTEXT_SUPPORTED)

- `tested` VSAM-SUCCESS → `src/templates/program/file-handling.cbl:73` VALUE ["00"], parent WS-VSAM-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0082-FLD-000004`
- `tested` VSAM-EOF → `src/templates/program/file-handling.cbl:74` VALUE ["10"], parent WS-VSAM-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0082-FLD-000005`
- Source hashes: `src/templates/program/file-handling.cbl` d9ca04c39498…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-BCHCTL00-001** (CONTEXT_SUPPORTED)

- `tested` FUNC-INIT → `src/programs/batch/BCHCTL00.cbl:50` VALUE ["INIT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000012`
- `sets_true` MODE-INITIALIZE → `src/programs/batch/BCHCTL00.cbl:42` VALUE ["I"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000007`
- `tested` FUNC-CHEK → `src/programs/batch/BCHCTL00.cbl:51` VALUE ["CHEK"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000013`
- `sets_true` MODE-CHECK-PREREQ → `src/programs/batch/BCHCTL00.cbl:43` VALUE ["C"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000008`
- `tested` FUNC-UPDT → `src/programs/batch/BCHCTL00.cbl:52` VALUE ["UPDT"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000014`
- `sets_true` MODE-UPDATE-STATUS → `src/programs/batch/BCHCTL00.cbl:44` VALUE ["U"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000009`
- `tested` FUNC-TERM → `src/programs/batch/BCHCTL00.cbl:53` VALUE ["TERM"], parent LS-FUNCTION, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000015`
- `sets_true` MODE-FINALIZE → `src/programs/batch/BCHCTL00.cbl:45` VALUE ["F"], parent WS-PROCESS-MODE, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000010`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/BCHCTL00.cbl` 876e218a3c1a…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-BCHCTL00-004** (CONTEXT_SUPPORTED)

- `tested` PREREQS-SATISFIED → `src/programs/batch/BCHCTL00.cbl:39` VALUE ["Y"], parent WS-PREREQ-MET, permanent ID `SYS-PORTFOLIO-001-FIL-0042-FLD-000004`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/programs/batch/BCHCTL00.cbl` 876e218a3c1a…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-HISTLD00-001** (CONTEXT_SUPPORTED)

- `sets_true` END-OF-FILE → `src/programs/batch/HISTLD00.cbl:63` VALUE ["Y"], parent WS-END-OF-FILE-SW, permanent ID `SYS-PORTFOLIO-001-FIL-0044-FLD-000008`
- Source hashes: `src/copybook/batch/BCHCON.cpy` 374943d4a215…, `src/copybook/batch/BCHCTL.cpy` d075c66c4489…, `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/common/HISTREC.cpy` ec0fef7e5a93…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/DBTBLS.cpy` ef8bad44dfbc…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/HISTLD00.cbl` 148f75d448f2…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-RTNCDE00-001** (CONTEXT_SUPPORTED)

- `sets_true` RC-STATUS-SUCCESS → `src/copybook/common/RTNCODE.cpy:17` VALUE ["S"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000013`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-WARNING → `src/copybook/common/RTNCODE.cpy:18` VALUE ["W"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000014`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-ERROR → `src/copybook/common/RTNCODE.cpy:19` VALUE ["E"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000015`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- `sets_true` RC-STATUS-SEVERE → `src/copybook/common/RTNCODE.cpy:20` VALUE ["F"], parent RC-STATUS, permanent ID `SYS-PORTFOLIO-001-FIL-0013-FLD-000016`, via COPY RTNCODE (src/programs/batch/RTNCDE00.cbl:30)
- Source hashes: `src/copybook/common/RTNCODE.cpy` 27eabb519319…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/batch/RTNCDE00.cbl` 7cb951ea1f41…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

**RT-DB2CONN-001** (CONTEXT_SUPPORTED)

- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `sets_true` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- `tested` WS-CONNECTED → `src/programs/common/DB2CONN.cbl:27` VALUE ["Y"], parent WS-CONNECTION-STATE, permanent ID `SYS-PORTFOLIO-001-FIL-0055-FLD-000001`
- Source hashes: `src/copybook/common/ERRHAND.cpy` c129b21fe770…, `src/copybook/db2/DBPROC.cpy` 74da3b10107f…, `src/copybook/db2/SQLCA.cpy` 03e8f64ae705…, `src/programs/common/DB2CONN.cbl` 488a9dcd9fa7…
- Human decision: the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)

## Uncertainties and metadata disagreements

- REQ-HISTLD00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-HISTLD00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-HISTLD00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-HISTLD00-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-PRCSEQ00-002: 'INIT' is declared by FUNC-INIT (PRCSEQ00.cbl:65), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-002: 'R' is declared by BCT-STATUS-READY (BCHCTL.cpy:16), BCT-STAT-READY (BCHCON.cpy:9), BCT-DEP-REQUIRED (BCHCON.cpy:39), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-003: 'NEXT' is declared by FUNC-NEXT (PRCSEQ00.cbl:66), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-003: 'R' is declared by BCT-STATUS-READY (BCHCTL.cpy:16), BCT-STAT-READY (BCHCON.cpy:9), BCT-DEP-REQUIRED (BCHCON.cpy:39), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-006: 'STAT' is declared by FUNC-STAT (PRCSEQ00.cbl:67), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-006: 'A' is declared by BCT-STATUS-ACTIVE (BCHCTL.cpy:17), BCT-STAT-ACTIVE (BCHCON.cpy:10), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-006: 'E' is declared by BCT-STATUS-ERROR (BCHCTL.cpy:20), BCT-STAT-ERROR (BCHCON.cpy:13), but no cited statement references it: not counted as evidence
- REQ-PRCSEQ00-007: 'TERM' is declared by FUNC-TERM (PRCSEQ00.cbl:68), but no cited statement references it: not counted as evidence
- REQ-RCVPRC00-003: 'RECV' is declared by FUNC-RECV (RCVPRC00.cbl:62), but no cited statement references it: not counted as evidence
- REQ-RCVPRC00-006: 'TERM' is declared by FUNC-TERM (RCVPRC00.cbl:63), but no cited statement references it: not counted as evidence
- REQ-RPTAUD00-001: 'SYSTEM AUDIT REPORT' is declared by FILLER (RPTAUD00.cbl:56), but no cited statement references it: not counted as evidence
- REQ-RPTAUD00-001: 'REPORT DATE:' is declared by FILLER (RPTAUD00.cbl:60), but no cited statement references it: not counted as evidence
- REQ-RPTSTA00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RPTSTA00-001: 'SYSTEM STATISTICS AND PERFORMANCE REPORT' is declared by FILLER (RPTSTA00.cbl:57), but no cited statement references it: not counted as evidence
- REQ-RPTSTA00-001: 'REPORT DATE:' is declared by FILLER (RPTSTA00.cbl:61), but no cited statement references it: not counted as evidence
- REQ-RTNANA00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNANA00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-002: 'S' is declared by RC-SET-CODE (RTNCODE.cpy:7), RC-STATUS-SUCCESS (RTNCODE.cpy:17), but no cited statement references it: not counted as evidence
- REQ-RTNCDE00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-RTNCDE00-004: 'A' is declared by RC-ANALYZE (RTNCODE.cpy:10), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'TRAN' is declared by AUD-TRANSACTION (AUDITLOG.cpy:15), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'USER' is declared by AUD-USER-ACTION (AUDITLOG.cpy:16), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'SYST' is declared by AUD-SYSTEM-EVENT (AUDITLOG.cpy:17), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'SUCC' is declared by AUD-SUCCESS (AUDITLOG.cpy:28), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'FAIL' is declared by AUD-FAILURE (AUDITLOG.cpy:29), but no cited statement references it: not counted as evidence
- REQ-AUDPROC-002: 'WARN' is declared by AUD-WARNING (AUDITLOG.cpy:30), but no cited statement references it: not counted as evidence
- REQ-DB2CMT-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CMT-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CMT-002: 'CMIT' is declared by FUNC-CMIT (DB2CMT.cbl:36), but no cited statement references it: not counted as evidence
- REQ-DB2CMT-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CMT-003: 'RBAK' is declared by FUNC-RBACK (DB2CMT.cbl:37), but no cited statement references it: not counted as evidence
- REQ-DB2CMT-003: 'SAVE' is declared by FUNC-SAVE (DB2CMT.cbl:38), but no cited statement references it: not counted as evidence
- REQ-DB2CMT-003: 'REST' is declared by FUNC-REST (DB2CMT.cbl:39), but no cited statement references it: not counted as evidence
- REQ-DB2CONN-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CONN-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CONN-002: ref 2: permanent field ID SYS-PORTFOLIO-001-FIL-0055-FLD-000001 is not in the reverse field catalogue
- REQ-DB2CONN-002: 'CONN' is declared by FUNC-CONN (DB2CONN.cbl:36), but no cited statement references it: not counted as evidence
- REQ-DB2CONN-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2CONN-003: 'DISC' is declared by FUNC-DISC (DB2CONN.cbl:37), but no cited statement references it: not counted as evidence
- REQ-DB2ERR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-005: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-006: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ERR-006: 'LOG ' is declared by FUNC-LOG (DB2ERR.cbl:41), but no cited statement references it: not counted as evidence
- REQ-DB2ERR-006: 'D' is declared by EL-TYPE-DATA (DBTBLS.cpy:39), but no cited statement references it: not counted as evidence
- REQ-DB2STAT-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-CURSMGR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-CURSMGR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ONLN-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ONLN-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ONLN-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2ONLN-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-001: RECV-CURSOR is ambiguous (2 declarations); qualify it (OF/IN) to resolve
- REQ-DB2RECV-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-005: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-DB2RECV-005: 'C' is declared by ERR-CONTINUE (ERRHND.cpy:17), DB2-CONNECT (DB2REQ.cpy:6), RECV-CONNECTION (DB2RECV.cbl:33), but no cited statement references it: not counted as evidence
- REQ-DB2RECV-006: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-ERRHNDL-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-ERRHNDL-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-ERRHNDL-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-INQHIST-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-INQHIST-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-INQHIST-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-INQPORT-001: COPY SQLPOS at INQPORT.cbl:21 cannot be resolved: symbols it would define stay unresolved
- REQ-INQPORT-002: COPY SQLPOS at INQPORT.cbl:21 cannot be resolved: symbols it would define stay unresolved
- REQ-SECMGR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-SECMGR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-SECMGR-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- REQ-PORTTRAN-001: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-001: ref 3: permanent field ID SYS-PORTFOLIO-001-FIL-0072-FLD-000006 is not in the reverse field catalogue
- REQ-PORTTRAN-002: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-003: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-004: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-005: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-005: ref 2: permanent field ID SYS-PORTFOLIO-001-FIL-0014-FLD-000009 is not in the reverse field catalogue
- REQ-PORTTRAN-005: ref 3: permanent field ID SYS-PORTFOLIO-001-FIL-0014-FLD-000010 is not in the reverse field catalogue
- REQ-PORTTRAN-005: ref 4: permanent field ID SYS-PORTFOLIO-001-FIL-0014-FLD-000011 is not in the reverse field catalogue
- REQ-PORTTRAN-005: ref 5: permanent field ID SYS-PORTFOLIO-001-FIL-0014-FLD-000012 is not in the reverse field catalogue
- REQ-PORTTRAN-006: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-007: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-008: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-009: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTTRAN-010: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- REQ-PORTUPDT-001: ref 2: permanent field ID SYS-PORTFOLIO-001-FIL-0073-FLD-000013 is not in the reverse field catalogue
- REQ-PORTUPDT-001: ref 3: permanent field ID SYS-PORTFOLIO-001-FIL-0073-FLD-000001 is not in the reverse field catalogue
- REQ-PORTUPDT-001: ref 4: permanent field ID SYS-PORTFOLIO-001-FIL-0009-FLD-000001 is not in the reverse field catalogue
- REQ-PORTUPDT-002: ref 3: permanent field ID SYS-PORTFOLIO-001-FIL-0073-FLD-000005 is not in the reverse field catalogue
- REQ-PORTUPDT-002: ref 4: permanent field ID SYS-PORTFOLIO-001-FIL-0073-FLD-000007 is not in the reverse field catalogue
- REQ-PORTUPDT-002: ref 5: permanent field ID SYS-PORTFOLIO-001-FIL-0073-FLD-000006 is not in the reverse field catalogue
- REQ-PORTVALD-001: ref 3: permanent field ID SYS-PORTFOLIO-001-FIL-0074-FLD-000002 is not in the reverse field catalogue
- REQ-PORTVALD-001: ref 4: permanent field ID SYS-PORTFOLIO-001-FIL-0074-FLD-000003 is not in the reverse field catalogue
- REQ-PORTVALD-001: ref 5: permanent field ID SYS-PORTFOLIO-001-FIL-0074-FLD-000004 is not in the reverse field catalogue
- REQ-PORTVALD-001: ref 6: permanent field ID SYS-PORTFOLIO-001-FIL-0074-FLD-000005 is not in the reverse field catalogue
- REQ-PORTVALD-002: 'I' is declared by LS-VAL-ID (PORTVALD.cbl:23), but no cited statement references it: not counted as evidence
- REQ-PORTVALD-002: 'PORT' is declared by VAL-ID-PREFIX (PORTVAL.cpy:37), but no cited statement references it: not counted as evidence
- REQ-PORTVALD-002: 'Invalid Portfolio ID format' is declared by VAL-ERR-ID (PORTVAL.cpy:22), but no cited statement references it: not counted as evidence
- REQ-PORTVALD-003: 'T' is declared by LS-VAL-TYPE (PORTVALD.cbl:25), but no cited statement references it: not counted as evidence
- REQ-PORTVALD-003: 'Invalid Investment Type' is declared by VAL-ERR-TYPE (PORTVAL.cpy:26), but no cited statement references it: not counted as evidence
- RT-DB2ERR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2ERR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2ERR-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2STAT-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2STAT-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2STAT-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-CURSMGR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-CURSMGR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2ONLN-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2ONLN-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2RECV-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2RECV-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-ERRHNDL-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-ERRHNDL-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-INQHIST-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-INQPORT-001: COPY SQLPOS at INQPORT.cbl:21 cannot be resolved: symbols it would define stay unresolved
- RT-INQPORT-002: COPY SQLPOS at INQPORT.cbl:21 cannot be resolved: symbols it would define stay unresolved
- RT-SECMGR-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-SECMGR-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-PORTADD-001: 'A' is declared by PORT-ACTIVE (PORTFLIO.cpy:25), PORT-ACTIVE (PORTFLIO.cpy:25), but no cited statement references it: not counted as evidence
- RT-PORTTRAN-001: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- RT-PORTTRAN-002: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- RT-PORTTRAN-003: COPY PORTREC at PORTTRAN.cbl:40 cannot be resolved: symbols it would define stay unresolved
- RT-UTLMON00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-UTLMON00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2HNDL-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2HNDL-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2HNDL-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-HISTLD00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-HISTLD00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-HISTLD00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-HISTLD00-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-HISTLD00-005: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RCVPRC00-001: 'P' is declared by BCT-REC-PROCESS (BCHCON.cpy:52), WS-RECOVER-PROCESS (RCVPRC00.cbl:50), but no cited statement references it: not counted as evidence
- RT-RCVPRC00-001: 'S' is declared by PSR-DEP-SOFT (PRCSEQ.cpy:30), WS-RECOVER-SEQUENCE (RCVPRC00.cbl:51), but no cited statement references it: not counted as evidence
- RT-RCVPRC00-001: 'A' is declared by BCT-STATUS-ACTIVE (BCHCTL.cpy:17), BCT-STAT-ACTIVE (BCHCON.cpy:10), WS-RECOVER-ALL (RCVPRC00.cbl:52), but no cited statement references it: not counted as evidence
- RT-RCVPRC00-002: 'S' is declared by PSR-DEP-SOFT (PRCSEQ.cpy:30), WS-RECOVER-SEQUENCE (RCVPRC00.cbl:51), but no cited statement references it: not counted as evidence
- RT-RCVPRC00-002: 'A' is declared by BCT-STATUS-ACTIVE (BCHCTL.cpy:17), BCT-STAT-ACTIVE (BCHCON.cpy:10), WS-RECOVER-ALL (RCVPRC00.cbl:52), but no cited statement references it: not counted as evidence
- RT-RPTAUD00-001: 'REPORT DATE:' is declared by FILLER (RPTAUD00.cbl:60), but no cited statement references it: not counted as evidence
- RT-RPTSTA00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RPTSTA00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RPTSTA00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNANA00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNANA00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNANA00-004: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNCDE00-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNCDE00-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-RTNCDE00-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2CMT-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2CMT-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2CONN-001: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2CONN-002: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved
- RT-DB2CONN-003: COPY SQLCA at SQLCA.cpy:6 is circular: symbols it would define stay unresolved

## Evidence supplements

- `ESU-0001` v1 for REQ-RTNCDE00-002: CONTEXT_UNSUPPORTED; acceptance not possible via advisory: the existing claim check accepted this item, the dependency-aware check does not (CONTEXT_UNSUPPORTED); a reviewer should confirm or correct the citation. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.
- `ESU-0002` v1 for REQ-RTNCDE00-003: CONTEXT_SUPPORTED; acceptance possible via a signed resolution of RVW-REQ-RTNCDE00-003 with outcome resolved_no_change and selected_option ESU-0002. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.
- `ESU-0003` v1 for REQ-RTNCDE00-004: CITATION_MISMATCH; acceptance not possible via a signed resolution of RVW-REQ-RTNCDE00-004 with outcome resolved_no_change and selected_option ESU-0003. none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt.

Recorded in this run: none.
