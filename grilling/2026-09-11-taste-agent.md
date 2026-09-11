# Grilling: the taste agent (what would make Headshot daily-use)

Started 2026-09-11. Every question and Jake's answer, verbatim. Recs in the questions are Claude's; Jake's words are the record.

## Framing (Jake, stream of consciousness, before round 1)

- "What would make this something I would actually use every day? Why would it be better than a Google or just a ChatGPT prompt? It has a specific knowledge set, right? Would it remember movies I've watched? ... Shouldn't it be able to open movies for you and know what you like and suggest things? ... what's the problem there for a user? Can't figure out what movie to watch, TV to watch. How do we solve that?"
- "What if we had something that was agentic and looked through everything you were subscribed to, every streaming service you had, your YouTube recommendations, and the previous movies you've watched? It has this big brain corpus and knows your Netflix recommendations. Somehow, we can see that algorithm and know you as a user. We could even have a reinforcement learning with human feedback type of thing where they just play Tinder to see if they like movies or not, and we can refine their movie and TV taste."
- Design: "I also want to figure out how we can do actual beautiful frontend design on this. A designer I really like is Ryu from Cursor. ... I really like Cursor's design. I want to figure out how we actually design a website like this and actually make something that a user likes to look at, is beautiful to look at, and so some user would actually want to use."
- ScrollGoblin (~/Documents/ScrollGoblin): "I made an app or a website for myself called Scroll Goblin, where I could feed it YouTube videos and it would make me a summary of it. What if I could do that for movies and TV and stuff, actually, with your taste and a knowledge base of your taste?"
- "Let's think about the problem and the solution ... People can't find a movie to watch, and the solution is somehow our AI. How do we get there, and how do we become better than Google or Chat?"

## Round 1

**Q1. The 9pm moment.** What does the first screen show when you open it with no question? Rec: three picks for tonight with a one-line reason each and a "not tonight" swipe that teaches it. Chat is the second tap, not the first.
**A1.** "I don't know about that 9 pm moment. I feel like it should maybe start on the chat, but I don't know. It should be like an active agent, right? Like an actual agentic thing, a harness for a consumer for a specific thing. I don't know."

**Q2. What it knows about you.** Letterboxd export CSV for v1, plus every "watched it / liked it / not for me" tap. Rec: no scraping of streaming accounts, no Trakt yet. Is a CSV upload acceptable as the on-ramp?
**A2.** "Yeah, more of what I talked about in this somehow knows your scraping of streaming accounts. I actually like that Letterboxd works well. Anything else works well. Also, just quizzing the user when they come in might work well."

**Q3. Where memory lives.** This breaks the "no accounts" rule. Rec: a lightweight identity (magic-link email, or a device key) that owns a private taste graph, layered on the shared brain. Okay adding auth, or v1 single-device localStorage?
**A3.** "Yeah, we're definitely going to want to start to have accounts now, per user. I'm happy to add auth now, but maybe that's a later thing."

**Q4. The unit of taste.** Rec: your taste is a subgraph of the industry graph, not a list of genres. Recs are walks from your cluster into unseen titles, filtered by mood, runtime, streaming. Taste map visible or hidden?
**A4.** "Yeah, definitely visible taste map, visible everything, perfect UI, very well designed."

**Q5. Mood input.** How much do you say each night? Rec: a two-chip prompt ("how long," "what energy") and free text optional.
**A5.** "Yeah, I guess I can maybe quiz you a little bit. I don't know. That's kind of a thing we'll have to figure out in the sys prompt."

**Q6. The action.** "Open it for you" means: Play button deep-linking to the streaming app, trailer inline, add to list. Controlling a TV out of scope. Agree?
**A6.** "Yeah, play button that actually takes you to a streaming service that you have. It knows what streaming services you are subscribed to, and it can take you directly there. Controlling actual TV is out of scope."

**Q7. TV versus movies.** Rec: v1 is movies plus limited series only, TV series later.
**A7.** "We have TV and movies. TV is equally as important as movies. Keep TV now. I watch TV more."

