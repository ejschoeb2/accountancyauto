/**
 * Record the ad-hoc email demo.
 * This is a convenience wrapper — the recording logic lives in scripts/demo/recordings/adhoc-email.ts
 *
 * Usage: npx tsx scripts/record-demo.ts
 */

import { runDemo } from "./demo/helpers";
import demo from "./demo/recordings/adhoc-email";

runDemo(demo);
