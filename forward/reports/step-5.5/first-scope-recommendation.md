# First approval scope: recommendation and comparison

Generated 2026-11-01T00:14:35.047Z. 42 program scopes and 114 requirement scopes evaluated with the existing G2 evaluator. **This is a proposal, not an approval.**

Ranking: meaningful scopes first (application program with source text and a source-verified requirement), then the lowest workload score (root causes weighted A 1, B 2, C 3, D 3, E 6, plus 0.5 per shared dependency), then fewer units, then more requirements.

## Top three program scopes

### 1. programs:RTNCDE00

programs:RTNCDE00: 4 requirement(s), 3 unit(s) (2 shared dependencies), 5 blocking finding(s) from 3 root cause(s) [D:1 A:1 B:1], workload score 7. Suitable: an application function with source text and at least one source-verified requirement.

### 2. programs:PORTDEL

programs:PORTDEL: 6 requirement(s), 2 unit(s) (1 shared dependency), 8 blocking finding(s) from 6 root cause(s) [C:1 D:1 B:4], workload score 14.5. Suitable: an application function with source text and at least one source-verified requirement.

### 3. programs:RCVPRC00

programs:RCVPRC00: 8 requirement(s), 6 unit(s) (5 shared dependencies), 9 blocking finding(s) from 6 root cause(s) [B:6], workload score 14.5. Suitable: an application function with source text and at least one source-verified requirement.

## Recommended first scope: `programs:RTNCDE00`

programs:RTNCDE00: 4 requirement(s), 3 unit(s) (2 shared dependencies), 5 blocking finding(s) from 3 root cause(s) [D:1 A:1 B:1], workload score 7. Suitable: an application function with source text and at least one source-verified requirement. It is the meaningful program scope with the least weighted human work; 28 other program scope(s) were not recommended (templates, test tools, utilities, empty sources or no verified requirement). It is a proposal for human review, not an approval.

## All program scopes

