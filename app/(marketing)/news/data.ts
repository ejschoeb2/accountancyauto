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
    slug: "mtd-income-tax-what-your-practice-needs-to-know",
    category: "Industry",
    date: "March 2026",
    author: "The Prompt Team",
    headline: "MTD for Income Tax: what your practice needs to know before April 2026",
    excerpt:
      "Making Tax Digital for Income Tax Self Assessment is arriving for the first wave of taxpayers. Here's what's changing, who's affected, and how to prepare your practice.",
    body: [
      "Making Tax Digital for Income Tax Self Assessment (MTD for ITSA) represents the most significant change to UK tax reporting since Self Assessment itself. From April 2026, sole traders and landlords with qualifying income above £50,000 will be required to keep digital records and submit quarterly updates to HMRC through MTD-compatible software. The threshold drops to £30,000 from April 2027. For accounting practices, this isn't a distant concern — it's an operational shift that needs planning now.",
      "The quarterly submission requirement is the headline change. Instead of a single annual Self Assessment return, affected clients will submit summary updates to HMRC four times a year, followed by a final declaration that replaces the traditional return. Each quarterly update covers a three-month period and must be filed by the deadline — typically one month after the quarter ends. For a practice managing 200 sole trader clients, that's potentially 800 additional filing touchpoints per year. The administrative overhead of tracking and chasing these submissions manually is, frankly, unworkable at scale.",
      "The practical challenge for most practices isn't the software — it's the client communication. Many sole traders and landlords have spent decades filing once a year. Shifting them to quarterly digital record-keeping requires education, repeated reminders, and a reliable system for collecting records four times as often. Practices that already have automated reminder pipelines are significantly better positioned: the infrastructure for chasing clients on a schedule already exists, and extending it to quarterly MTD submissions is a configuration change rather than a process overhaul.",
      "Prompt is built around exactly this kind of deadline complexity. Each client's filing obligations — whether annual Corporation Tax, quarterly VAT, or the new quarterly MTD for ITSA submissions — are tracked individually with deadlines calculated from their specific periods. As MTD for ITSA rolls out, practices using Prompt can configure reminder sequences for quarterly submissions alongside existing annual obligations, ensuring clients receive timely, filing-specific prompts for every deadline without the practice having to manage the calendar manually. The shift to quarterly reporting is significant, but with the right infrastructure it doesn't have to mean four times the admin.",
    ],
  },
  {
    slug: "hidden-cost-missed-companies-house-confirmation-statements",
    category: "Guide",
    date: "March 2026",
    author: "The Prompt Team",
    headline: "The hidden cost of missed Companies House confirmation statements",
    excerpt:
      "A missed confirmation statement doesn't just mean a fine — it can trigger a strike-off that dissolves your client's company entirely. Here's why this deadline deserves more attention.",
    body: [
      "Of all the UK filing deadlines an accounting practice tracks, the Companies House confirmation statement is the one most likely to be overlooked — and the one with the most disproportionate consequences when it is. Unlike Corporation Tax or VAT, where a missed deadline results in a financial penalty, a missed confirmation statement can lead to Companies House initiating proceedings to strike the company off the register. Once struck off, the company ceases to exist as a legal entity. Its assets vest in the Crown. Its bank accounts are frozen. Directors can face personal liability for debts. Restoration is possible but expensive, time-consuming, and entirely avoidable.",
      "The confirmation statement itself is straightforward. Every company must confirm that the information Companies House holds — registered office, directors, shareholders, SIC codes, and persons with significant control — is accurate, at least once every 12 months from the date of incorporation or the last confirmation statement. The filing fee is £34 for online submissions. The form takes minutes to complete if the information hasn't changed. Yet practices consistently report that this is one of the most commonly missed deadlines, precisely because it seems so routine. It falls through the cracks not because it's complex, but because it's easy to deprioritise.",
      "The strike-off process adds a deceptive buffer that makes the problem worse. Companies House sends two gazette notices before dissolving a company, and the process typically takes around three months from the first notice. This delay creates a false sense of security — practices that spot a missed confirmation statement after the first gazette notice assume they have time, and sometimes they do. But the gazette notice damages the company's credit profile immediately, and lenders, suppliers, and clients who run routine checks may see a company 'proposed for strike-off' and draw their own conclusions. The reputational cost arrives long before the legal one.",
      "Automated tracking eliminates this risk entirely. Prompt calculates each company's confirmation statement deadline from its incorporation date or last filing, and fires reminder sequences on the practice's schedule — typically starting 60 days before the due date. The practice doesn't need to maintain a spreadsheet of incorporation dates or manually check Companies House for each client. The system knows what's due and when, and it chases accordingly. For a deadline that costs £34 to file and potentially tens of thousands to fix if missed, automated reminders aren't a convenience — they're basic risk management.",
    ],
  },
  {
    slug: "uk-accounting-software-market-2026-automation",
    category: "Industry",
    date: "March 2026",
    author: "The Prompt Team",
    headline: "UK accounting software in 2026: where compliance automation is headed",
    excerpt:
      "The tools accountants use are changing fast. From MTD mandates to AI-powered document processing, here's where the UK accounting software market is heading — and what it means for your practice.",
    body: [
      "The UK accounting software market has undergone more change in the past three years than in the previous decade. Making Tax Digital drove the first wave — practices that had relied on desktop software and manual HMRC submissions were forced onto cloud platforms capable of digital filing. That transition is largely complete. The next wave is different: it's not about digitising what practices already do, but about automating the administrative work that sits around the compliance itself. Filing a VAT return takes minutes. Chasing the client for records, tracking the deadline, sending reminders, following up, and logging the communication takes hours. The software market is shifting its focus from the filing to everything that happens before it.",
      "Practice management platforms — the traditional hub of client and deadline tracking — are responding by adding automation features, but they're doing so within systems designed primarily for time recording, billing, and workflow management. The result is often a compromise: reminder functionality bolted onto a platform optimised for something else. Dedicated compliance automation tools like Prompt take the opposite approach, building from the deadline outward. Every feature — reminder sequences, document collection, client portals, email tracking — exists to serve a single goal: ensuring the right client is chased for the right filing at the right time, with minimal manual effort from the practice.",
      "Document collection is emerging as the next frontier. The bottleneck in most compliance workflows isn't the filing itself — it's getting the records from the client. Practices report spending more time chasing documents than preparing returns. The market is responding with client portals, automated document requests, and increasingly, AI-powered document classification that can identify what a client has uploaded, verify it against what's needed, and flag discrepancies before the accountant opens the file. This shifts the practice's role from administrative coordinator to quality reviewer — a fundamentally more efficient and more valuable use of professional time.",
      "The MTD for Income Tax rollout from April 2026 will accelerate all of these trends. Quarterly submissions mean four times the filing touchpoints, four times the client communication, and four times the document collection cycles. Practices that are already stretched managing annual deadlines manually will find quarterly obligations unmanageable without automation. The practices that invested early in compliance automation infrastructure — automated reminders, client self-service portals, intelligent document handling — will absorb the MTD transition with minimal disruption. Those that didn't will face a choice: invest now, or accept that a growing share of their professional time is spent on admin that software could handle.",
    ],
  },
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
