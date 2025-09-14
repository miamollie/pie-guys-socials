
# Pie Guys Automated socials


🥧 Iteration 1 – Email-only suggestions (no automation on posts)

What happens:

Cron (AWS EventBridge or Zapier schedule) runs once/week.

Pull metrics (via Instagram Graph API or export from Metricool/Buffer).

AgentDB/Sheets stores them.

LLM generates: “This week’s summary + 3 draft captions.”

You get an email report — nothing posts automatically.

Output: Email with insights + suggestions.

Setup cost: Low → just needs one automation + email delivery.

Pros: Safe (LLM can’t post anything). Easy for non-tech team to consume.

Cons: Still need manual posting.

🥧 Iteration 2 – Drafts in scheduler (semi-automated)

What happens:

Same as Iteration 1, but instead of only emailing, system also pushes suggested posts into Buffer/Later draft queue.

You log in, approve/tweak, then publish or schedule.

Output: Email + preloaded drafts in scheduler.

Setup cost: Medium → add scheduler API integration.

Pros: Saves the step of retyping captions. Built-in safety net (nothing posts without approval).

Cons: Slightly more tooling complexity (need Buffer/Later).

🥧 Iteration 3 – “Approve by reply”

What happens:

You still get weekly email.

If you reply “yes” → system automatically moves drafts from “pending” → “scheduled”.

If “tweak” → system opens Google Doc/Sheet with editable captions.

Output: Email + approval loop.

Setup cost: Medium-high (needs email parser or webhook for replies).

Pros: Hands-off publishing once trust is established.

Cons: Must manage reply parsing reliably.

🥧 Iteration 4 – Full auto-posting (hands off)

What happens:

LLM generates insights + posts.

Posts go straight to Instagram via Buffer API or Meta’s Content Publishing API.

Optional: send email “This week’s posts have been scheduled. Here’s the summary.”

Output: Auto-posts with optional recap.

Setup cost: High (risk tolerance + QA).

Pros: Zero human involvement once it works.

Cons: Risk of tone mismatch, wrong image, or poor post slipping through.