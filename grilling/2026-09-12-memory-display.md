# Grilling — memory display (v5.3)

2026-09-12. Short session, one round, after v5.2 shipped.

## Jake's framing (verbatim)

"I also want to make memory display MUCH better I dont understand it now"
"Yeah lets fix the memory with a SHORT grill me then ill compact after you write the spec and give me the goal launcher"

## Position

The memory today is an essay with bold names and scores in every sentence. It reads like a list pretending to be a paragraph, it has no reading order (two columns), and no line shows where it came from. The fix is to stop asking the model for prose and ask it for claims: short beliefs, each with the titles that prove it. Code checks every cited title against the log before it renders, so the display can never name something you did not log. The page becomes one sentence about you, a handful of claims with poster marks as evidence, and your own words. "Right now" leaves the memory and comes from the rows.

## Round 1

**Q1.** Storage: keep markdown and parse it, or structured JSON claims `{ text, evidence: [imdbIds], source }`? Rec: JSON claims; markdown was the source of every ghost-title bug.
**A1.** rec is good

**Q2.** Shape: one column (sentence, claims, your words) or the model's four sections? Rec: one column, three blocks.
**A2.** rec is good

**Q3.** Evidence: poster marks with the score under each, tap opens the drawer; faces for people-claims. Rec: yes, three to five per claim.
**A3.** rec is good

**Q4.** Five to eight claims under twelve words, one sentence under twenty; code truncates. Rec: yes.
**A4.** rec is good

**Q5.** "Not me" on each claim removes it and the rewrite never reasserts it (stored rejected claims in the prompt). Rec: yes.
**A5.** rec is good

**Q6.** Negative claims kept, capped at two. Rec: yes.
**A6.** rec is good

**Q7.** "Right now" leaves the model's output; series in progress + Later come from rows as a block on You. Rec: yes.
**A7.** rec is good

**Q8.** Your words as the third block: pinned lines plus per-title notes, quotes only, newest first, six max, "all notes" links to the Log filtered to noted rows. Rec: yes.
**A8.** rec is good

Jake added (verbatim): "I also want to figure out how to make it more obvious the log chatbox is for logging new things youve seen" and "We also need to make the display of the RLing new movies better" (read as: the rating display when logging a new title on the Log page).

## Decisions (memory display, v5.3)

- Memory is JSON claims, not markdown: `{ sentence, claims: [{ id, text, evidence: [imdbId], polarity: "love" | "avoid" }], rejected: [{ text }] }`, rewritten from rows by the model, validated by code (evidence must be rows; text lengths capped; ≤8 claims, ≤2 avoid).
- You: one column — the sentence; claims with poster marks and scores; your words (pinned + notes). "Right now" and Later come from rows.
- "Not me" rejects a claim for good.
- Log page: the field says what it is for ("Log something you just watched"), and the rating step after a title is picked is a proper display (poster, title, year, the row of ten, note) rather than a bare row.
