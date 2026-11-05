# Backup and recovery

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** can the project, including the git-ignored local assets, be backed up and restored, and was each restore verified? The tool is `forward/tools/backup.js`. Its exclusion policy is tested in `forward/tests/dashboard-backup-exclusion-policy.test.ts` and `evidence-adjudication-and-backup-recovery.test.ts`.

## Reports

| Report | What it records about recovery |
|---|---|
| [STEP-10](../STEP-10-REPORT.md) | the first recoverable backup and restore test |
| [STEP-11](../STEP-11-REPORT.md) | recovery completeness (code only, and code with local assets) |
| [Git regression stabilization](../GIT-REGRESSION-STABILIZATION.md) | backup compatibility after the forward tree was committed |
| [STEP-24 dashboard assessment](../STEP-24-DASHBOARD-ASSESSMENT.md) and [STEP-25 handover](../STEP-25-FINAL-HANDOVER-ASSESSMENT.md) | exclusion policy 2 (the dashboard's reproducible output) |

## Evidence, in chronological order

- [`step-9/recovery-manifest.json`](../step-9/recovery-manifest.json)
- [`step-10/backup-create.json`](../step-10/backup-create.json) and [`step-10/restore-test.json`](../step-10/restore-test.json)
- [`step-11/recovery/`](../step-11/recovery/), [`step-12/recovery/`](../step-12/recovery/), [`step-14/recovery/`](../step-14/recovery/), [`step-15/recovery/`](../step-15/recovery/): backup creation, verification and checkout restores at each step
- [`git-stabilization/backup-create.json`](../git-stabilization/backup-create.json), [`backup-restore-test.json`](../git-stabilization/backup-restore-test.json), [`backup-compatibility.json`](../git-stabilization/backup-compatibility.json)

**Path used by:** `forward/tools/recovery-manifest.js` and `forward/tests/dashboard-backup-exclusion-policy.test.ts` (`step-9`). `backup.js` itself excludes `forward/reports/step-*/` and the top-level report JSON files from archives.

**Related topics:** [source integrity](source-integrity-and-traceability.md) · [engineering handover](engineering-handover-and-quality.md)
