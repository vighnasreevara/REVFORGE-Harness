# Security and authorization

## Restricted and local-only material

| Material | Where | In Git | Why |
|---|---|---|---|
| Original COBOL source | `references/` (configured with `REVFORGE_COBOL_SOURCE_ROOT`) | no (`.gitignore`) | restricted third-party source; see `THIRD_PARTY_NOTICES.md` |
| Generated Java | `forward/generated/` | no | derived from protected source; local authorizations only |
| Workflow run records | `forward/runs/` | no (only `.gitkeep`) | sensitive records: approvals, packets, BMad records |
| Neo4j credentials | `.mcp.json` | no | credentials; a template is in `.mcp.json.example` |
| Local settings | `.claude/settings.local.json`, `.env` | no | machine-specific |
| BMad executor installation | `forward/integrations/bmad/executor/` | no | provisioned per machine |
| Dashboard output | `forward/dashboard/node_modules`, `dist`, `public/evidence` | no | reproducible |

The STEP-25 audit checks that none of these is tracked (`repository-integrity.json` → `no_forbidden_tracked`), and that no committed file matches a secret pattern (the backup tool's scan).

## Authorization model

| Authorization | Contract | Status |
|---|---|---|
| G2/G3/G4 human approvals | Ed25519-signed approval statements, verified against `REVFORGE_APPROVAL_TRUST_STORE` | no trust store configured; none recorded |
| Business decision resolutions | signed resolutions (`workflow decisions resolve`) | none recorded |
| Java generation through the workflow | `generation.java_generation_allowed` + G4 PASS + BMad stages to sprint | `false` |
| Historical local generation | program-scoped `LGA-*` records, source hashes bound | 41 programs; `LOCAL_LGA_NOT_BMAD_GOVERNED`; new ones need BMad evidence |
| Disclosure to Claude (BMad) | `ai-disclosure-authorization`, signed by the data owner | ADA-8154d6398d4d unsigned; expires 2026-11-06T20:45:24Z |
| Source export to OpenAI | `signed-source-export-authorization` (OpenAI only) | 0 recorded; network disabled; never run live |

Every authorization fails closed. An unsigned, expired or mismatching record authorizes nothing, and no tool in the repository can mark one as signed.

## Data handling rules

- No source is sent to an external service unless a signed authorization covers the exact files, provider, workflow and limits. Nothing has been sent.
- Reports and the dashboard reference COBOL paths, hashes and permanent IDs. Some committed reports quote short statement excerpts, which is why the backup excludes report exports.
- The dashboard runs under a Content-Security-Policy with same-origin requests only, no telemetry and no CDNs, and renders Mermaid in strict mode.
- Backups (`forward/tools/backup.js`) are code-only and local. They exclude run records, generated Java, original COBOL, credentials, report exports and reproducible dashboard output (exclusion policy 2), and refuse to run if a committed file contains a secret pattern.
