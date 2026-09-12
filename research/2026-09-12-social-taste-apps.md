I have enough to report. Here are the full findings.

---

# Social taste / friend-recommendation apps — competitive landscape, 2025–2026

Date of research: 11 September 2026. Every claim is sourced inline. Where a number isn't public I say so rather than guessing.

---

## 1. Beli — the one to study

**What it is.** A restaurant tracking/ranking social app. Founded 2021 in NYC by Judy Thelen and Eliot Frost (a couple, Harvard Business School grads); it grew out of a shared Google Map of NYC restaurants. Users log places they've been and want to try, rank them, follow friends, and get personalized recommendations. Developer of record is Beli Technologies, Inc. — https://en.wikipedia.org/wiki/Beli_(app) ; https://beliapp.com

**Ownership / funding**
- Harvard entrepreneurship grants, 2019–2020.
- **Series A: $5.3M from Goodwater Capital, announced November 2023.** (Crunchbase records it as 14/29 Nov 2023; some trackers label it a seed.) — https://www.crunchbase.com/organization/beli
- **Total raised $12M as of June 2025, including FirstMark Capital** (company-confirmed to Business Insider; Wikipedia/Wikiwand cite the same). The FirstMark money has never been announced as a named round — there is **no public Series B**. — https://www.wikiwand.com/en/articles/Beli_(app) ; https://www.businessinsider.com/social-map-startup-corner-raised-seven-million-venture-capital-genz-2026-7 (21 Jul 2026, restates "Beli… had raised $12 million in venture capital as of June 2025")
- Corroborating: Forbes Cloud 100 **Rising Stars 2025** (16 Sep 2025) — a list restricted to companies that have raised **under $30M**, which caps the plausible total. — https://firstmark.com/story/beli-named-to-forbes-cloud-100-rising-stars-2025/
- I found **no evidence of any 2026 round**. Treat "Series B" as not having happened publicly.

**Traction**
- **75M+ global reviews across 30,000 cities as of Sept 2025** — up from **58M in May 2025** (WSJ) and **60M mid-2025**. That's ~17M ratings added in four months. For scale, Yelp had ~83.6M reviews over the same period. — https://firstmark.com/story/restaurant-rating-app-beli-featured-in-wall-street-journal/ (9 May 2025) ; https://tastecooking.com/beli-invites-the-loneliest-generation-to-dine-out/ (24 Jun 2025)
- **~80% of users under 35**; ~10% international; NYC largest market, Chicago second. Founders **decline to publish DAU/MAU** — no MAU figure is public, don't infer one.
- **Over 80% of users join via referral** — https://www.iveybusinessreview.ca/magazine/articles/beli
- App Store, US, checked 11 Sep 2026: **4.8★ from ~17,000 ratings, ranked #59 in Food & Drink**, version 9.15.0 shipped 10 Sep 2026, first released 11 Jul 2021. — https://apps.apple.com/us/app/beli/id1478375386
- College program: leaderboards across **187 universities** plus a "Dining Hall of Fame."

**AI features.** Nothing publicized as generative AI. The "personalized recommendation" engine is collaborative filtering over the pairwise-comparison data — it predicts *your* score for a restaurant and a separate friend-group score. No LLM chat feature announced as of Sept 2026. This is a genuine gap.

**Monetization**
- **Beli Supper Club** (invite-only, NYC, events + premium features): **$74.99/year** in-app.
- **Creator subscriptions: $5.79/month or $42.90/year** — a creator-economy layer, newer.
- **Weekly Streak Restore: $0.99** (Duolingo-style paid streak insurance).
- Affiliate/booking via OpenTable and SevenRooms. Ivey called these "insufficient revenue sources" and argued the real prize is a B2B analytics product over the ratings corpus. — App Store IAP list, https://apps.apple.com/us/app/beli/id1478375386 ; https://www.iveybusinessreview.ca/magazine/articles/beli

**MULTIPLAYER — and why it works.** Beli is unambiguously multiplayer, and the mechanic is worth copying carefully. Four things stack:

