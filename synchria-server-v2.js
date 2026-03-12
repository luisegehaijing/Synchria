/**
 * Synchria – Backend Server v2
 * Six new categories, updated matching algorithms
 * Stack: Node.js + Express + in-memory store
 * Production: swap store with Supabase (see README)
 */

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// STORE
// ---------------------------------------------------------------------------
const store = new Map(); // userId -> UserRecord

// ---------------------------------------------------------------------------
// CATEGORY DEFINITIONS
// shared_passion   — shared hobbies, interests, identity groups
// try_together     — one-off shared experiences (restaurant, hike, concert)
// accountability   — parallel growth toward personal goals
// creative         — making something together
// knowledge        — teach / learn / swap expertise
// life_moment      — same life chapter (new city, new parent, etc.)
// ---------------------------------------------------------------------------

function overlap(a = [], b = []) {
  const setB = new Set(b.map(x => x.toLowerCase()));
  return a.filter(x => setB.has(x.toLowerCase()));
}

function softOverlap(a = [], b = []) {
  return a.filter(ta =>
    b.some(tb =>
      ta.toLowerCase().includes(tb.toLowerCase()) ||
      tb.toLowerCase().includes(ta.toLowerCase())
    )
  );
}

// ---------------------------------------------------------------------------
// MATCHING ALGORITHMS
// ---------------------------------------------------------------------------

