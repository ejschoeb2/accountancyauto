/**
 * Peninsula Accounting Reminder Email Template
 *
 * Branded HTML email for client filing reminders
 * All styles are inline for email client compatibility
 *
 * Supports two modes:
 * - v1.0: Plain text body with clientName, filingType (backwards compatible)
 * - v1.1: Rich HTML body from TipTap renderer
 */

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
} from '@react-email/components';

interface ReminderEmailProps {
  subject: string;
  // v1.0 backwards compatibility: plain text mode
  body?: string;
  clientName?: string;
  filingType?: string;
  // v1.1 rich text mode: pre-rendered HTML
  htmlBody?: string;
}

export default function ReminderEmail({
  subject,
  body,
  clientName,
  filingType,
  htmlBody,
}: ReminderEmailProps) {
  return (
    <Html>
      <Head>
        <meta charSet="UTF-8" />
      </Head>
      <Body style={{ backgroundColor: '#f4f4f4', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', padding: '0' }}>
          {/* Header with logo/branding */}
          <Section style={{ backgroundColor: '#333333', padding: '20px', textAlign: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
              Peninsula Accounting
            </Text>
          </Section>

          {/* Main content */}
          <Section style={{ padding: '30px' }}>
            <Heading style={{ color: '#333333', fontSize: '20px', marginBottom: '20px' }}>
              {subject}
            </Heading>

            {/* v1.1 rich text mode */}
            {htmlBody ? (
              <div
                style={{
                  color: '#333333',
                  fontSize: '14px',
                  lineHeight: '1.6',
                }}
                dangerouslySetInnerHTML={{ __html: htmlBody }}
              />
            ) : (
              /* v1.0 plain text mode (backwards compatible) */
              <>
                <Text style={{ color: '#666666', fontSize: '14px', lineHeight: '1.6', marginBottom: '15px' }}>
                  Dear {clientName},
                </Text>

                <Text style={{ color: '#666666', fontSize: '14px', lineHeight: '1.6', marginBottom: '15px', whiteSpace: 'pre-wrap' }}>
                  {body}
                </Text>

                <Text style={{ color: '#666666', fontSize: '14px', lineHeight: '1.6', marginBottom: '15px' }}>
                  Filing Type: <strong>{filingType}</strong>
                </Text>
              </>
            )}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#f4f4f4', padding: '20px', borderTop: '1px solid #dddddd' }}>
            <Text style={{ color: '#999999', fontSize: '12px', textAlign: 'center', margin: 0 }}>
              This is an automated reminder from Peninsula Accounting
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
