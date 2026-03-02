/**
 * TipTap to Email HTML rendering pipeline
 *
 * Converts TipTap JSON content to email-safe HTML with inline styles
 * Pipeline: TipTap JSON -> HTML -> variable substitution -> React Email -> inline-styled email HTML
 *
 * For ad-hoc emails, use renderTipTapEmailSimple() which skips the React Email
 * template wrapper and produces a lightweight HTML email preserving bold/italic.
 */

import { generateHTML } from '@tiptap/html'
import { render } from '@react-email/render'
import { getSharedExtensions } from './tiptap-extensions'
import { substituteVariables, TemplateContext } from '@/lib/templates/variables'
import ReminderEmail from './templates/reminder'

interface RenderTipTapEmailParams {
  bodyJson: Record<string, any>    // TipTap JSON content
  subject: string                   // Subject line (may contain {{placeholders}})
  context: Partial<TemplateContext> // Client data for variable substitution
  clientId?: string                 // Optional: for unsubscribe link
}

interface RenderTipTapEmailResult {
  html: string    // Fully rendered, inline-styled email HTML
  text: string    // Plain text fallback
  subject: string // Subject with variables substituted
}

/**
 * Render TipTap JSON content to email HTML
 *
 * @param params - Template content and client context
 * @returns Email HTML, plain text, and resolved subject
 * @throws Error if bodyJson is malformed or invalid
 */
export async function renderTipTapEmail(
  params: RenderTipTapEmailParams
): Promise<RenderTipTapEmailResult> {
  const { bodyJson, subject, context, clientId } = params

  // Step 1: Validate and convert TipTap JSON to raw HTML
  let rawHtml: string
  try {
    rawHtml = generateHTML(bodyJson, getSharedExtensions())
  } catch (error) {
    throw new Error(
      `Invalid template content: ${
        error instanceof Error ? error.message : 'Malformed TipTap JSON'
      }`
    )
  }

  // Step 2: Build safe context with fallbacks for missing data
  const safeContext: TemplateContext = {
    client_name: context.client_name || '[Client Name]',
    deadline: context.deadline || new Date(),
    filing_type: context.filing_type || '[Filing Type]',
    accountant_name: context.accountant_name || 'Prompt',
  }

  // Step 3: Substitute variables in HTML body and subject
  const resolvedHtml = substituteVariables(rawHtml, safeContext)
  const resolvedSubject = substituteVariables(subject, safeContext)

  // Step 4: Render via React Email (with inline styles)
  const emailHtml = await render(
    ReminderEmail({
      subject: resolvedSubject,
      htmlBody: resolvedHtml,
      clientId,
    }),
    { pretty: false } // CRITICAL: Keep compact to avoid Gmail 102KB clipping
  )

  // Step 5: Generate plain text fallback
  // Convert <br> and </p> to newlines before stripping HTML
  const plainText = resolvedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '') // Strip all HTML tags
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .trim()

  return {
    html: emailHtml,
    text: plainText,
    subject: resolvedSubject,
  }
}

/**
 * Render TipTap JSON to a simple HTML email (for ad-hoc sends)
 *
 * Skips the React Email template wrapper. Produces a minimal HTML envelope
 * that preserves bold, italic, links, and lists without any branding chrome.
 * Safe to call client-side (no React Email dependency).
 *
 * @param params - Template content and client context
 * @returns Minimal HTML email, plain text, and resolved subject
 * @throws Error if bodyJson is malformed or invalid
 */
export function renderTipTapEmailSimple(
  params: RenderTipTapEmailParams
): RenderTipTapEmailResult {
  const { bodyJson, subject, context } = params

  // Step 1: Validate and convert TipTap JSON to raw HTML
  let rawHtml: string
  try {
    rawHtml = generateHTML(bodyJson, getSharedExtensions())
  } catch (error) {
    throw new Error(
      `Invalid template content: ${
        error instanceof Error ? error.message : 'Malformed TipTap JSON'
      }`
    )
  }

  // Step 2: Build safe context with fallbacks
  const safeContext: TemplateContext = {
    client_name: context.client_name || '[Client Name]',
    deadline: context.deadline || new Date(),
    filing_type: context.filing_type || '[Filing Type]',
    accountant_name: context.accountant_name || 'Prompt',
    documents_required: context.documents_required,
    portal_link: context.portal_link,
  }

  // Step 3: Substitute variables
  const resolvedHtml = substituteVariables(rawHtml, safeContext)
  const resolvedSubject = substituteVariables(subject, safeContext)

  // Step 4: Minimal HTML envelope — preserves formatting, no branded wrapper
  const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div>${resolvedHtml}</div>
</body>
</html>`

  // Step 5: Plain text fallback
  const plainText = resolvedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    html: emailHtml,
    text: plainText,
    subject: resolvedSubject,
  }
}
