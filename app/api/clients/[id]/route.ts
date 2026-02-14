import { NextRequest, NextResponse } from "next/server";
import { updateClientMetadataSchema } from "@/lib/validations/client";
import { updateClientMetadata } from "@/app/actions/clients";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleUnpauseClient, cancelRemindersForReceivedRecords, restoreRemindersForUnreceivedRecords, rebuildQueueForClient } from "@/lib/reminders/queue-builder";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createClient();

    // Fetch current client state before update
    const { data: currentClient, error: fetchError } = await supabase
      .from('clients')
      .select('reminders_paused, records_received_for')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Validate the request body
    const validationResult = updateClientMetadataSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    // Update the client
    const updatedClient = await updateClientMetadata(id, validationResult.data);

    // Use admin client for queue operations (requires service-role)
    const adminClient = createAdminClient();

    // Handle reminders_paused changes
    if ('reminders_paused' in body) {
      const wasPaused = currentClient.reminders_paused;
      const isPaused = body.reminders_paused;

      // If unpausing (was paused, now not paused)
      if (wasPaused && !isPaused) {
        await handleUnpauseClient(adminClient, id);
      }
    }

    // Handle records_received_for changes
    if ('records_received_for' in body) {
      const oldRecordsReceived = currentClient.records_received_for || [];
      const newRecordsReceived = body.records_received_for || [];

      // Find filing types that were added to records_received_for
      const addedFilingTypes = newRecordsReceived.filter(
        (filingTypeId: string) => !oldRecordsReceived.includes(filingTypeId)
      );

      // Find filing types that were removed from records_received_for
      const removedFilingTypes = oldRecordsReceived.filter(
        (filingTypeId: string) => !newRecordsReceived.includes(filingTypeId)
      );

      // Cancel reminders for newly received filing types
      for (const filingTypeId of addedFilingTypes) {
        await cancelRemindersForReceivedRecords(adminClient, id, filingTypeId);
      }

      // Restore reminders for filing types that are no longer received
      for (const filingTypeId of removedFilingTypes) {
        await restoreRemindersForUnreceivedRecords(adminClient, id, filingTypeId);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedClient,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