function matchSharedPassion(user, candidates) {
  return candidates.map(c => {
    const passionHits = softOverlap(user.profile.passions || [], c.profile.passions || []);
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = passionHits.length * 4 + tagHits.length * 1.5;
    const reasons = [
      passionHits.length > 0 && `Both into: ${passionHits.slice(0, 3).join(", ")}`,
      tagHits.length > 0 && passionHits.length === 0 && `Shared interests: ${tagHits.slice(0, 2).join(", ")}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchTryTogether(user, candidates) {
  return candidates.map(c => {
    const activityHits = softOverlap(user.profile.activities || [], c.profile.activities || []);
    const vibeBonus = user.profile.vibe && c.profile.vibe &&
      user.profile.vibe.toLowerCase() === c.profile.vibe.toLowerCase() ? 2 : 0;
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = activityHits.length * 3.5 + vibeBonus * 2 + tagHits.length;
    const reasons = [
      activityHits.length > 0 && `Both want to: ${activityHits.slice(0, 2).join(", ")}`,
      vibeBonus > 0 && `Same energy: ${user.profile.vibe}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchAccountability(user, candidates) {
  return candidates.map(c => {
    const goalHits = softOverlap(user.profile.goals || [], c.profile.goals || []);
    const domainHits = overlap(user.profile.domains || [], c.profile.domains || []);
    const timelineBonus = user.profile.timeline && c.profile.timeline &&
      user.profile.timeline === c.profile.timeline ? 2 : 0;
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = goalHits.length * 4 + domainHits.length * 2.5 + timelineBonus * 2 + tagHits.length;
    const reasons = [
      goalHits.length > 0 && `Shared goal: ${goalHits.slice(0, 2).join(", ")}`,
      timelineBonus > 0 && `Same timeline: ${user.profile.timeline}`,
      domainHits.length > 0 && goalHits.length === 0 && `Same domain: ${domainHits.slice(0, 2).join(", ")}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchCreative(user, candidates) {
  return candidates.map(c => {
    const mediumHits = overlap(user.profile.mediums || [], c.profile.mediums || []);
    const influenceHits = softOverlap(user.profile.influences || [], c.profile.influences || []);
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = mediumHits.length * 4 + influenceHits.length * 2.5 + tagHits.length * 1.5;
    const reasons = [
      mediumHits.length > 0 && `Same medium: ${mediumHits.slice(0, 2).join(", ")}`,
      influenceHits.length > 0 && `Shared influences: ${influenceHits.slice(0, 2).join(", ")}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchKnowledge(user, candidates) {
  return candidates.map(c => {
    const iTeachThem = softOverlap(user.profile.canTeach || [], c.profile.wantsToLearn || []);
    const theyTeachMe = softOverlap(c.profile.canTeach || [], user.profile.wantsToLearn || []);
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = iTeachThem.length * 3 + theyTeachMe.length * 3 + tagHits.length;
    const reasons = [
      theyTeachMe.length > 0 && `They can teach you: ${theyTeachMe.slice(0, 2).join(", ")}`,
      iTeachThem.length > 0 && `You can teach them: ${iTeachThem.slice(0, 2).join(", ")}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchLifeMoment(user, candidates) {
  return candidates.map(c => {
    const momentHits = softOverlap(user.profile.moments || [], c.profile.moments || []);
    const feelingHits = overlap(user.profile.feelings || [], c.profile.feelings || []);
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    const score = momentHits.length * 5 + feelingHits.length * 2 + tagHits.length;
    const reasons = [
      momentHits.length > 0 && `Same chapter: ${momentHits.slice(0, 2).join(", ")}`,
      feelingHits.length > 0 && `Same feeling: ${feelingHits.slice(0, 2).join(", ")}`,
    ].filter(Boolean);
    return { user: c, score, reasons };
  });
}

function matchFallback(user, candidates) {
  return candidates.map(c => {
    const tagHits = overlap(user.profile.tags || [], c.profile.tags || []);
    return {
      user: c,
      score: tagHits.length,
      reasons: tagHits.length > 0 ? [`Common ground: ${tagHits.slice(0, 3).join(", ")}`] : [],
    };
  });
}

const ALGORITHMS = {
  shared_passion: matchSharedPassion,
  try_together:   matchTryTogether,
  accountability: matchAccountability,
  creative:       matchCreative,
  knowledge:      matchKnowledge,
  life_moment:    matchLifeMoment,
};

// Multi-category: run all relevant algorithms, aggregate best score per person
function runMatching(user, allCandidates) {
  const categories = user.categories || [];
  const scoreMap = new Map();

  for (const cat of categories) {
    const algo = ALGORITHMS[cat] || matchFallback;
    const eligible = allCandidates.filter(c =>
      (c.categories || []).includes(cat)
    );
    const results = algo(user, eligible);

    for (const { user: c, score, reasons } of results) {
      if (score <= 0) continue;
      const existing = scoreMap.get(c.id);
      if (!existing || score > existing.score) {
        scoreMap.set(c.id, { user: c, score, reasons, matchedOn: [cat] });
      } else if (existing && !existing.matchedOn.includes(cat)) {
        existing.matchedOn.push(cat);
      }
    }
  }

  // Fallback: if no category matches, run tag-based fallback on everyone
  if (scoreMap.size === 0) {
    const fallback = matchFallback(user, allCandidates);
    for (const { user: c, score, reasons } of fallback) {
      if (score > 0) scoreMap.set(c.id, { user: c, score, reasons, matchedOn: [] });
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.score - a.score || b.user.ts - a.user.ts)
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

app.post("/api/users", (req, res) => {
  const { id, name, categories, openAnswer, profile } = req.body;
  if (!id || !name || !profile) {
    return res.status(400).json({ error: "Missing: id, name, profile" });
  }
  store.set(id, {
    id, name,
    categories: categories || [],
    openAnswer: openAnswer || "",
    profile,
    ts: Date.now(),
  });
  console.log(`[+] ${name} | ${(categories||[]).join(", ")} | total: ${store.size}`);
  res.json({ ok: true });
});

app.get("/api/matches/:userId", (req, res) => {
  const user = store.get(req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  const candidates = [...store.values()].filter(
    c => c.id !== user.id && Date.now() - c.ts < TWO_WEEKS
  );

  const matches = runMatching(user, candidates);
  console.log(`[~] ${user.name} → ${matches.length} matches`);
  res.json({ matches });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, users: store.size, uptime: Math.round(process.uptime()) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nSynchria backend → http://localhost:${PORT}\n`);
});