1. **Pairwise comparison instead of stars.** You never assign a number. The app hands you a previously-ranked restaurant and asks "better or worse?", binary-searching your new entry into your personal ordering, then emitting a score out of 10. Two consequences: (a) the input is *low-friction and honest* — people can't rank consistently on an absolute scale but are near-perfect at A-vs-B; (b) the output is **a total ordering per user**, which is a far richer signal than a 4-star rating, because it's calibrated *within* that person. That's what makes cross-user matching work at all.
2. **Match Score.** Because every user has a full ordering, the app can compute a numeric taste-similarity between you and any friend. This is the social hook: it converts "my friend liked this" into "my 94%-match friend liked this," which is the only version of a friend rec that's actually trustworthy. It also gives every new friend-add an immediate payoff — a number appears.
3. **The list is selfish before it's social.** The core loop (keeping your been/want-to-try list and map) is valuable with zero friends. Single-player utility first, multiplayer value on top. That's why it survives cold-start, and why 80%+ of growth is referral rather than paid: you invite friends because *your* recommendations get better, not out of altruism.
4. **Status and streaks.** City and global leaderboards, university leaderboards, streaks, and rank-gated feature unlocks turn logging into a competitive, visible identity. TASTE (24 Jun 2025) notes the feed is deliberately short — no doomscroll — so the app's job is to send you out to eat, not to retain attention. Founders say they explicitly don't optimize time-in-app.

The deeper point for a movie/TV app: **the pairwise ranking is the asset.** It produces per-user ordinal data dense enough to compute person-to-person compatibility, and compatibility is what makes a friend feed non-noise.

---

## 2. "Rex" — three different companies, and no, it is not a16z-backed

This name is heavily overloaded. I could not find any a16z-backed Rex. Here is what actually exists:

**(a) Rex (places), by Aliza Rosen — the one TechCrunch covered. Likely dead.**
Founded 2021 by Aliza Rosen (ex-Twitter PM, ran the 140→280 character change) with Twitter alumni. Shared recommendations for restaurants, bars, museums, trails. Used AI + computer vision to scrape your camera roll for places you'd been, to solve cold-start. Exited beta June 2023. **Seed $3.96M from Accel and Khosla Ventures**, plus angels from Twitter/Snap/Pinterest including Biz Stone's Future Positive. **Tracxn marks it deadpooled as of July 2025.** — https://techcrunch.com/2023/06/12/rexs-new-app-makes-it-easy-to-discover-and-share-recommended-places-with-friends ; https://www.crunchbase.com/organization/rex-2

**(b) Rex: Track Books, Movies & TV — heyrex.app / iloverex.com. This is your closest direct competitor.**
Developer **Late Summer Labs LLC**. A single library for books, movies, TV, podcasts, music and plays. Rate on a **four-tier scale (Loved it / Liked it / Just ok / Not for me)** rather than stars. **Imports from Goodreads and Letterboxd.** Follow friends for trusted recs; "Rex chat" is an in-app AI that learns from your ratings. No ads, per the developer. Site copy: "see what the people you trust love."
App Store: **5.0★ from only 22 ratings**, Books category, iOS 17+ — i.e. **very early, negligible traction**. No funding, investor, or headcount information is public; I found none. — https://heyrex.app/ ; https://apps.apple.com/us/app/rex-track-books-movies-tv/id6758253958

**(c) Rex: Entertainment Discovery (Rex Discovery) — rexapp.ai.** Developer **Rex Entertainment Corp**, founder/CEO **Jack Rousseau**. AI-first "what to watch": conversational Rex AI (ask by mood/actor/director), a taste profile, streaming-service-aware results, and **Party Mode** — a group pools preferences to pick one title. Public unveiling at **SXSW, 17 March 2026**. Paid tier "Rex Unlimited" **$3.99/mo or $39.99/yr**. App Store: **4.9★ from 8 ratings** — essentially pre-traction. No funding disclosed. — https://rexapp.ai/ ; https://apps.apple.com/us/app/rex-entertainment-discovery/id6743517396 ; https://do512.com/events/2026/3/17/rex-presents-the-future-of-entertainment-discovery-official-tickets

**Multiplayer?** (a) was multiplayer (follow graph + maps). (b) is single-player-first with a follow graph bolted on — tracking and AI chat are the core, friends are secondary. (c) is **mostly single-player AI**, with Party Mode as the only genuine multiplayer surface — and Party Mode is the one feature reviewers actually cite ("saved my girlfriend and I so much hassle on movie night").

---

## 3. Pally — not a taste app

Verified: **Pally is an AI personal assistant**, not a social recommendations product. Pally Technologies, Inc., founder **Haz Hubble**, **Y Combinator S25**. You text it like a friend; it connects to iMessage, WhatsApp, Gmail, Slack, Google Calendar, Notion, drafts emails, books things. Built on Anthropic and OpenAI models. Freemium: Pro $25/mo, Max $100/mo. — https://www.pally.com/

