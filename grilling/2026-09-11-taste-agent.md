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

---

# Session 4 — Product direction (2026-09-11, night)

Jake's framing, verbatim: "Dude, let's do a round of grill-me where we take this next, including what I just told you about where it comes to services and imports being weird and being more of a settings page. Take out either new chatter tonight because it looks weird (we just discussed it), and also just fix the design of the website because I think it looks like shit.

We'll also do a grilling of how to hone in on someone's taste better, and this should be more of a product direction grilling. What would people actually use this thing for? Remember to save all my answers to grilling in a document somewhere. I don't know. Something I'm also thinking about is whether ChatGPT released an agents API today, where I think you can basically make your own agent harness or something like that online. I don't know. Might be too expensive for our use case, though, like a personal harness with movies or something. I don't know, just thinking. Do the grill, man."

## Claude's position (session 4)

The product is not a chat and not a dashboard. It is a nightly plan you can talk back to. One surface: open the app and the agent has already said something ("Tonight: three things, here's why, Play"). Typing under it is the same thread. History is the past nights. "New chat" dies; "Tonight" is the only home. Trivia is a thing the agent can also do, not a mode.

Taste is memory, not a map. A person page ("Your taste") that reads like what a good friend knows about you: services, what you've told it, what it has concluded, imports, and a way to correct it. Every mechanism for learning taste should be a moment that already happens (after Play, after a swipe, in chat), never a form. Memory is a text document per user the model can read and rewrite, plus the structured tables we already have.

The design problem is not tokens, it is that the app has no idea; it is a generic dark SaaS shell. The redesign should commit to one thing (posters and the plan) and spend nothing elsewhere.

On OpenAI's agent harness: hosting the loop elsewhere buys nothing here. The loop is small (pick, narrate, answer); what's expensive and ours is the graph, the taste memory, and the tool set. Stay on the AI SDK + OpenRouter. Not a decision to make tonight.

## Round 1 (who / what / why)

**Q1. What would someone actually open this for.** Rec: the 9pm moment only ("what do I watch tonight"), with trivia as a bonus. Not a tracker, not Letterboxd, not a discovery feed.
**Q2. One surface.** Rec: delete New chat. Home = Tonight = the agent's message with three picks + composer beneath. History lists previous nights and any side threads. A question typed on Tonight continues that night's thread.
**Q3. What makes it different from asking ChatGPT.** Rec: three things ChatGPT can't do: it knows your services and links Play, it remembers everything you've told it without re-prompting, and its reasons are real graph facts. Everything we build should sharpen one of those three.
**Q4. Your taste = the settings page.** Rec: rename the sidebar item to "You". Sections: What I know about you (prose memory), Services, Imports (Letterboxd, later YouTube/Netflix history), Watched log, Later. Onboarding becomes the empty state of this page, not a separate route.
**Q5. Memory model.** Rec: two layers. Structured (watched, services, taste vector) as today, plus a per-user markdown memory the agent rewrites after each conversation and each swipe session: ~40 lines, editable by the user, shown on the You page verbatim. The model reads it every turn.
**Q6. Mechanisms for learning taste, ranked.** Rec: (1) after Play, next open asks "did you watch X? how was it" as the first line of the plan; (2) chat statements ("I hated Dune 2") are stored as memory + rating; (3) swipe deck stays for onboarding and cold-start only; (4) Letterboxd import; (5) Netflix viewing-activity CSV (they let you download it) as the next import. Drop the daily deck as a standalone surface.
**Q7. Who's the user.** Rec: you and a handful of friends who watch a lot and get stuck choosing; not casual viewers. Design for someone who has 200+ titles of history, not 5.
**Q8. What the app looks like in one sentence.** Rec: a quiet dark room where the posters are the only color; the agent talks in short lines; nothing looks like a SaaS dashboard (no cards-with-borders, no stat tiles, no mono uppercase labels).
**Q9. OpenAI agent harness.** Rec: no. Our loop stays in the AI SDK on OpenRouter; revisit only if we need hosted memory or long-running sessions we can't do on Vercel.