**Q8. Why it's fun, not a chore.** Rec: after you watch something it asks one question and updates your map visibly. Is this the hook, or is the hook social?
**A8.** "Yeah, it's like a brain that grows with you. I don't know. You can maybe even later, out of scope, connect to a friend in multiplayer."

## Decisions so far (derived from round 1)
- Accounts are coming (per-user taste memory); timing open.
- Taste map is visible and central; design quality is a hard requirement (Cursor-grade).
- TV and movies equal; TV first-class from day one.
- Play button deep-links into services the user actually has; no TV control.
- Onboarding: Letterboxd import + quiz; scraping streaming accounts is desired but unresolved.
- Start screen: probably chat, but "an active agent" rather than a search box; undecided.

## Round 2

Jake: "Rec is good for all of them." Each rec below is therefore a decision.

**Q1. The one job.** Rec: "pick tonight" with a Play button; the swipe deck is its onboarding, "would I like X" comes free through chat. → **Accepted.**
**Q2. Agentic means what.** Rec: it runs without being asked. Overnight it scans what landed on your services, checks new releases against your taste graph, and has a short deck ready when you open it (ScrollGoblin Scout style). Chat is for talking back. → **Accepted.**
**Q3. Knowing your services.** Rec: no scraping. You tell it which services you pay for (one-time checklist); TMDB provider data does the rest. Netflix's algorithm is not observable; taste is inferred from what you say you watched. → **Accepted.**
**Q4. YouTube as taste signal.** Rec: v2, via Google Takeout, not v1. → **Accepted.**
**Q5. The swipe deck.** Rec: fifty titles at onboarding (seen and liked / seen and meh / never seen / want to see), then a daily deck of eight. Explicit only, undo always. → **Accepted (explicit only).**
**Q6. What taste is made of.** Rec: a per-user embedding from rated titles plus graph structure (people you keep watching, eras, runtimes you finish); every rec carries a reason in graph terms. → **Accepted.**
**Q7. TV.** Rec: it tracks where you are in a show from your taps; "pick tonight" may answer "one more episode of X" as legitimately as "start Y." → **Accepted.**
**Q8. Design.** Rec: a short design system doc before code (palette, type, three core layouts: home, title, taste map), built through the gstack design skills, with Cursor and Ryu's work as the reference set; Claude proposes a mood set for Jake to react to. → **Accepted.**
**Q9. Same app or new.** Rec: same repo and brain, new top-level surface; Headshot's paths and identification become tools the taste agent calls; shared brain public, taste graph private per account. → **Accepted.**
**Q10. Who it's for.** Rec: Jake first, then a few friends, then the market. → **Accepted.**

## Round 3

Jake: "Rec is good for all of them, I think." Each rec below is a decision.

