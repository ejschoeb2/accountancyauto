# Optimisation Candidates

Potentially redundant columns identified during QuickBooks cleanup. Investigate before removing.

| Column | Table | Issue |
|--------|-------|-------|
| `vat_frequency` | clients | 0 app code references, default 'quarterly', possibly superseded by `vat_stagger_group` |
| `has_overrides` | clients | 0 app code references, 0/49 rows are true |
| `display_name` | clients | Actively used (14 files) but 39% null — check if redundant with `company_name` |
| `phone` | clients | 59% populated, came from QB sync. Check if UI exposes it |
