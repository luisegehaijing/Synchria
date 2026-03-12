import { useState, useRef, useEffect } from "react";

const API_BASE = "http://localhost:3001";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ─── SIX CATEGORIES ──────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: "shared_passion",
    emoji: "🐾",
    label: "Shared Passion",
    tagline: "Find your people",
    description: "Dog walks, wine, chess, film, plants — whatever makes you you.",
    color: "#7A9E87",
  },
  {
    id: "try_together",
    emoji: "🍜",
    label: "Try Something Together",
    tagline: "A companion for an experience",
    description: "A restaurant, hike, concert, museum — things better shared.",
    color: "#D4863A",
  },
  {
    id: "accountability",
    emoji: "🌱",
    label: "Accountability Partner",
    tagline: "Grow alongside someone",
    description: "Training, learning, building — a fellow traveller on a parallel path.",
    color: "#5A8A6A",
  },
  {
    id: "creative",
    emoji: "🎵",
    label: "Creative Collaboration",
    tagline: "Make something together",
    description: "Music, writing, film, design, code — find your creative counterpart.",
    color: "#9B7BB5",
  },
  {
    id: "knowledge",
    emoji: "💡",
    label: "Knowledge Exchange",
    tagline: "Teach, learn, or trade",
    description: "Share your expertise, absorb someone else's — peer-to-peer wisdom.",
    color: "#C4914A",
  },
  {
    id: "life_moment",
    emoji: "🌅",
    label: "Life Moment Companion",
    tagline: "Same chapter, different story",
    description: "New city, new parent, career change — life's big transitions.",
    color: "#6B8FB5",
  },
];

// ─── SYNI PROMPTS ────────────────────────────────────────────────────────────
function buildSyniSystem(catIds, openAnswer) {
  const labels = catIds.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean).join(", ");
  return `You are Syni, the warm and perceptive guide of Synchria — a platform where people share their real inner thoughts to find genuine connection.

The person is open to: ${labels}.
They wrote this before meeting you: "${openAnswer}"

Your job: have a genuine, light conversation to understand who they really are. Ask about specifics — what they love, what they're looking for, what kind of person would make their week better. Be curious and warm, not clinical. Short messages (2-3 sentences). After 4-5 exchanges, wrap up naturally and let them know you have a good picture of them.`;
}

