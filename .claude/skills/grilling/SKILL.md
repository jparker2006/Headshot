---
name: grilling
description: Grill a product direction until every decision is explicit. Rounds of pointed questions with a recommendation each, the user answers or says "rec is good", every question and answer saved verbatim to a markdown record, then a spec section written from the decisions. Use when the user says "grill me", "grilling session", "let's think about what we're building", or wants to harden a direction before building.
---

# Grilling

The method used for Headshot v1, v2 and v3. It exists because building on an unexamined direction wastes days.

## Rules
1. **Record everything verbatim.** Before the first question, create or append to `grilling/<YYYY-MM-DD>-<topic>.md` in the repo. Write the user's framing (their own words), then each round as `**Qn.** <question with rec>` / `**An.** <their exact answer>`. "Rec is good" is recorded as the rec becoming a decision. Update the file after every user message, before replying.
2. **Rounds of 6–12 questions.** Each question names the real tradeoff and ends with a recommendation ("Rec: …"). Never ask something the codebase or a sensible default can answer. Questions get harder each round: round 1 is who/what/why, round 2 is the shape of the product, round 3 is the hard parts (data, money, auth, what ships first).
3. **Start with a position.** Open each session with two or three paragraphs of what you actually think, stated plainly, before the questions. The user is grilling a point of view, not a survey.
4. **Chase contradictions.** When an answer conflicts with an earlier decision or with what the product does today, say so in the next round and ask which one wins.
5. **Stop at three rounds unless the user asks for more.** Then write the spec: a new section in `SPEC.md` (problem, who it's for, user stories numbered on from the last one, implementation decisions, testing decisions, build order, out of scope) and a `## Decisions` block at the end of the record. Commit both.
6. **Design decisions go to `DESIGN.md`** when the session touches the UI, and a mood set (two or three boards on a design canvas) is offered before any screen is built.
7. **Do not build during the grilling.** The deliverable is the record and the spec section; the user launches the build separately (usually `/goal` pointed at the spec section).

## Voice
Direct, opinionated, short. Name the tradeoff, give the rec, move on. No lists of options without a pick.
