import { redirect } from 'next/navigation';

// Redirect legacy /email-logs route to /activity
export default function EmailLogsRedirect() {
  redirect('/activity');
}