Funding: **$1.1M pre-seed, June 2025** (Y Combinator, Pioneer Fund; Product Hunt Product of the Week), then **$5.2M seed at a $30M valuation, announced 6 August 2026**, led by **Cyber Fund and Y Combinator**, with Pioneer Fund, Founders Inc, 468 Capital and angels. Earlier positioning was "AI-native relationship intelligence" — consolidating your contacts across social platforms with on-device processing — which is why it surfaces in social-graph searches. **Single-player.** The "social graph" is your private contact list, not a shared network. — https://svpost.com/articles/pally-1m-preseed ; https://app.dealroom.co/news/note/pally-raises-5-2m-seed-for-an-ai-assistant-that-lives-in-your-texts ; https://www.crunchbase.com/organization/pally-6028

Not a competitor. Do not build against it.

---

## 4. Perfectly Imperfect / PI.FYI

**What it is.** A recommendations newsletter (launched on Substack 8 Sept 2020) that became a social app. Founders **Tyler Bainbridge** (ex-Meta engineer, laid off May 2023), **Alex Cushing**, and **Serey Morm** (since departed). Tagline through the years: "Cool people like cool things" / "A Taste of Someone's Taste." Bainbridge describes the app as "**Letterboxd meets Myspace**" and a "home base for taste" — explicitly built because tastes are fragmented across Letterboxd, Goodreads and Beli. Newsletter guests include Charli XCX, Lorde, Olivia Rodrigo, Francis Ford Coppola, Kyle MacLachlan, the Rizzler. — https://en.wikipedia.org/wiki/Perfectly_Imperfect_(platform) ; https://www.creatorspotlight.com/p/tyler-bainbridge (31 Mar 2026)

**Key dates.** Substack launch Sept 2020 → paid subs turned on May 2023 → **PI.FYI app released 2 Feb 2024** → left Substack for own stack Oct 2024 → **single/interested-in status feature early 2025** → **events feature Aug 2025** → private groups/communities planned. — App Store metadata, https://apps.apple.com/us/app/pi-fyi-log-your-favorites/ (Perfectly Imperfect LLC, Social Networking, **4.86★ / 3,181 ratings**, latest build 10 Sep 2026)

**Funding.** Bootstrapped off Bainbridge's Meta severance. **Has raised venture capital but declines to disclose the amount or investors** (Business Insider, 20 Aug 2025). No round is public on Crunchbase/PitchBook with a figure. Say "undisclosed," not a number.

**Traction (two vintages — note the discrepancy, and prefer the primary one).**
- Aug 2025, from the founder to Business Insider: **~140,000 newsletter subscribers, 74,000 of whom joined the app; ~2,000 paying users at $6/month** as of late July 2025. Team: 3 full-time + 5 part-time contractors. Instagram ~193k. Goal stated: "hit a million users sometime next year."
- Mar 2026, Creator Spotlight: "**a social app with 400,000 members**." — https://www.businessinsider.com/perfectly-imperfect-nostalgia-events-community-grow-social-network-app-newsletter-2025-8 ; https://www.creatorspotlight.com/p/tyler-bainbridge

