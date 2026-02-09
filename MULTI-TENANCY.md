# Multi-Tenancy Architecture Decision

## Overview

This document outlines the architectural decision for deploying Peninsula Accounting to multiple accounting practices.

**Decision Date:** 2026-02-09
**Decision:** Separate Supabase project per client
**Scale:** 1-5 clients expected

---

## Architecture Options Considered

### Option 1: Separate Supabase Project per Client ✅ CHOSEN

Each accounting practice gets their own:
- Dedicated Supabase project
- Dedicated database
- Dedicated Vercel deployment (or shared with env vars)
- Complete data isolation

#### Pros
- **Complete data isolation** - Critical for financial/accounting data
- **No risk of data leakage** between practices
- **Compliance friendly** - Each client's data stays separate
- **Custom configurations** - Can customize per practice if needed
- **Independent performance** - One client's load doesn't affect others
- **Simpler security model** - No complex RLS filtering needed
- **Easier to maintain** at small scale (1-5 clients)
- **Client-specific billing** - Can track costs per client easily

#### Cons
- Manual setup required per client
- Migration management across N databases
- Higher infrastructure costs (each Supabase has minimum costs)
- Can't share aggregated insights across practices
- Need to deploy updates to multiple instances

#### Best For
- **1-10 clients** (our use case)
- High-security requirements
- Financial/accounting data
- Custom client requirements

---

### Option 2: Multi-Tenant Single Database ❌ NOT CHOSEN

Single Supabase project with `practice_id` column on all tables.

#### Pros
- Single deployment, single database
- Deploy features to all clients at once
- Shared infrastructure costs
- Centralized monitoring
- Can analyze across all practices

#### Cons
- **Requires major refactoring** - Add `practice_id` to every table
- **All RLS policies need rewriting** to include practice filtering
- **Risk of data leakage** if RLS policies have bugs
- **Complex testing** required to verify cross-tenant isolation
- One bad query could slow down all tenants
- Compliance concerns with shared database

#### Best For
- **10+ clients** where separate projects become unmanageable
- SaaS products with standardized features
- Lower-security use cases

---

### Option 3: Database-per-Tenant (Postgres Schemas)

Single Supabase with separate Postgres schemas per practice.

#### Pros
- Good isolation within single infrastructure
- Centralized management

#### Cons
- Complex schema management
- Still need migration tooling across schemas
- Supabase doesn't natively support this pattern well
- More complexity than Option 1 without clear benefits at small scale

#### Best For
- Medium scale (5-15 clients) where separate projects are too many but multi-tenant is too risky

---

## Current Codebase State

The application is **NOT multi-tenant ready**. Converting to Option 2 would require:

1. Add `practice_id` column to all tables:
   - `clients`
   - `email_templates`
   - `schedules`
   - `schedule_steps`
   - `delivery_log`
   - `audit_log`
   - `filing_assignments`
   - `records_received`

2. Update all RLS policies to filter by `practice_id`

3. Add practice management:
   - `practices` table
   - Practice selection UI
   - Practice context in app state

4. Update all queries to filter by `practice_id`

5. Add onboarding flow for new practices

6. Testing infrastructure to verify tenant isolation

**Estimated effort:** Phase 4 project (2-3 weeks of work)

---

## Deployment Strategy (Separate Projects)

### Manual Setup Process

For each new accounting practice client:

1. **Create Supabase Project**
   - New project at supabase.com
   - Note project URL and anon key
   - Enable email auth

2. **Run Migrations**
   ```bash
   # Point to new project
   npx supabase link --project-ref <new-project-ref>

   # Run all migrations
   npx supabase db push
   ```

3. **Seed Data** (if needed)
   - Email templates
   - Default schedules
   - System settings

4. **Deploy to Vercel**
   - Option A: New Vercel project per client
   - Option B: Same Vercel project with client-specific env vars

5. **Configure Postmark**
   - Set up client-specific sender email
   - Or use same Postmark with different templates

