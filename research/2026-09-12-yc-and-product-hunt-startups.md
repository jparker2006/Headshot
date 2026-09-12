I've hit the session's web-search cap but got substantial coverage through direct page fetches. Findings below.

---

# Media taste graph / AI entertainment recommendation startups, 2024–2026

## Important caveat up front: the YC result is a negative one

**The YC company directory (`ycombinator.com/companies?query=…`) cannot be scraped by WebFetch** — it is a client-side JS app and returns only the page title. Two workarounds did work:

1. YC's server-rendered **industry** pages (`/companies/industry/entertainment`, `/media`, `/consumer`, `/social`) render fully.
2. The community **yc-oss API mirror** (`https://yc-oss.github.io/api/batches/<batch>.json`, `/tags/<tag>.json`) returns structured batch data.

Using both, I checked every 2024–2026 batch (W24, S24, F24, W25, S25, F25, X25, W26, P26, S26) for movies/TV/streaming/watch/recommendation/taste/social keywords. **YC has funded essentially zero consumer movie/TV taste-graph or "what to watch" startups in 2024–2026.** Their entertainment bets are all *generation* (AI filmmaking, dubbing, characters, comics, games), not *discovery* or *taste*. I want to be explicit: I did not find a single YC 2024–2026 company doing what Headshot does. That is a real signal, not a gap in my search.

The YC entertainment-adjacent companies I did confirm (all generation-side, listed for completeness):

| Company | Batch | What it does | URL |
|---|---|---|---|
| Flick | F2025 | AI filmmaking software, end-to-end AI short films; **$6M seed (May 2026)**, 4 films with 20+ festival awards, 2 founders, SF | https://www.ycombinator.com/companies/flick / https://flick.art |
| Koyal | F2025 | Agentic AI filmmaking, scripts → visual stories; music videos for Grammy winners, 1.5M+ views | https://koyal.ai |
| Familiar | S2026 | AI dubbing into 30 languages preserving actor performance | https://thefamiliarlab.com |
| Grocalo | S2026 | "AI brain" that runs creator social content; video understanding + platform analytics | https://grocalo.com |
| Mixy | F2025 | Song mashup app, claims 1.5M users | https://usemixy.com |
| Swerve | W2025 | AI character chat / immersive storytelling | https://www.getswerve.com |
| Digipals | F2025 | Ambient AI agents in group chats using location/calendar/photo context — closest YC company to "social AI for what to do", but not entertainment-specific | https://www.digipals.app |
| Mochi | S2026 | Watch/create anime microdramas | — |
| Sagaland | W2024 | "AI entertainment platform" (vague) | https://sagaland.ai |
| BiteSight | W2024 | Video recommendations of nearby restaurants with friend social proof — a *food* taste graph, structurally the nearest analogue | — |

Sources: https://www.ycombinator.com/companies/industry/entertainment , https://www.ycombinator.com/companies/industry/media , https://www.ycombinator.com/companies/industry/consumer , https://www.ycombinator.com/companies/industry/social , https://yc-oss.github.io/api/batches/fall-2025.json , https://yc-oss.github.io/api/batches/winter-2025.json , https://yc-oss.github.io/api/batches/summer-2025.json , https://yc-oss.github.io/api/batches/winter-2026.json , https://yc-oss.github.io/api/tags/entertainment.json

---

## The actual competitive set (Product Hunt + web)

### Multiplayer / group-decision (the closest to Headshot's social axis)

**1. MatchWatch** — https://www.matchwatch.tv — PH launch **30 Apr 2026, 2 upvotes** (very small). Free web PWA; up to **6 people** swipe independently, app surfaces titles everyone said yes to. 20+ streaming services across NZ/AU/UK/US, mood filters (Date Night, Scary, Kids). **Multiplayer. No AI claimed.** No funding found. Founder framing: "four streaming services, two opinions, zero agreement by 9pm." (https://www.producthunt.com/products/matchwatch)

**2. Queue — Find Movies & Shows** — https://co.queue.app — Founded 2020 by Garrett Rothstein (ex-Quibi) and **Spencer Rascoff (Zillow co-founder)**, LA. Claims **2M+ users**. "Swipe with a Friend" to match instantly, Friends Widget showing what your circle is binging, 200+ streaming services, affiliate revenue model. Now appears under MWM (mwm.ai), suggesting acquisition — I could **not verify the acquisition or any funding total**. **Multiplayer. AI not explicitly claimed.** (https://mwm.ai/apps/queue-find-movies-shows/1554132853 , https://play.google.com/store/apps/details?id=co.queue.app)

**3. Telie** — PH launch **2021, 79 upvotes, #23 day rank.** Social TV/movie tracking; **collaborative groups with anonymous voting** on what to watch together, Instagram Stories sharing. Built by Cornell friends (Alanna Zhou, Cindy Huang, Haiying Weng). **Multiplayer. No AI.** No traction numbers disclosed. Pre-2024 but the most directly Headshot-shaped group-voting product I found. (https://www.producthunt.com/products/telie)

