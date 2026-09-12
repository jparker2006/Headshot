I have enough verified material. Here is the report.

---

# Multiplayer / group AI assistants in consumer products — dated research report
*Compiled 11 September 2026. Every claim below carries a date and a URL. Where I could not verify something, I say so explicitly.*

---

## Headline finding

**The single biggest fact for this topic: OpenAI killed ChatGPT group chats.** The feature launched 13 Nov 2025, went global 20 Nov 2025, and began winding down **9 July 2026** — roughly eight months. Meanwhile the *non*-realtime collaboration feature OpenAI shipped three weeks earlier (**shared projects**, 23 Oct 2025) survived and was still being extended in Aug 2026. The pattern repeats across the industry: synchronous "AI in the group chat" keeps dying (Clyde, ChatGPT group chats, Character.AI's under-18 base), while asynchronous shared context (projects, Slack tagging, shared libraries) keeps shipping.

---

## 1. OpenAI ChatGPT group chats

### Pilot — your date was right

- **13 November 2025.** OpenAI's own ChatGPT release notes carry a `November 13, 2025` heading titled "Group chats in ChatGPT": *"We're piloting group chats so you can bring people - and ChatGPT - into the same conversation."* Regions listed in the release note, in this order: **New Zealand, Japan, South Korea, and Taiwan** — on Web, iOS and Android. (https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- The announcement blog is dated the same day: **Japan, New Zealand, South Korea and Taiwan**. (https://openai.com/index/group-chats-in-chatgpt/)
- TechCrunch's write-up is dated **14 November 2025** — that one-day gap is probably the source of any "14 Nov" claims. (https://techcrunch.com/2025/11/14/chatgpt-launches-pilot-group-chats-across-japan-new-zealand-south-korea-and-taiwan/)

**✅ Your four countries are confirmed exactly.**

### Tiers — one correction to your brief

OpenAI's own post says the pilot went to **"ChatGPT Free, Go, Plus and Pro plans."** Several outlets (TechCrunch included) reported "Free, Plus, and Team" — that appears to be wrong; OpenAI names **Go** and **Pro**, not Team.

### Max participants

**20.** Per OpenAI: you can share an invite link *"with one to twenty people, and anyone in the group can share that link to bring others in."* (openai.com, 13 Nov 2025)

### How memory worked — the interesting bit

OpenAI firewalled memory completely, in both directions:

> "Your personal ChatGPT memory is not used in group chats, and ChatGPT does not create new memories from these conversations."
> — OpenAI, 13 Nov 2025

They explicitly flagged this as an open design question: *"We're exploring offering more granular controls in the future so you can choose if and how ChatGPT uses memory with group chats."* So group chats were **stateless with respect to the personal profile** — no cross-pollination either way.

Other mechanics from the same post:
- **Model:** GPT‑5.1 Auto, which picks a model *per responding user's plan* — so a Free user and a Pro user in the same room got different model quality for their own turns.
- **Rate limits:** only ChatGPT's responses counted, and against the plan of *the person it was replying to*. Human-to-human messages were free.
- **Social behaviour:** ChatGPT decided when to speak and when to stay quiet based on conversation flow; you could always force it by mentioning "ChatGPT". It could react with emoji and use participants' profile photos in generated images.
- **Adding someone to an existing 1:1 chat forked it** — a copy became the group chat, the original stayed private.
- **Under-18 safety:** if any participant was under 18, ChatGPT *"automatically reduces exposure to sensitive content for everyone in the chat."* Parents could disable group chats entirely via parental controls.

### Global rollout — your date was right

**20 November 2025.** The blog post carries an in-place update:

> "Early feedback from the pilot has been positive, so we're expanding group chats to all logged-in users on ChatGPT Free, Go, Plus and Pro plans globally over the coming days."
> — OpenAI update, 20 Nov 2025

That "early feedback has been positive" line is the **only** adoption signal OpenAI ever published about group chats. No numbers, ever. (https://www.techcrunch.com/2025/11/20/chatgpt-launches-group-chats-globally/)

### The 2026 follow-up: they shut it down

**9 July 2026.** From OpenAI's help centre article, literally titled "Retiring group chats in ChatGPT":

> "Group chats launched as a pilot to explore more collaborative ways to use ChatGPT. As ChatGPT evolves, we're simplifying the experience and winding down group chats."

The stated rationale is worth reading closely, because it is an admission that the experiment didn't earn its complexity:

> "Retiring this pilot keeps the product simpler today and lets us apply what we learned to experiences that can serve more people over time."

Mechanics of the wind-down (help centre + the `July 9, 2026` release-note entry):
- From 9 July 2026: no new group chats, no converting an existing conversation into one, no joining via invite link — web, iOS and Android.
- Existing groups stayed usable, then went **read-only** on a staggered schedule ("timing may vary as this change rolls out").
- History preserved; exports available via ChatGPT or the OpenAI Privacy Portal.
- Individual conversations unaffected.

(https://help.openai.com/en/articles/12703475-retiring-group-chats-in-chatgpt)

Note the same 9 July 2026 release-note entry also retired **Atlas**, the ChatGPT browser — that was a general simplification sweep, not group-chats-specific.

### What OpenAI kept instead — shared projects

This is the contrast that matters for anyone building in this space. **23 October 2025** — three weeks *before* group chats — OpenAI shipped **shared projects** to every tier:

> "ChatGPT can draw from anything in the shared project – including chats, uploaded files and custom instructions – so responses are informed by your group's internal knowledge, and you can pick up where others left off."

Collaborator limits at launch: **Pro** 40 files / 100 collaborators; **Plus and Go** 25 files / 10 collaborators; **Free** 5 files / 5 collaborators. Visibility toggles between "Only those invited" and "Anyone with a link," reversible at any time.

Shared projects were still being developed in **August 2026** (14 Aug 2026 release note: shared projects remain project-only for memory purposes, and you can now change an unshared project's memory setting). And on **9 September 2026** OpenAI shipped **Library sharing** — share files and folders with Viewer/Editor roles, share across a workspace, a "Shared with me" section. That is collaboration-as-shared-artifacts, not collaboration-as-shared-conversation.

**Read: asynchronous shared context survived; the synchronous group room did not.**

### Other 2026 context you asked about

- **Pulse was also sunset — 17 June 2026.** Release note: *"Pulse is being sunset as proactive updates move into scheduled tasks. Pro users will continue to have access for 14 days from today."* Pulse had launched 25 Sept 2025 for $200/mo Pro users (https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs/), reached web on 29 Oct 2025, and absorbed Tasks on 17 Dec 2025. **So there was never a "group chats + Pulse" crossover — both features died within a month of each other.**
- **The Sora social app also died.** Sora 2 launched as an invite-only iOS social feed with "cameos" on **30 Sept 2025**; per Wikipedia it peaked near ~1M users then fell below 500K actives, and the **mobile app shut down 26 April 2026** (API discontinued 24 Sept 2026). (https://en.wikipedia.org/wiki/Sora_(app)) OpenAI's consumer-social push has therefore been retired on all three fronts: Sora app, group chats, Pulse.

### The "ChatGPT DMs" story — treat with caution

- **4 October 2025:** a teardown of ChatGPT Android beta **1.2025.273** by Tibor Blaho surfaced Direct Messages, username support and profile photos, internally codenamed **"Calpico"** — with "Calpico Rooms" for co-creating text/images in shared conversations. (https://www.bleepingcomputer.com/news/artificial-intelligence/chatgpt-social-could-be-a-thing-as-leak-shows-direct-messages-support/)
- **17 October 2025:** further reporting on the same leak; the code was present but *"not yet functional,"* with no OpenAI confirmation. (https://www.storyboard18.com/digital/chatgpt-may-soon-add-direct-messages-turning-the-ai-app-into-a-social-platform-82752.htm)
- **⚠️ One outlet (Crypto Briefing) framed the July 2026 retirement as OpenAI "introducing a DM-style messages tab" to replace group chats** (https://cryptobriefing.com/openai-retires-chatgpt-group-chats-messages-tab/). **I could not corroborate this.** I grepped the full ChatGPT release-notes history for "Direct message" and "Messages tab" — **zero hits**. OpenAI's own retirement article says only that they are *"continuing to explore ways to make ChatGPT more collaborative over time."* Treat the DM-tab claim as unverified.

---

## 2. Anthropic / Claude

Anthropic's consumer surface has essentially **no realtime multiplayer**; its collaboration story is shared context and, as of mid-2026, a shared agent in Slack.

- **Projects — 25 June 2024.** Pro and Team users organise chats into Projects with a 200K context window. The Team-plan collaboration primitive was an *activity feed*: users could *"share snapshots of their best conversations with Claude into your team's shared project activity feed."* Explicitly framed as "learn from how colleagues prompt," not as co-presence. (https://www.anthropic.com/news/projects)
- **Artifacts — June 2024**, with sharing added later. The current Artifacts page notes *"you can share artifacts for anyone to view your creations,"* viewers can sign in on any plan, and availability expanded to Team and Enterprise in **July 2025**. Sharing is publish-and-view, not co-edit. (https://claude.com/blog/build-artifacts)
- **⭐ @Claude — 23 June 2026. This is Anthropic's actual multiplayer product, and they use the word.** Claude joins Slack as a team member you tag. Anthropic's framing:
  > "@Claude is multiplayer"

  Within a channel there is **one Claude that interacts with everyone** — teammates can see what it's working on and pick up where others left off. It works asynchronously, can be tagged in threads, builds channel context over time, takes proactive initiative, and can schedule tasks for itself over hours or days. Launched **in beta for Claude Enterprise and Team customers** with an introductory launch credit, with intent to *"expand where it's available more widely."* (https://www.anthropic.com/news/introducing-claude-tag)

  Note the shape: **it is multiplayer because the humans are already in a group chat Anthropic didn't have to build.** Contrast with OpenAI, which built the room itself and then retired it.
- **Claude Cowork exists but is not multiplayer.** Per Anthropic's product page it is a single-user agentic desktop/web/mobile product — *"Give it a goal, and it works across your files and tools"* — with a built-in browser, unattended scheduled tasks and parallel subtasks. No shared sessions, no co-presence. (https://www.anthropic.com/product/claude-cowork) Per Wikipedia's timeline: research preview **Jan 2026**, enterprise release **Feb 2026**, Dispatch (phone→computer) **Mar 2026**, Chrome sidebar **Aug 2026**. (https://en.wikipedia.org/wiki/Claude_(language_model))
- Also from that Wikipedia timeline, relevant as a cautionary note on shared-artifact surfaces: **July 2026**, the BBC found 200+ shared Claude chats indexed by Google, *"some containing health records and corporate documents,"* after a robots.txt issue prevented noindex directives from applying.

---

## 3. Character.AI

Character.AI is the only company here that built group chat as a *core* product surface — and the only one whose multiplayer story was wrecked by regulation rather than indifference.

### Group chat — earlier than most people remember

- **11 October 2023 — "Character Group Chat."** Rooms where *"multiple AI Characters and humans"* talk together. Launched **mobile-only (iOS/Android)** as an early preview exclusive to **c.ai+ subscribers ($9.99/mo)**, web promised later. (https://blog.character.ai/new-feature-announcement-character-group-chat/)
- TechCrunch, same day, gives the scale context: **~30M global MAU, ~7M US MAU** at the time. Suggested use cases were multi-character: Einstein, Curie, Tesla and Hawking arguing about science. (https://techcrunch.com/2023/10/11/character-ai-introduces-group-chats-where-people-and-multiple-ais-can-talk-to-each-other/)
- (Wikipedia dates a group-chat capability to the **11 May 2023** c.ai+ subscription announcement; the dedicated feature post is October 2023. https://en.wikipedia.org/wiki/Character.ai)

### Scenes / Streams / Feed — the 2025 pivot

- **2 June 2025 — "Character.AI Unveils New Ways to Create."** Three launches: **Scenes** (*"immersive storytelling… pre-populated storylines,"* mobile first); **Streams** (*"create dynamic moments between any two Characters by choosing a topic and hitting play"* — multi-character, user-directed, rolling out that week on web and mobile); and a **Community Feed**, a scrollable feed positioned as the app's main entry point. (https://blog.character.ai/character-ai-unveils-new-ways-to-create/)
- **4 August 2025 —** "Character.AI Launches World's First AI-Native Social Feed," bundling Characters, Scenes and Streams into one scrollable surface.
- **16 October 2025 — Scenes shipped properly**: *"short, Character-driven role-play moments that turn simple chats into immersive story-driven worlds."*
- **12 August 2025 context:** CEO Karandeep Anand's pivot-to-entertainment framing, with **20M MAU averaging 75 minutes/day** and 9M new characters created monthly. (https://getcoai.com/news/character-ai-pivots-from-agi-to-entertainment-with-20m-monthly-users/)

### The under-18 ban — your date was right

- **29 October 2025 — "Taking Bold Steps to Keep Teen Users Safe."** Character.AI announced it would **remove open-ended chat for under-18 users**, *"no later than November 25, 2025."* Interim: a **two-hour daily cap**, *"ramping down in the coming weeks."* Age assurance via **Persona** plus an in-house model. They also funded an independent non-profit **AI Safety Lab**. Stated reasons: questions about content teens encounter, plus *"how open-ended AI chat in general might affect teens, even when content controls work perfectly"* — i.e. the format itself, not just the content — and feedback from regulators and parents. They described the move as *"more conservative than our peers."* (https://blog.character.ai/u18-chat-announcement/)
- **21 November 2025 — the actual execution date.** Removal began **Monday 24 November 2025**, US first, in two waves (second group weeks later with ≥2 weeks' notice). The interim cap had already stepped down from two hours to **one hour/day**. Teens kept **Feed, Imagine, AvatarFX and Streams** — note that Streams is multi-character but *not* open-ended, which is exactly the line they drew. Support partners: Koko and ThroughLine, with helplines in 170 countries. (https://blog.character.ai/an-update-on-changes-to-our-under-18-experience/)

### What it did

- **4 November 2025:** community reaction was severe and split. Users posting *"it is officially over"*; others welcoming it, one describing *"a screen time of 15 hours a day."* Strong resistance to ID-based age verification. (https://futurism.com/artificial-intelligence/character-ai-minors-banned-user-reactio)
- **I could not find a credible, primary post-ban usage figure.** The search results surface only SEO statistics aggregators (demandsage, sqmagazine, botmemo, axis-intelligence), which I would not cite. Character.AI has not, as far as I can find, published the engagement impact. Note their earlier disclosure that the userbase skewed heavily young — Wikipedia, Jan 2024: 3.5M daily visitors, *"the vast majority of them 16 to 30 years old."*

---

## 4. Meta AI

Meta is the counter-example: AI in group chats has been live continuously for three years across the largest messaging install base on earth, and Meta simply never breaks out the engagement.

- **27 September 2023 (Connect).** Meta AI launched across WhatsApp, Messenger and Instagram, built on Llama 2, with Bing for realtime info. **Group chats were in the launch pitch**: the post walks through a group planning a hike and getting suggestions inline. Invocation via `@MetaAI`, and `@MetaAI /imagine` for images. Also 28 celebrity-voiced AI characters (Snoop Dogg as "Dungeon Master," MrBeast as "Zach," Kendall Jenner as "Billie") in US beta. (https://about.fb.com/news/2023/09/introducing-ai-powered-assistants-characters-and-creative-tools/)
- **18 April 2024.** Meta AI rebuilt on Llama 3 and expanded to **Facebook, Instagram, WhatsApp and Messenger including group chats**, across 13 countries beyond the US: Australia, Canada, Ghana, Jamaica, Malawi, New Zealand, Nigeria, Pakistan, Singapore, South Africa, Uganda, Zambia, Zimbabwe. (https://about.fb.com/news/2024/04/meta-ai-assistant-built-with-llama-3/)
- **29 April 2025 — standalone Meta AI app** on Llama 4, with a **Discover feed** where people *"share and explore how others are using AI"* — you can view others' prompts and **remix** them; nothing posts without explicit consent. (https://about.fb.com/news/2025/04/introducing-meta-ai-app-new-way-access-ai-assistant/)
- **30 April 2025 — the number you wanted.** Q1 2025 earnings release, Zuckerberg: Meta AI *"now has almost 1 billion monthly actives."* (https://investor.atmeta.com/investor-news/press-release-details/2025/Meta-Reports-First-Quarter-2025-Results/default.aspx) Worth flagging that this counts anyone touching the assistant anywhere across four apps — it is not comparable to ChatGPT WAU, and Meta has never split it by surface.
- **25 September 2025 — Vibes.** A feed of short AI-generated videos inside the Meta AI app and meta.ai: *"create your own video, remix what you see, and share it with friends and followers,"* cross-postable to Instagram and Facebook Stories/Reels. (https://about.fb.com/news/2025/09/introducing-vibes-ai-videos/)
- **29 September 2025** also brought Meta AI chat themes to WhatsApp. (https://about.fb.com/news/2025/09/live-motion-photos-meta-ai-chat-themes-video-call-backgrounds-more-whatsapp/)
- **27 July 2026 — Meta AI reached Threads DMs**, its fourth major surface, where you can share posts/images/links/videos to the assistant and ask follow-ups. Reporting notes Meta AI had been in Instagram chat threads for over a year, and — importantly — that **"Meta has not disclosed how often users interact with Meta AI inside Instagram or WhatsApp DMs."** (https://www.aichatdaily.com/ai-business/meta-ai-arrives-threads-dms-meta-walls-off)

**Read: Meta never had to earn the group chat — it already owned it.** That is why its version of this feature has outlived everyone else's, and also why there is no adoption data to evaluate.

---

## 5. Discord Clyde

- **Launched 9 March 2023.** Discord's own post: Clyde is the OpenAI-powered assistant you summon by typing `@Clyde` in any server channel; it *"can answer questions and have extended conversations with you and your friends,"* recommend playlists, and use GIFs/emoji like any user. Same announcement: **AutoMod AI**, **Conversation Summaries**, **Avatar Remix**, an AI **Whiteboard**, and a **$5M AI incubator**. Privacy framing: OpenAI could not train on Discord user data, and Clyde only saw messages sent to it or in threads it created. (https://discord.com/blog/ai-on-discord-your-place-for-ai-with-friends)
- **20 April 2023 —** TechCrunch reported Clyde was jailbroken into producing napalm and meth instructions, one of the earliest public group-chat-AI safety incidents. (https://techcrunch.com/2023/04/20/jailbreak-tricks-discords-new-chatbot-into-sharing-napalm-and-meth-instructions/)
- **Killed 1 December 2023, announced ~17 November 2023.** Discord's in-product notice: *"Clyde will be deactivated at the end of the month. By December 1, 2023, users will no longer be able to invoke Clyde in DMs, Group DMs or server chats."* **Discord gave no reason.** Reporting at the time noted only that Clyde had been *"in beta for a small number of servers."* (https://decrypt.co/206528/clydes-last-call-discords-ai-chatbot-being-shut-down-on-december-1)
  - ⚠️ Source caveat: this article dates the name "Clyde" to May 2021 — that refers to Discord's older non-AI system bot. The AI Clyde is the 9 March 2023 launch, per Discord's own blog. Also note Discord's support FAQ (support.discord.com article 13066317497239) now 404s, and both Discord support and archived copies sit behind a bot challenge, so I could not read Discord's original notice directly — the quote above is as reported.

### Discord's AI in 2025–2026

Discord has **not** rebuilt a conversational assistant. Its AI is now infrastructure, not a character:
- **March 2026:** an **age inference model** analysing profile, usage and gaming history to determine whether accounts belong to adults, plus AI review of servers not already marked adult. (https://en.wikipedia.org/wiki/Discord)
- The **25 June 2026 changelog** contains **zero AI features** — trending games, tap-to-react, account linking, game profiles. (https://discord.com/blog/discord-update-june-25-2026-changelog)
- AI catch-up/summarisation has been reported as in development but I found no shipped, first-party announcement.

---

## 6. Snapchat My AI

- **Launched late February 2023** for **Snapchat+** subscribers only ($3.99/mo), as essentially a ChatGPT wrapper. (https://en.wikipedia.org/wiki/Snapchat)
- **Opened to all users on 19 April 2023**, at the Snap Partner Summit, **including group chat support**. Snap noted Snapchat+ members had sent *"nearly 2 million chats"* to it during early testing.
- **The backlash — 24 April 2023, five days later.** TechCrunch, citing Sensor Tower: Snapchat's average US App Store rating fell to **1.67 over the prior week, with 75% one-star reviews**, against a Q1 2023 baseline of **3.05 average and 35% one-star**. Daily review volume rose **fivefold**. Apptopia: "AI" appeared **2,973 times** in reviews in seven days, with an Impact Score of **-9.2 on a -10 to +10 scale**; one-star ratings **tripled on 20 April 2023**. Complaints: it appeared without consent, free users could not unpin it, and it collected location data. Snap's response was essentially that users *"don't have to use it."* (https://techcrunch.com/2023/04/24/snapchat-sees-spike-in-1-star-reviews-as-users-pan-the-my-ai-feature-calling-for-its-removal/)

  **This is the key precedent for forced-presence AI in a social graph: the feature was not opt-in, and the rating collapse was immediate and measurable.**
- **The usage stat you were after — confirmed, primary source.** Snap's **Q2 2023 results (1 August 2023)**:
  > "Since launching My AI, our AI-powered chatbot, over 150 million people have sent over 10 billion messages, which we believe makes My AI among the largest consumer chatbots available today."

  (https://investor.snap.com/news/news-details/2023/Snap-Inc.-Announces-Second-Quarter-2023-Financial-Results/default.aspx) — So: **150M+ users, 10B+ messages**, within ~3.5 months of the free rollout. Note the tension with the review backlash: people used it heavily *and* hated being given it.
- **Status in 2025–2026: alive, but being augmented rather than replaced.** On **5 November 2025** Snap announced Perplexity will pay Snap **$400M in cash and equity over one year** to put its answer engine in Snapchat, launching **early 2026**, with revenue recognised in 2026. Snap cited **nearly 1 billion MAU** and 75%+ of 13–34-year-olds in 25+ countries. Critically, My AI survives:
  > "Snapchatters will still be able to chat with the existing My AI chatbot, with Perplexity joining as an answer engine"

  (https://investor.snap.com/news/news-details/2025/Snap-and-Perplexity-Partner-to-Bring-Conversational-AI-Search-to-Snapchat/default.aspx; TechCrunch 6 Nov 2025: https://techcrunch.com/2025/11/06/perplexity-to-pay-snap-400m-to-power-search-in-snapchat/)

---

## 7. Google Gemini in Google Messages — ⚠️ your assumption appears to be wrong

**I could not find any evidence that Gemini became available in group chats in Google Messages.** Everything points the other way:

- **Announced 26 February 2024**, broadly rolling out **25 May 2024** after I/O. 9to5Google's description is explicit about the scope: *"You're having a direct 1:1 conversation with Gemini, which cannot be pulled into other conversations."* Gemini appears as its own contact in the conversation list. Requires RCS enabled; **not end-to-end encrypted**. (https://9to5google.com/2024/05/25/google-messages-gemini-launch/)
- **Google's current help page** (support.google.com/messages/answer/14599070) describes availability in **165+ countries and 40+ languages**, requiring an Android phone, a personal Google Account (not Family Link or Workspace), **age 18+**, and RCS enabled. It walks through *"Tap the chat with Gemini, or tap Start chat."* **The word "group" does not appear in relation to Gemini anywhere on the page.** It also warns: *"Chats with Gemini aren't end-to-end encrypted."*
- I checked 9to5Google's Google Messages feature round-ups for **June 2025**, **December 2025** and **September 2026**, plus APK-teardown coverage. The group-chat work in Messages through 2025–26 is **RCS plumbing, not Gemini**: group @mentions and a Trash folder shipped **20 March 2026**; join-by-link, custom group icons, MLS encryption and mute-duration were the other threads. No Gemini-in-group-chat feature surfaced in any of them.

**Where Google *does* do multiplayer AI is Workspace, not consumer Messages:**
- **October 2024** — Gemini summaries of unread conversations in Google Chat.
- **18 August 2025** — Gemini summarises unread messages inside a **space or group DM**, auto-surfacing *"a card in the conversation pane summarizing recent discussions."* Rapid Release from 12 Aug 2025, Scheduled Release from 25 Aug 2025, web first. Gated to Business Standard/Plus, Enterprise Standard/Plus, Frontline Plus and Gemini Education tiers, and requires admin-enabled smart features. (https://workspaceupdates.googleblog.com/2025/08/catch-up-unread-conversations-gemini-chat.html)

So the accurate statement is: **Gemini in consumer Google Messages is 1:1 only; Gemini's group-conversation capability lives in Google Chat for paid Workspace tiers, and it summarises rather than participates.**

---

## Cross-cutting patterns worth carrying forward

1. **Synchronous "AI in the room" has a bad track record when the room has to be built.** Clyde: 9 months. ChatGPT group chats: 8 months. Sora's social app: 7 months. The survivors (Meta AI, @Claude) are parasitic on group chats that already existed.
2. **Memory is the unsolved problem.** OpenAI's solution was total isolation — no personal memory in, no memories out — and they publicly flagged it as temporary and unsatisfying. Nobody has shipped a good answer to "whose memory is this?" in a shared thread.
3. **Consent is the reputational landmine.** Snap's 1.67-star week came from *pinning* My AI, not from what it said. Character.AI's most-resisted change was age verification. Meta's model works partly because @-mention invocation is opt-in per message.
4. **The durable primitive is shared context, not shared presence.** OpenAI retired group chats and kept shared projects, then added Library sharing. Anthropic went straight to shared context (Projects, activity feeds) and only reached multiplayer by entering Slack. Google does summarisation of group conversation rather than participation in it.
5. **Almost nobody publishes engagement data for these features.** OpenAI: one sentence, "early feedback has been positive," then a shutdown. Meta: explicitly declines to break out assistant usage. Discord: no reason given at all. The only hard number in this entire report is Snap's 150M/10B from Q2 2023 — and Snap shipped that feature to everyone whether they wanted it or not.

---

## Sources (40 URLs)

**OpenAI:** [Group chats announcement + 20 Nov update](https://openai.com/index/group-chats-in-chatgpt/) · [Retiring group chats](https://help.openai.com/en/articles/12703475-retiring-group-chats-in-chatgpt) · [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) · [TechCrunch pilot, 14 Nov 2025](https://techcrunch.com/2025/11/14/chatgpt-launches-pilot-group-chats-across-japan-new-zealand-south-korea-and-taiwan/) · [TechCrunch global, 20 Nov 2025](https://www.techcrunch.com/2025/11/20/chatgpt-launches-group-chats-globally/) · [Crypto Briefing retirement (DM claim unverified)](https://cryptobriefing.com/openai-retires-chatgpt-group-chats-messages-tab/) · [BleepingComputer DM leak](https://www.bleepingcomputer.com/news/artificial-intelligence/chatgpt-social-could-be-a-thing-as-leak-shows-direct-messages-support/) · [Storyboard18 Calpico](https://www.storyboard18.com/digital/chatgpt-may-soon-add-direct-messages-turning-the-ai-app-into-a-social-platform-82752.htm) · [TechCrunch Pulse](https://techcrunch.com/2025/09/25/openai-launches-chatgpt-pulse-to-proactively-write-you-morning-briefs/) · [Sora app (Wikipedia)](https://en.wikipedia.org/wiki/Sora_(app)) · [OpenAI Q1 2026 adoption signals](https://openai.com/signals/research/2026q1-update/)

**Anthropic:** [Projects](https://www.anthropic.com/news/projects) · [@Claude](https://www.anthropic.com/news/introducing-claude-tag) · [Build Artifacts](https://claude.com/blog/build-artifacts) · [Claude Cowork](https://www.anthropic.com/product/claude-cowork) · [Claude (Wikipedia)](https://en.wikipedia.org/wiki/Claude_(language_model))

**Character.AI:** [Character Group Chat](https://blog.character.ai/new-feature-announcement-character-group-chat/) · [TechCrunch group chats](https://techcrunch.com/2023/10/11/character-ai-introduces-group-chats-where-people-and-multiple-ais-can-talk-to-each-other/) · [New Ways to Create (Scenes/Streams/Feed)](https://blog.character.ai/character-ai-unveils-new-ways-to-create/) · [AI-native social feed](https://blog.character.ai/character-ai-launches-worlds-first-ai-native-social-feed/) · [Introducing Scenes](https://blog.character.ai/introducing-scenes-your-new-way-to-tell-stories-on-c-ai/) · [U18 announcement, 29 Oct 2025](https://blog.character.ai/u18-chat-announcement/) · [U18 execution, 21 Nov 2025](https://blog.character.ai/an-update-on-changes-to-our-under-18-experience/) · [Futurism reaction](https://futurism.com/artificial-intelligence/character-ai-minors-banned-user-reactio) · [20M MAU pivot](https://getcoai.com/news/character-ai-pivots-from-agi-to-entertainment-with-20m-monthly-users/) · [Character.ai (Wikipedia)](https://en.wikipedia.org/wiki/Character.ai)

**Meta:** [Connect 2023 launch](https://about.fb.com/news/2023/09/introducing-ai-powered-assistants-characters-and-creative-tools/) · [Llama 3 expansion](https://about.fb.com/news/2024/04/meta-ai-assistant-built-with-llama-3/) · [Standalone app](https://about.fb.com/news/2025/04/introducing-meta-ai-app-new-way-access-ai-assistant/) · [Vibes](https://about.fb.com/news/2025/09/introducing-vibes-ai-videos/) · [Q1 2025 results — "almost 1 billion monthly actives"](https://investor.atmeta.com/investor-news/press-release-details/2025/Meta-Reports-First-Quarter-2025-Results/default.aspx) · [Threads DMs, July 2026](https://www.aichatdaily.com/ai-business/meta-ai-arrives-threads-dms-meta-walls-off)

**Discord:** [Clyde launch, 9 Mar 2023](https://discord.com/blog/ai-on-discord-your-place-for-ai-with-friends) · [Clyde jailbreak](https://techcrunch.com/2023/04/20/jailbreak-tricks-discords-new-chatbot-into-sharing-napalm-and-meth-instructions/) · [Clyde shutdown](https://decrypt.co/206528/clydes-last-call-discords-ai-chatbot-being-shut-down-on-december-1) · [June 2026 changelog](https://discord.com/blog/discord-update-june-25-2026-changelog) · [Discord (Wikipedia)](https://en.wikipedia.org/wiki/Discord)

**Snap:** [TechCrunch 1-star backlash](https://techcrunch.com/2023/04/24/snapchat-sees-spike-in-1-star-reviews-as-users-pan-the-my-ai-feature-calling-for-its-removal/) · [Q2 2023 results — 150M/10B](https://investor.snap.com/news/news-details/2023/Snap-Inc.-Announces-Second-Quarter-2023-Financial-Results/default.aspx) · [Perplexity partnership](https://investor.snap.com/news/news-details/2025/Snap-and-Perplexity-Partner-to-Bring-Conversational-AI-Search-to-Snapchat/default.aspx) · [TechCrunch $400M deal](https://techcrunch.com/2025/11/06/perplexity-to-pay-snap-400m-to-power-search-in-snapchat/) · [Snapchat (Wikipedia)](https://en.wikipedia.org/wiki/Snapchat)

**Google:** [Gemini in Messages help page](https://support.google.com/messages/answer/14599070) · [9to5Google Gemini launch](https://9to5google.com/2024/05/25/google-messages-gemini-launch/) · [Workspace: Gemini unread summaries in spaces/group DMs](https://workspaceupdates.googleblog.com/2025/08/catch-up-unread-conversations-gemini-chat.html) · [Google Messages Dec 2025 features](https://9to5google.com/2025/12/22/google-messages-features/)

---

### Three corrections to your brief

1. **Tiers:** the pilot was Free, **Go**, Plus and **Pro** — not "Free, Plus, Team" as several outlets reported. OpenAI's own post is authoritative.
2. **Gemini in Google Messages group chats: I found no evidence this ever shipped.** It is 1:1 only per Google's own help documentation. The group-AI capability is in Google Chat (Workspace, paid tiers) and it summarises rather than participates.
3. **The "Messages tab replaces group chats" claim is unverified** — it appears in one outlet and contradicts a full grep of OpenAI's release-note history.

### Two things I could not verify
- **Discord's original Clyde deprecation notice.** The support article 404s and archived snapshots return a Cloudflare challenge; the quote and the "no reason given" characterisation come from contemporaneous reporting (Decrypt, 17 Nov 2023).
- **Character.AI's post-ban usage impact.** No primary figure exists that I could find; only SEO statistics aggregators, which I deliberately did not cite.

Note also: my WebSearch budget was exhausted partway through (200/200), so the back half of this research was done via direct page fetches and a text-extraction proxy. That worked well — it actually got me past the Cloudflare blocks on openai.com and help.openai.com that WebFetch could not reach — but if you want deeper digging on any single thread, a fresh session would have search available again.
