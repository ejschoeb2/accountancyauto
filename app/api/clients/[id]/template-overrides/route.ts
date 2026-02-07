import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveTemplateForClient, getOverriddenFieldNames } from '@/lib/templates/inheritance';
import type { ReminderTemplate, ClientTemplateOverride, TemplateStep } from '@/lib/types/database';

// Validation schemas
const putOverrideSchema = z.object({
  template_id: z.string().uuid(),
  step_index: z.number().int().min(0),
  overridden_fields: z.object({
    subject: z.string().optional(),
    body: z.string().optional(),
    delay_days: z.number().int().min(0).optional(),
  }),
});

const deleteParamsSchema = z.object({
  template_id: z.string().uuid(),
  step_index: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
});

interface TemplateWithOverrides {
  template: ReminderTemplate;
  overrides: ClientTemplateOverride[];
  resolved_steps: TemplateStep[];
  overridden_field_map: Record<number, string[]>;
}

/**
 * GET /api/clients/[id]/template-overrides
 * Returns all templates with their overrides and resolved (merged) steps
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const supabase = await createClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all active templates
    const { data: templates, error: templatesError } = await supabase
      .from('reminder_templates')
      .select('*')
      .eq('is_active', true)
      .order('filing_type_id');

    if (templatesError) {
      return NextResponse.json({ error: templatesError.message }, { status: 500 });
    }

    // Get all overrides for this client
    const { data: overrides, error: overridesError } = await supabase
      .from('client_template_overrides')
      .select('*')
      .eq('client_id', clientId);

    if (overridesError) {
      return NextResponse.json({ error: overridesError.message }, { status: 500 });
    }

    // Build response with resolved templates
    const result: TemplateWithOverrides[] = (templates || []).map((template) => {
      const templateOverrides = (overrides || []).filter(
        (o) => o.template_id === template.id
      );

      const overrideEntries = templateOverrides.map((o) => ({
        step_index: o.step_index,
        overridden_fields: o.overridden_fields,
      }));

      const resolvedSteps = resolveTemplateForClient(template.steps, overrideEntries);
      const overriddenFieldMap = getOverriddenFieldNames(template.steps, overrideEntries);

      // Convert Map to Record for JSON serialization
      const overriddenFieldRecord: Record<number, string[]> = {};
      overriddenFieldMap.forEach((fields, stepIndex) => {
        overriddenFieldRecord[stepIndex] = fields;
      });

      return {
        template,
        overrides: templateOverrides,
        resolved_steps: resolvedSteps,
        overridden_field_map: overriddenFieldRecord,
      };
    });

    return NextResponse.json({ templates: result });
  } catch (error) {
    console.error('GET /api/clients/[id]/template-overrides error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]/template-overrides
 * Upsert or delete a template override for a specific step
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await request.json();

    // Validate input
    const validation = putOverrideSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { template_id, step_index, overridden_fields } = validation.data;
    const supabase = await createClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('reminder_templates')
      .select('id, steps')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate step_index is within bounds
    if (step_index >= template.steps.length) {
      return NextResponse.json(
        { error: `Invalid step_index. Template has ${template.steps.length} steps.` },
        { status: 400 }
      );
    }

    // If overridden_fields is empty, delete the override
    const hasOverriddenFields = Object.keys(overridden_fields).length > 0;

    if (!hasOverriddenFields) {
      // Delete the override
      const { error: deleteError } = await supabase
        .from('client_template_overrides')
        .delete()
        .eq('client_id', clientId)
        .eq('template_id', template_id)
        .eq('step_index', step_index);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    } else {
      // Upsert the override
      const { data: override, error: upsertError } = await supabase
        .from('client_template_overrides')
        .upsert(
          {
            client_id: clientId,
            template_id,
            step_index,
            overridden_fields,
          },
          {
            onConflict: 'client_id,template_id,step_index',
          }
        )
        .select()
        .single();

      if (upsertError) {
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }
    }

    // Update has_overrides flag
    const { data: remainingOverrides, error: countError } = await supabase
      .from('client_template_overrides')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);

    if (countError) {
      console.error('Failed to count overrides:', countError);
    } else {
      const hasOverrides = (remainingOverrides as unknown as { count: number } | null)?.count ?
        ((remainingOverrides as unknown as { count: number }).count > 0) : false;

      await supabase
        .from('clients')
        .update({ has_overrides: hasOverrides })
        .eq('id', clientId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/clients/[id]/template-overrides error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/template-overrides
 * Delete template override(s) for a client
 * Query params: template_id (required), step_index (optional)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);

    const queryParams = {
      template_id: searchParams.get('template_id'),
      step_index: searchParams.get('step_index'),
    };

    // Validate query params
    const validation = deleteParamsSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { template_id, step_index } = validation.data;
    const supabase = await createClient();

    // Build delete query
    let query = supabase
      .from('client_template_overrides')
      .delete()
      .eq('client_id', clientId)
      .eq('template_id', template_id);

    if (step_index !== undefined) {
      query = query.eq('step_index', step_index);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Update has_overrides flag
    const { data: remainingOverrides, error: countError } = await supabase
      .from('client_template_overrides')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);

    if (countError) {
      console.error('Failed to count overrides:', countError);
    } else {
      const hasOverrides = (remainingOverrides as unknown as { count: number } | null)?.count ?
        ((remainingOverrides as unknown as { count: number }).count > 0) : false;

      await supabase
        .from('clients')
        .update({ has_overrides: hasOverrides })
        .eq('id', clientId);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/clients/[id]/template-overrides error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
