// ─── Data-driven wizard step configuration ──────────────────────────────────
// Adding a new step = one config entry here + its component. No page.tsx edits.

export interface WizardStepConfig {
  id: AdminStep;
  label: string;
  /** Which user paths include this step */
  showFor: "all" | "admin" | "admin-full" | "member";
  /** Steps that are only for the full (non-joining) admin flow */
}

export type AdminStep =
  | "account"
  | "firm"
  | "plan"
  | "deadlines"
  | "import"
  | "email"
  | "portal"
  | "complete";

/**
 * Full ordered list of all wizard steps.
 * The `showFor` field controls which steps are visible for each user path:
 * - "admin-full": only for new admins creating a fresh org
 * - "admin": visible for all admin paths (full + joining existing org)
 * - "member": only for invited members
 * - "all": visible in every path
 */
export const WIZARD_STEPS: WizardStepConfig[] = [
  { id: "account", label: "Verify Email", showFor: "admin-full" },
  { id: "firm", label: "Firm Details", showFor: "admin-full" },
  { id: "plan", label: "Plan", showFor: "admin-full" },
  { id: "deadlines", label: "Deadlines", showFor: "admin" },
  { id: "import", label: "Import Clients", showFor: "all" },
  { id: "email", label: "Email Setup", showFor: "admin" },
  { id: "portal", label: "Client Portal", showFor: "admin-full" },
  { id: "complete", label: "Complete", showFor: "all" },
];

export type UserType = "new-admin" | "invited-member" | null;

/** Member steps (separate, simpler flow) */
export const MEMBER_STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
  { label: "Complete" },
];

/**
 * Get the stepper labels for the admin path.
 * When joining an existing org, only admin + all steps are shown (no admin-full).
 */
export function getAdminStepperSteps(joiningExistingOrg: boolean) {
  return WIZARD_STEPS.filter((s) => {
    if (joiningExistingOrg) {
      // "Email Settings" label override for joining flow
      return s.showFor === "admin" || s.showFor === "all";
    }
    return s.showFor !== "member";
  }).map((s) => ({
    label: s.id === "email" && joiningExistingOrg ? "Email Settings" : s.label,
  }));
}

/**
 * Get the ordered list of admin step IDs for a given flow.
 */
export function getAdminStepIds(joiningExistingOrg: boolean): AdminStep[] {
  return WIZARD_STEPS.filter((s) => {
    if (joiningExistingOrg) {
      return s.showFor === "admin" || s.showFor === "all";
    }
    return s.showFor !== "member";
  }).map((s) => s.id);
}

/**
 * Convert an AdminStep to its stepper index for the given flow.
 */
export function adminStepToIndex(
  step: AdminStep,
  joiningExistingOrg: boolean
): number {
  const ids = getAdminStepIds(joiningExistingOrg);
  return ids.indexOf(step);
}

// ─── Plan tiers ───────────────────────────────────────────────────────────────

export const PLAN_TIERS = [
  {
    key: "free",
    name: "Free",
    price: 0 as number | null,
    priceNote: "forever free",
    range: "Up to 10 clients",
    clientLimit: 10,
    tagline:
      "Get started at no cost. Upgrade naturally when your practice grows.",
    featured: false,
  },
  {
    key: "solo",
    name: "Solo",
    price: 19 as number | null,
    priceNote: "/mo",
    range: "Up to 40 clients",
    clientLimit: 40,
    tagline:
      "For sole traders and bookkeepers managing a small client list.",
    featured: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: 39 as number | null,
    priceNote: "/mo",
    range: "Up to 80 clients",
    clientLimit: 80,
    tagline: "For independent accountants and small practices.",
    featured: false,
  },
  {
    key: "practice",
    name: "Practice",
    price: 69 as number | null,
    priceNote: "/mo",
    range: "Up to 200 clients",
    clientLimit: 200,
    tagline:
      "For growing practices managing a wide range of deadlines.",
    featured: true,
  },
  {
    key: "firm",
    name: "Firm",
    price: 109 as number | null,
    priceNote: "/mo",
    range: "Up to 400 clients",
    clientLimit: 400,
    tagline:
      "For established firms with a broad portfolio of clients.",
    featured: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugifyFirmName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
