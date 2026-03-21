# Upload Edge Case Test Files

Test files for QA_EDGE_CASES.md items U1–U5.

## Files

| File | Tests | Edge Case |
|------|-------|-----------|
| `u1-large-file-5mb.pdf` | U1 | Upload via portal — should this bypass validation (SHA-256, MIME, OCR)? |
| `u2-duplicate-test.pdf` | U2 | Upload twice to same client portal. 1st should succeed, 2nd should return 409. Then retry with `confirmDuplicate=true` |
| `u3-invalid-type.exe` | U3 | Should be rejected — not in allowlist (PDF, JPEG, PNG, TIFF, Word, Excel, CSV) |
| `u3-invalid-type.zip` | U3 | Should be rejected — ZIP not in allowlist |
| `u3-exe-renamed-as.pdf` | U3 | EXE binary with `.pdf` extension — tests MIME re-verification beyond extension check |
| `u4-zero-byte.pdf` | U4 | Empty file — should fail gracefully, not crash |
| `u4-zero-byte.csv` | U4 | Empty CSV — should fail gracefully |

## U5 (URL path traversal)

No file needed. Test manually by visiting:
- `/portal/<script>alert(1)</script>`
- `/portal/../../etc/passwd`
- `/portal/' OR 1=1--`

Verify these return 404 or error page, not a stack trace or injected content.
