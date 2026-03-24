import type { ComponentType } from "react";

import { GettingStartedIllustration } from "./getting-started";
import { ClientFieldsIllustration } from "./client-fields";
import { TrafficLightStatusIllustration } from "./traffic-light-status";
import { ClientPortalIllustration } from "./client-portal";
import { PortalDocumentsIllustration } from "./portal-documents";
import { DocumentVerdictsIllustration } from "./document-verdicts";
import { TeamSettingsIllustration } from "./team-settings";
import { CloudStorageIllustration } from "./cloud-storage";
import { FilingDeadlinesIllustration } from "./filing-deadlines";
import { VATStaggerGroupsIllustration } from "./vat-stagger-groups";
import { ReminderPipelineIllustration } from "./reminder-pipeline";
import { EmailTemplatesIllustration } from "./email-templates";
import { DocumentGuideIllustration } from "./document-guide";

export type GuideIllustration = ComponentType<{ isHovered: boolean }>;

/** Map guide article IDs → illustration components */
export const guideIllustrations: Record<string, GuideIllustration> = {
  "getting-started-with-prompt": GettingStartedIllustration,
  "understanding-client-fields": ClientFieldsIllustration,
  "traffic-light-status-system": TrafficLightStatusIllustration,
  "how-the-client-portal-works": ClientPortalIllustration,
  "managing-portal-documents-and-checklists": PortalDocumentsIllustration,
  "understanding-document-verdicts": DocumentVerdictsIllustration,
  "managing-your-team-and-settings": TeamSettingsIllustration,
  "connecting-cloud-storage": CloudStorageIllustration,
  "how-uk-filing-deadlines-are-calculated": FilingDeadlinesIllustration,
  "vat-stagger-groups-explained": VATStaggerGroupsIllustration,
  "how-the-reminder-pipeline-works": ReminderPipelineIllustration,
  "writing-effective-email-templates": EmailTemplatesIllustration,
  "document-guide": DocumentGuideIllustration,
};
