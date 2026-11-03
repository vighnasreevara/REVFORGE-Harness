# BMad integration (staged, not installed)

This directory holds a pinned BMad release (`bmad-method@6.12.4`) staged for the forward harness, plus its bindings to the forward agents.

- `release.pin.json`: the pinned release and the sha256 of every staged file.
- `workflow-registry.json`: the verified workflow catalogue.
- `bindings.json`: which BMad workflow maps to which forward agent, and the gates each one needs.
- `mapping.json`: the versioned mapping from REVFORGE inputs to BMad inputs.
- `staging/`: the npm tarball and its extracted package. Git-ignored; reproducible from the pin.

Operations: [forward/docs/BMAD-INTEGRATION-OPERATIONS.md](../../docs/BMAD-INTEGRATION-OPERATIONS.md).
