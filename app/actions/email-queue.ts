'use server';

import { createClient } from '@/lib/supabase/server';

export interface CancelSchedulingParams {
  reminderIds: string[];
}

export interface CancelSchedulingResult {
  success: boolean;
  message: string;
  cancelledCount: number;
}

export async function cancelScheduling(params: CancelSchedulingParams): Promise<CancelSchedulingResult> {
  const supabase = await createClient();
  const { reminderIds } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      cancelledCount: 0,
    };
  }

  try {
    // Update status to 'cancelled' for selected reminders
    const { error, count } = await supabase
      .from('reminder_queue')
      .update({ status: 'cancelled' })
      .in('id', reminderIds)
      .neq('status', 'sent'); // Don't cancel already sent emails

    if (error) {
      console.error('Error cancelling scheduling:', error);
      throw error;
    }

    return {
      success: true,
      message: `Successfully cancelled ${count || 0} scheduled email(s)`,
      cancelledCount: count || 0,
    };
  } catch (error) {
    console.error('Error in cancelScheduling:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      cancelledCount: 0,
    };
  }
}

export interface UncancelSchedulingParams {
  reminderIds: string[];
}

export interface UncancelSchedulingResult {
  success: boolean;
  message: string;
  uncancelledCount: number;
}

export async function uncancelScheduling(params: UncancelSchedulingParams): Promise<UncancelSchedulingResult> {
  const supabase = await createClient();
  const { reminderIds } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      uncancelledCount: 0,
    };
  }

  try {
    // Update status to 'scheduled' for cancelled reminders only
    const { error, count } = await supabase
      .from('reminder_queue')
      .update({ status: 'scheduled' })
      .in('id', reminderIds)
      .eq('status', 'cancelled'); // Only uncancel cancelled emails

    if (error) {
      console.error('Error uncancelling scheduling:', error);
      throw error;
    }

    return {
      success: true,
      message: `Successfully uncancelled ${count || 0} email(s)`,
      uncancelledCount: count || 0,
    };
  } catch (error) {
    console.error('Error in uncancelScheduling:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      uncancelledCount: 0,
    };
  }
}

export interface RescheduleSpecificParams {
  reminderIds: string[];
  newDate: string; // ISO date string
}

export interface RescheduleOffsetParams {
  reminderIds: string[];
  offsetDays: number;
}

export interface RescheduleResult {
  success: boolean;
  message: string;
  rescheduledCount: number;
  errors?: string[];
}

export async function rescheduleToSpecificDate(params: RescheduleSpecificParams): Promise<RescheduleResult> {
  const supabase = await createClient();
  const { reminderIds, newDate } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      rescheduledCount: 0,
    };
  }

  try {
    const newDateTime = new Date(newDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate new date is in the future
    if (newDateTime < today) {
      return {
        success: false,
        message: 'New date must be in the future',
        rescheduledCount: 0,
      };
    }

    // Fetch the reminders to validate against deadline dates
    const { data: reminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('id, client_id, deadline_date, send_date, status')
      .in('id', reminderIds)
      .neq('status', 'sent'); // Don't reschedule already sent emails

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return {
        success: false,
        message: 'No eligible reminders found (may have already been sent)',
        rescheduledCount: 0,
      };
    }

    // Validate all reminders can be rescheduled to the new date
    const errors: string[] = [];
    for (const reminder of reminders) {
      const deadlineDate = new Date(reminder.deadline_date);
      if (newDateTime > deadlineDate) {
        errors.push(`Reminder for client cannot be scheduled after deadline (${reminder.deadline_date})`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Some reminders cannot be rescheduled to this date',
        rescheduledCount: 0,
        errors,
      };
    }

    // Update all reminders to the new date
    const { error: updateError, count } = await supabase
      .from('reminder_queue')
      .update({
        send_date: newDate,
        status: 'rescheduled',
      })
      .in('id', reminderIds);

    if (updateError) {
      console.error('Error updating reminders:', updateError);
      throw updateError;
    }

    return {
      success: true,
      message: `Successfully rescheduled ${count || 0} email(s) to ${newDate}`,
      rescheduledCount: count || 0,
    };
  } catch (error) {
    console.error('Error in rescheduleToSpecificDate:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      rescheduledCount: 0,
    };
  }
}

export async function rescheduleWithOffset(params: RescheduleOffsetParams): Promise<RescheduleResult> {
  const supabase = await createClient();
  const { reminderIds, offsetDays } = params;

  if (reminderIds.length === 0) {
    return {
      success: false,
      message: 'No reminders selected',
      rescheduledCount: 0,
    };
  }

  if (offsetDays === 0) {
    return {
      success: false,
      message: 'Offset must be non-zero',
      rescheduledCount: 0,
    };
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch the reminders to calculate and validate new dates
    const { data: reminders, error: fetchError } = await supabase
      .from('reminder_queue')
      .select('id, client_id, deadline_date, send_date, status')
      .in('id', reminderIds)
      .neq('status', 'sent'); // Don't reschedule already sent emails

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      return {
        success: false,
        message: 'No eligible reminders found (may have already been sent)',
        rescheduledCount: 0,
      };
    }

    // Validate and calculate new dates for each reminder
    const errors: string[] = [];
    const updates: { id: string; newDate: string }[] = [];

    for (const reminder of reminders) {
      const currentDate = new Date(reminder.send_date);
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + offsetDays);

      // Validate new date is in the future
      if (newDate < today) {
        errors.push(`Offset would result in a past date for one or more reminders`);
        break;
      }

      // Validate new date is before deadline
      const deadlineDate = new Date(reminder.deadline_date);
      if (newDate > deadlineDate) {
        errors.push(`Offset would result in a date after deadline for one or more reminders`);
        break;
      }

      updates.push({
        id: reminder.id,
        newDate: newDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Some reminders cannot be rescheduled with this offset',
        rescheduledCount: 0,
        errors,
      };
    }

    // Update each reminder individually with its calculated new date
    let successCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('reminder_queue')
        .update({
          send_date: update.newDate,
          status: 'rescheduled',
        })
        .eq('id', update.id);

      if (!updateError) {
        successCount++;
      }
    }

    return {
      success: true,
      message: `Successfully rescheduled ${successCount} email(s) with offset of ${offsetDays} day(s)`,
      rescheduledCount: successCount,
    };
  } catch (error) {
    console.error('Error in rescheduleWithOffset:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      rescheduledCount: 0,
    };
  }
}
