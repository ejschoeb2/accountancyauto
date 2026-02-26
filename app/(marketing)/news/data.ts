export interface Article {
  slug: string;
  category: "Guide" | "Industry" | "Product";
  date: string;
  author: string;
  headline: string;
  excerpt: string;
  body: string[];
}

export const articles: Article[] = [
  {
    slug: "how-uk-accountants-lose-hours-to-manual-deadline-chasing",
    category: "Guide",
    date: "February 2026",
    author: "The Prompt Team",
    headline: "How UK accountants are losing hours to manual deadline chasing",
    excerpt:
      "Between Corporation Tax, VAT, Self Assessment, and Companies House, the average accounting practice manages thousands of deadlines each year. Here's why the manual approach is costing you more than you think.",
    body: [
      "Run the numbers for a practice with 80 clients. Each client has at least four major annual filing obligations — Corporation Tax payment, CT600 return, VAT returns (typically four per year), and a Companies House confirmation statement. Add Self Assessment for any sole traders or directors, and you're looking at upwards of 600 individual deadlines every twelve months. The moment you start tracking these manually — whether in a spreadsheet, a shared calendar, or a practice management system that requires human input — you've introduced the two most expensive variables in your workflow: time and error.",
      "The time cost is the one most practices underestimate. Sending a reminder isn't a one-click action. Someone has to identify which clients are approaching a deadline, draft or retrieve a template, personalise it, send it, then follow up if there's no response. Research from accounting industry bodies consistently finds that administrative overhead — the category reminder-chasing falls squarely into — accounts for 20–30% of billable hours lost each week in small and mid-size practices. For a sole practitioner billing at £75 per hour, even four hours of manual chasing per week represents over £15,000 in forgone revenue annually.",
      "The error cost is harder to quantify but potentially more damaging. HMRC late filing penalties for Corporation Tax start at £100 and escalate quickly. Companies House strikes off companies for missed confirmation statements. When a deadline slips because a client wasn't chased in time — or was chased but the wrong address was used — the practice may be liable for compensation, and almost certainly faces a difficult client conversation. One missed deadline can cost more than a year's subscription to a tool that would have prevented it.",
      "Client relationships are the third casualty. When clients receive reminders that feel generic, arrive at inconsistent intervals, or — worse — arrive after the deadline has already passed, it erodes confidence in the practice. Clients increasingly expect proactive, professional communication. The practices that retain clients longest aren't necessarily the ones with the best technical skills; they're the ones who make compliance feel effortless. Automating the reminder pipeline isn't a convenience — it's a competitive differentiator.",
    ],
  },
  {
    slug: "understanding-vat-stagger-groups-hmrc",
    category: "Industry",
    date: "January 2026",
    author: "The Prompt Team",
    headline: "Understanding HMRC's three VAT stagger groups — and why they matter",
    excerpt:
      "Most accountants know their clients are on a VAT quarter, but fewer know about HMRC's stagger group system — and it makes a material difference to when reminders should be sent.",
    body: [
      "When a business registers for VAT, HMRC assigns it to one of three stagger groups. This assignment determines which calendar months form the business's VAT quarters — and consequently, when its VAT returns and payments are due throughout the year. Stagger Group 1 covers quarters ending in January, April, July, and October. Stagger Group 2 covers February, May, August, and November. Stagger Group 3 covers March, June, September, and December. For each quarter, the return and payment deadline falls one month and seven days after the quarter end — so a Stagger Group 1 business with a quarter ending 31 January has until 7 March to file and pay.",
      "The practical implication for accounting practices is significant. If you don't know which stagger group each client sits in, you can't set accurate VAT reminders. A reminder sent 30 days before the deadline for a Stagger Group 3 client goes out at a different calendar date than the same logic applied to a Stagger Group 1 client — even if both clients have identical year-ends. Practices that record only a client's 'VAT quarter month' without the stagger group number are working with incomplete information, and their reminders reflect it.",
      "HMRC's stagger system also explains why VAT filing pressure is distributed unevenly across the year. Stagger Group 3 clusters with year-end accounting deadlines in March, June, September, and December, creating workload spikes that coincide with Corporation Tax and Companies House filings. Practices managing a large Stagger Group 3 cohort face compounding deadline pressure in those months. Understanding the distribution of your client base across stagger groups lets you forecast workload more accurately and staff accordingly.",
      "From a technology standpoint, proper stagger group support requires storing the integer value (1, 2, or 3) rather than inferring it from a 'VAT quarter' date. Inference is fragile — it breaks for clients whose year-end doesn't neatly correspond to a quarter boundary, and it fails entirely for clients assigned to a non-standard quarter by HMRC. Prompt stores the stagger group explicitly for every VAT-registered client, calculates the precise quarter-end dates for each stagger, and fires reminders at the correct number of days before each client's actual deadline — not an approximation of it.",
    ],
  },
  {
    slug: "client-portal-reduce-document-chasing",
    category: "Product",
    date: "December 2025",
    author: "The Prompt Team",
    headline: "Introducing the client portal: let clients upload documents directly",
    excerpt:
      "The most common frustration we hear from accountants: chasing clients for their records. We've built a secure document portal so you never have to send that email again.",
    body: [
      "The document collection problem is one of the oldest in accounting. You send a reminder, the client confirms they'll get the records over, and then nothing. You send a follow-up, they apologise and promise to look for the P60. Another week passes. What sounds like a client management issue is really an infrastructure issue: there's no frictionless path for a client to hand over a document. Email attachments get buried. Shared drives require logins. Asking clients to post physical records is increasingly unrealistic. Prompt's client portal is designed to remove every obstacle between the client and the upload.",
      "Each reminder email sent by Prompt contains a personalised, filing-specific portal link. The link requires no account creation and no password — clicking it takes the client directly to their secure upload page, pre-loaded with a checklist of the documents needed for that specific filing. For a Corporation Tax filing, the checklist might include the P&L, balance sheet, bank statements, and loan agreements. For Self Assessment, it lists employment income documents, rental income records, and any capital gains disposals. Clients see exactly what's needed, upload directly against each item, and the portal confirms receipt in real time.",
      "From the practice dashboard, every filing shows live document status: which items have been uploaded, which are outstanding, and when each file arrived. There's no need to check email or ask a colleague whether the records came in — the information is surfaced automatically. When documents remain outstanding as the deadline approaches, Prompt's automated follow-up sequence continues to fire with a fresh portal link in each message, so the client always has a current, working route to submit.",
      "Security was a primary design consideration. Portal links are short-lived and filing-specific — a link for a 2025 CT600 cannot be used to access any other client's data or any other filing period. All uploaded files are stored in EU-region infrastructure, and downloads from the practice dashboard are served via short-lived signed URLs with no direct storage access exposed. Every upload and every download is logged to a full audit trail, giving practices the accountability records they need for professional standards compliance.",
    ],
  },
  {
    slug: "self-assessment-season-january-deadline-tips",
    category: "Guide",
    date: "November 2025",
    author: "The Prompt Team",
    headline: "Preparing for Self Assessment season: get your clients ready before January",
    excerpt:
      "The January 31 deadline is the most stressful time of year for UK accountants. Here's a timeline for when to start chasing clients — and how Prompt automates it all.",
    body: [
      "Every UK accountant knows the feeling: it's the second week of January, three clients still haven't sent their records, and the 31st is approaching faster than it should. The January Self Assessment deadline is the one date in the accounting calendar that creates genuine, sustained pressure — both for practices and for their clients. The good news is that the pressure is almost entirely a product of late starts. A practice that begins its Self Assessment sequence in October is never scrambling in January. The challenge is that an October start requires discipline and systems — without automation, it's one more thing that gets deprioritised until it's urgent.",
      "The optimal timeline looks like this: in October, send an initial 'heads up' communication to all Self Assessment clients. This isn't a formal reminder — it's a prompt to start gathering records while the tax year is still fresh. Bank statements from April are easier to retrieve in October than in January. P60s and P11Ds are typically issued by July and are findable in October; by January they've migrated to an unknown drawer. An October message asking clients to locate and hold onto their documents dramatically reduces the last-minute scramble. In November, send the first formal reminder with a document checklist and a portal link. Clients who received the October heads-up are primed to act.",
      "December is when the sequence becomes more targeted. Clients who have already uploaded their documents should receive a confirmation and a note that their return will be prepared in January. Clients who haven't should receive a more direct chase — emphasising the 31 January deadline and the consequences of missing it. The tone should be firm but not alarmist; the goal is action, not anxiety. Early January is the time for a final urgent prompt to the remaining holdouts. By this point, clients who haven't responded to four or five personalised reminders are unlikely to respond to a sixth, and a phone call may be warranted — but the automated sequence has done everything possible to avoid that conversation.",
      "Prompt handles this entire sequence automatically once it's configured. You define the reminder schedule — which messages go out at which intervals — and the system fires them on your behalf for every Self Assessment client, every year, without manual intervention. The portal link in each email gives clients a direct route to upload their records, and the dashboard shows in real time which clients have submitted and which are still outstanding. In a typical Self Assessment season, practices using Prompt report that 70–80% of clients have uploaded their records before Christmas — leaving January for preparation and filing rather than chasing.",
    ],
  },
];