**Q1. Auth.** Rec: Neon Auth, magic-link email, no passwords. Taste rows carry a user id; shared brain unchanged. Sign-in appears only at first swipe or "I watched it." → **Accepted.**
**Q2. Taste store.** Rec: three tables: `watched` (user, title, four-bucket rating, when, source), `services` (user, provider ids), `taste` (user, one 512-dim vector recomputed nightly, plus derived facts JSON). Nothing else stored. → **Accepted.**
**Q3. How a pick is made.** Rec: candidates = unseen titles on your services (recent or trending) plus graph neighbors of your five-stars; score = cosine to taste vector + graph proximity − swipe-away penalty, filtered by runtime and energy. The model only writes reasons for the top three and swaps on request. Wildcard left open (not required). → **Accepted.**
**Q4. Reason line.** Rec: exactly one reason per pick and it must be a real graph fact; no graph reason, no deck slot. → **Accepted.**
**Q5. Overnight run.** Rec: Vercel cron ~4am per active user (30 days): refresh availability by provider, rescore, write a deck of eight and three picks, one cheap model call for reasons. → **Accepted.**
**Q6. Letterboxd import.** Rec: CSV export upload (ratings, watched, watchlist), matched by title + year, review screen for the ten worst matches, re-upload replaces, no account link. → **Accepted.**
**Q7. Onboarding order.** Rec: services (six taps) → Letterboxd or skip → fifty-title swipe (skippable after twenty) → first three picks. Under three minutes. → **Accepted.**
**Q8. TV position.** Rec: "which season are you on" asked once for a show marked watching, then "one more episode" taps; never scrapes viewing. → **Accepted.**
**Q9. Home screen.** Rec: chat composer on top with the agent's opening message already there: tonight's three picks as cards with Play, deck below. "Starts on chat" and is the 9pm moment. → **Accepted.**
**Q10. Play.** Rec: JustWatch deep links from TMDB; on none of your services, show rent/buy price instead of hiding. → **Accepted.**
**Q11. Taste map.** Rec: private ego graph, you at the center, rated people and titles as rings colored by rating, industry graph faint behind; same sigma canvas. Second tab, timing per build order. → **Accepted.**
**Q12. Build order.** Rec: design system doc first; A) auth + taste store + Letterboxd + services; B) pick engine + home with Play; C) swipe deck + nightly cron; D) taste map + design pass. → **Accepted.**

## Design direction (mood set, 2026-09-11)

Three boards shown (A Chrome restraint, B Typographic, C Poster study). Jake: "B's reason lines inside A's frame."
Jake: "Do we need a tonight? We could have like a watch later? Not sure." Claude's rec, adopted pending objection: Tonight stays the home surface and the name (the decision is the hook); Later is a chip on it holding dismissed picks ("not tonight" = later) and the imported Letterboxd watchlist; the pick engine draws from Later first so the list drains.

## After the first real onboarding (Jake, 2026-09-11 evening)

Jake's notes, verbatim: "You shouldn't be able to just click your profile and instantly be signed out. That sucks." / "You should be able to expand the sidebar for sure." / "I don't understand the difference between the Tonight and the Home screen. I don't like that." / "when I click it, it goes to the movie database. Instead, it should just take me to that streaming service that I clicked on and open up the movie for me" / "New questions tonight are the same thing." / "History is really weird. That should just look like normal ChatGPT history." / "Clicking the Taste Brain and the Brain brings up… the taste map, which sucks because it's just some weird graph. The more we do this, I'm starting to like the graph less and less." / "Let's actually think about what we're actually building."

Claude's position, adopted as the working direction: the graph is infrastructure (truth, one-line reasons, identification), not the product. The product is a personal movie/TV agent: Tonight is home, chat is how you talk to it, Play opens the service. Graph surfaces leave the nav; the only graph pictures are the chain inside a trivia answer and a small "why this connects to you" strip on a title page. Sidebar becomes ChatGPT-shaped (collapsible; New chat, Tonight, Later, history list; account menu with sign out at the bottom). Play deep-links into the service's search for the title until per-service ids exist.

## Notes after the sidebar rework (Jake, 2026-09-11, late)

Verbatim: "I'm confused why we have a new chat in it tonight. It's kind of weird. We shouldn't need both. Are they kind of the same thing, or are they separate, like we have a dashboard and then a chat?" / "Services and Imports is kind of weird. That should be more of a settings page in Your Taste. It just sucks so far. We're going to have to add different mechanisms for people to be able to give us their taste, and we can build basically a memory of them." / "We also need to redesign the website because it still looks like shit. I don't know how the chat looks. I don't know how the chat actually acts, but we'll fix it."

Open for the next grilling: (1) dashboard-with-a-chat vs a chat that opens on tonight's plan (Claude's vote: the latter; one Tonight button, History under it, no New chat); (2) Your taste as the settings page: services, imports, what it knows, and the mechanisms for building a memory of a person (imports, swipes, chat, "I watched it" after Play, check-ins); (3) a real visual redesign of every screen; (4) how the chat should look and behave.
