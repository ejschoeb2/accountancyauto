import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateCorporationTaxPayment,
  calculateCT600Filing,
  calculateCompaniesHouseAccounts,
  calculateVATDeadline,
  calculateSelfAssessmentDeadline,
  getVATQuarterEnds,
  type VatQuarterEnum,
} from "@/lib/deadlines/calculators";
import type { FilingTypeId } from "@/lib/types/database";

interface DeadlineEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  client_id: string;
  client_name: string;
  filing_type_id: string;
  filing_type_name: string;
  is_overridden: boolean;
}

/**
 * GET /api/calendar/deadlines
 * Fetch deadline events for a given month/year
 * Query params: month (1-12), year (e.g., 2026)
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  // Parse query params
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

  // Validate params
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid month or year" },
      { status: 400 }
    );
  }

  // Calculate date range for filtering (include padding for calendar display)
  // Show last few days of prior month and first few days of next month
  const startDate = new Date(year, month - 2, 25); // ~last week of prior month
  const endDate = new Date(year, month, 7); // ~first week of next month

  try {
    // Fetch all clients with active filing assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from("client_filing_assignments")
      .select(`
        id,
        client_id,
        filing_type_id,
        clients!inner (
          id,
          company_name,
          year_end_date,
          vat_quarter
        ),
        filing_types!inner (
          id,
          name
        )
      `)
      .eq("is_active", true);

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 }
      );
    }

    // Fetch all deadline overrides
    const { data: overrides, error: overridesError } = await supabase
      .from("client_deadline_overrides")
      .select("client_id, filing_type_id, override_date");

    if (overridesError) {
      console.error("Error fetching overrides:", overridesError);
      return NextResponse.json(
        { error: "Failed to fetch overrides" },
        { status: 500 }
      );
    }

    // Build override map for quick lookup
    const overrideMap = new Map<string, string>();
    overrides?.forEach((override) => {
      const key = `${override.client_id}_${override.filing_type_id}`;
      overrideMap.set(key, override.override_date);
    });

    // Calculate deadlines for each assignment
    const events: DeadlineEvent[] = [];

    for (const assignment of assignments || []) {
      const client = assignment.clients as any;
      const filingType = assignment.filing_types as any;

      // Check for override first
      const overrideKey = `${assignment.client_id}_${assignment.filing_type_id}`;
      const overrideDate = overrideMap.get(overrideKey);

      let deadlineDate: Date | null = null;

      if (overrideDate) {
        // Use override date
        deadlineDate = new Date(overrideDate);
      } else {
        // Calculate deadline based on filing type
        try {
          switch (assignment.filing_type_id as FilingTypeId) {
            case "corporation_tax_payment":
              if (client.year_end_date) {
                deadlineDate = calculateCorporationTaxPayment(
                  new Date(client.year_end_date)
                );
              }
              break;

            case "ct600_filing":
              if (client.year_end_date) {
                deadlineDate = calculateCT600Filing(new Date(client.year_end_date));
              }
              break;

            case "companies_house":
              if (client.year_end_date) {
                deadlineDate = calculateCompaniesHouseAccounts(
                  new Date(client.year_end_date)
                );
              }
              break;

            case "vat_return":
              if (client.vat_quarter) {
                const quarterEnds = getVATQuarterEnds(
                  client.vat_quarter as VatQuarterEnum,
                  year
                );
                deadlineDate = calculateVATDeadline(quarterEnds[0]);
              }
              break;

            case "self_assessment":
              deadlineDate = calculateSelfAssessmentDeadline(year);
              break;
          }
        } catch (error) {
          console.error(
            `Error calculating deadline for ${client.company_name} - ${filingType.name}:`,
            error
          );
          // Skip this assignment if calculation fails
          continue;
        }
      }

      // Skip if no deadline could be determined
      if (!deadlineDate) {
        continue;
      }

      // Filter to requested month range (with padding)
      if (deadlineDate >= startDate && deadlineDate <= endDate) {
        events.push({
          id: `${assignment.client_id}_${assignment.filing_type_id}`,
          title: `${client.company_name} - ${filingType.name}`,
          date: deadlineDate.toISOString().split("T")[0], // YYYY-MM-DD
          client_id: assignment.client_id,
          client_name: client.company_name,
          filing_type_id: assignment.filing_type_id,
          filing_type_name: filingType.name,
          is_overridden: !!overrideDate,
        });
      }
    }

    // Sort events by date
    events.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error processing calendar deadlines:", error);
    return NextResponse.json(
      { error: "Failed to process calendar deadlines" },
      { status: 500 }
    );
  }
}
