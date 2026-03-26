/**
 * Seed demo data for recording the full library of 56 demo videos.
 *
 * Creates a demo user, organisation, clients (diverse statuses),
 * filing assignments, email templates, schedules, email logs,
 * reminder queue entries, client documents, portal tokens, and
 * app_settings needed for a comprehensive demo environment.
 *
 * Idempotent: checks for existing data before inserting.
 * Run via: npx tsx scripts/demo/seed-demo-data.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import crypto from "crypto";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// ─── Config ────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_EMAIL = process.env.DEMO_EMAIL || "test@example.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "password123";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── TipTap helpers ────────────────────────────────────────────────────────

function doc(...content: any[]) {
  return { type: "doc", content };
}

function paragraph(...content: any[]) {
  return { type: "paragraph", content };
}

function text(value: string, marks?: any[]) {
  const node: any = { type: "text", text: value };
  if (marks) node.marks = marks;
  return node;
}

function bold(value: string) {
  return text(value, [{ type: "bold" }]);
}

function placeholder(id: string, label: string) {
  return { type: "placeholder", attrs: { id, label } };
}

function emptyParagraph() {
  return { type: "paragraph" };
}

// ─── Date helpers ──────────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("=== Seeding Demo Data ===\n");

  // ── 1. Demo user & org ──────────────────────────────────────────────────

  console.log("1. Creating demo user and organisation...");

  // Check for existing user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let userId =
    existingUsers?.users?.find((u) => u.email === DEMO_EMAIL)?.id ?? null;

  if (!userId) {
    const { data: newUser, error: userError } =
      await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    if (userError) {
      console.error("  Failed to create user:", userError.message);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log(`  + Created user: ${DEMO_EMAIL} (${userId})`);
  } else {
    console.log(`  ~ User already exists: ${DEMO_EMAIL} (${userId})`);
  }

  // Organisation
  const ORG_SLUG = "thornton-associates";
  const { data: existingOrg } = await supabase
    .from("organisations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  let orgId: string;

  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`  ~ Organisation already exists: ${ORG_SLUG} (${orgId})`);
  } else {
    const { data: newOrg, error: orgError } = await supabase
      .from("organisations")
      .insert({
        name: "Thornton & Associates",
        slug: ORG_SLUG,
        plan_tier: "firm",
        subscription_status: "active",
        client_portal_enabled: true,
      })
      .select("id")
      .single();
    if (orgError) {
      console.error("  Failed to create org:", orgError.message);
      process.exit(1);
    }
    orgId = newOrg.id;
    console.log(`  + Created organisation: Thornton & Associates (${orgId})`);
  }

  // Link user to org
  const { data: existingLink } = await supabase
    .from("user_organisations")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!existingLink) {
    await supabase
      .from("user_organisations")
      .insert({ user_id: userId, org_id: orgId, role: "admin" });
    console.log("  + Linked user to org as admin");
  } else {
    console.log("  ~ User already linked to org");
  }

  // ── 1b. Team members (real auth users) ────────────────────────────────

  console.log("\n1b. Creating team member users...");

  const teamMemberDefs = [
    {
      email: "james.wilson@thornton-associates.co.uk",
      password: DEMO_PASSWORD,
      fullName: "James Wilson",
      role: "member" as const,
    },
    {
      email: "sophie.chen@thornton-associates.co.uk",
      password: DEMO_PASSWORD,
      fullName: "Sophie Chen",
      role: "admin" as const,
    },
  ];

  const teamMemberIds: Record<string, string> = {};

  for (const member of teamMemberDefs) {
    // Check if user already exists
    let memberId: string | null = null;
    const existing = existingUsers?.users?.find((u) => u.email === member.email);

    if (existing) {
      memberId = existing.id;
      console.log(`  ~ Team member ${member.email} already exists (${memberId})`);
    } else {
      const { data: newMember, error: memberError } =
        await supabase.auth.admin.createUser({
          email: member.email,
          password: member.password,
          email_confirm: true,
          user_metadata: { full_name: member.fullName },
        });
      if (memberError) {
        console.error(
          `  Failed to create team member ${member.email}:`,
          memberError.message
        );
        continue;
      }
      memberId = newMember.user.id;
      console.log(`  + Created team member: ${member.email} (${memberId})`);
    }

    teamMemberIds[member.email] = memberId;

    // Link team member to org
    const { data: existingMemberLink } = await supabase
      .from("user_organisations")
      .select("id")
      .eq("user_id", memberId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!existingMemberLink) {
      await supabase
        .from("user_organisations")
        .insert({ user_id: memberId, org_id: orgId, role: member.role });
      console.log(`  + Linked ${member.fullName} to org as ${member.role}`);
    } else {
      console.log(`  ~ ${member.fullName} already linked to org`);
    }
  }

  // ── 2. Clients ──────────────────────────────────────────────────────────

  console.log("\n2. Creating clients...");

  interface ClientDef {
    company_name: string;
    display_name: string | null;
    primary_email: string;
    client_type: "Limited Company" | "LLP" | "Partnership" | "Individual";
    year_end_date: string;
    vat_registered: boolean;
    vat_stagger_group: 1 | 2 | 3 | null;
    vat_scheme: "Standard" | "Flat Rate" | "Cash Accounting" | "Annual Accounting" | null;
    reminders_paused: boolean;
    records_received_for: string[];
    completed_for: string[];
  }

  const clientDefs: ClientDef[] = [
    // OVERDUE clients (deadline passed, not completed)
    {
      company_name: "Hartley Construction Ltd",
      display_name: "Hartley Construction",
      primary_email: "accounts@hartleyconstruction.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysAgo(300), // year end ~10 months ago => corp tax due ~2 months ago
      vat_registered: true,
      vat_stagger_group: 1 as const,
      vat_scheme: "Standard" as const,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "Midlands Electrical Services Ltd",
      display_name: "Midlands Electrical",
      primary_email: "info@midlandselectrical.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysAgo(320),
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "J. Singh & Partners",
      display_name: null,
      primary_email: "jsingh@singhpartners.co.uk",
      client_type: "Partnership" as const,
      year_end_date: "2025-04-05",
      vat_registered: true,
      vat_stagger_group: 2 as const,
      vat_scheme: "Flat Rate" as const,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    // APPROACHING clients (deadline within 30 days)
    {
      company_name: "Brighton Digital LLP",
      display_name: "Brighton Digital",
      primary_email: "hello@brightondigital.co.uk",
      client_type: "LLP" as const,
      year_end_date: daysFromNow(-260), // year end ~8.5 months ago => CH deadline in ~15 days
      vat_registered: true,
      vat_stagger_group: 3 as const,
      vat_scheme: "Cash Accounting" as const,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "Oakwood Property Management Ltd",
      display_name: "Oakwood Properties",
      primary_email: "finance@oakwoodpm.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysFromNow(-250),
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: ["corporation_tax_payment"] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "Sarah Mitchell",
      display_name: null,
      primary_email: "sarah.mitchell@gmail.com",
      client_type: "Individual" as const,
      year_end_date: "2025-04-05",
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    // ON TRACK clients (deadline > 30 days away)
    {
      company_name: "Thames Valley Consulting Ltd",
      display_name: "Thames Valley Consulting",
      primary_email: "admin@thamesvalley.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysFromNow(-60), // year end 2 months ago => deadlines well in future
      vat_registered: true,
      vat_stagger_group: 1 as const,
      vat_scheme: "Standard" as const,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "Northern Logistics Group Ltd",
      display_name: "Northern Logistics",
      primary_email: "accounts@northernlogistics.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysFromNow(-30),
      vat_registered: true,
      vat_stagger_group: 2 as const,
      vat_scheme: "Annual Accounting" as const,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    {
      company_name: "David Chen",
      display_name: null,
      primary_email: "david.chen@outlook.com",
      client_type: "Individual" as const,
      year_end_date: "2025-04-05",
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
    // COMPLETED clients (filings marked complete)
    {
      company_name: "Greenfield Architects Ltd",
      display_name: "Greenfield Architects",
      primary_email: "office@greenfieldarch.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysAgo(400),
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: [
        "corporation_tax_payment",
        "ct600_filing",
        "companies_house",
      ] as string[],
      completed_for: [
        "corporation_tax_payment",
        "ct600_filing",
        "companies_house",
      ] as string[],
    },
    {
      company_name: "Emma Richardson",
      display_name: null,
      primary_email: "emma.richardson@hotmail.co.uk",
      client_type: "Individual" as const,
      year_end_date: "2025-04-05",
      vat_registered: false,
      vat_stagger_group: null,
      vat_scheme: null,
      reminders_paused: false,
      records_received_for: ["self_assessment"] as string[],
      completed_for: ["self_assessment"] as string[],
    },
    // RECORDS RECEIVED (violet status) - records in but not completed
    {
      company_name: "Coastal Catering Services LLP",
      display_name: "Coastal Catering",
      primary_email: "bookkeeping@coastalcatering.co.uk",
      client_type: "LLP" as const,
      year_end_date: daysAgo(200),
      vat_registered: true,
      vat_stagger_group: 1 as const,
      vat_scheme: "Standard" as const,
      reminders_paused: false,
      records_received_for: [
        "corporation_tax_payment",
        "ct600_filing",
      ] as string[],
      completed_for: [] as string[],
    },
    // PAUSED client
    {
      company_name: "Westbury Retail Group Ltd",
      display_name: "Westbury Retail",
      primary_email: "finance@westburyretail.co.uk",
      client_type: "Limited Company" as const,
      year_end_date: daysAgo(180),
      vat_registered: true,
      vat_stagger_group: 3 as const,
      vat_scheme: "Standard" as const,
      reminders_paused: true,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    },
  ];

  // ── Filler clients (pad to ~50 total) ─────────────────────────────────
  // These give the table a realistic size for demos like search, filter,
  // bulk-delete, CSV import, and the workload forecast chart.

  const fillerNames: Array<{
    company_name: string;
    display_name: string | null;
    client_type: "Limited Company" | "LLP" | "Partnership" | "Individual";
    vat_registered: boolean;
    vat_stagger_group: 1 | 2 | 3 | null;
    vat_scheme: "Standard" | "Flat Rate" | "Cash Accounting" | "Annual Accounting" | null;
    year_end_offset: number; // days ago for year_end_date
  }> = [
    { company_name: "Archer & Lane Solicitors LLP", display_name: "Archer & Lane", client_type: "LLP", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 90 },
    { company_name: "Beacon Software Ltd", display_name: "Beacon Software", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 150 },
    { company_name: "Castlegate Ventures Ltd", display_name: "Castlegate Ventures", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 200 },
    { company_name: "Diana Frost", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Eclipse Design Studio Ltd", display_name: "Eclipse Design", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Flat Rate", year_end_offset: 120 },
    { company_name: "Fenwick & Partners", display_name: null, client_type: "Partnership", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 0 },
    { company_name: "Granville Hotels Ltd", display_name: "Granville Hotels", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 280 },
    { company_name: "Harper & Webb Accountants LLP", display_name: "Harper & Webb", client_type: "LLP", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Cash Accounting", year_end_offset: 45 },
    { company_name: "Ironbridge Manufacturing Ltd", display_name: "Ironbridge Manufacturing", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 330 },
    { company_name: "James Thornton", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Kingsway Logistics Ltd", display_name: "Kingsway Logistics", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Annual Accounting", year_end_offset: 75 },
    { company_name: "Lakeside Dental Practice Ltd", display_name: "Lakeside Dental", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 210 },
    { company_name: "Morgan & Clarke", display_name: null, client_type: "Partnership", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Northstar IT Solutions Ltd", display_name: "Northstar IT", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Standard", year_end_offset: 160 },
    { company_name: "Orchard Farm Supplies Ltd", display_name: "Orchard Farm", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Flat Rate", year_end_offset: 240 },
    { company_name: "Patricia Hammond", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Queensgate Recruitment Ltd", display_name: "Queensgate Recruitment", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 100 },
    { company_name: "Redwood Financial Planning LLP", display_name: "Redwood Financial", client_type: "LLP", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 55 },
    { company_name: "Summit Engineering Ltd", display_name: "Summit Engineering", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Standard", year_end_offset: 190 },
    { company_name: "Thomas Whitfield", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Unity Care Services Ltd", display_name: "Unity Care", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 270 },
    { company_name: "Victoria Chambers Ltd", display_name: "Victoria Chambers", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 140 },
    { company_name: "Whitmore & Sons Ltd", display_name: "Whitmore & Sons", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Cash Accounting", year_end_offset: 310 },
    { company_name: "Xavier Consulting Ltd", display_name: "Xavier Consulting", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 60 },
    { company_name: "York & District Builders LLP", display_name: "York Builders", client_type: "LLP", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Standard", year_end_offset: 225 },
    { company_name: "Zenith Electrical Contractors Ltd", display_name: "Zenith Electrical", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 175 },
    { company_name: "Ashford Wealth Management Ltd", display_name: "Ashford Wealth", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 85 },
    { company_name: "Bridgewater Plastics Ltd", display_name: "Bridgewater Plastics", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Flat Rate", year_end_offset: 260 },
    { company_name: "Croft & Baines", display_name: null, client_type: "Partnership", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 0 },
    { company_name: "Dominic Patel", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Elmswood Veterinary Group Ltd", display_name: "Elmswood Vets", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 130 },
    { company_name: "Foxglove Events Ltd", display_name: "Foxglove Events", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 295 },
    { company_name: "Glendale Transport Ltd", display_name: "Glendale Transport", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 3, vat_scheme: "Annual Accounting", year_end_offset: 110 },
    { company_name: "Hannah Brooks", display_name: null, client_type: "Individual", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 0 },
    { company_name: "Ivybridge Consulting LLP", display_name: "Ivybridge Consulting", client_type: "LLP", vat_registered: true, vat_stagger_group: 1, vat_scheme: "Standard", year_end_offset: 170 },
    { company_name: "Jubilee Catering Ltd", display_name: "Jubilee Catering", client_type: "Limited Company", vat_registered: true, vat_stagger_group: 2, vat_scheme: "Standard", year_end_offset: 50 },
    { company_name: "Kestrel Print Solutions Ltd", display_name: "Kestrel Print", client_type: "Limited Company", vat_registered: false, vat_stagger_group: null, vat_scheme: null, year_end_offset: 340 },
  ];

  for (const filler of fillerNames) {
    const yearEnd = filler.client_type === "Individual" || filler.client_type === "Partnership"
      ? "2025-04-05"
      : daysAgo(filler.year_end_offset);

    clientDefs.push({
      company_name: filler.company_name,
      display_name: filler.display_name,
      primary_email: `demo+${filler.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
      client_type: filler.client_type,
      year_end_date: yearEnd,
      vat_registered: filler.vat_registered,
      vat_stagger_group: filler.vat_stagger_group,
      vat_scheme: filler.vat_scheme,
      reminders_paused: false,
      records_received_for: [] as string[],
      completed_for: [] as string[],
    });
  }

  console.log(`  Total clients to seed: ${clientDefs.length}`);

  const clientIds: Record<string, string> = {};

  for (const def of clientDefs) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("company_name", def.company_name)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing) {
      clientIds[def.company_name] = existing.id;
      console.log(`  ~ ${def.company_name} (exists)`);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("clients")
      .insert({
        ...def,
        org_id: orgId,
        owner_id: userId,
        active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  Error creating ${def.company_name}:`, error.message);
      continue;
    }

    clientIds[def.company_name] = inserted.id;
    console.log(`  + ${def.company_name}`);
  }

  // ── 3. Filing assignments ───────────────────────────────────────────────

  console.log("\n3. Creating filing assignments...");

  // Map of client type to applicable filing types
  const filingsByType: Record<string, string[]> = {
    "Limited Company": [
      "corporation_tax_payment",
      "ct600_filing",
      "companies_house",
    ],
    LLP: ["corporation_tax_payment", "ct600_filing", "companies_house"],
    Partnership: ["partnership_tax_return"],
    Individual: ["self_assessment"],
  };

  const vatFilingType = "vat_return";
  let assignmentCount = 0;

  for (const def of clientDefs) {
    const clientId = clientIds[def.company_name];
    if (!clientId) continue;

    const filingTypes = [...(filingsByType[def.client_type] || [])];
    if (def.vat_registered) filingTypes.push(vatFilingType);

    for (const ftId of filingTypes) {
      const { error } = await supabase.from("client_filing_assignments").upsert(
        {
          org_id: orgId,
          client_id: clientId,
          filing_type_id: ftId,
          is_active: true,
        },
        { onConflict: "client_id,filing_type_id" }
      );
      if (!error) assignmentCount++;
    }
  }

  console.log(`  + Created/updated ${assignmentCount} filing assignments`);

  // ── 3b. Deadline overrides for a few clients ────────────────────────────

  console.log("\n3b. Creating deadline overrides...");

  const overrideDefs = [
    {
      clientName: "Oakwood Property Management Ltd",
      filing_type_id: "corporation_tax_payment",
      override_date: daysFromNow(10),
      reason: "HMRC agreed extension due to flood damage",
    },
    {
      clientName: "Brighton Digital LLP",
      filing_type_id: "companies_house",
      override_date: daysFromNow(20),
      reason: "Filed extension request with Companies House",
    },
  ];

  for (const ov of overrideDefs) {
    const clientId = clientIds[ov.clientName];
    if (!clientId) continue;

    await supabase.from("client_deadline_overrides").upsert(
      {
        org_id: orgId,
        client_id: clientId,
        filing_type_id: ov.filing_type_id,
        override_date: ov.override_date,
        reason: ov.reason,
      },
      { onConflict: "client_id,filing_type_id" }
    );
    console.log(`  + Override: ${ov.clientName} / ${ov.filing_type_id}`);
  }

  // ── 4. Org filing type selections ───────────────────────────────────────

  console.log("\n4. Activating filing types for org...");

  const activeFilingTypes = [
    "corporation_tax_payment",
    "ct600_filing",
    "companies_house",
    "vat_return",
    "self_assessment",
    "partnership_tax_return",
  ];

  for (const ftId of activeFilingTypes) {
    await supabase.from("org_filing_type_selections").upsert(
      {
        org_id: orgId,
        filing_type_id: ftId,
        is_active: true,
      },
      { onConflict: "org_id,filing_type_id" }
    );
  }
  console.log(
    `  + Activated ${activeFilingTypes.length} filing types for org`
  );

  // ── 5. Email templates ──────────────────────────────────────────────────

  console.log("\n5. Creating email templates...");

  const templateDefs = [
    {
      name: "Friendly First Reminder",
      subject:
        "{{filing_type}} — deadline approaching for {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "I hope this email finds you well. This is a friendly reminder that your "
          ),
          bold("{{filing_type}}"),
          text(" deadline is on "),
          bold("{{deadline}}"),
          text(" ("),
          placeholder("days_until_deadline", "Days Until Deadline"),
          text(" days from now).")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "To ensure everything is submitted on time, please send across any outstanding records or documents at your earliest convenience. If you have already done so, please disregard this message."
          )
        ),
        emptyParagraph(),
        paragraph(
          text(
            "If you have any questions, please don't hesitate to get in touch."
          )
        ),
        emptyParagraph(),
        paragraph(text("Kind regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "Follow-Up Reminder",
      subject:
        "Action needed: {{filing_type}} due {{deadline_short}} — {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "Further to our previous correspondence, I wanted to follow up regarding your "
          ),
          bold("{{filing_type}}"),
          text(" which is due on "),
          bold("{{deadline}}"),
          text(". This is now just "),
          placeholder("days_until_deadline", "Days Until Deadline"),
          text(" days away.")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "We still require the following to complete your filing on time:"
          )
        ),
        paragraph(text("- Any outstanding invoices and receipts")),
        paragraph(text("- Bank statements for the relevant period")),
        paragraph(text("- Details of any significant transactions")),
        emptyParagraph(),
        paragraph(
          bold("Please send these through as soon as possible"),
          text(
            " to allow us adequate time to prepare and submit your return before the deadline."
          )
        ),
        emptyParagraph(),
        paragraph(text("Many thanks,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "Urgent Final Notice",
      subject:
        "URGENT: {{filing_type}} deadline in {{days_until_deadline}} days — {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          bold("This is an urgent reminder"),
          text(" that your "),
          bold("{{filing_type}}"),
          text(" deadline is on "),
          bold("{{deadline}}"),
          text(" — only "),
          bold("{{days_until_deadline}} days away"),
          text(".")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "Late filing or payment may result in penalties and interest charges from HMRC. To avoid this, we need to receive any outstanding information "
          ),
          bold("immediately"),
          text(".")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "If there are any circumstances preventing you from providing the required documents, please contact us today so we can discuss your options."
          )
        ),
        emptyParagraph(),
        paragraph(text("Regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "VAT Return Prompt",
      subject:
        "VAT Return due {{deadline_short}} — records needed for {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text("Your "),
          bold("VAT Return"),
          text(" is due for submission and payment by "),
          bold("{{deadline}}"),
          text(". We have "),
          placeholder("days_until_deadline", "Days Until Deadline"),
          text(" days to get this filed.")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "Please ensure we have the following for the quarter:"
          )
        ),
        paragraph(text("- All sales invoices issued")),
        paragraph(text("- All purchase invoices and receipts")),
        paragraph(text("- Bank statements covering the VAT period")),
        emptyParagraph(),
        paragraph(text("Best regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "Self Assessment Nudge",
      subject:
        "Self Assessment tax return — {{days_until_deadline}} days left for {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text("The "),
          bold("Self Assessment"),
          text(" deadline of "),
          bold("{{deadline}}"),
          text(" is approaching. You have "),
          placeholder("days_until_deadline", "Days Until Deadline"),
          text(" days remaining.")
        ),
        emptyParagraph(),
        paragraph(text("To prepare your tax return, we'll need:")),
        paragraph(text("- P60 / P45 from any employment")),
        paragraph(text("- Self-employment income and expenses")),
        paragraph(text("- Rental income details (if applicable)")),
        paragraph(text("- Dividend vouchers and investment income")),
        emptyParagraph(),
        paragraph(text("Warm regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "Companies House Reminder",
      subject:
        "Companies House accounts due {{deadline_short}} — {{client_name}}",
      is_active: true,
      is_custom: false,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text("This is a reminder that your "),
          bold("Companies House annual accounts"),
          text(" are due for filing by "),
          bold("{{deadline}}"),
          text(". There are "),
          placeholder("days_until_deadline", "Days Until Deadline"),
          text(" days remaining.")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "Late filing with Companies House incurs automatic penalties starting at "
          ),
          bold("\u00a3150"),
          text(
            " and increasing over time. Please ensure all year-end information has been provided."
          )
        ),
        emptyParagraph(),
        paragraph(text("Kind regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    // Custom templates
    {
      name: "Year-End Pack Request",
      subject:
        "Year-end documents needed — {{client_name}}",
      is_active: true,
      is_custom: true,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "As your year end has now passed, we would like to begin preparing your accounts. Could you please provide us with the following:"
          )
        ),
        emptyParagraph(),
        paragraph(text("- Trial balance or management accounts")),
        paragraph(text("- Bank statements for the full year")),
        paragraph(text("- Fixed asset additions and disposals")),
        paragraph(text("- Loan statements")),
        paragraph(text("- Payroll summaries")),
        emptyParagraph(),
        paragraph(
          text(
            "If you use cloud accounting software, please ensure we have access."
          )
        ),
        emptyParagraph(),
        paragraph(text("Best regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
    {
      name: "Payroll Year-End Notice",
      subject:
        "Payroll year-end — action required for {{client_name}}",
      is_active: true,
      is_custom: true,
      body_json: doc(
        paragraph(
          text("Dear "),
          placeholder("client_name", "Client Name"),
          text(",")
        ),
        emptyParagraph(),
        paragraph(
          text(
            "The payroll year end is approaching. Please ensure all employee details are up to date and confirm any benefits in kind for P11D reporting."
          )
        ),
        emptyParagraph(),
        paragraph(
          text(
            "We will need final confirmation of any changes to salaries or directors' remuneration by the end of the month."
          )
        ),
        emptyParagraph(),
        paragraph(text("Regards,")),
        paragraph(placeholder("accountant_name", "Accountant Name"))
      ),
    },
  ];

  const templateMap = new Map<string, string>();

  for (const tmpl of templateDefs) {
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id")
      .eq("name", tmpl.name)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing) {
      templateMap.set(tmpl.name, existing.id);
      console.log(`  ~ ${tmpl.name} (exists)`);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("email_templates")
      .insert({
        ...tmpl,
        org_id: orgId,
        owner_id: userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  Error creating template "${tmpl.name}":`, error.message);
      continue;
    }

    templateMap.set(tmpl.name, inserted.id);
    console.log(`  + ${tmpl.name}`);
  }

  // ── 6. Schedules & steps ────────────────────────────────────────────────

  console.log("\n6. Creating schedules and steps...");

  const scheduleDefs = [
    {
      filing_type_id: "corporation_tax_payment",
      name: "Corporation Tax Payment Reminders",
      description:
        "Standard 3-step reminder sequence for Corporation Tax payment deadlines",
      schedule_type: "filing",
      steps: [
        { template_name: "Friendly First Reminder", delay_days: 30 },
        { template_name: "Follow-Up Reminder", delay_days: 14 },
        { template_name: "Urgent Final Notice", delay_days: 7 },
      ],
    },
    {
      filing_type_id: "ct600_filing",
      name: "CT600 Filing Reminders",
      description:
        "Reminder sequence for CT600 Corporation Tax return filing",
      schedule_type: "filing",
      steps: [
        { template_name: "Friendly First Reminder", delay_days: 30 },
        { template_name: "Follow-Up Reminder", delay_days: 14 },
        { template_name: "Urgent Final Notice", delay_days: 7 },
      ],
    },
    {
      filing_type_id: "companies_house",
      name: "Companies House Accounts Reminders",
      description:
        "Reminder sequence for annual accounts filing at Companies House",
      schedule_type: "filing",
      steps: [
        { template_name: "Companies House Reminder", delay_days: 30 },
        { template_name: "Follow-Up Reminder", delay_days: 14 },
        { template_name: "Urgent Final Notice", delay_days: 7 },
      ],
    },
    {
      filing_type_id: "vat_return",
      name: "VAT Return Quarterly Reminders",
      description: "Two-step reminder for quarterly VAT return submissions",
      schedule_type: "filing",
      steps: [
        { template_name: "VAT Return Prompt", delay_days: 14 },
        { template_name: "Urgent Final Notice", delay_days: 5 },
      ],
    },
    {
      filing_type_id: "self_assessment",
      name: "Self Assessment Annual Reminders",
      description:
        "Three-step reminder for annual Self Assessment tax returns",
      schedule_type: "filing",
      steps: [
        { template_name: "Self Assessment Nudge", delay_days: 60 },
        { template_name: "Follow-Up Reminder", delay_days: 21 },
        { template_name: "Urgent Final Notice", delay_days: 7 },
      ],
    },
    {
      filing_type_id: "partnership_tax_return",
      name: "Partnership Tax Return Reminders",
      description: "Reminder sequence for partnership tax returns",
      schedule_type: "filing",
      steps: [
        { template_name: "Friendly First Reminder", delay_days: 30 },
        { template_name: "Follow-Up Reminder", delay_days: 14 },
        { template_name: "Urgent Final Notice", delay_days: 7 },
      ],
    },
    // Custom schedule
    {
      filing_type_id: null as string | null,
      name: "Payroll Year-End Pack",
      description:
        "Custom schedule for collecting payroll year-end information",
      schedule_type: "custom",
      custom_date: "2027-04-05",
      recurrence_rule: "annually" as const,
      recurrence_anchor: "2027-04-05",
      steps: [
        { template_name: "Payroll Year-End Notice", delay_days: 30 },
        { template_name: "Follow-Up Reminder", delay_days: 14 },
      ],
    },
  ];

  for (const schedDef of scheduleDefs) {
    const { data: existing } = await supabase
      .from("schedules")
      .select("id")
      .eq("name", schedDef.name)
      .eq("org_id", orgId)
      .maybeSingle();

    if (existing) {
      console.log(`  ~ ${schedDef.name} (exists)`);
      continue;
    }

    const insertData: Record<string, unknown> = {
      org_id: orgId,
      owner_id: userId,
      name: schedDef.name,
      description: schedDef.description,
      schedule_type: schedDef.schedule_type,
      is_active: true,
    };

    if (schedDef.filing_type_id) {
      insertData.filing_type_id = schedDef.filing_type_id;
    }
    if (schedDef.schedule_type === "custom") {
      insertData.custom_date = (schedDef as any).custom_date;
      insertData.recurrence_rule = (schedDef as any).recurrence_rule;
      insertData.recurrence_anchor = (schedDef as any).recurrence_anchor;
    }

    const { data: insertedSchedule, error: schedError } = await supabase
      .from("schedules")
      .insert(insertData)
      .select("id")
      .single();

    if (schedError) {
      console.error(
        `  Error creating schedule "${schedDef.name}":`,
        schedError.message
      );
      continue;
    }

    // Insert steps
    const stepsToInsert = schedDef.steps
      .map((step, index) => {
        const templateId = templateMap.get(step.template_name);
        if (!templateId) {
          console.warn(
            `    Template "${step.template_name}" not found, skipping step`
          );
          return null;
        }
        return {
          schedule_id: insertedSchedule.id,
          email_template_id: templateId,
          step_number: index + 1,
          delay_days: step.delay_days,
          org_id: orgId,
          owner_id: userId,
        };
      })
      .filter(Boolean);

    if (stepsToInsert.length > 0) {
      const { error: stepsError } = await supabase
        .from("schedule_steps")
        .insert(stepsToInsert);

      if (stepsError) {
        console.error(
          `    Error creating steps for "${schedDef.name}":`,
          stepsError.message
        );
      }
    }

    console.log(
      `  + ${schedDef.name} (${schedDef.steps.length} steps)`
    );
  }

  // ── 7. Email log (sent/delivered/bounced) ───────────────────────────────

  console.log("\n7. Creating email log entries...");

  // Build some realistic email log entries over the last 30 days
  const emailLogClients = [
    "Hartley Construction Ltd",
    "Midlands Electrical Services Ltd",
    "Brighton Digital LLP",
    "Oakwood Property Management Ltd",
    "Sarah Mitchell",
    "Thames Valley Consulting Ltd",
    "Northern Logistics Group Ltd",
    "J. Singh & Partners",
    "Coastal Catering Services LLP",
    "David Chen",
  ];

  const emailLogEntries: Array<{
    client_id: string;
    filing_type_id: string;
    recipient_email: string;
    subject: string;
    sent_at: string;
    delivery_status: string;
    send_type: string;
    delivered_at?: string;
    bounce_type?: string;
    bounce_description?: string;
  }> = [];

  // Sent/delivered emails
  for (let i = 0; i < 12; i++) {
    const clientName =
      emailLogClients[i % emailLogClients.length];
    const clientDef = clientDefs.find(
      (c) => c.company_name === clientName
    );
    if (!clientDef || !clientIds[clientName]) continue;

    const filingTypes =
      clientDef.client_type === "Individual"
        ? ["self_assessment"]
        : ["corporation_tax_payment", "ct600_filing", "companies_house"];
    const filingType = filingTypes[i % filingTypes.length];
    const sentAt = isoAgo(Math.floor(Math.random() * 28) + 1);
    const isBounced = i === 7; // One bounced email

    emailLogEntries.push({
      client_id: clientIds[clientName],
      filing_type_id: filingType,
      recipient_email: clientDef.primary_email!,
      subject: `${filingType === "self_assessment" ? "Self Assessment" : filingType === "corporation_tax_payment" ? "Corp Tax" : filingType === "ct600_filing" ? "CT600" : "Companies House"} — deadline approaching for ${clientDef.company_name}`,
      sent_at: sentAt,
      delivery_status: isBounced ? "bounced" : "delivered",
      send_type: i < 8 ? "scheduled" : "ad-hoc",
      ...(isBounced
        ? {
            bounce_type: "HardBounce",
            bounce_description:
              "The email account does not exist at the domain",
          }
        : { delivered_at: sentAt }),
    });
  }

  // Check if we already have entries for this org
  const { count: existingEmailLogCount } = await supabase
    .from("email_log")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((existingEmailLogCount ?? 0) < 5) {
    for (const entry of emailLogEntries) {
      const { error } = await supabase.from("email_log").insert({
        ...entry,
        org_id: orgId,
      });
      if (error) {
        console.error("  Email log insert error:", error.message);
      }
    }
    console.log(`  + Created ${emailLogEntries.length} email log entries`);
  } else {
    console.log(
      `  ~ Email log already has ${existingEmailLogCount} entries, skipping`
    );
  }

  // ── 8. Reminder queue (queued/pending emails) ───────────────────────────

  console.log("\n8. Creating reminder queue entries...");

  const queueEntries: Array<{
    client_id: string;
    filing_type_id: string;
    template_id: string | null;
    step_index: number;
    deadline_date: string;
    send_date: string;
    status: string;
    resolved_subject: string;
  }> = [];

  // Queue 6-8 scheduled reminders for upcoming deadlines
  const queueClients = [
    {
      name: "Brighton Digital LLP",
      filing: "companies_house",
      deadline: daysFromNow(20),
      send: daysFromNow(6),
    },
    {
      name: "Brighton Digital LLP",
      filing: "ct600_filing",
      deadline: daysFromNow(90),
      send: daysFromNow(60),
    },
    {
      name: "Oakwood Property Management Ltd",
      filing: "corporation_tax_payment",
      deadline: daysFromNow(10),
      send: daysFromNow(3),
    },
    {
      name: "Thames Valley Consulting Ltd",
      filing: "corporation_tax_payment",
      deadline: daysFromNow(210),
      send: daysFromNow(180),
    },
    {
      name: "Thames Valley Consulting Ltd",
      filing: "vat_return",
      deadline: daysFromNow(45),
      send: daysFromNow(31),
    },
    {
      name: "Northern Logistics Group Ltd",
      filing: "ct600_filing",
      deadline: daysFromNow(330),
      send: daysFromNow(300),
    },
    {
      name: "Sarah Mitchell",
      filing: "self_assessment",
      deadline: "2027-01-31",
      send: daysFromNow(250),
    },
    {
      name: "David Chen",
      filing: "self_assessment",
      deadline: "2027-01-31",
      send: daysFromNow(250),
    },
  ];

  for (const q of queueClients) {
    const clientId = clientIds[q.name];
    if (!clientId) continue;

    queueEntries.push({
      client_id: clientId,
      filing_type_id: q.filing,
      template_id: null,
      step_index: 0,
      deadline_date: q.deadline,
      send_date: q.send,
      status: "scheduled",
      resolved_subject: `Reminder: ${q.filing.replace(/_/g, " ")} for ${q.name}`,
    });
  }

  const { count: existingQueueCount } = await supabase
    .from("reminder_queue")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((existingQueueCount ?? 0) < 3) {
    for (const entry of queueEntries) {
      await supabase.from("reminder_queue").insert({
        ...entry,
        org_id: orgId,
      });
    }
    console.log(`  + Created ${queueEntries.length} reminder queue entries`);
  } else {
    console.log(
      `  ~ Reminder queue already has ${existingQueueCount} entries, skipping`
    );
  }

  // ── 9. Client documents ─────────────────────────────────────────────────

  console.log("\n9. Creating client document records...");

  const documentDefs = [
    {
      clientName: "Greenfield Architects Ltd",
      filing_type_id: "corporation_tax_payment",
      original_filename: "accounts-2025.pdf",
      source: "manual" as const,
      needs_review: false,
      tax_period_end_date: daysAgo(400),
    },
    {
      clientName: "Greenfield Architects Ltd",
      filing_type_id: "ct600_filing",
      original_filename: "ct600-submission-confirmation.pdf",
      source: "manual" as const,
      needs_review: false,
      tax_period_end_date: daysAgo(400),
    },
    {
      clientName: "Coastal Catering Services LLP",
      filing_type_id: "corporation_tax_payment",
      original_filename: "bank-statements-q4.pdf",
      source: "portal_upload" as const,
      needs_review: true,
      tax_period_end_date: daysAgo(200),
    },
    {
      clientName: "Oakwood Property Management Ltd",
      filing_type_id: "corporation_tax_payment",
      original_filename: "trial-balance-2025.xlsx",
      source: "portal_upload" as const,
      needs_review: true,
      validation_warnings: [
        {
          code: "MIME_MISMATCH",
          message:
            "Expected PDF but received spreadsheet",
          expected: "application/pdf",
          found:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
      tax_period_end_date: daysFromNow(-250),
    },
    {
      clientName: "Hartley Construction Ltd",
      filing_type_id: "vat_return",
      original_filename: "vat-return-q4.xlsx",
      source: "inbound_email" as const,
      needs_review: false,
      tax_period_end_date: daysAgo(100),
    },
  ];

  const { count: existingDocCount } = await supabase
    .from("client_documents")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((existingDocCount ?? 0) < 3) {
    for (const docDef of documentDefs) {
      const clientId = clientIds[docDef.clientName];
      if (!clientId) continue;

      const retainUntil = new Date(docDef.tax_period_end_date);
      retainUntil.setFullYear(retainUntil.getFullYear() + 6);

      const docId = crypto.randomUUID();
      const storagePath = `orgs/${orgId}/clients/${clientId}/${docDef.filing_type_id}/2025/${docId}.${docDef.original_filename.split(".").pop()}`;

      const insertData: Record<string, unknown> = {
        org_id: orgId,
        client_id: clientId,
        filing_type_id: docDef.filing_type_id,
        storage_path: storagePath,
        original_filename: docDef.original_filename,
        tax_period_end_date: docDef.tax_period_end_date,
        retain_until: retainUntil.toISOString().split("T")[0],
        source: docDef.source,
        needs_review: docDef.needs_review,
        uploader_user_id:
          docDef.source === "manual" ? userId : null,
      };

      if ((docDef as any).validation_warnings) {
        insertData.validation_warnings = (docDef as any).validation_warnings;
      }

      const { error } = await supabase
        .from("client_documents")
        .insert(insertData);
      if (error) {
        console.error(
          `  Error creating doc for ${docDef.clientName}:`,
          error.message
        );
      } else {
        console.log(
          `  + ${docDef.original_filename} (${docDef.clientName})`
        );
      }
    }
  } else {
    console.log(
      `  ~ Documents already exist (${existingDocCount}), skipping`
    );
  }

  // ── 10. Portal tokens ───────────────────────────────────────────────────

  console.log("\n10. Creating portal tokens...");

  const portalTokenDefs = [
    {
      clientName: "Brighton Digital LLP",
      filing_type_id: "companies_house",
      tax_year: "2025",
    },
    {
      clientName: "Coastal Catering Services LLP",
      filing_type_id: "corporation_tax_payment",
      tax_year: "2025",
    },
  ];

  const { count: existingTokenCount } = await supabase
    .from("upload_portal_tokens")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((existingTokenCount ?? 0) < 1) {
    for (const tokenDef of portalTokenDefs) {
      const clientId = clientIds[tokenDef.clientName];
      if (!clientId) continue;

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from("upload_portal_tokens")
        .insert({
          org_id: orgId,
          client_id: clientId,
          filing_type_id: tokenDef.filing_type_id,
          tax_year: tokenDef.tax_year,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          created_by_user_id: userId,
        });

      if (error) {
        console.error(
          `  Error creating portal token for ${tokenDef.clientName}:`,
          error.message
        );
      } else {
        console.log(
          `  + Portal token for ${tokenDef.clientName} (${tokenDef.filing_type_id})`
        );
      }
    }
  } else {
    console.log(
      `  ~ Portal tokens already exist (${existingTokenCount}), skipping`
    );
  }

  // ── 11. App settings ────────────────────────────────────────────────────

  console.log("\n11. Setting up app settings...");

  const settingsDefs = [
    {
      key: "reminder_send_hour",
      value: "9",
      user_id: userId,
    },
    {
      key: "onboarding_complete",
      value: "true",
      user_id: null,
    },
    {
      key: "setup_mode",
      value: "real",
      user_id: null,
    },
    {
      key: "email_sender_name",
      value: "Thornton & Associates",
      user_id: null,
    },
    {
      key: "email_sender_address",
      value: "reminders@thornton-associates.co.uk",
      user_id: null,
    },
    {
      key: "email_reply_to",
      value: "info@thornton-associates.co.uk",
      user_id: null,
    },
    {
      key: "templates_visited",
      value: "true",
      user_id: null,
    },
    {
      key: "activity_visited",
      value: "true",
      user_id: null,
    },
    {
      key: "progress_reviewed",
      value: "true",
      user_id: null,
    },
  ];

  for (const setting of settingsDefs) {
    const { error } = await supabase.from("app_settings").upsert(
      {
        org_id: orgId,
        user_id: setting.user_id,
        key: setting.key,
        value: setting.value,
      },
      { onConflict: "org_id,user_id,key" }
    );

    if (error) {
      console.error(
        `  Error setting ${setting.key}:`,
        error.message
      );
    }
  }

  console.log(
    `  + Set ${settingsDefs.length} app settings`
  );

  // ── Done ────────────────────────────────────────────────────────────────

  console.log("\n=== Demo Data Seeding Complete ===\n");
  console.log("Summary:");
  console.log(
    `  - User:        ${DEMO_EMAIL}`
  );
  console.log(
    `  - Team members: ${Object.keys(teamMemberIds).length}`
  );
  console.log(
    `  - Organisation: Thornton & Associates (${ORG_SLUG})`
  );
  console.log(
    `  - Clients:     ${Object.keys(clientIds).length}`
  );
  console.log(
    `  - Templates:   ${templateMap.size}`
  );
  console.log(
    `  - Email logs:  ${emailLogEntries.length}`
  );
  console.log(
    `  - Queue items: ${queueEntries.length}`
  );
  console.log(
    `  - Documents:   ${documentDefs.length}`
  );
  console.log(
    `  - Portal tkns: ${portalTokenDefs.length}`
  );
  console.log(
    `\nRun 'npx tsx scripts/demo/seed-demo-data.ts' to re-run (idempotent).`
  );
}

seed().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