**A1.** "Honestly, I don't see someone opening this as a 9 pm rec. I don't know why I'd see someone opening this. To be honest, I'm kind of just building it for fun, but I don't know. Something I don't like about Letterbox is that it doesn't have TV, and it doesn't have deep AI analytics and a taste profile. I don't know. Maybe I'm thinking about this wrong. I probably won't even make this a big product or anything that I market, but I'm just thinking it's more useful as that."
**A2.** "Rec is good, but I don't know if we need tonight or home. I don't know, whatever."
**A3.** "Yeah, exactly. Good. Rec is good. The thing is, when you click play, it doesn't actually open them well enough. You need to go to TMDB and then click the link on the streaming service through there because the way you did it doesn't work."
**A4.** "Maybe, I don't know. Maybe you have a lore memory page instead of in the settings that you can build by swiping on movies or something. I don't know."
**A5.** "Yeah, definitely going to need that two-layer memory. Maybe even a third layer of something else, but that two-layer memory sounds good."
**A6.** "Yeah, let them rate and just text. Yeah, I like all these mechanisms. All these recs are good. One thing: the user shouldn't have to download that Letterboxd data themselves. We should have a way to have the agent do it for them on that, Flix, and Letterbox and stuff like that. I don't know."
**A7.** "Yeah, just a bunch of friends who watch a lot of shit, like film buffs."
**A8.** "I think that makes sense. I don't know. I kind of like sassy designs, but just a cool design, like a cursor riot type of design for someone who watches movies. Look into cool design on Twitter. I don't know, haven't done that yet, and use cool design skills."
**A9.** "No, we don't need that agent harness yet."

## Round 2 (the shape of the product)

Contradiction to settle first: session 3 round 2 decided "the one job is pick tonight." A1 now says the 9pm moment is not why anyone opens it; the thing Letterboxd lacks is TV plus a real AI taste profile. Those are different products. The first is a plan you consume; the second is a log you keep and a mirror you look into.

