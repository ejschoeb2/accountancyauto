# Requirements: Peninsula Accounting v3.0 — Inbound Email Intelligence

**Defined:** 2026-02-13
**Core Value:** Close the feedback loop — when clients reply to reminders, the system reads, classifies, and acts on their responses automatically.

## v3.0 Requirements

### Inbound Processing

- [ ] **INBD-01**: System receives client reply emails via Postmark inbound webhook
- [ ] **INBD-02**: Reply-To address encodes client ID and filing type using cryptographic tokens (VERP-style)
- [ ] **INBD-03**: Webhook validates authenticity via Basic HTTP Auth and header verification
- [ ] **INBD-04**: System detects and ignores auto-generated emails (Auto-Submitted header) to prevent loops
- [ ] **INBD-05**: Inbound emails stored in database with sender, subject, body, and decoded context

### AI Classification

- [ ] **AICL-01**: AI classifies reply intent into 7 accounting-specific categories (Paperwork Sent, Question, Extension Request, Can't Find Records, Accountant Not Needed, Out of Office, Unclear)
- [ ] **AICL-02**: Each classification includes confidence score (HIGH 90%+, MEDIUM 60-89%, LOW <60%)
- [ ] **AICL-03**: Classification uses Claude Haiku 4.5 with structured outputs for guaranteed schema compliance
- [ ] **AICL-04**: Out-of-office replies detected and excluded from review queue

### Auto-Actions

- [ ] **AUTO-01**: High-confidence "Paperwork Sent" replies (90%+) automatically mark filing as records received
- [ ] **AUTO-02**: Auto-actions logged in audit trail with AI classification details
- [ ] **AUTO-03**: Auto-action system can be enabled/disabled via toggle in settings page
- [ ] **AUTO-04**: Auto-action settings configurable during onboarding setup wizard

### Review & Visibility

- [ ] **REVW-01**: Human review queue shows all replies below 90% confidence for accountant classification
- [ ] **REVW-02**: Accountant can manually override AI classification with correct intent
- [ ] **REVW-03**: Full email content (body, subject, sender, date) visible in dashboard
- [ ] **REVW-04**: Reply log shows chronological list of all inbound emails per client
- [ ] **REVW-05**: Review queue shows badge count in navigation

## Future Requirements (v3.1+)

### Communication

- **COMM-01**: Accountant can reply to clients from within the dashboard (two-way email)
- **COMM-02**: Email threading groups related messages into conversations

### Automation

- **AUTM-01**: Auto-pause reminder sequence on high-confidence "Accountant Not Needed" intent
- **AUTM-02**: AI generates suggested response drafts for common scenarios

### Analytics

- **ANLY-01**: Reply statistics per filing type (response rates, intent distribution)
- **ANLY-02**: Batch review interface for classifying multiple replies at once

## Out of Scope

| Feature | Reason |
|---------|--------|
| Attachment processing/OCR | Text classification only for v3.0; adds scope creep |
| Fully automated replies (no human review) | Accounting is regulated; mistakes damage client relationships |
| Custom ML model training | Modern LLMs handle accounting context; insufficient training data |
| Sentiment analysis | Adds complexity without clear action; accountants read tone from content |
| Real-time re-classification on page load | Expensive; classify once on receipt, store result |
| Complex chatbot conversation flows | Clients prefer human contact; over-automation feels impersonal |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INBD-01 | Phase 10 | Pending |
| INBD-02 | Phase 10 | Pending |
| INBD-03 | Phase 10 | Pending |
| INBD-04 | Phase 10 | Pending |
| INBD-05 | Phase 10 | Pending |
| AICL-01 | Phase 11 | Pending |
| AICL-02 | Phase 11 | Pending |
| AICL-03 | Phase 11 | Pending |
| AICL-04 | Phase 11 | Pending |
| AUTO-01 | Phase 13 | Pending |
| AUTO-02 | Phase 13 | Pending |
| AUTO-03 | Phase 13 | Pending |
| AUTO-04 | Phase 13 | Pending |
| REVW-01 | Phase 12 | Pending |
| REVW-02 | Phase 12 | Pending |
| REVW-03 | Phase 12 | Pending |
| REVW-04 | Phase 12 | Pending |
| REVW-05 | Phase 12 | Pending |

**Coverage:**
- v3.0 requirements: 18 total
- Mapped to phases: 18/18 (100%)
- Unmapped: 0

**Phase distribution:**
- Phase 10 (Inbound Email Infrastructure): 5 requirements
- Phase 11 (AI Classification Engine): 4 requirements
- Phase 12 (Accountant Review Interface): 5 requirements
- Phase 13 (Auto-Action System): 4 requirements

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 after roadmap creation*
