# T-274 design review

Reviewed the existing scoped-key and recovery proposal against queue candidate 44fb79c30e5a36fc998cb4401f5bd39a6a3f81cf. The independent queue checkpoint covers the current fail-closed contract. T-274 remains design-only.

Before changing uniqueness, the release owner must approve the new contract and define how every producer and lookup identifies platform versus tenant scope. Include prefix-based automation resume lookups in the inventory. Specify empty-key compatibility and the SQLite capability check that prevents workers with incompatible binaries from starting.

Use a frozen-point comparison that enumerates the expected schema, checks foreign keys and fingerprints all expected rows. Verify same-scope deduplication, two successful cross-scope writes, repeated restore, interruption rollback and reconciliation of post-snapshot external effects. Once scoped duplicates exist, restoring the old binary alone is unsafe. Recovery must preserve those jobs and account for effects created after the snapshot.

Prepare combined verification on a separate branch with exact accepted queue paths and the bounded payment and export changes. Regenerate the manifest and run synthetic queue, payment, authenticated export and security regressions. Full verification, a current restore receipt and independent payment acceptance are release gates. No migration was written or executed.
