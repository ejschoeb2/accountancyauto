"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReminderTemplate, ClientTemplateOverride, TemplateStep, FilingTypeId } from '@/lib/types/database';

interface TemplateWithOverrides {
  template: ReminderTemplate;
  overrides: ClientTemplateOverride[];
  resolved_steps: TemplateStep[];
  overridden_field_map: Record<number, string[]>;
}

interface TemplateOverridesProps {
  clientId: string;
}

const FILING_TYPE_NAMES: Record<FilingTypeId, string> = {
  corporation_tax_payment: 'Corporation Tax Payment',
  ct600_filing: 'CT600 Filing',
  companies_house: 'Companies House',
  vat_return: 'VAT Return',
  self_assessment: 'Self Assessment',
};

export function TemplateOverrides({ clientId }: TemplateOverridesProps) {
  const [templates, setTemplates] = useState<TemplateWithOverrides[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplates, setExpandedTemplates] = useState<Record<string, boolean>>({});
  const [editingSteps, setEditingSteps] = useState<Record<string, number | null>>({});
  const [editForms, setEditForms] = useState<Record<string, Partial<TemplateStep>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Fetch template overrides
  useEffect(() => {
    async function fetchTemplateOverrides() {
      try {
        const response = await fetch(`/api/clients/${clientId}/template-overrides`);
        if (!response.ok) {
          throw new Error('Failed to fetch template overrides');
        }
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to load template overrides: ${message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchTemplateOverrides();
  }, [clientId]);

  const toggleTemplate = (templateId: string) => {
    setExpandedTemplates((prev) => ({
      ...prev,
      [templateId]: !prev[templateId],
    }));
  };

  const startEditing = (templateId: string, stepIndex: number, currentStep: TemplateStep) => {
    const key = `${templateId}-${stepIndex}`;
    setEditingSteps((prev) => ({ ...prev, [templateId]: stepIndex }));
    setEditForms((prev) => ({
      ...prev,
      [key]: {
        subject: currentStep.subject,
        body: currentStep.body,
        delay_days: currentStep.delay_days,
      },
    }));
  };

  const cancelEditing = (templateId: string, stepIndex: number) => {
    const key = `${templateId}-${stepIndex}`;
    setEditingSteps((prev) => ({ ...prev, [templateId]: null }));
    setEditForms((prev) => {
      const newForms = { ...prev };
      delete newForms[key];
      return newForms;
    });
  };

  const updateEditForm = (
    templateId: string,
    stepIndex: number,
    field: keyof TemplateStep,
    value: string | number
  ) => {
    const key = `${templateId}-${stepIndex}`;
    setEditForms((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const saveOverride = async (templateId: string, stepIndex: number, baseStep: TemplateStep) => {
    const key = `${templateId}-${stepIndex}`;
    const editedFields = editForms[key];

    if (!editedFields) {
      toast.error('No changes to save');
      return;
    }

    // Determine which fields have changed from base
    const overriddenFields: Partial<Pick<TemplateStep, 'subject' | 'body' | 'delay_days'>> = {};

    if (editedFields.subject !== undefined && editedFields.subject !== baseStep.subject) {
      overriddenFields.subject = editedFields.subject;
    }
    if (editedFields.body !== undefined && editedFields.body !== baseStep.body) {
      overriddenFields.body = editedFields.body;
    }
    if (editedFields.delay_days !== undefined && editedFields.delay_days !== baseStep.delay_days) {
      overriddenFields.delay_days = editedFields.delay_days;
    }

    setSaving((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await fetch(`/api/clients/${clientId}/template-overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          step_index: stepIndex,
          overridden_fields: overriddenFields,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save override');
      }

      // Refresh templates
      const templatesResponse = await fetch(`/api/clients/${clientId}/template-overrides`);
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Clear editing state
      setEditingSteps((prev) => ({ ...prev, [templateId]: null }));
      setEditForms((prev) => {
        const newForms = { ...prev };
        delete newForms[key];
        return newForms;
      });

      toast.success('Override saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const resetStepOverride = async (templateId: string, stepIndex: number) => {
    const key = `${templateId}-${stepIndex}`;
    setSaving((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await fetch(
        `/api/clients/${clientId}/template-overrides?template_id=${templateId}&step_index=${stepIndex}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to reset override');
      }

      // Refresh templates
      const templatesResponse = await fetch(`/api/clients/${clientId}/template-overrides`);
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Clear editing state if this step was being edited
      if (editingSteps[templateId] === stepIndex) {
        setEditingSteps((prev) => ({ ...prev, [templateId]: null }));
        setEditForms((prev) => {
          const newForms = { ...prev };
          delete newForms[key];
          return newForms;
        });
      }

      toast.success('Override reset to template default');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const resetAllOverrides = async (templateId: string) => {
    setSaving((prev) => ({ ...prev, [templateId]: true }));

    try {
      const response = await fetch(
        `/api/clients/${clientId}/template-overrides?template_id=${templateId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to reset all overrides');
      }

      // Refresh templates
      const templatesResponse = await fetch(`/api/clients/${clientId}/template-overrides`);
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData.templates || []);

      // Clear any editing state for this template
      setEditingSteps((prev) => ({ ...prev, [templateId]: null }));

      toast.success('All overrides reset for this template');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSaving((prev) => ({ ...prev, [templateId]: false }));
    }
  };

  const getFieldStyle = (isOverridden: boolean) => {
    return isOverridden
      ? 'border-accent bg-accent/5'
      : 'border-border';
  };

  if (loading) {
    return (
      <div className="rounded-lg border py-8 px-8">
        <h2 className="text-lg font-semibold mb-4">Template Customizations</h2>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border py-8 px-8">
        <h2 className="text-lg font-semibold mb-4">Template Customizations</h2>
        <p className="text-sm text-muted-foreground">
          No templates available. Active filing assignments with templates will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">Template Customizations</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Customize reminder templates for this client. Overridden fields will persist even when the base template changes.
      </p>
      <div className="space-y-4">
        {templates.map((templateData) => {
          const { template, overridden_field_map, resolved_steps } = templateData;
          const isExpanded = expandedTemplates[template.id];
          const hasOverrides = Object.keys(overridden_field_map).length > 0;
          const isResettingAll = saving[template.id];

          return (
            <div key={template.id} className="rounded-lg border">
              {/* Template header */}
              <div className="p-4 flex items-center justify-between">
                <button
                  onClick={() => toggleTemplate(template.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {isExpanded ? (
                    <Icon name="keyboard_arrow_down" size="sm" />
                  ) : (
                    <Icon name="chevron_right" size="sm" />
                  )}
                  <div>
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {FILING_TYPE_NAMES[template.filing_type_id]} • {resolved_steps.length} steps
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {hasOverrides && (
                    <Badge variant="outline" className="border-accent text-accent">
                      {Object.keys(overridden_field_map).length} Override
                      {Object.keys(overridden_field_map).length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {hasOverrides && isExpanded && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetAllOverrides(template.id)}
                      disabled={isResettingAll}
                      className="text-destructive hover:text-destructive/80"
                    >
                      {isResettingAll ? 'Resetting...' : 'Reset All'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Template steps */}
              {isExpanded && (
                <div className="border-t p-4 space-y-4">
                  {resolved_steps.map((step, stepIndex) => {
                    // Find base step for comparison
                    const baseStep = template.steps[stepIndex];
                    const overriddenFields = overridden_field_map[stepIndex] || [];
                    const isEditing = editingSteps[template.id] === stepIndex;
                    const editKey = `${template.id}-${stepIndex}`;
                    const isSaving = saving[editKey];

                    return (
                      <div key={stepIndex} className="rounded-md border p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="font-medium">Step {step.step_number}</div>
                          {overriddenFields.length > 0 && (
                            <Badge variant="outline" className="border-accent text-accent">
                              Customized
                            </Badge>
                          )}
                        </div>

                        {!isEditing ? (
                          <>
                            {/* Display mode */}
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  Delay Days
                                  {overriddenFields.includes('delay_days') && (
                                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                                  )}
                                </div>
                                <div className={`text-sm p-2 rounded ${getFieldStyle(overriddenFields.includes('delay_days'))}`}>
                                  {step.delay_days} days before deadline
                                  {!overriddenFields.includes('delay_days') && (
                                    <span className="text-muted-foreground ml-2">(inherited)</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  Subject
                                  {overriddenFields.includes('subject') && (
                                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                                  )}
                                </div>
                                <div className={`text-sm p-2 rounded ${getFieldStyle(overriddenFields.includes('subject'))}`}>
                                  {step.subject}
                                  {!overriddenFields.includes('subject') && (
                                    <span className="text-muted-foreground ml-2">(inherited)</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  Body
                                  {overriddenFields.includes('body') && (
                                    <Badge variant="secondary" className="text-xs">Custom</Badge>
                                  )}
                                </div>
                                <div className={`text-sm p-2 rounded whitespace-pre-wrap ${getFieldStyle(overriddenFields.includes('body'))}`}>
                                  {step.body}
                                  {!overriddenFields.includes('body') && (
                                    <span className="text-muted-foreground ml-2">(inherited)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditing(template.id, stepIndex, step)}
                              >
                                Edit Step
                              </Button>
                              {overriddenFields.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => resetStepOverride(template.id, stepIndex)}
                                  disabled={isSaving}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  {isSaving ? 'Resetting...' : 'Reset to Default'}
                                </Button>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Edit mode */}
                            <div className="space-y-3 bg-muted/50 p-3 rounded">
                              <div className="flex items-start gap-2 p-2 bg-accent/5 border border-accent/20 rounded">
                                <Icon name="info" size="sm" className="text-accent mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-accent">
                                  Only changed fields will be saved as overrides. Unchanged fields will continue to inherit from the template.
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`delay-${editKey}`}>
                                  Delay Days
                                </Label>
                                <Input
                                  id={`delay-${editKey}`}
                                  type="number"
                                  min="0"
                                  value={editForms[editKey]?.delay_days ?? step.delay_days}
                                  onChange={(e) =>
                                    updateEditForm(
                                      template.id,
                                      stepIndex,
                                      'delay_days',
                                      parseInt(e.target.value, 10)
                                    )
                                  }
                                  className={`hover:border-foreground/20 ${getFieldStyle(
                                    editForms[editKey]?.delay_days !== baseStep.delay_days
                                  )}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`subject-${editKey}`}>
                                  Subject
                                </Label>
                                <Input
                                  id={`subject-${editKey}`}
                                  type="text"
                                  value={editForms[editKey]?.subject ?? step.subject}
                                  onChange={(e) =>
                                    updateEditForm(template.id, stepIndex, 'subject', e.target.value)
                                  }
                                  className={`hover:border-foreground/20 ${getFieldStyle(
                                    editForms[editKey]?.subject !== baseStep.subject
                                  )}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`body-${editKey}`}>
                                  Body
                                </Label>
                                <Textarea
                                  id={`body-${editKey}`}
                                  rows={6}
                                  value={editForms[editKey]?.body ?? step.body}
                                  onChange={(e) =>
                                    updateEditForm(template.id, stepIndex, 'body', e.target.value)
                                  }
                                  className={`hover:border-foreground/20 ${getFieldStyle(
                                    editForms[editKey]?.body !== baseStep.body
                                  )}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveOverride(template.id, stepIndex, baseStep)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelEditing(template.id, stepIndex)}
                                  disabled={isSaving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
