"use client";

import { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import { Icon } from "@/components/ui/icon";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../calendar-styles.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enGB }),
  getDay,
  locales: {
    "en-GB": enGB,
  },
});

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

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: DeadlineEvent;
}

interface DeadlineCalendarProps {
  initialEvents: DeadlineEvent[];
  initialDate?: Date;
}

// Color mapping for filing types
const FILING_TYPE_COLORS: Record<string, string> = {
  corporation_tax_payment: "#3b82f6", // blue
  ct600_filing: "#6366f1", // indigo
  companies_house: "#f59e0b", // amber
  vat_return: "#10b981", // green
  self_assessment: "#ef4444", // red
};

export function DeadlineCalendar({ initialEvents, initialDate }: DeadlineCalendarProps) {
  const [events, setEvents] = useState<DeadlineEvent[]>(initialEvents);
  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Convert deadline events to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(
    () =>
      events.map((event) => {
        const eventDate = new Date(event.date);
        return {
          id: event.id,
          title: event.title,
          start: eventDate,
          end: eventDate,
          resource: event,
        };
      }),
    [events]
  );

  // Fetch events for a specific month
  const fetchEventsForMonth = useCallback(async (date: Date) => {
    setIsLoading(true);
    try {
      const month = date.getMonth() + 1; // getMonth() is 0-indexed
      const year = date.getFullYear();

      const response = await fetch(
        `/api/calendar/deadlines?month=${month}&year=${year}`
      );

      if (!response.ok) {
        console.error("Failed to fetch calendar events");
        return;
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle month navigation
  const handleNavigate = useCallback(
    (newDate: Date) => {
      setCurrentDate(newDate);
      fetchEventsForMonth(newDate);
    },
    [fetchEventsForMonth]
  );

  // Style events by filing type
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const color = FILING_TYPE_COLORS[event.resource.filing_type_id] || "#64748b";

    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: "white",
        borderRadius: "4px",
        padding: "2px 4px",
        fontSize: "0.875rem",
        fontWeight: "500",
      },
    };
  }, []);

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { resource } = event;
    return (
      <div className="flex items-center gap-1.5 w-full">
        <span className="truncate flex-1">{resource.client_name}</span>
        {resource.is_overridden && (
          <Icon name="edit" size="sm" className="opacity-75 flex-shrink-0" />
        )}
      </div>
    );
  };

  // Custom toolbar
  const CustomToolbar = (toolbar: {
    date: Date;
    onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  }) => {
    const goToBack = () => {
      toolbar.onNavigate('PREV');
    };

    const goToNext = () => {
      toolbar.onNavigate('NEXT');
    };

    const goToToday = () => {
      toolbar.onNavigate('TODAY');
    };

    const label = () => {
      const date = toolbar.date;
      return format(date, 'MMMM yyyy', { locale: enGB });
    };

    return (
      <div className="rbc-toolbar">
        <div className="rbc-btn-group">
          <button type="button" onClick={goToToday}>
            Today
          </button>
        </div>
        <div className="rbc-toolbar-label">{label()}</div>
        <div className="rbc-btn-group">
          <button type="button" onClick={goToBack} aria-label="Previous month">
            <Icon name="chevron_left" size="sm" />
          </button>
          <button type="button" onClick={goToNext} aria-label="Next month">
            <Icon name="chevron_right" size="sm" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      {isLoading && (
        <div className="calendar-loading-overlay">
          <div className="bg-background border rounded-md px-3 py-2 text-sm flex items-center gap-2 shadow-sm">
            <Icon name="progress_activity" size="sm" className="animate-spin text-accent" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      )}
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 650, minHeight: 650 }}
        views={["month"]}
        defaultView="month"
        date={currentDate}
        onNavigate={handleNavigate}
        eventPropGetter={eventStyleGetter}
        components={{
          event: EventComponent,
          toolbar: CustomToolbar,
        }}
        tooltipAccessor={(event: CalendarEvent) => {
          const { resource } = event;
          return `${resource.client_name} - ${resource.filing_type_name}\n${resource.date}${
            resource.is_overridden ? " (custom deadline)" : ""
          }`;
        }}
      />
    </div>
  );
}