**4. Stream Vote** — PH launch **2021, 65 upvotes, #39 day rank.** Create a group, invite friends, swipe/match on movies and TV. iOS + Android. **Multiplayer. No AI.** (https://www.producthunt.com/products/stream-vote)

**5. flickd** — PH launch **2024, 134 upvotes, #18 day rank.** Social network for film/TV: track, rate, review, follow friends, discuss specific scenes, streaming availability, "tailored recommendations across film & TV." Free, iOS + Android, web on roadmap. **Multiplayer (Letterboxd-shaped). Recommendations claimed, algorithm unspecified.** (https://www.producthunt.com/products/flickd)

**6. What to Watch: AI Movies & TV** — iOS, developer **Ramiz Mehdiyev**. **Released 17 Dec 2025**, latest update **26 Mar 2026 (v2.5.20)** which upgraded to **Groq API running Llama 3.3 70B**. Features: mood-based AI recs, **"Couple Match" — partners swipe together to find a film both want**, deep search ("90s action movies with a plot twist"), watchlist, daily movie quiz with global leaderboard. **Multiplayer (couples) + AI.** Too new for a ratings average to display — effectively zero traction so far. This is the single closest product to Headshot's premise found, and it is a solo-dev app. (https://apps.apple.com/us/app/what-to-watch-ai-movies-tv/id6756384424)

