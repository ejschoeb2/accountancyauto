import { DeadlineCalendar } from "./components/deadline-calendar";

interface DeadlineEvent {
  id: string;
  title: string;
  date: string;
  client_id: string;
  client_name: string;
  filing_type_id: string;
  filing_type_name: string;
  is_overridden: boolean;
}

// Filing type color legend
const FILING_TYPE_LEGEND = [
  { id: "corporation_tax_payment", name: "Corporation Tax Payment", color: "#3b82f6" },
  { id: "ct600_filing", name: "CT600 Filing", color: "#6366f1" },
  { id: "companies_house", name: "Companies House", color: "#f59e0b" },
  { id: "vat_return", name: "VAT Return", color: "#10b981" },
  { id: "self_assessment", name: "Self Assessment", color: "#ef4444" },
];

async function fetchInitialEvents(): Promise<DeadlineEvent[]> {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/calendar/deadlines?month=${month}&year=${year}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch initial calendar events");
      return [];
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error("Error fetching initial calendar events:", error);
    return [];
  }
}

export default async function CalendarPage() {
  const events = await fetchInitialEvents();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Deadline Calendar</h1>
        <p className="text-muted-foreground">
          Bird's-eye view of filing deadlines across all clients
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{events.length}</span>{" "}
          {events.length === 1 ? "deadline" : "deadlines"} this month
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border rounded-lg p-6">
        <DeadlineCalendar initialEvents={events} />
      </div>

      {/* Legend */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-4">Filing Type Legend</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {FILING_TYPE_LEGEND.map((type) => (
            <div key={type.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: type.color }}
              />
              <span className="text-sm">{type.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