function buildExtractSystem(catIds) {
  const fieldMap = {
    shared_passion:  `"passions": ["specific hobby 1", "specific hobby 2", "specific hobby 3"],`,
    try_together:    `"activities": ["activity 1", "activity 2"], "vibe": "casual|adventurous|cultural|foodie",`,
    accountability:  `"goals": ["goal 1", "goal 2"], "domains": ["health|learning|career|creative|other"], "timeline": "weeks|months|year+",`,
    creative:        `"mediums": ["medium 1", "medium 2"], "influences": ["influence 1", "influence 2"],`,
    knowledge:       `"canTeach": ["topic 1", "topic 2"], "wantsToLearn": ["topic 1", "topic 2"],`,
    life_moment:     `"moments": ["life stage 1", "life stage 2"], "feelings": ["feeling 1", "feeling 2"],`,
  };
  const relevant = catIds.filter(id => fieldMap[id]).map(id => fieldMap[id]).join("\n  ");
  return `Extract a connection profile from this chat. Return ONLY valid JSON, no markdown.

{
  ${relevant}
  "summary": "one warm sentence capturing who this person is right now",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Tags should be specific and human (e.g. "morning runner", "jazz nerd", "new to Berlin", "learning guitar").`;
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(messages, system) {
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function saveUser(payload) {
  try {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  } catch { return null; }
}

async function fetchMatches(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/matches/${userId}`);
    return res.json();
  } catch { return { matches: [] }; }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── SYNI AVATAR ─────────────────────────────────────────────────────────────
// Swap SYNI_SRC with your image URL or base64 when ready
const SYNI_SRC = <img_0505 className="jpg"></img_0505>;

function SyniAvatar({ size = 40, animate = false }) {
  const style = {
    width: size, height: size, borderRadius: "50%",
    flexShrink: 0, display: "block",
    ...(animate ? { animation: "elfBob 3s ease-in-out infinite" } : {}),
  };
  return SYNI_SRC
    ? <img src={SYNI_SRC} alt="Syni" style={{ ...style, objectFit: "cover", objectPosition: "center 10%" }} />
    : (
      <div style={{
        ...style,
        background: "linear-gradient(135deg, #7A9E87 0%, #4A6B5A 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#FDFAF3", fontFamily: "'Fraunces', serif",
        fontStyle: "italic", fontWeight: 700, fontSize: size * 0.42,
      }}>S</div>
    );
}

function Wordmark({ size = 20 }) {
  return (
    <span style={{
      fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: "italic",
      fontSize: size, color: "#1C1812", letterSpacing: "-0.02em",
    }}>Synchria</span>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState("landing"); // landing | onboard | chat | extracting | matches
  const [name, setName] = useState("");
  const [selectedCats, setSelectedCats] = useState([]);
  const [openAnswer, setOpenAnswer] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [userId] = useState(generateId);
  const [backendError, setBackendError] = useState(false);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  function handleLanding() { if (name.trim()) setStep("onboard"); }
  function toggleCat(id) {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  async function handleOnboardSubmit() {
    if (!selectedCats.length || !openAnswer.trim()) return;
    setStep("chat");
    setIsTyping(true);
    const system = buildSyniSystem(selectedCats, openAnswer);
    const init = `Hi Syni, I'm ${name}.`;
    const reply = await callClaude([{ role: "user", content: init }], system);
    setMessages([{ role: "user", content: init }, { role: "assistant", content: reply }]);
    setIsTyping(false);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  async function sendMessage() {
    if (!input.trim() || isTyping) return;
    const next = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    setIsTyping(true);
    const reply = await callClaude(
      next.map(m => ({ role: m.role, content: m.content })),
      buildSyniSystem(selectedCats, openAnswer)
    );
    setMessages([...next, { role: "assistant", content: reply }]);
    setIsTyping(false);
  }

  async function finishAndMatch() {
    setStep("extracting");
    const transcript = messages.map(m => `${m.role === "user" ? name : "Syni"}: ${m.content}`).join("\n");
    let extracted;
    try {
      const raw = await callClaude(
        [{ role: "user", content: `Transcript:\n\n${transcript}` }],
        buildExtractSystem(selectedCats)
      );
      extracted = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      extracted = { summary: "A thoughtful person with an open heart.", tags: [] };
    }
    setProfile(extracted);
    const saved = await saveUser({ id: userId, name, categories: selectedCats, openAnswer, profile: extracted });
    if (!saved) setBackendError(true);
    const data = await fetchMatches(userId);
    setMatches(data?.matches || []);
    setStep("matches");
  }

  const userCount = messages.filter(m => m.role === "user").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600;1,9..144,700&family=DM+Sans:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --cream:#FDFAF3; --parchment:#F5EDD8; --paper:#EDE4CC;
          --ink:#1C1812; --ink-2:#4A3F30; --ink-3:#9A8E7A;
          --forest:#4A7C5A; --forest-bg:#EBF3EE;
          --amber:#D4863A; --amber-bg:#FDF0E3; --r:10px;
        }
        html,body{background:var(--cream);color:var(--ink);font-family:'DM Sans',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;min-height:100%}
        @keyframes elfBob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-5px) rotate(1deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes td{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}

        /* TOPBAR */
        .topbar{position:fixed;top:0;left:0;right:0;height:54px;background:rgba(253,250,243,0.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--paper);display:flex;align-items:center;padding:0 24px;gap:10px;z-index:200}
        .page{padding-top:54px;min-height:100vh;display:flex;justify-content:center}

        /* LANDING */
        .landing{width:100%;max-width:1000px;padding:0 24px;display:grid;grid-template-columns:1.1fr 0.9fr;gap:56px;min-height:calc(100vh - 54px);align-items:center}
        @media(max-width:720px){.landing{grid-template-columns:1fr;gap:32px;padding-top:40px;padding-bottom:56px}.landing-right{order:-1}}
        .landing-left{animation:fadeUp 0.5s 0.1s ease both}
        .landing-right{animation:fadeUp 0.5s 0.25s ease both}
        .kicker{font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--forest);display:flex;align-items:center;gap:8px;margin-bottom:18px}
        .kicker-dot{width:6px;height:6px;background:var(--amber);border-radius:50%;flex-shrink:0}
        .landing-h1{font-family:'Fraunces',serif;font-weight:700;font-style:italic;font-size:clamp(38px,5vw,62px);line-height:1.1;letter-spacing:-.03em;color:var(--ink);margin-bottom:18px}
        .landing-h1 .accent{color:var(--forest)}
        .landing-body{font-size:16px;line-height:1.8;color:var(--ink-2);font-weight:300;max-width:420px;margin-bottom:10px}
        .landing-sub{font-family:'Fraunces',serif;font-style:italic;font-size:14px;line-height:1.7;color:var(--ink-3);max-width:400px;margin-bottom:36px}
        .name-label{display:block;font-size:11px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px}
        .name-input{width:100%;max-width:320px;background:var(--parchment);border:1.5px solid var(--paper);border-radius:8px;padding:12px 16px;font-size:17px;font-family:'Fraunces',serif;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s;margin-bottom:18px;display:block}
        .name-input:focus{border-color:var(--forest);box-shadow:0 0 0 3px var(--forest-bg)}
        .name-input::placeholder{color:var(--paper)}
        .btn-primary{display:inline-flex;align-items:center;gap:10px;background:var(--ink);color:var(--cream);border:none;padding:13px 26px;font-family:'Fraunces',serif;font-size:15px;font-weight:700;font-style:italic;cursor:pointer;border-radius:8px;transition:background .2s,transform .1s}
        .btn-primary:hover{background:var(--forest)}
        .btn-primary:active{transform:scale(.98)}
        .btn-primary:disabled{opacity:.35;cursor:not-allowed}
        .btn-primary .arr{transition:transform .2s;font-style:normal}
        .btn-primary:hover .arr{transform:translateX(4px)}
        .syni-circle{width:156px;height:156px;background:var(--parchment);border:1.5px solid var(--paper);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 22px;box-shadow:0 8px 32px rgba(28,24,18,.08)}
        .pillars{border:1.5px solid var(--paper);border-radius:var(--r);overflow:hidden}
        .pillar{padding:14px 18px;display:flex;gap:13px;align-items:flex-start;border-bottom:1px solid var(--paper)}
        .pillar:last-child{border-bottom:none}
        .pillar-n{font-family:'Fraunces',serif;font-size:18px;font-weight:700;font-style:italic;color:var(--amber);flex-shrink:0;line-height:1.2}
        .pillar h4{font-size:12.5px;font-weight:500;color:var(--ink);margin-bottom:2px}
        .pillar p{font-size:11.5px;color:var(--ink-3);line-height:1.5;font-weight:300}

        /* ONBOARD */
        .onboard-page{width:100%;max-width:700px;padding:48px 24px 80px;animation:fadeUp .4s ease both}
        .page-title{font-family:'Fraunces',serif;font-weight:700;font-style:italic;font-size:clamp(24px,4vw,36px);letter-spacing:-.02em;color:var(--ink);margin-bottom:6px}
        .page-sub{font-size:14px;color:var(--ink-3);font-weight:300;line-height:1.6;margin-bottom:28px}
        .cat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:32px}
        @media(max-width:560px){.cat-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:380px){.cat-grid{grid-template-columns:1fr}}
        .cat-card{border:1.5px solid var(--paper);border-radius:var(--r);padding:16px 14px;cursor:pointer;text-align:left;background:var(--cream);transition:border-color .18s,background .18s,transform .1s;position:relative;user-select:none}
        .cat-card:hover{background:var(--parchment);border-color:#C8BFA8}
        .cat-card.selected{background:var(--parchment)}
        .cat-card.selected::after{content:'✓';position:absolute;top:10px;right:12px;font-size:12px;font-weight:600;color:var(--forest)}
        .cat-emoji{font-size:22px;margin-bottom:8px;display:block}
        .cat-label{font-family:'Fraunces',serif;font-weight:700;font-style:italic;font-size:14px;color:var(--ink);margin-bottom:4px}
        .cat-desc{font-size:11.5px;color:var(--ink-3);line-height:1.5;font-weight:300}
        .open-q-label{font-family:'Fraunces',serif;font-style:italic;font-size:17px;color:var(--ink);line-height:1.5;margin-bottom:12px;display:block}
        .open-q-ta{width:100%;background:var(--parchment);border:1.5px solid var(--paper);border-radius:var(--r);padding:14px 16px;font-size:15px;font-family:'DM Sans',sans-serif;font-weight:300;color:var(--ink);outline:none;resize:none;line-height:1.6;min-height:90px;transition:border-color .2s,box-shadow .2s;margin-bottom:18px}
        .open-q-ta:focus{border-color:var(--forest);box-shadow:0 0 0 3px var(--forest-bg)}
        .open-q-ta::placeholder{color:var(--ink-3);font-style:italic}
        .onboard-hint{font-size:12px;color:var(--ink-3);font-weight:300;margin-bottom:20px;font-style:italic}
        .select-hint{font-size:13px;color:var(--ink-3);font-weight:300;font-style:italic;margin-top:4px}

        /* CHAT */
        .chat-wrap{width:100%;max-width:620px;height:calc(100vh - 54px);display:flex;flex-direction:column;padding:0 24px}
        .chat-header{padding:16px 0;border-bottom:1px solid var(--paper);flex-shrink:0;display:flex;align-items:center;justify-content:space-between}
        .syni-id{display:flex;align-items:center;gap:11px}
        .syni-bubble{border:1.5px solid var(--paper);border-radius:50%;background:var(--parchment);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
        .syni-name{font-family:'Fraunces',serif;font-size:14px;font-weight:700;font-style:italic;color:var(--ink)}
        .syni-role{font-size:11px;color:var(--ink-3);letter-spacing:.04em}
        .cats-chips{display:flex;flex-wrap:wrap;gap:5px}
        .cat-chip{font-size:10px;padding:3px 8px;border-radius:20px;border:1px solid var(--paper);color:var(--ink-3);background:var(--cream);white-space:nowrap}
        .messages-area{flex:1;overflow-y:auto;padding:22px 0;display:flex;flex-direction:column;gap:14px;scrollbar-width:thin;scrollbar-color:var(--paper) transparent}
        .msg{max-width:80%;font-size:14.5px;line-height:1.7;animation:msgIn .22s ease both}
        .msg-user{align-self:flex-end;background:var(--ink);color:var(--cream);padding:11px 17px;border-radius:18px 18px 4px 18px}
        .msg-syni{align-self:flex-start;background:var(--parchment);color:var(--ink-2);padding:13px 17px;border-radius:4px 18px 18px 18px;border:1px solid var(--paper);font-family:'Fraunces',serif;font-size:15px;font-style:italic;font-weight:400;line-height:1.7}
        .typing{align-self:flex-start;display:flex;gap:5px;background:var(--parchment);border:1px solid var(--paper);padding:13px 16px;border-radius:4px 18px 18px 18px}
        .tdot{width:5px;height:5px;border-radius:50%;background:var(--ink-3);animation:td 1.2s infinite}
        .tdot:nth-child(2){animation-delay:.2s}.tdot:nth-child(3){animation-delay:.4s}
        .chat-footer{padding:12px 0;flex-shrink:0}
        .nudge{background:var(--amber-bg);border:1.5px solid rgba(212,134,58,.3);border-radius:8px;padding:11px 15px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;animation:fadeUp .3s ease both}
        .nudge-text{font-family:'Fraunces',serif;font-style:italic;font-size:13px;color:var(--ink-2)}
        .btn-nudge{background:var(--amber);color:white;border:none;padding:8px 16px;font-family:'Fraunces',serif;font-size:13px;font-weight:700;font-style:italic;cursor:pointer;border-radius:6px;white-space:nowrap;transition:background .15s;flex-shrink:0}
        .btn-nudge:hover{background:#B86E28}
        .input-wrap{display:flex;align-items:flex-end;gap:10px;background:var(--parchment);border:1.5px solid var(--paper);border-radius:var(--r);padding:10px 12px 10px 17px;transition:border-color .2s}
        .input-wrap:focus-within{border-color:var(--forest)}
        .chat-ta{flex:1;background:transparent;border:none;outline:none;resize:none;font-size:14.5px;font-family:'DM Sans',sans-serif;font-weight:400;color:var(--ink);line-height:1.5;max-height:120px;padding:2px 0}
        .chat-ta::placeholder{color:var(--ink-3);font-style:italic}
        .btn-send{background:var(--forest);border:none;color:white;width:33px;height:33px;border-radius:7px;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s}
        .btn-send:hover{background:#3A5C4A}
        .btn-send:disabled{opacity:.25;cursor:not-allowed}

        /* EXTRACTING */
        .extracting{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;padding:80px 24px;animation:fadeUp .4s ease both}
        .extracting h2{font-family:'Fraunces',serif;font-size:24px;font-weight:700;font-style:italic;color:var(--ink)}
        .extracting p{font-size:13px;color:var(--ink-3);font-weight:300}

        /* MATCHES */
        .matches-page{width:100%;max-width:720px;padding:52px 24px 80px;animation:fadeUp .4s ease both}
        .matches-h{font-family:'Fraunces',serif;font-weight:700;font-style:italic;font-size:clamp(28px,4vw,44px);letter-spacing:-.02em;color:var(--ink);margin-bottom:6px}
        .matches-sub{font-size:14px;color:var(--ink-3);font-weight:300;margin-bottom:28px}
        .my-strip{background:var(--parchment);border:1.5px solid var(--paper);border-left:4px solid var(--amber);border-radius:var(--r);padding:18px 20px;margin-bottom:32px;display:flex;gap:16px;align-items:flex-start}
        .my-strip-cats{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
        .my-cat-chip{font-size:10px;font-weight:500;letter-spacing:.05em;padding:3px 9px;border-radius:20px;border:1px solid rgba(74,124,90,.2);color:var(--forest);background:var(--forest-bg)}
        .my-name{font-family:'Fraunces',serif;font-size:17px;font-weight:700;font-style:italic;color:var(--ink);margin-bottom:4px}
        .my-summary{font-family:'Fraunces',serif;font-style:italic;font-size:13px;color:var(--ink-2);line-height:1.55;margin-bottom:10px}
        .tags{display:flex;flex-wrap:wrap;gap:6px}
        .tag{font-size:11px;color:var(--ink-2);background:var(--cream);border:1px solid var(--paper);padding:3px 10px;border-radius:20px}
        .section-div{display:flex;align-items:center;gap:12px;margin-bottom:18px;font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
        .section-div::before,.section-div::after{content:'';flex:1;height:1px;background:var(--paper)}
        .match-list{display:flex;flex-direction:column;gap:12px}
        .match-card{background:var(--cream);border:1.5px solid var(--paper);border-radius:var(--r);padding:18px 20px;opacity:0;animation:fadeUp .4s ease forwards;transition:border-color .18s,transform .15s,box-shadow .18s}
        .match-card:hover{border-color:#C8BFA8;transform:translateY(-1px);box-shadow:0 5px 18px rgba(28,24,18,.06)}
        .match-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:12px}
        .match-identity{display:flex;align-items:center;gap:11px}
        .match-avi{width:40px;height:40px;background:var(--parchment);border:1.5px solid var(--paper);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .match-name{font-family:'Fraunces',serif;font-size:16px;font-weight:700;font-style:italic;color:var(--ink);margin-bottom:3px}
        .match-cats{display:flex;flex-wrap:wrap;gap:4px}
        .match-cat-chip{font-size:10px;color:var(--ink-3);background:var(--parchment);border:1px solid var(--paper);padding:2px 8px;border-radius:20px}
        .match-score{font-family:'Fraunces',serif;font-size:24px;font-weight:700;font-style:italic;color:var(--forest);flex-shrink:0;line-height:1}
        .match-summary{font-family:'Fraunces',serif;font-style:italic;font-size:13px;color:var(--ink-2);line-height:1.6;margin-bottom:8px}
        .match-reasons{display:flex;flex-direction:column;gap:4px;margin-bottom:9px}
        .reason{font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
        .reason::before{content:'·';color:var(--amber);font-size:18px;line-height:0}
        .empty{text-align:center;padding:56px 20px;border:1.5px dashed var(--paper);border-radius:var(--r);background:var(--parchment)}
        .empty h3{font-family:'Fraunces',serif;font-size:20px;font-weight:700;font-style:italic;color:var(--ink);margin-bottom:8px}
        .empty p{font-size:13.5px;color:var(--ink-3);line-height:1.7;font-weight:300}
        .offline-warn{font-size:12px;color:#92400E;background:#FEF9C3;border:1px solid #FDE68A;padding:8px 13px;border-radius:6px;margin-bottom:16px}
      `}</style>

      {/* TOPBAR */}
      <div className="topbar">
        <SyniAvatar size={30} />
        <Wordmark size={19} />
      </div>

      <div className="page">

        {/* ══ LANDING ══ */}
        {step === "landing" && (
          <div className="landing">
            <div className="landing-left">
              <div className="kicker"><span className="kicker-dot"/>Real connection, no public profiles</div>
              <h1 className="landing-h1">
                Find the people<br/>you've been <span className="accent">wishing for.</span>
              </h1>
              <p className="landing-body">
                Share your real self with Syni, and meet the one you're looking for —
                a hiking buddy, a creative partner, a fellow new parent,
                someone to finally try that restaurant with.
              </p>
              <p className="landing-sub">
                No curated bios. No public profiles.<br/>
                Just a private conversation that speaks for you.
              </p>
              <label className="name-label">Your name</label>
              <input
                className="name-input"
                placeholder="What should Syni call you?"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLanding()}
                autoFocus
              />
              <button className="btn-primary" onClick={handleLanding} disabled={!name.trim()}>
                <span>Meet Syni</span><span className="arr">→</span>
              </button>
            </div>

            <div className="landing-right">
              <div className="syni-circle">
                <SyniAvatar size={120} animate />
              </div>
              <div className="pillars">
                {[
                  ["I",   "A private conversation",       "Syni listens to what you'd never put on a profile."],
                  ["II",  "Your depth, not your résumé",  "We learn what actually matters to you, then find resonance."],
                  ["III", "Six ways to connect",           "Passion, experience, growth, creativity, knowledge, life stage."],
                ].map(([n, t, d]) => (
                  <div className="pillar" key={n}>
                    <div className="pillar-n">{n}</div>
                    <div><h4>{t}</h4><p>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ ONBOARD ══ */}
        {step === "onboard" && (
          <div className="onboard-page">
            <div className="kicker"><span className="kicker-dot"/>Welcome, {name}</div>
            <h2 className="page-title">What are you open to?</h2>
            <p className="page-sub">Pick everything that speaks to you — you can be open to more than one.</p>

            <div className="cat-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  className={`cat-card${selectedCats.includes(cat.id) ? " selected" : ""}`}
                  onClick={() => toggleCat(cat.id)}
                  style={selectedCats.includes(cat.id) ? { borderColor: cat.color } : {}}
                >
                  <span className="cat-emoji">{cat.emoji}</span>
                  <div className="cat-label">{cat.label}</div>
                  <div className="cat-desc">{cat.description}</div>
                </button>
              ))}
            </div>

            {selectedCats.length > 0 ? (
              <>
                <label className="open-q-label">
                  One thing before you meet Syni —<br/>
                  <em>What's something you're looking for that you haven't quite found yet?</em>
                </label>
                <textarea
                  className="open-q-ta"
                  placeholder="Write whatever comes to mind, no pressure…"
                  value={openAnswer}
                  onChange={e => setOpenAnswer(e.target.value)}
                />
                <p className="onboard-hint">This stays private. Syni uses it to start a real conversation.</p>
                <button className="btn-primary" onClick={handleOnboardSubmit} disabled={!openAnswer.trim()}>
                  <span>Start talking with Syni</span><span className="arr">→</span>
                </button>
              </>
            ) : (
              <p className="select-hint">Select at least one to continue.</p>
            )}
          </div>
        )}

        {/* ══ CHAT ══ */}
        {step === "chat" && (
          <div className="chat-wrap">
            <div className="chat-header">
              <div className="syni-id">
                <div className="syni-bubble" style={{ width: 40, height: 40 }}>
                  <SyniAvatar size={40} />
                </div>
                <div>
                  <div className="syni-name">Syni</div>
                  <div className="syni-role">Your guide</div>
                </div>
              </div>
              <div className="cats-chips">
                {selectedCats.map(id => {
                  const cat = CATEGORIES.find(c => c.id === id);
                  return cat ? <span key={id} className="cat-chip">{cat.emoji} {cat.label}</span> : null;
                })}
              </div>
            </div>

            <div className="messages-area">
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role === "user" ? "msg-user" : "msg-syni"}`}>
                  {m.content}
                </div>
              ))}
              {isTyping && (
                <div className="typing">
                  <div className="tdot"/><div className="tdot"/><div className="tdot"/>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-footer">
              {userCount >= 3 && (
                <div className="nudge">
                  <span className="nudge-text">Syni has a good sense of you now…</span>
                  <button className="btn-nudge" onClick={finishAndMatch}>Find my people →</button>
                </div>
              )}
              <div className="input-wrap">
                <textarea
                  ref={textareaRef}
                  className="chat-ta"
                  rows={1}
                  placeholder="Share a real thought with Syni…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isTyping}
                />
                <button className="btn-send" onClick={sendMessage} disabled={!input.trim() || isTyping}>↑</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ EXTRACTING ══ */}
        {step === "extracting" && (
          <div className="extracting">
            <SyniAvatar size={80} animate />
            <h2>Syni is thinking about you…</h2>
            <p>Finding the people who'll get it.</p>
          </div>
        )}

        {/* ══ MATCHES ══ */}
        {step === "matches" && profile && (
          <div className="matches-page">
            <div className="kicker"><span className="kicker-dot"/>Your matches</div>
            <h2 className="matches-h">Here they are, {name}.</h2>
            <p className="matches-sub">Based on what you shared with Syni — not a profile, a conversation.</p>

            <div className="my-strip">
              <SyniAvatar size={42} />
              <div style={{ flex: 1 }}>
                <div className="my-strip-cats">
                  {selectedCats.map(id => {
                    const cat = CATEGORIES.find(c => c.id === id);
                    return cat ? <span key={id} className="my-cat-chip">{cat.emoji} {cat.label}</span> : null;
                  })}
                </div>
                <div className="my-name">{name}</div>
                <p className="my-summary">{profile.summary}</p>
                <div className="tags">{(profile.tags || []).map(t => <span key={t} className="tag">{t}</span>)}</div>
              </div>
            </div>

            {backendError && (
              <div className="offline-warn">
                ⚠ Backend not running — start with <code>node server.js</code> to see real matches.
              </div>
            )}

            <div className="section-div">{matches.length} {matches.length === 1 ? "match" : "matches"} found</div>

            {matches.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 36, marginBottom: 14 }}>🌱</div>
                <h3>You're among the first here.</h3>
                <p>Share Synchria with someone who'd appreciate it.<br/>Your matches will arrive.</p>
              </div>
            ) : (
              <div className="match-list">
                {matches.map(({ user, score, reasons, matchedOn }, i) => {
                  const topCat = CATEGORIES.find(c => c.id === (matchedOn || [])[0]);
                  return (
                    <div key={user.id} className="match-card" style={{ animationDelay: `${i * 0.07}s` }}>
                      <div className="match-top">
                        <div className="match-identity">
                          <div className="match-avi">{topCat?.emoji || "✦"}</div>
                          <div>
                            <div className="match-name">{user.name}</div>
                            <div className="match-cats">
                              {(user.categories || []).map(id => {
                                const cat = CATEGORIES.find(c => c.id === id);
                                return cat ? <span key={id} className="match-cat-chip">{cat.emoji} {cat.label}</span> : null;
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="match-score">{Math.round(score * 10)}</div>
                      </div>
                      <p className="match-summary">{user.profile?.summary}</p>
                      {reasons?.length > 0 && (
                        <div className="match-reasons">
                          {reasons.map((r, ri) => <div key={ri} className="reason">{r}</div>)}
                        </div>
                      )}
                      <div className="tags">
                        {(user.profile?.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