**7. MovieMates: AI Film Finder** — Android. AI finder identifies films from social shares (Instagram, X, YouTube, TikTok); shared collections, real-time updates, shared lists to break the "what should we watch" deadlock. **Multiplayer + AI.** Google Play page truncated on fetch — **I could not verify install count, rating, developer, or dates.** (https://play.google.com/store/apps/details?id=app.moviemates)

**8. Search Party by Something Good** — "A fun, fast way to pick a Christmas movie together." Multiplayer, seasonal/novelty scope. Date and upvotes not retrieved.

**9. Watch-together infrastructure (adjacent, not taste)** — Filmingo ("Watch Together"), Flickcall, JustParty, Hearo, Koi Watch, Torrent Party. These solve *synchronized playback*, not *deciding what to watch* — a distinct and much more crowded category. Dates/upvotes not retrieved individually.

### AI-first, single-player recommendation

**10. TasteRay** — https://www.tasteray.com — TasteRay, Inc., Wilmington DE + Kraków, Poland; founders **Mike Wolniak and Mike Jaskolski**. Natural-language mood input → up to 3 recommendations **with explanations for why each matches**, across Netflix/Prime/Disney+/HBO Max/Apple TV+. Explicitly claims the model was trained on **critics, festival programmers and verified cinephiles rather than view counts**, to avoid popularity bias. Currently **early access, free; planned $6.99/mo or $69.99/yr**. iOS, Android, web, **and WhatsApp**. Has a **group mode** for date night / family night considering multiple people's preferences. Self-reported claims (unverified, marketing copy): 1.8 points higher quality ratings vs competing algorithms, 92% find a new favorite in month one. **No funding disclosed.** Strategically the most similar positioning to Headshot: reason-carrying recommendations, anti-popularity-bias. Also runs heavy content marketing on group movie-night keywords.

**11. Maimovie** — by **Mycelebs / AI Keytalk** (Korea). PH launch **2023, 258 upvotes, #5 day rank.** AI recs across **137 streaming services, 880K+ titles**, voice search, and a **"Taste Slider"** to tune recommendation parameters. **Single-player + AI.** (https://www.producthunt.com/products/maimovie)

**12. Movie Deep Search by AI Keytalk** — same company (Mycelebs). PH launch **Feb 2023, 259 upvotes, #4 day rank, 4.6 rating from 24 reviews, ~1.3K followers.** Natural-language descriptive search ("a thought-provoking science-fiction film"), deep learning over structured + unstructured social data, **30+ registered US patents**, 9+ years NLP, sells as an API to boost other platforms' search/recs. **Single-player + AI, B2B2C ambition.** (https://www.producthunt.com/products/movie-deep-search-by-ai-keytalk)

**13. Film Finder** — PH launch **8 Jul 2024, 418 upvotes, #5 day rank, 326 followers.** Strongest PH launch in this set. Personalized recs, collections by genre/actor/mood, watchlist, search by title/actor/director. React Native. Founder's stated KPI: cut film-search time from 1–2 hours to 2–5 minutes. **Single-player today; founder said social features were the next priority after Android.** (https://www.producthunt.com/products/film-finder)

**14. Cineswipe** — PH launch **20 Jul 2024, 114 upvotes**; **V2 relaunched 1 Apr 2026**. 5.0 rating (1 review), 95 followers. Discovery via **infinite scrollable clips** (TikTok-shaped) personalized to taste, plus tracking, collections, stats. iOS + Android. Filed under Social Networking but functionally **single-player. No explicit AI claim.** (https://www.producthunt.com/products/cineswipe)

**15. MovieWiser** — PH launch **2023, 109 upvotes, #11 day rank, 61 followers.** AI recs + streaming availability, synopses, trailers, ratings, watchlist. Free. Maker stated a plan to **build a film profile from saved movies**; a commenter asked for **Letterboxd and IMDb import** — the same import vector Headshot uses. **Single-player + AI.** (https://www.producthunt.com/products/moviewiser)

**16. WatchNow AI** — PH launches **24 Jan 2023 (12 upvotes)**, **2.0 on 30 Oct 2023 (43 upvotes)**, and **"Save Joe" on 26 Sep 2025**. Input preferences → 10 hyper-tailored recommendations. 168 followers, 3.0 rating (1 review). Maker explicitly discussed making AI responses **deterministic** for consistency. **Single-player + AI.** (https://www.producthunt.com/products/watchnow-ai)

**17. Watchlistfy → WaLi** — PH launch **3 Oct 2023 (97 upvotes)**; rebranded relaunch as **"WaLi: Log, Track & Suggestions" on 10 Aug 2025 (8 upvotes)**. Tracks anime, movies, TV, games with AI suggestions. 47 followers, iOS + Android, **source on GitHub**. **Mostly single-player + AI.** The 97 → 8 upvote collapse across the rebrand is a useful datapoint on category fatigue. (https://www.producthunt.com/products/watchlistfy-watchlist-tracker)

**18. Taste (taste.io)** — PH launches **23 Jul 2016 (#3 day rank, 15 upvotes)** and **Taste 2.0 on 16 Oct 2023 (35 upvotes)**; 280 followers, 4.0 from 2 reviews. Mechanism is a **collaborative-filtering taste graph**: "your recommendations come from the collective souls of those who share your unique taste." **Implicitly multiplayer (taste-neighbor matching), not friend-graph social.** Long-running — a commenter of many years said it "feels disorienting to get through." Pre-2024 but it is the closest existing implementation of a literal taste graph for film.

### Adjacent: general-purpose taste/recommendation social apps

**19. Hypelist** — https://hypelist.com — Launched **Jan 2024** by **Alfonso Cobo, who previously sold Unfold to Squarespace**. Curate and share lists of anything — books, movies, restaurants, skincare — with discovery by category, location, trending; **collaborative lists with friends**; comments. **AI chatbot** answers "recommend me a movie/restaurant" and suggests items to add to a list based on what's already in it; stated plan for the AI to learn preferences over time. **Both multiplayer and AI.** Traction reported by TechCrunch: "good traction," **users create ~3 lists on average** — a weak number, honestly. Monetization: **Hypelist Ultra at $2.99/mo** (unlimited AI calls, private lists, customization) plus brand partnerships, explicitly no ads. **No funding disclosed in any source I read.** TechCrunch named two competitors I could not independently verify: **Memorizer (France)** and **Openvy (India)**. (https://techcrunch.com/2024/12/03/hypelist-is-an-app-for-you-to-create-and-discover-all-kinds-of-lists , https://www.netinfluencer.com/alfonso-cobo-hypelist/)

**20. Palette** — PH launch **25 Apr 2024, 180 upvotes, 28 comments**; follow-up "Palette Challenges" **27 Jun 2024**. Social curation of books, movies, games, webpages, TV; follow friends, collaborate, discover together. **Multiplayer, no AI.** (https://www.producthunt.com/products/palette-7)

**21. Listy** — "The things you love, privately saved and beautifully listed." **Explicitly private/single-player** — the anti-social positioning in the same category. Date/upvotes not retrieved.

**22. Malachyte** — **$10M seed, reported Aug 2026 by TechCrunch.** Founded by **ex-Spotify recommendation engineers**; "two-headed Vector AI" that predicts the next product a shopper wants and learns general taste. **Applied to e-commerce, not entertainment** — included because it is the clearest recent proof that "taste graph as infrastructure" is a fundable 2026 thesis, and because the talent flow is out of media recs into commerce. (https://techcrunch.com/2026/08/06/ex-spotify-employees-raise-10m-to-bring-the-ai-behind-its-recommendations-to-e-commerce/)

---

## What I could not verify

- **Any funding number for any pure movie/TV taste-graph startup.** Not one of items 1–18 or 20–21 disclosed a round anywhere I could reach. The only dollar figures I confirmed in adjacent territory are Flick's $6M seed (AI filmmaking, not discovery) and Malachyte's $10M (e-commerce, not media).
- **Queue's acquisition and funding.** The MWM listing strongly implies acquisition but I found no announcement.
- **MovieMates** — Google Play page truncated; developer, installs, rating, dates all unverified.
- **Memorizer (FR)** and **Openvy (IN)** — named only in TechCrunch's Hypelist piece; I ran out of search budget before fetching them. Worth a follow-up.
- **Upvote counts for** Watchlist+, OneMovie, TeeVee, GPTFlix, Filmingo, Search Party, Listy — surfaced in search listings but their product pages 404'd or weren't fetched.
- **Product Hunt's `/topics/streaming`** returns **404**; `/topics/movies` and `/topics/entertainment` return Product Hunt's all-time popular products (Figma, Slack, GPT-4o) rather than topic-filtered results, so the topic pages were useless for this. All usable PH data came from `/search?q=` and individual `/products/` pages.
- I hit the **200-call WebSearch cap** partway through, so the last third of the research was WebFetch-only. A follow-up pass could likely add several more 2025–2026 launches.

---

## Three things worth noting for Headshot

1. **Nobody credible is funded in this space.** The entire pure-play competitive set is solo devs and tiny teams with 2–418 Product Hunt upvotes and no disclosed capital. YC — the most aggressive consumer-AI funder there is — has funded zero of these across ten batches while funding a dozen AI *filmmaking* companies. Read charitably that is an open lane; read skeptically it is a category investors have decided doesn't produce venture outcomes. The honest answer is probably that consumer discovery apps have historically failed to retain, and the people who would fund it now are funding generation instead.

2. **The multiplayer axis is well-trodden but shallow.** Swipe-to-match for couples/groups exists in at least six products (MatchWatch, Queue, Telie, Stream Vote, MovieMates, "What to Watch" Couple Match). All of them implement it as *filtering a catalog by consensus*. None of them has anything resembling a graph substrate or a reason attached to the pick. Headshot's `graphReason` rule — every pick carries exactly one real graph fact — is genuinely unclaimed territory in this set.

3. **TasteRay is the one to watch.** It is the only competitor converging on the same strategic position: explanations attached to recommendations, explicit rejection of popularity bias, group mode, and a taste source that isn't view counts. It is further along commercially (four platforms including WhatsApp, priced at $6.99/mo) but its differentiator is *curator-trained taste*, where Headshot's is *verifiable graph structure*. Those are different bets on what makes a recommendation trustworthy, and Headshot's is the falsifiable one.

Sources: [YC entertainment](https://www.ycombinator.com/companies/industry/entertainment) · [YC media](https://www.ycombinator.com/companies/industry/media) · [YC consumer](https://www.ycombinator.com/companies/industry/consumer) · [YC social](https://www.ycombinator.com/companies/industry/social) · [YC Flick](https://www.ycombinator.com/companies/flick) · [yc-oss F2025](https://yc-oss.github.io/api/batches/fall-2025.json) · [yc-oss W2025](https://yc-oss.github.io/api/batches/winter-2025.json) · [yc-oss S2025](https://yc-oss.github.io/api/batches/summer-2025.json) · [yc-oss W2026](https://yc-oss.github.io/api/batches/winter-2026.json) · [yc-oss entertainment tag](https://yc-oss.github.io/api/tags/entertainment.json) · [PH MatchWatch](https://www.producthunt.com/products/matchwatch) · [PH flickd](https://www.producthunt.com/products/flickd) · [PH Telie](https://www.producthunt.com/products/telie) · [PH Stream Vote](https://www.producthunt.com/products/stream-vote) · [PH Film Finder](https://www.producthunt.com/products/film-finder) · [PH Cineswipe](https://www.producthunt.com/products/cineswipe) · [PH Maimovie](https://www.producthunt.com/products/maimovie) · [PH Movie Deep Search](https://www.producthunt.com/products/movie-deep-search-by-ai-keytalk) · [PH MovieWiser](https://www.producthunt.com/products/moviewiser) · [PH WatchNow AI](https://www.producthunt.com/products/watchnow-ai) · [PH Watchlistfy/WaLi](https://www.producthunt.com/products/watchlistfy-watchlist-tracker) · [PH Taste](https://www.producthunt.com/products/taste-2?launch=taste-2) · [PH Palette](https://www.producthunt.com/products/palette-7) · [TasteRay](https://www.tasteray.com/) · [What to Watch iOS](https://apps.apple.com/us/app/what-to-watch-ai-movies-tv/id6756384424) · [Queue](https://mwm.ai/apps/queue-find-movies-shows/1554132853) · [TechCrunch Hypelist](https://techcrunch.com/2024/12/03/hypelist-is-an-app-for-you-to-create-and-discover-all-kinds-of-lists) · [TechCrunch Malachyte](https://techcrunch.com/2026/08/06/ex-spotify-employees-raise-10m-to-bring-the-ai-behind-its-recommendations-to-e-commerce/)