**Q1. Which product wins.** Rec: the Letterboxd-with-TV-and-a-brain framing wins. The spine is the log (everything you've seen, film and TV, rated), the payoff is the taste profile and a friend who's read it. "Tonight" demotes from home to one thing you can ask. The name "Tonight" leaves the nav.
**Q2. So what is home.** Rec: home is "You": the memory page. Top: what it knows about you in prose (the markdown memory), then recently logged, then the pick for tonight as one row you can expand. The chat composer is pinned at the bottom of every page and opens a thread; there is no chat "surface", only threads in History.
**Q3. Logging.** Rec: logging is the primary verb, like Letterboxd's diary. One field: type a title, it resolves against the graph (film or show, season for TV), one tap for the rating bucket, optional one line of text. The one line goes into memory verbatim. Rating stays four buckets, no stars.
**Q4. Swipes as lore.** Rec: keep the deck as the fun way to log the back-catalog ("you've seen 40 things, keep going"), reachable from the You page, never a nav item. Each swipe session ends with the memory being rewritten and the diff shown ("I now think you avoid slow burns"). That is the "lore" A4 wants.
**Q5. Getting Letterboxd without a download.** Rec: Letterboxd profiles are public by default; user gives their username, we crawl their films/diary/watchlist pages server-side (no login, no credentials). Netflix viewing history needs a login and there is no API; we do not ask for streaming passwords. Netflix stays a CSV upload. No credential-holding agent, ever.
**Q6. Play that works.** Rec: stop guessing service search URLs. Use TMDB's watch/providers link (the JustWatch page for that title), which resolves to the actual service deep link on click. One hop, but it lands on the movie every time. Later: per-service ids from JustWatch's own API if we get access.
**Q7. The third memory layer.** Rec: an episodic layer: a dated list of moments ("2026-09-11: watched Heat after I suggested it, said the ending dragged"). Structured tables (facts), prose memory (beliefs), episodes (evidence). The model gets facts + beliefs every turn and pulls episodes by search only.
**Q8. TV specifically.** Rec: a show is logged once with a status (watching / finished / dropped) and a season pointer; episodes are never logged individually. "One more episode" lives in the pick row, not in the log.
**Q9. Analytics.** Rec: a "Year in review" style page is out of scope; the profile prose plus five hard numbers (titles, hours, TV share, most-watched people, decade) is the whole analytics story. Charts stay out until someone asks.
**Q10. Design process.** Rec: I do the Twitter/Dribbble research myself (Cursor, Riot, Linear, Arc, Ryu), produce three boards on the design canvas with real posters and real memory text, you pick. No tokens change until a board wins. The boards must show the You page, a thread, and the log field.
**Q11. What ships first.** Rec: (A) memory layers + log field + You page; (B) Letterboxd-by-username crawl + Play via TMDB provider link; (C) redesign of every screen from the winning board; (D) swipe-as-lore with the memory diff. Tonight's pick engine stays as is and becomes the "tonight" row.

**A1.** "Yeah, rec looks good for that. I agree."
**A2.** "Yeah, I like that as well."
**A3.** "Yeah, I like that. I also like the swiping mechanic."
**A4.** "Yeah, I really like the swiping mechanic because you can kind of go back and show everything you've seen before."
**A5.** "No, I'd rather do actual data exports for now, because crawling is kind of hard unless you can actually pull their data from a crawl. I would actually be okay holding streaming passwords. I don't think that's the worst thing in the world, and we can somehow go and get their Netflix data. I don't know, that's a further thing in the future, though."
**A6.** "Yeah, rec is good."
**A7.** "Yeah, that looks good. Rec is good."
**A8.** "Yeah, perfect. Q8 is good."
**A9.** "Yeah, not year in review, but actual analytics on what they've watched and stuff like that. That's cool."
**A10.** "Yeah, I agree with you on Q10."
**A11.** "I agree, except take out the letterbox by username crawl unless it's an actual thing from B. Yeah, I'm liking this, though."

Decisions from round 2: Q1, Q2, Q3, Q4, Q6, Q7, Q8, Q10 accepted as written. Q5: exports (CSV) only for now; no crawl; streaming-password login parked as future, not in scope. Q9: real analytics on what they've watched is in scope (not a year-in-review). Q11: build order stands minus the crawl.

## Round 3 (the hard parts)

Two things to settle from your answers. A9 vs my Q9: I said no charts, you said real analytics. Analytics wins; question 1 pins what that means. A5: you'd hold streaming passwords. I'll say it once: a password to Netflix is a password to a card on file, and Netflix's terms and bot defenses make it a support nightmare, not a moral one. It stays parked as "future", recorded, not built.

**Q1. What analytics means.** Rec: one page under You called "Numbers", four sections: volume over time (titles and hours per month, film vs TV stacked), people (top 12 actors/directors by count with faces), taste shape (decades, runtimes you finish, genres by bucket liked/meh), and the log itself as a filterable table. All computed from the watched table + graph; no model call. Charts hand-drawn SVG, no chart library.
**Q2. Runtime and hours.** Rec: hours need runtimes for films and episode counts for TV; the graph has neither. Add a TMDB-backed `titles` cache table (runtime, episodes per season, genres, poster) filled lazily on log/import. It also fixes the name/poster lookups the client does now.
**Q3. The prose memory: who writes it.** Rec: a model job (DeepSeek, cheap) rewrites it after any session that changed the log or after a chat that made a taste statement; it gets the old memory, the facts, and the new episodes, returns ≤40 lines of markdown. Never rewritten mid-conversation. User edits are kept verbatim and marked so the rewrite can't overwrite them.
**Q4. Chat scope.** Rec: the chat has the full tool set (log, rate, memory read, tonight, trivia). Threads live in localStorage still, but a thread's taste statements are extracted into episodes server-side at the end of each turn, so memory survives a cleared browser. Conversations themselves are never stored.
**Q5. Swipe as lore.** Rec: the deck draws from titles the graph thinks you may have seen (neighbors of your liked people + popular unrated titles from your eras), 30 per session, four buckets, undo. After each session: memory rewrite + a diff view ("added: you keep coming back to Denis Villeneuve"). The deck lives on You, one button.
**Q6. Imports.** Rec: Letterboxd CSV (done), Netflix viewing-activity CSV (title only, matched by name; marks seen, not liked), IMDb ratings CSV (has imdb ids, best match). All three on the Imports section of You. Re-upload replaces per source.
**Q7. Signed-out.** Rec: signed-out Headshot becomes the trivia chat and public answer pages only; You, log, swipes, tonight all require sign-in. The landing page for a signed-out visitor is a single sentence + sign-in, not a demo.
**Q8. What gets deleted.** Rec: delete `/onboarding` as a route (it folds into You's empty state), delete New chat, delete the Tonight nav item and TonightPanel as home, delete the taste map and `/brain` from any link (keep the code). Sidebar: You, History, then account.
**Q9. Money.** Rec: cost per user is one memory rewrite per session (~$0.001) and the nightly pick (~$0.002). Nothing to price; there is no plan to charge. TMDB free tier is the only rate limit that matters; the titles cache is what keeps us under it.
**Q10. Design, concretely.** Rec: I research first (a written note of 10 references with what to steal from each), then three boards: You page, a thread, the log field, each in all three directions. Direction constraint: posters are the color; the type does the personality; the chat reads like messages, not documents. Ship nothing until you pick.
**Q11. Build order, final.** Rec: (A) titles cache + log field + memory layers (prose, episodes) + You page with Numbers; (B) Play via TMDB provider link + imports section (Netflix, IMDb) + sidebar/nav cuts; (C) design research + boards, then the redesign of every screen from the winning board; (D) swipe-as-lore with the memory diff. Four `/goal` chunks.

**A1.** "Yeah, rec looks good."
**A2.** "Yeah, rec also looks good."
**A3.** "Same model DeepSeek Flash works really well. I want the user to also have access to that layer."
**A4.** "Yeah, full tool set, everything. I assume we're going to end up storing conversations if we have real users in the real database. I don't know."
**A5.** "Yeah, looks good."
**A6.** "Yeah, perfect."
**A7.** "Yeah, that's perfect."
**A8.** "I like the onboarding where you do stuff like that, where you can sort of start by swiping your taste. I don't know, but the rest seems good."
**A9.** "Yeah, for now let's not worry about the user cost or anything."
**A10.** "Start by researching design and design skills for sure."
**A11.** "Yeah, looks good."

## Decisions (session 4)

1. The product is a log with a brain: Letterboxd-with-TV plus a real AI taste profile, for film buffs who watch a lot. "Tonight" is one thing the agent can answer, not the home surface; the word leaves the nav.
2. Home is "You": prose memory on top, recently logged, tonight's pick as one expandable row. The composer is pinned on every page and opens a thread; there is no chat surface, only threads under History. New chat and the Tonight nav item are deleted.
3. Logging is the primary verb: one field, resolve against the graph (film or show + season), four buckets, optional one line of text that lands in memory verbatim.
4. Three memory layers: structured tables (facts), a per-user prose memory of ≤40 lines rewritten by DeepSeek Flash after any log change or taste statement (beliefs), and dated episodes (evidence). The prose memory is shown verbatim on You and editable; user edits are marked and never overwritten. Facts + beliefs go to the model every turn; episodes by search.
5. Taste mechanisms: after Play the next open leads with "did you watch X"; chat statements become episodes and ratings; the swipe deck is the fun way to log the back-catalog and the first thing a new account does (onboarding starts by swiping), each session ending with a memory rewrite and a shown diff; imports are Letterboxd CSV, Netflix viewing-activity CSV (seen, not liked), IMDb ratings CSV.
6. No crawling, no streaming passwords for now. Holding streaming logins to fetch Netflix history is recorded as a future option Jake is open to; not in scope.
7. Play uses the TMDB watch-providers (JustWatch) link for the title; the guessed per-service search URLs go.
8. Analytics is in scope as a Numbers page under You: volume per month (film vs TV, titles and hours), top people with faces, taste shape (decades, runtimes finished, genres by bucket), and the log as a filterable table. Computed, hand-drawn SVG, no model call. Requires a TMDB-backed titles cache (runtime, episodes, genres, poster).
9. TV: logged once with status (watching / finished / dropped) and a season pointer; never per episode.
10. Signed-out: trivia chat and public answer pages only; a one-sentence landing with sign-in. Conversations stay in localStorage for now; storing them server-side is expected later once there are real users, not decided.
11. Cost is ignored for now.
12. Design: research first (a written note of ~10 references and what to take from each, using the design skills), then three boards each showing You, a thread and the log field; posters are the color, type carries the personality, chat reads like messages. Nothing ships before Jake picks a board.
13. Build order: A) titles cache, log field, memory layers, You with Numbers; B) Play via provider link, Netflix + IMDb imports, nav cuts; C) design research + boards, then the redesign of every screen; D) swipe-as-lore with the memory diff, as the onboarding.
14. No hosted agent harness (OpenAI or otherwise); the loop stays on the AI SDK + OpenRouter.