**Monetization.** $6/mo subscription (profile customization, newsletter archive, bonus content) + brand partnerships (e.g. a guide with Hinge, funded from Match Group's $1M One More Hour initiative). Ads in the newsletter, **deliberately none in the app**.

**AI features.** None. The whole brand is **anti-algorithm** — reverse-chronological feed, no ranking, human curation as the product. That is a deliberate strategic position, not an omission.

**MULTIPLAYER.** Yes, but a *publishing* social graph rather than a *matching* one. The unit is a "rec" — a short post about a thing you like — plus "Ask" posts soliciting crowd input, likes, comments, customizable profiles, and now events. There is **no scoring, no ranking, no taste-compatibility computation.** Trust comes from following specific people whose taste you admire, editorial-magazine style. Contrast with Beli: PI is high-expression / low-structure; Beli is low-expression / high-structure. PI cannot compute a match score because it never collects ordinal data.

---

## 5. "Gossip" — no credible taste/recs startup by that name

I checked this carefully and found nothing matching "friends recommendations." What exists under the name:

- **"Gossip." by Vanilla b.v.** — App Store, released 19 Mar 2024, updated 10 Sep 2026, **4.46★ / 634 ratings**, Games → Trivia/Word. It's a friend-group party voting game: "Expose the wild, scandalous, and outrageous sides of the people you think you know. Vote on who's most likely to…" Multiplayer in the party-game sense (a group votes about each other), not a recommendations product. — iTunes Search API, https://itunes.apple.com/search?term=gossip&entity=software&country=us
- **GOSSIP Game** by Stratara Ltd — a fictional-friend-group roleplay/sim, released 6 May 2026, 1 rating.
- Everything else under "gossip app" in 2025–2026 tech press is the **anonymous-confession** category — Tea/TeaOnHer (TechCrunch's Aug 2025 data-exposure story; Tea pulled from the App Store and back on Android Jan 2026), Fizz, NGL, The Ick. Different market, adjacent only in that it's Gen Z social. — https://techcrunch.com/2025/08/13/how-we-found-teaonher-spilling-users-drivers-licenses-in-less-than-10-minutes/ ; https://mashable.com/article/tea-app-is-back-but-not-on-apple-app-store

**Conclusion: no notable taste-graph app named Gossip exists.** If someone referenced one, they probably meant the Vanilla party game or one of the confession apps.

---

## 6. The rest of the 2025–2026 wave — the ones that actually matter

### Letterboxd — the incumbent in your exact category, and it is in play
- **Users: 26M+ (Apr/Jul 2026 press), 28M+ (TIME, 30 Apr 2026), "more than 30 million" and 29M registered in Q1 2026 per Tiny.** In 2025 alone users published **143M reviews and logged ~900M films**. >50% of users under 35. — https://time.com/collection/time100-most-influential-companies/2026/letterboxd/ ; https://tiny.com/companies/letterboxd
- **Ownership: Tiny (Canada) bought 60% in 2023 at a reported ~$50M valuation; cofounders Matthew Buchanan and Karl von Randow hold 40%.**
- **In a sale process since ~May 2026, LionTree running it, ~$250M asked.** Reported bidders/talks: **Netflix, Sony Pictures, Paramount, TPG, RedBird, Versant (Comcast spin-off), Alexis Ohanian**, plus an underdog preservationist bid from Intrinsic Entertainment Collaborative. **Not closed as of my searches.** — https://www.theguardian.com/film/2026/jul/10/letterboxd-netflix-sales-talks (10 Jul 2026) ; https://variety.com/2026/film/news/letterboxd-sales-talks-netflix-sony-paramount-1236806379/ ; https://deadline.com/2026/05/letterboxd-for-sale-1236921783/
- **Product moves directly into your lane: launched the Letterboxd Video Store (in-app arthouse rentals) Dec 2025, and in 2026 is adding TV seasons in a separate section of the app** to avoid upsetting film purists.
- **Multiplayer mechanic — and its deliberate limits.** Follow graph, logs, reviews, lists, likes. The Guardian's own framing: its strength "lies in what it doesn't have: there's no way to message people or post pictures." **No taste-compatibility score, no pairwise ranking, no recommendation engine.** That is the opening.

### DoorDash Zesty — launched and killed inside four months
AI restaurant-discovery app, **beta 16 Dec 2025 in SF Bay Area and NYC**. Natural-language prompts ("low-key dinner in Williamsburg good for introverts"), aggregating DoorDash, Google Maps, TikTok, Reddit, Eater with cited sources; social layer of following friends, shared lists, reactions; vibe-first rather than star-rated. **Wound down April 2026, features folded into the core DoorDash app.** — https://techcrunch.com/2025/12/16/doordash-rolls-out-zesty-an-ai-social-app-for-discovering-new-restaurants/ ; https://restauranttechnologynews.com/2026/04/doordash-shuts-down-zesty-and-brings-restaurant-ai-discovery-into-core-app/ (11 Apr 2026)
**Read this as the cautionary tale:** an incumbent with infinite distribution, an LLM concierge and a social layer still could not get a standalone discovery app to stick in four months. AI discovery without an accumulated personal ranking corpus has no moat and no reason to open it twice.

### Corner — social map, explicitly a "taste graph"
Founded 2022, NYC, cofounders **Eliza Wu (CEO) and Jake Xia**. A place only enters the map when a user *saves* it. Reviews, photos, curated lists, AI-powered search over their own review corpus, reservation-drop alerts, events, friend "raves" roundups.
**Funding: $3.75M across two rounds (Abstract Ventures, Tapestry, 1517, plus angels including Partiful cofounder Shreya Murthy), doubled to $7.5M total confirmed 21 July 2026; raising a Series A.**
**Traction: 250,000+ users across 425 cities, mostly NY and Europe; 91,000 Instagram followers on their digital magazine.**
Wu's positioning quote is the thesis in one line: "Our proprietary dataset powers true personalization instead of virality-based recommendations." Multiplayer — save-to-surface means the map *is* the aggregate of the social graph's saves. — https://www.businessinsider.com/social-map-startup-corner-raised-seven-million-venture-capital-genz-2026-7 ; https://www.businessinsider.com/new-social-app-corner-google-maps-gen-z-ai-events-2025-9

### Airbuds — the fastest-growing pure taste-sharing app, and it is a16z-backed
SF-based, founders **Gilles Poupardin and Gawen Arab**. A home-screen **widget** showing what your friends are streaming in real time, across Spotify, Apple Music, SoundCloud, Musi, Deezer, Amazon Music, Audiomack.
**Funding: $5M round announced Sept 2025 led by Alexis Ohanian's Seven Seven Six; ~$10M total, investors include a16z, SV Angel, Dream Machine, Nikita Bier, Uncommon, Night Capital.**
**Traction: 15M+ downloads, 5M MAU, 1.5M DAU** (Sept 2025). Mostly US high-school and college, with UK/Australia/Brazil/Mexico.
Mechanic: emoji/sticker/selfie reactions on what a friend is playing, built-in messenger, ghost mode, weekly recaps, school-based discovery, customizable "Spaces." No AI features. Testing subscriptions. — https://techcrunch.com/2025/09/17/airbuds-is-the-music-social-network-apple-and-spotify-wish-they-had-built/ ; https://musically.com/2025/09/18/social-music-app-airbuds-has-1-5m-daily-users-and-5m-of-funding/
**Lesson: zero-friction ambient sharing beats deliberate posting.** Airbuds' input cost is literally zero — you just listen. Beli's is one binary comparison. Both are far below "write a review."

### Partiful — the social-graph adjacency
**$20M Series A, Nov 2024, a16z**; reported ~$140M valuation. **500,000 MAU in Q1 2025, +400% YoY**; no revenue model as of late 2025. TechCrunch described it in Oct 2025 (in the context of a metadata leak exposing GPS in profile photos) as having become "a powerful Facebook-like social graph" — friends, activities, locations, phone numbers. Relevant because it is quietly assembling the real-world friend graph these taste apps all need. — https://techbuzz.ai/articles/partiful-exposed-users-gps-locations-in-profile-photos ; https://www.businessinsider.com / Sacra https://sacra.com/c/partiful

### Also flagged, lower confidence
- **Amo's Bump** — friend-tracking social app, named by Business Insider (Jul 2026) as "gaining steam" in the same category. I did not verify its numbers.
- **Vivino** (~60M users) cited alongside Beli and Letterboxd as taste-graph proof points in the wine vertical.
- **Matinee** (getmatinee.com) — a 2026 "track movies and TV with friends" app, free on iOS and Android. Site returned a 500 when I tried to fetch it; no funding or traction data found. Watch it, don't cite it.

### On the "taste is the new social graph" theme
I did **not** find a canonical a16z, Not Boring, or The Information essay under that exact title. The framing is nonetheless live in trade commentary — e.g. "taste graphs beat social graphs… Beli and Letterboxd validated the model; the infrastructure layer is wide open" (7 Jan 2026, https://www.startupheist.com/doordash-just-opened-the-taste-graph-gold-rush-heres-how-you-win). Treat that as a secondary blog, not a primary source. The strongest *evidence* for the thesis is the transaction record, not the essays: a16z into Partiful and Airbuds, 776 leading Airbuds, FirstMark into Beli, and Netflix/Sony/Paramount bidding ~$250M for a 15-year-old film-logging site with no ad business.

---

## What this means for a social movie/TV taste app

Six things fall out of the research:

1. **Letterboxd owns the category, has 26–30M users, is adding TV in 2026, and may be owned by a studio or streamer within months.** Whoever buys it will have an incentive to bias it. That is both the competitive threat and the single biggest opening.
2. **Nobody in film/TV has Beli's pairwise-ranking mechanic.** Letterboxd takes 5-star ratings; Rex (Late Summer Labs) takes a 4-tier scale; Rex (Entertainment) takes a preference profile. None of them produce a per-user total ordering, so none of them can compute a real taste-match number between two people. That is the unoccupied ground.
3. **Match Score is the multiplayer primitive, not the feed.** Beli's social value is that it turns a friend's opinion into a weighted signal. A friend feed without compatibility weighting is just noise — which is the failure mode of most of these apps.
4. **Single-player utility must work first.** Beli's list, Letterboxd's diary, Airbuds' widget all pay off with zero friends. Rex (places) died; Zesty died in four months. Both led with discovery rather than with a personal artifact worth keeping.
5. **Input friction is the whole game.** Airbuds = zero. Beli = one binary tap. Letterboxd = a star and optional prose. PI.FYI = writing a post, and it's at 400k after six years while Airbuds hit 15M downloads in less.
6. **AI alone is not a product here.** Zesty had the best AI discovery in the category, backed by DoorDash's data and distribution, and shut down. AI becomes defensible only on top of accumulated personal ranking data — which is exactly the asset a pairwise system generates and a chatbot does not.

Sources: [Beli/Wikipedia](https://en.wikipedia.org/wiki/Beli_(app)), [Beli App Store](https://apps.apple.com/us/app/beli/id1478375386), [Crunchbase Beli](https://www.crunchbase.com/organization/beli), [FirstMark/Cloud 100](https://firstmark.com/story/beli-named-to-forbes-cloud-100-rising-stars-2025/), [FirstMark/WSJ](https://firstmark.com/story/restaurant-rating-app-beli-featured-in-wall-street-journal/), [TASTE on Beli](https://tastecooking.com/beli-invites-the-loneliest-generation-to-dine-out/), [Ivey Business Review](https://www.iveybusinessreview.ca/magazine/articles/beli), [TechCrunch on Rex](https://techcrunch.com/2023/06/12/rexs-new-app-makes-it-easy-to-discover-and-share-recommended-places-with-friends), [heyrex.app](https://heyrex.app/), [Rex App Store](https://apps.apple.com/us/app/rex-track-books-movies-tv/id6758253958), [rexapp.ai](https://rexapp.ai/), [Rex Discovery App Store](https://apps.apple.com/us/app/rex-entertainment-discovery/id6743517396), [pally.com](https://www.pally.com/), [Pally seed/Dealroom](https://app.dealroom.co/news/note/pally-raises-5-2m-seed-for-an-ai-assistant-that-lives-in-your-texts), [SVPost on Pally pre-seed](https://svpost.com/articles/pally-1m-preseed), [Business Insider on PI.FYI](https://www.businessinsider.com/perfectly-imperfect-nostalgia-events-community-grow-social-network-app-newsletter-2025-8), [Creator Spotlight on Bainbridge](https://www.creatorspotlight.com/p/tyler-bainbridge), [PI Wikipedia](https://en.wikipedia.org/wiki/Perfectly_Imperfect_(platform)), [TIME100 Letterboxd](https://time.com/collection/time100-most-influential-companies/2026/letterboxd/), [Guardian on Letterboxd sale](https://www.theguardian.com/film/2026/jul/10/letterboxd-netflix-sales-talks), [Tiny/Letterboxd](https://tiny.com/companies/letterboxd), [Deadline Letterboxd for sale](https://deadline.com/2026/05/letterboxd-for-sale-1236921783/), [TechCrunch on Zesty launch](https://techcrunch.com/2025/12/16/doordash-rolls-out-zesty-an-ai-social-app-for-discovering-new-restaurants/), [Restaurant Technology News on Zesty shutdown](https://restauranttechnologynews.com/2026/04/doordash-shuts-down-zesty-and-brings-restaurant-ai-discovery-into-core-app/), [TechCrunch on Airbuds](https://techcrunch.com/2025/09/17/airbuds-is-the-music-social-network-apple-and-spotify-wish-they-had-built/), [Music Ally on Airbuds](https://musically.com/2025/09/18/social-music-app-airbuds-has-1-5m-daily-users-and-5m-of-funding/), [Business Insider on Corner](https://www.businessinsider.com/social-map-startup-corner-raised-seven-million-venture-capital-genz-2026-7), [TechCrunch on Tea/TeaOnHer](https://techcrunch.com/2025/08/13/how-we-found-teaonher-spilling-users-drivers-licenses-in-less-than-10-minutes/), [StartupHeist taste-graph piece](https://www.startupheist.com/doordash-just-opened-the-taste-graph-gold-rush-heres-how-you-win)