6. **Set Environment Variables**
   ```
   NEXT_PUBLIC_SUPABASE_URL=<client-specific>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<client-specific>
   SUPABASE_SERVICE_ROLE_KEY=<client-specific>
   POSTMARK_SERVER_TOKEN=<shared-or-client-specific>
   ```

### Future: Automated Deployment Script

Could create `scripts/deploy-new-client.sh`:

```bash
#!/bin/bash
# Creates new Supabase project and deploys for a new client
# Usage: ./deploy-new-client.sh "Client Name"

CLIENT_NAME=$1

# 1. Create Supabase project (requires Supabase CLI with API access)
# 2. Run migrations
# 3. Seed default data
# 4. Create Vercel deployment
# 5. Set environment variables
# 6. Output setup instructions
```

---

## Cost Considerations

### Separate Projects (Current Approach)

**Per client costs:**
- Supabase: $25/month (Pro plan) or $0 (Free tier for small clients)
- Vercel: $20/month (Pro) or $0 (Hobby for small sites)
- Postmark: Shared across clients
- **Total:** ~$25-45/month per client (or $0 for small usage)

**For 3 clients:** ~$75-135/month

### Multi-Tenant (Alternative)

**Shared costs:**
- Supabase: $25/month (Pro) - single instance
- Vercel: $20/month (Pro) - single deployment
- Postmark: Shared
- **Total:** ~$45/month total

**Savings at 3 clients:** ~$30-90/month
**Break-even point:** ~2-3 clients

**Note:** Cost savings don't outweigh security/complexity risks for financial data.

---

## Migration Path (If Scaling Beyond 10 Clients)

If the client base grows significantly:

### Phase 1: Assessment
- Evaluate if separate projects are becoming unmanageable
- Assess compliance requirements
- Budget for refactoring effort

### Phase 2: Design
- Design multi-tenant schema with `practice_id`
- Plan RLS policy updates
- Design migration strategy for existing clients

### Phase 3: Implementation
- Implement multi-tenant architecture
- Build migration tools
- Extensive testing for tenant isolation

### Phase 4: Migration
- Create new multi-tenant Supabase project
- Migrate clients one-by-one
- Verify data integrity
- Update DNS/deployments

### Phase 5: Decommission
- Shut down old separate projects
- Monitor for issues

**Estimated timeline:** 2-3 months
**Estimated cost:** Significant development effort

---

## Security Considerations

### Separate Projects (Current)
- ✅ Physical data isolation
- ✅ No cross-tenant queries possible
- ✅ Simpler RLS policies
- ✅ Client data breaches are isolated
- ✅ Easier compliance audits

### Multi-Tenant
- ⚠️ Must trust RLS policies completely
- ⚠️ One RLS bug could expose all client data
- ⚠️ Complex testing required
- ⚠️ Compliance audits are more complex

For **accounting/financial data**, separate projects provide better security posture.

---

## Recommendation

**Stick with separate Supabase projects** for the foreseeable future (1-5 clients).

### Action Items
- [ ] Document the manual setup process
- [ ] Create setup checklist for new clients
- [ ] Consider creating deployment automation if beyond 3 clients
- [ ] Revisit this decision if client count exceeds 10

### Future Optimization
If managing multiple projects becomes burdensome:
1. Create automated deployment script
2. Use infrastructure-as-code (Terraform/Pulumi)
3. Consider managed multi-tenancy platforms

Only refactor to multi-tenant architecture if:
- Client count exceeds 10-15
- Complexity of managing separate projects becomes unmanageable
- Cost savings become significant enough to justify refactoring risk

---

## References

- Supabase Multi-tenancy Guide: https://supabase.com/docs/guides/platform/multi-tenancy
- Current codebase: Single-tenant by design
- Migration files: `supabase/migrations/`
- RLS policies: Defined per-table in migrations

---

**Last Updated:** 2026-02-09
**Status:** Active Decision
**Review Date:** When client count reaches 5
