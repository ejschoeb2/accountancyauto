import { DeadlineCalendar } from "./components/deadline-calendar";
import { Icon } from "@/components/ui/icon";

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

// Hex colors match react-big-calendar event styling (inline styles required by the library)
const FILING_TYPE_LEGEND = [
  {
    id: "corporation_tax_payment",
    name: "Corporation Tax Payment",
    shortName: "Corp Tax Payment",
    color: "#3b82f6",
    icon: "payments"
  },
  {
    id: "ct600_filing",
    name: "CT600 Filing",
    shortName: "CT600",
    color: "#6366f1",
    icon: "description"
  },
  {
    id: "companies_house",
    name: "Companies House",
    shortName: "Companies House",
    color: "#f59e0b",
    icon: "business"
  },
  {
    id: "vat_return",
    name: "VAT Return",
    shortName: "VAT Return",
    color: "#10b981",
    icon: "receipt_long"
  },
  {
    id: "self_assessment",
    name: "Self Assessment",
    shortName: "Self Assessment",
    color: "#ef4444",
    icon: "person"
  },
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

  // Count events by type for stats
  const eventsByType = events.reduce((acc: Record<string, number>, event) => {
    acc[event.filing_type_id] = (acc[event.filing_type_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-foreground">Deadline Calendar</h1>
        <p className="text-muted-foreground mt-1">
          Bird&apos;s-eye view of filing deadlines across all clients
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-card border rounded-lg py-6 px-8">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="event" size="sm" className="text-accent" />
          <h2 className="text-sm font-semibold">This Month</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">{events.length}</span>
          <span className="text-sm text-muted-foreground">
            {events.length === 1 ? "deadline" : "deadlines"}
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border rounded-lg py-8 px-8 shadow-sm">
        <DeadlineCalendar initialEvents={events} />
      </div>

      {/* Legend */}
      <div className="bg-card border rounded-lg py-6 px-8 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="label" size="sm" className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">Filing Type Legend</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FILING_TYPE_LEGEND.map((type) => {
            const count = eventsByType[type.id] || 0;
            return (
              <div
                key={type.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 hover:bg-accent/5 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${type.color}15` }}
                >
                  <Icon
                    name={type.icon}
                    size="sm"
                    style={{ color: type.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {type.shortName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {count} this month
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