| Rank | Scope | Meaningful | Score | Root causes (A/B/C/D/E) | Reqs | Deps | Blocking | Not recommended because |
|---|---|---|---|---|---|---|---|---|
| 1 | RTNCDE00 | yes | 7 | 1/1/0/1/0 | 4 | 2 | 5 |  |
| 2 | PORTDEL | yes | 14.5 | 0/4/1/1/0 | 6 | 1 | 8 |  |
| 3 | RCVPRC00 | yes | 14.5 | 0/6/0/0/0 | 8 | 5 | 9 |  |
| 4 | SECMGR | yes | 17 | 1/6/0/1/0 | 4 | 2 | 10 |  |
| 5 | PORTVALD | yes | 17.5 | 1/8/0/0/0 | 3 | 1 | 11 |  |
| 6 | DB2ONLN | yes | 18 | 1/5/0/2/0 | 4 | 2 | 9 |  |
| 7 | PORTUPDT | yes | 19.5 | 1/6/1/1/0 | 3 | 1 | 13 |  |
| 8 | PORTREAD | yes | 19.5 | 1/6/1/1/0 | 2 | 1 | 12 |  |
| 9 | PORTADD | yes | 21.5 | 0/6/1/2/0 | 6 | 1 | 10 |  |
| 10 | PRCSEQ00 | yes | 23.5 | 1/10/0/0/0 | 9 | 5 | 12 |  |
| 11 | HISTLD00 | yes | 41 | 1/12/0/4/0 | 6 | 8 | 19 |  |
| 12 | PORTMSTR | yes | 50 | 1/13/2/5/0 | 13 | 4 | 31 |  |
| 13 | DB2RECV | yes | 61.5 | 2/18/0/7/0 | 13 | 5 | 30 |  |
| 14 | INQHIST | yes | 106 | 6/30/0/12/0 | 18 | 8 | 52 |  |
| 15 | POSUPDT | no | 5 | 0/1/1/0/0 | 0 | 0 | 3 | source text is missing or empty; no requirement is in scope |
| 16 | PROGNAME | no | 6 | 1/1/1/0/0 | 0 | 0 | 6 | classified template (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 17 | ERRPROC | no | 8.5 | 0/4/0/0/0 | 2 | 1 | 5 | no requirement in scope is independently verified against the source |
| 18 | CKPRST | no | 9 | 0/1/0/2/0 | 0 | 2 | 3 | no requirement is in scope |
| 19 | DB2HNDL | no | 14.5 | 1/2/1/2/0 | 0 | 1 | 10 | classified template (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 20 | RPTPOS00 | no | 15 | 1/3/0/2/0 | 1 | 4 | 8 | no requirement in scope is independently verified against the source |
| 21 | AUDPROC | no | 15.5 | 0/3/1/2/0 | 2 | 1 | 12 | no requirement in scope is independently verified against the source |
| 22 | FILEHNDL | no | 17 | 1/2/1/3/0 | 0 | 0 | 10 | classified template (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 23 | RTNANA00 | no | 17.5 | 0/4/0/3/0 | 2 | 1 | 10 | no requirement in scope is independently verified against the source |
| 24 | RPTAUD00 | no | 17.5 | 1/3/1/2/0 | 1 | 3 | 11 | no requirement in scope is independently verified against the source |
| 25 | RPTSTA00 | no | 17.5 | 0/2/0/4/0 | 1 | 3 | 5 | no requirement in scope is independently verified against the source |
| 26 | ERRHANDL | no | 18 | 1/4/1/0/1 | 0 | 0 | 9 | classified template (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope; depends on 1 missing source/runtime dependency |
| 27 | PORTTEST | no | 19 | 1/4/2/1/0 | 0 | 2 | 11 | classified test_tool (inferred), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 28 | BCHCTL00 | no | 19 | 0/7/0/1/0 | 3 | 4 | 12 | no requirement in scope is independently verified against the source |
| 29 | UTLVAL00 | no | 21 | 2/4/1/2/0 | 0 | 4 | 12 | classified utility (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 30 | CURSMGR | no | 21.5 | 2/5/0/3/0 | 2 | 1 | 12 | no requirement in scope is independently verified against the source |
| 31 | TSTVAL00 | no | 22 | 2/5/1/2/0 | 0 | 2 | 17 | classified test_tool (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 32 | DB2ERR | no | 25.5 | 1/8/0/2/0 | 9 | 5 | 21 | no requirement in scope is independently verified against the source |
| 33 | UTLMNT00 | no | 28 | 2/5/1/4/0 | 0 | 2 | 15 | classified utility (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 34 | ERRHNDL | no | 29 | 0/8/0/4/0 | 3 | 2 | 10 | no requirement in scope is independently verified against the source |
| 35 | INQPORT | no | 29 | 0/5/0/2/2 | 2 | 2 | 9 | no requirement in scope is independently verified against the source; depends on 2 missing source/runtime dependencies |
| 36 | UTLMON00 | no | 30 | 2/6/1/2/1 | 0 | 2 | 17 | classified utility (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope; depends on 1 missing source/runtime dependency |
| 37 | DB2STAT | no | 31 | 0/7/0/3/1 | 3 | 4 | 18 | no requirement in scope is independently verified against the source; depends on 1 missing source/runtime dependency |
| 38 | TSTGEN00 | no | 34 | 2/6/2/4/0 | 0 | 4 | 18 | classified test_tool (confirmed), not an application function; needs a signed scope decision before it can be a modernisation candidate; no requirement is in scope |
| 39 | DB2CONN | no | 37 | 0/10/0/1/2 | 6 | 4 | 20 | no requirement in scope is independently verified against the source; depends on 2 missing source/runtime dependencies |
| 40 | DB2CMT | no | 40 | 1/12/0/2/1 | 12 | 6 | 30 | no requirement in scope is independently verified against the source; depends on 1 missing source/runtime dependency |
| 41 | PORTTRAN | no | 64.5 | 0/19/2/4/1 | 14 | 5 | 33 | depends on 1 missing source/runtime dependency |
| 42 | INQONLN | no | 158 | 8/45/0/14/2 | 29 | 12 | 79 | depends on 2 missing source/runtime dependencies |

## Narrowest alternatives (requirement scopes)

| Scope | Score | Root causes (A/B/C/D/E) | Blocking |
|---|---|---|---|
| REQ-RTNCDE00-001 | 4 | 0/0/0/1/0 | 3 |
| REQ-RTNCDE00-002 | 4 | 0/0/0/1/0 | 1 |
| REQ-PORTADD-003 | 5.5 | 0/1/1/0/0 | 3 |
| REQ-PORTADD-004 | 5.5 | 0/1/1/0/0 | 3 |
| REQ-PORTDEL-002 | 5.5 | 0/1/1/0/0 | 4 |
| REQ-PORTDEL-003 | 5.5 | 0/1/1/0/0 | 4 |
| REQ-PORTDEL-004 | 5.5 | 0/1/1/0/0 | 4 |
| REQ-PORTDEL-005 | 5.5 | 0/1/1/0/0 | 4 |
| REQ-RCVPRC00-001 | 6.5 | 0/2/0/0/0 | 3 |
| REQ-RCVPRC00-002 | 6.5 | 0/2/0/0/0 | 3 |
