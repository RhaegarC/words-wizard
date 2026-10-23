import { useEffect, useMemo, useState } from "react";
import { db, type Profile } from "./db";
import { practiceWords, topics, words, type Word } from "./content";

type Route = "home" | "topics" | "session" | "words" | "buddy" | "settings" | "review";
type Locale = "en" | "zh";
type IconName =
  | "home" | "book" | "sparkle" | "user" | "flame" | "heart" | "play"
  | "volume" | "arrow" | "check" | "settings" | "globe" | "download"
  | "shield" | "chart" | "close" | "moon" | "image";

const avatars = [
  { id: "luma", name: "Luma", color: "#7562df", pale: "#ded9ff" },
  { id: "pippin", name: "Pippin", color: "#e9825d", pale: "#ffe0d2" },
  { id: "moss", name: "Moss", color: "#55a57a", pale: "#cfeedd" },
  { id: "nova", name: "Nova", color: "#d76391", pale: "#f8dce7" },
  { id: "orbit", name: "Orbit", color: "#468da7", pale: "#d9eef5" },
  { id: "ember", name: "Ember", color: "#d99b35", pale: "#fff0c9" },
];

const copy = {
  en: {
    home: "Home", practice: "Practice", words: "My words", buddy: "My buddy",
    welcome: "Welcome back", adventure: "Ready for a word adventure?",
    quest: "Today’s quest", little: "A little practice goes a long way",
    start: "Start practice", minutes: "About 10 min", collection: "Your collection",
    learned: "words collected", viewWords: "See every word you’ve earned",
    monthly: "Monthly check-in", lockedReview: "Your first check-in unlocks after 5 words",
    streak: "day streak", tokens: "care tokens", visit: "Visit buddy",
    bright: "is feeling bright!", grow: "Every new word helps your buddy grow stronger.",
    growing: "Growing to Juvenile", topic: "Current world", change: "Change topic",
    settings: "Settings", allWords: "Collection", wordBook: "Word Book",
  },
  zh: {
    home: "首页", practice: "练习", words: "我的单词", buddy: "学习伙伴",
    welcome: "欢迎回来", adventure: "准备好开始单词冒险了吗？",
    quest: "今日任务", little: "每天练一点，进步看得见",
    start: "开始练习", minutes: "约 10 分钟", collection: "你的单词收藏",
    learned: "个已收集单词", viewWords: "看看你学会的每一个单词",
    monthly: "每月复习", lockedReview: "收集 5 个单词后解锁首次复习",
    streak: "天连续学习", tokens: "枚关爱币", visit: "看看伙伴",
    bright: "今天充满活力！", grow: "每学一个新单词，伙伴都会变得更强。",
    growing: "成长为少年伙伴", topic: "当前世界", change: "更换主题",
    settings: "设置", allWords: "单词收藏", wordBook: "单词图鉴",
  },
} as const;

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22Z" /></>,
    sparkle: <><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
    flame: <path d="M13.5 22c4-1 6.5-3.7 6.5-7.5 0-2.9-1.6-5.5-4.4-7.7.1 2.6-1.2 4.3-2.4 5.2.2-4-2.1-7.1-5.3-9.5.3 4.5-3.9 7.1-3.9 12 0 3.8 2.5 6.5 6.5 7.5-1.5-.9-2.4-2.4-2.4-4.1 0-1.9 1.2-3.5 3-4.8-.1 2 .7 3 1.5 3.7.5-.8 1-1.8.9-3.1 1.5 1.1 2.4 2.5 2.4 4.2 0 1.7-.9 3.2-2.4 4.1Z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    play: <path d="m9 6 9 6-9 6Z" />,
    volume: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M5 20h14" /></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
    chart: <><path d="M4 20V10m6 10V4m6 16v-7m5 7H2" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    moon: <path d="M20 15.3A9 9 0 0 1 8.7 4a9 9 0 1 0 11.3 11.3Z" />,
    image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 15-5-5L5 20" /></>,
  };
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

function Button({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props}>{children}</button>;
}

function Brand() {
  return <div className="brand"><span><Icon name="sparkle" size={22} /></span><b>Words<em>Wizard</em></b></div>;
}

function Character({ avatarId, small = false, sleeping = false }: { avatarId: string; small?: boolean; sleeping?: boolean }) {
  const avatar = avatars.find((item) => item.id === avatarId) ?? avatars[0];
  return (
    <div className={`character ${small ? "small" : ""} ${sleeping ? "sleeping" : ""}`} style={{ "--pet": avatar.color, "--pet-pale": avatar.pale } as React.CSSProperties}>
      {!small && <><i className="spark one" /><i className="spark two" /></>}
      <svg viewBox="0 0 210 210" role="img" aria-label={`${avatar.name} word buddy`}>
        <ellipse cx="105" cy="180" rx="55" ry="13" fill="#292147" opacity=".09" />
        <path className="pet" d="M153 130c31-8 40 10 22 24-10 8-23 4-24-5 12 4 21-4 13-9-4-3-8-2-13 0Z" />
        <path className="pet" d="M67 115c-4 30 3 59 38 62 36 3 47-27 39-61Z" />
        <path className="pale" d="M72 125c-27 8-32 35-5 38 13 1 22-10 21-28ZM140 125c25 7 28 31 6 35-13 2-21-8-20-25Z" />
        <path className="pale" d="m68 80-16-28c-3-5 3-10 8-6l25 20Zm73-1 16-28c3-5-3-10-8-6l-25 20Z" />
        <path className="pet" d="M62 90c0-31 18-49 43-49 28 0 46 21 45 51-1 31-20 50-46 50-25 0-42-20-42-52Z" />
        {sleeping ? (
          <><path d="M78 94c5 4 10 4 15 0M116 94c5 4 10 4 15 0" fill="none" stroke="#292147" strokeWidth="4" strokeLinecap="round" /></>
        ) : (
          <><ellipse cx="86" cy="92" rx="8" ry="10" fill="#fff" /><ellipse cx="124" cy="92" rx="8" ry="10" fill="#fff" /><circle cx="88" cy="94" r="4" fill="#292147" /><circle cx="122" cy="94" r="4" fill="#292147" /></>
        )}
        <path d="M99 109c4 3 9 3 13 0" fill="none" stroke="#292147" strokeWidth="4" strokeLinecap="round" />
        <circle cx="75" cy="110" r="7" fill="#f59e9e" opacity=".55" /><circle cx="136" cy="110" r="7" fill="#f59e9e" opacity=".55" />
        <path className="pale" d="m94 46 11-22 11 22" />
      </svg>
    </div>
  );
}

function WordArt({ word, large = false }: { word: Word; large?: boolean }) {
  return <div className={`word-art art-${word.topicId} ${large ? "large" : ""}`}><span>{word.text.slice(0, 1).toUpperCase()}</span><i>{word.symbol}</i></div>;
}

function normalizeProfile(saved: Partial<Profile>): Profile {
  const now = Date.now();
  return {
    id: saved.id,
    name: saved.name ?? "Wizard",
    characterName: saved.characterName ?? "Luma",
    avatar: saved.avatar ?? "luma",
    currentTopicId: "currentTopicId" in saved ? saved.currentTopicId ?? null : "explore",
    locale: saved.locale ?? (navigator.language.startsWith("zh") ? "zh" : "en"),
    xp: saved.xp ?? 124,
    streakCount: saved.streakCount ?? (saved as Partial<Profile> & { streak?: number }).streak ?? 4,
    bestStreak: saved.bestStreak ?? 4,
    careTokens: saved.careTokens ?? 2,
    sessionsSinceLastToken: saved.sessionsSinceLastToken ?? 3,
    completedSessions: saved.completedSessions ?? 4,
    learnedCount: saved.learnedCount ?? 6,
    createdAt: saved.createdAt ?? now,
    lastPracticeAt: saved.lastPracticeAt ?? now,
    lastWakeAt: saved.lastWakeAt ?? null,
    frozenDays: saved.frozenDays ?? 0,
    lastMonthlyReviewAt: saved.lastMonthlyReviewAt ?? null,
  };
}

function speak(text: string, language = "en-US") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

function Creation({ onCreate }: { onCreate: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("luma");
  const isZh = navigator.language.startsWith("zh");
  const submit = () => {
    const now = Date.now();
    onCreate(normalizeProfile({
      name: name.trim() || avatars.find((item) => item.id === avatar)?.name || "Luma",
      characterName: name.trim() || avatars.find((item) => item.id === avatar)?.name || "Luma",
      avatar,
      currentTopicId: null,
      locale: isZh ? "zh" : "en",
      xp: 0,
      streakCount: 0,
      bestStreak: 0,
      careTokens: 0,
      sessionsSinceLastToken: 0,
      completedSessions: 0,
      learnedCount: 0,
      createdAt: now,
      lastPracticeAt: now,
    }));
  };
  return (
    <main className="creation">
      <header><Brand /><span>为好奇的小脑袋设计 · Made for curious minds</span></header>
      <section className="creation-card">
        <div className="creation-copy">
          <label className="eyebrow">Your adventure starts here · 冒险从这里开始</label>
          <h1>Make a new<br /><em>word buddy!</em></h1>
          <p>Choose a magical friend to learn and grow with you.<br /><span>选择一位和你一起学习、成长的魔法伙伴。</span></p>
          <label className="name-field">
            <b>What should we call your buddy? · 伙伴叫什么名字？</b>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Type a name · 输入名字" maxLength={16} />
          </label>
          <div className="name-suggestions">{["Luma", "Nova", "Moss"].map((item) => <button key={item} onClick={() => setName(item)}>{item}</button>)}</div>
        </div>
        <div className="avatar-builder">
          <Character avatarId={avatar} />
          <div className="avatar-list six">
            {avatars.map((item) => (
              <button key={item.id} aria-label={`Choose ${item.name}`} className={avatar === item.id ? "selected" : ""} onClick={() => setAvatar(item.id)} style={{ "--swatch": item.color, "--pale": item.pale } as React.CSSProperties}>
                <i />{avatar === item.id && <b><Icon name="check" size={13} /></b>}
              </button>
            ))}
          </div>
          <strong className="selected-name">{avatars.find((item) => item.id === avatar)?.name}</strong>
          <Button className="primary wide" onClick={submit}>Meet my buddy · 认识伙伴 <Icon name="arrow" /></Button>
        </div>
      </section>
      <p className="safe"><Icon name="shield" size={15} /> Your progress stays safely on this device · 学习进度安全保存在此设备上</p>
    </main>
  );
}

function InstallPrompt({ onContinue }: { onContinue: () => void }) {
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return (
    <main className="setup-page">
      <Brand />
      <section className="install-card">
        <div className="install-art"><Icon name="download" size={42} /><span><Icon name="sparkle" /></span></div>
        <span className="eyebrow">Keep your magic safe · 保护学习成果</span>
        <h1>Add Words-Wizard to your Home Screen</h1>
        <p>Installing helps keep your buddy and word progress safe, even when you come back later.</p>
        <p className="zh-copy">将 Words-Wizard 添加到主屏幕，伙伴和单词进度会保存得更安全。</p>
        <div className="install-steps">
          {isiOS ? (
            <><span><b>1</b>Tap Share in Safari · 点击 Safari 的“分享”</span><span><b>2</b>Choose “Add to Home Screen” · 选择“添加到主屏幕”</span></>
          ) : (
            <><span><b>1</b>Open your browser menu · 打开浏览器菜单</span><span><b>2</b>Choose “Install app” · 选择“安装应用”</span></>
          )}
        </div>
        <Button className="primary wide" onClick={onContinue}>I’m ready · 我准备好了 <Icon name="arrow" /></Button>
        <button className="quiet-action" onClick={onContinue}>Maybe later · 稍后再说</button>
      </section>
    </main>
  );
}

function TopicPicker({ profile, onChoose }: { profile: Profile; onChoose: (id: string) => void }) {
  const zh = profile.locale === "zh";
  return (
    <main className="setup-page topic-setup">
      <Brand />
      <header><span className="eyebrow">Choose your first world · 选择第一个世界</span><h1>{zh ? "你想从哪里开始？" : "Where will your adventure begin?"}</h1><p>{zh ? "所有世界都已开放，之后可以随时更换。" : "Every world is open. You can change it whenever you like."}</p></header>
      <section className="topic-grid">
        {topics.map((topic, index) => (
          <button className={`topic-card ${topic.tone}`} key={topic.id} onClick={() => onChoose(topic.id)}>
            <span className="topic-number">0{index + 1}</span><div className="topic-art"><Icon name={index % 2 ? "sparkle" : "image"} size={30} /></div>
            <strong>{topic.title}</strong><b>{topic.titleZh}</b><p>{zh ? topic.descriptionZh : topic.description}</p><i><Icon name="arrow" size={17} /></i>
          </button>
        ))}
      </section>
    </main>
  );
}

function Home({ profile, go }: { profile: Profile; go: (route: Route) => void }) {
  const t = copy[profile.locale];
  const topic = topics.find((item) => item.id === profile.currentTopicId) ?? topics[1];
  const zh = profile.locale === "zh";
  return (
    <>
      <header className="topbar">
        <div><span className="eyebrow">{t.welcome}, {profile.name}!</span><h1>{t.adventure}</h1></div>
        <div className="top-stats">
          <span><Icon name="flame" /><b>{profile.streakCount}</b><small>{t.streak}</small></span>
          <span><Icon name="heart" /><b>{profile.careTokens}</b><small>{t.tokens}</small></span>
          <button aria-label={t.settings} onClick={() => go("settings")}><Icon name="settings" /></button>
        </div>
      </header>
      <section className="hero">
        <div className="hero-pet"><Character avatarId={profile.avatar} /></div>
        <div className="hero-copy">
          <label><Icon name="sparkle" size={15} /> Hatchling · 幼年伙伴</label>
          <h2>{profile.characterName} {t.bright}</h2><p>{t.grow}</p>
          <div className="growth-label"><span>{t.growing}</span><b>42%</b></div><div className="progress"><i /></div>
        </div>
        <button onClick={() => go("buddy")}>{t.visit} <Icon name="arrow" size={17} /></button>
      </section>
      <section className="topic-strip">
        <span className={`topic-mini ${topic.tone}`}><Icon name="image" /></span>
        <div><small>{t.topic}</small><b>{zh ? topic.titleZh : topic.title}</b></div>
        <button onClick={() => go("topics")}>{t.change}</button>
      </section>
      <section className="today">
        <header><div><span className="eyebrow">{t.quest}</span><h2>{t.little}</h2></div><label>{t.minutes}</label></header>
        <article className="quest">
          <span className="quest-icon"><Icon name="book" size={28} /></span>
          <div><h3>{zh ? "今日 5 个新单词" : "Today’s five new words"}</h3><p>{zh ? "单词介绍 + 拼写 + 综合练习" : "Learn · spell · comprehensive practice"}</p><aside>{practiceWords.slice(0, 3).map((word) => <i key={word.id}>{word.text}</i>)}<small>+2</small></aside></div>
          <Button className="primary" onClick={() => go("session")}><Icon name="play" size={19} /> {t.start}</Button>
        </article>
      </section>
      <section className="feature-grid">
        <button onClick={() => go("words")}><i><Icon name="book" size={28} /></i><span><small>{t.collection}</small><b>{profile.learnedCount} {t.learned}</b><em>{t.viewWords}</em></span><Icon name="arrow" /></button>
        <button className="review-feature" onClick={() => profile.learnedCount >= 5 && go("review")}><i><Icon name="sparkle" size={28} /></i><span><small>{t.monthly}</small><b>{profile.learnedCount >= 5 ? (zh ? "单词想再见见你" : "Words want another visit") : t.lockedReview}</b><em>{profile.learnedCount >= 5 ? (zh ? "轻松复习，不会扣分" : "A gentle review, never a test") : ""}</em></span><label>{profile.learnedCount >= 5 ? (zh ? "开始" : "Ready") : `${profile.learnedCount}/5`}</label></button>
      </section>
    </>
  );
}

function WordIntro({ word, locale, onNext }: { word: Word; locale: Locale; onNext: () => void }) {
  const zh = locale === "zh";
  return (
    <div className="intro-card">
      <WordArt word={word} large />
      <span className="eyebrow">{zh ? "认识新单词" : "Meet a new word"}</span>
      <div className="word-heading"><h1>{word.text}</h1><strong>{word.meaningZh}</strong><button onClick={() => speak(word.text)} aria-label={`Hear ${word.text}`}><Icon name="volume" /></button></div>
      <p className="phonetic">{word.phonetic} · {word.partOfSpeech}</p>
      <div className="bilingual-definition"><p><b>EN</b>{word.definitionEn}</p><p><b>中文</b>{word.definitionZh}</p></div>
      <blockquote>{zh ? word.exampleZh : word.exampleEn}</blockquote>
      <Button className="primary" onClick={onNext}>{zh ? "开始拼写" : "Let’s spell it"} <Icon name="arrow" /></Button>
    </div>
  );
}

type ExerciseMode = "spelling" | "meaning" | "picture" | "fill" | "listen";

function Exercise({ word, mode, locale, onNext }: { word: Word; mode: ExerciseMode; locale: Locale; onNext: () => void }) {
  const [selected, setSelected] = useState("");
  const [built, setBuilt] = useState("");
  const [usedLetters, setUsedLetters] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [correct, setCorrect] = useState(false);
  const zh = locale === "zh";
  const distractors = words.filter((item) => item.id !== word.id).slice(0, 2);
  const options = mode === "meaning"
    ? [word, ...distractors].sort((a, b) => a.id.localeCompare(b.id))
    : [word, ...distractors].sort((a, b) => b.id.localeCompare(a.id));
  const letters = word.text.toUpperCase().split("").sort();
  const submit = (value: string) => {
    setSelected(value);
    if (value.toLowerCase() === word.text.toLowerCase()) setCorrect(true);
    else setMisses((count) => Math.min(count + 1, 3));
  };
  const addLetter = (letter: string, index: number) => {
    const next = built + letter;
    setBuilt(next);
    setUsedLetters((used) => [...used, index]);
    if (next.length === word.text.length) submit(next);
  };
  const modeTitle = {
    spelling: zh ? "拼出这个单词" : "Build the word",
    meaning: zh ? "选择正确的中文意思" : "Choose the correct meaning",
    picture: zh ? "哪个单词符合这幅图？" : "Which word matches the picture?",
    fill: zh ? "完成这个句子" : "Complete the sentence",
    listen: zh ? "听一听，选择正确单词" : "Listen and choose",
  }[mode];

  return (
    <div className="exercise new-exercise">
      <div className="exercise-art"><WordArt word={word} /></div>
      <span className="eyebrow">{mode === "spelling" ? "Spelling builder · 拼写练习" : "Comprehensive practice · 综合练习"}</span>
      <h1>{modeTitle}</h1>
      {mode === "listen" && <button className="listen big" onClick={() => speak(word.text)}><Icon name="volume" /> {zh ? "播放单词" : "Play word"}</button>}
      {mode === "fill" && <p className="fill-sentence">We will <b>_____</b> something wonderful today.</p>}
      {mode === "spelling" ? (
        <>
          <p className="meaning-clue">{word.meaningZh} · {word.phonetic}</p>
          <div className={`letter-slots ${correct ? "correct" : ""}`}>{word.text.split("").map((_, index) => <span key={index}>{built[index] ?? ""}</span>)}</div>
          <div className="letter-bank">{letters.map((letter, index) => <button key={`${letter}-${index}`} disabled={usedLetters.includes(index)} onClick={() => addLetter(letter, index)}>{letter}</button>)}</div>
          {!correct && built && <button className="clear-letters" onClick={() => { setBuilt(""); setSelected(""); setUsedLetters([]); }}>{zh ? "清空重试" : "Clear and try again"}</button>}
        </>
      ) : mode === "picture" ? (
        <div className="picture-options">{options.map((item) => <button key={item.id} onClick={() => submit(item.text)} className={selected === item.text ? (item.id === word.id ? "correct" : "try") : ""}><WordArt word={item} /><b>{item.text}</b></button>)}</div>
      ) : (
        <div className="answers">{options.map((item, index) => {
          const label = mode === "meaning" ? (zh ? item.meaningZh : item.meaningEn) : item.text;
          return <button key={item.id} onClick={() => submit(item.text)} className={selected === item.text ? (item.id === word.id ? "correct" : "try") : ""}><i>{String.fromCharCode(65 + index)}</i><span>{label}</span>{selected === item.text && item.id === word.id && <b><Icon name="check" /></b>}</button>;
        })}</div>
      )}
      {(selected || correct) && (
        <div className={`feedback ${correct ? "success" : ""}`}>
          <span><b>{correct ? (zh ? "太棒了！" : "Wonderful work!") : misses >= 3 ? (zh ? `答案是 ${word.text}` : `The answer is ${word.text}`) : (zh ? "很接近了，再试一次！" : "Nearly there — try again!")}</b><small>{!correct && misses === 1 ? (zh ? `提示：第一个字母是 ${word.text[0].toUpperCase()}` : `Hint: it starts with ${word.text[0].toUpperCase()}`) : !correct && misses === 2 ? `${word.meaningZh} · ${word.meaningEn}` : correct ? (zh ? "你找到了正确答案。" : "You found the right answer.") : ""}</small></span>
          {(correct || misses >= 3) && <Button className="primary" onClick={onNext}>{zh ? "继续" : "Continue"} <Icon name="arrow" /></Button>}
        </div>
      )}
    </div>
  );
}

function PracticeSession({ profile, onDone, onExit }: { profile: Profile; onDone: (profile: Profile) => void; onExit: () => void }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const locale = profile.locale;
  const zh = locale === "zh";
  const complete = step >= 15;
  const isLearning = step < 10;
  const wordIndex = isLearning ? Math.floor(step / 2) : step - 10;
  const word = practiceWords[wordIndex];
  const isIntro = isLearning && step % 2 === 0;
  const modes: ExerciseMode[] = ["picture", "meaning", "fill", "listen", "picture"];

  if (!started) {
    return (
      <section className="session-intro">
        <div className="session-orbit"><Icon name="sparkle" size={38} /></div>
        <span className="eyebrow">Today’s word quest · 今日单词任务</span>
        <h1>{zh ? "准备认识 5 个新单词" : "Five new words are waiting"}</h1>
        <p>{zh ? "先认识单词并练习拼写，然后完成一轮综合练习。" : "Meet each word, build its spelling, then finish with comprehensive practice."}</p>
        <div className="session-plan"><span><b>5</b>{zh ? "新单词" : "new words"}</span><span><b>15</b>{zh ? "个小步骤" : "short steps"}</span><span><b>~10</b>{zh ? "分钟" : "minutes"}</span></div>
        <div className="preview-words">{practiceWords.map((item) => <WordArt word={item} key={item.id} />)}</div>
        <Button className="primary" onClick={() => setStarted(true)}><Icon name="play" /> {zh ? "开始任务" : "Begin quest"}</Button>
      </section>
    );
  }

  if (complete) {
    const nextCount = Math.max(profile.learnedCount, 5);
    return (
      <section className="summary">
        <Character avatarId={profile.avatar} /><span className="eyebrow">Quest complete · 任务完成</span>
        <h1>{zh ? "你创造了单词魔法！" : "You made word magic!"}</h1>
        <p>{zh ? `${profile.characterName} 变得更强了，你练习了 5 个单词。` : `${profile.characterName} grew stronger, and you practiced five words.`}</p>
        <div className="summary-grid"><span><b>+25</b><small>{zh ? "成长点数" : "growth points"}</small></span><span><b>5</b><small>{zh ? "练习单词" : "words practiced"}</small></span><span><b>{profile.streakCount + 1}</b><small>{zh ? "天连续学习" : "day streak"}</small></span><span><b>{Math.min(profile.sessionsSinceLastToken + 1, 5)}/5</b><small>{zh ? "下枚关爱币" : "next Care Token"}</small></span></div>
        <Button className="primary wide" onClick={() => onDone({ ...profile, xp: profile.xp + 25, learnedCount: nextCount, completedSessions: profile.completedSessions + 1, sessionsSinceLastToken: Math.min(profile.sessionsSinceLastToken + 1, 5), streakCount: profile.streakCount + 1, bestStreak: Math.max(profile.bestStreak, profile.streakCount + 1), lastPracticeAt: Date.now() })}>{zh ? "返回首页" : "Back to home"} <Icon name="arrow" /></Button>
      </section>
    );
  }

  return (
    <section className="practice">
      <header><button onClick={() => setConfirmExit(true)} aria-label="Close"><Icon name="close" /></button><div><i style={{ width: `${((step + 1) / 15) * 100}%` }} /></div><b>{step + 1} / 15</b></header>
      {isIntro ? <WordIntro word={word} locale={locale} onNext={() => setStep(step + 1)} /> : <Exercise key={`${step}-${word.id}`} word={word} mode={isLearning ? "spelling" : modes[wordIndex]} locale={locale} onNext={() => setStep(step + 1)} />}
      {confirmExit && <div className="modal-backdrop"><div className="exit-modal"><span className="modal-icon"><Icon name="heart" /></span><h2>{zh ? "要离开这次任务吗？" : "Leave this quest?"}</h2><p>{zh ? "今天尚未完成的进度不会保存。" : "Today’s unfinished progress won’t be saved."}</p><Button className="primary wide" onClick={() => setConfirmExit(false)}>{zh ? "继续练习" : "Keep practicing"}</Button><button className="quiet-action" onClick={onExit}>{zh ? "离开任务" : "Leave quest"}</button></div></div>}
    </section>
  );
}

function WordDetail({ word, locale, onBack }: { word: Word; locale: Locale; onBack: () => void }) {
  return (
    <section className="word-detail">
      <button className="back-action" onClick={onBack}>← {locale === "zh" ? "返回我的单词" : "Back to My Words"}</button>
      <div className="detail-layout">
        <WordArt word={word} large />
        <div>
          <span className={`status-badge ${word.mastered ? "mastered" : ""}`}>{word.mastered ? "Mastered · 已掌握" : "Learning · 学习中"}</span>
          <div className="word-heading"><h1>{word.text}</h1><strong>{word.meaningZh}</strong><button onClick={() => speak(word.text)}><Icon name="volume" /></button></div>
          <p className="phonetic">{word.phonetic} · {word.partOfSpeech}</p>
          <div className="bilingual-definition"><p><b>English</b>{word.definitionEn}</p><p><b>中文</b>{word.definitionZh}</p></div>
          <div className="examples"><p>“{word.exampleEn}”</p><p>{word.exampleZh}</p></div>
          <div className="detail-strength"><span>{locale === "zh" ? "单词熟练度" : "Word strength"}</span><div><i style={{ width: `${word.strength * 100}%` }} /></div><b>{word.strength >= .8 ? (locale === "zh" ? "很强" : "Strong") : (locale === "zh" ? "成长中" : "Growing")}</b></div>
        </div>
      </div>
    </section>
  );
}

function MyWords({ profile }: { profile: Profile }) {
  const [tab, setTab] = useState<"collection" | "book">(() => location.hash.includes("tab=wordbook") ? "book" : "collection");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Word | null>(null);
  const t = copy[profile.locale];
  const zh = profile.locale === "zh";
  const visible = tab === "book" ? words.filter((word) => word.mastered) : words.filter((word) => filter === "all" || (filter === "mastered" ? word.mastered : !word.mastered));
  if (selected) return <WordDetail word={selected} locale={profile.locale} onBack={() => setSelected(null)} />;
  return (
    <section className="word-page">
      <span className="eyebrow">My Words · 我的单词</span>
      <header><div><h1>{zh ? "单词宝藏" : "Word treasure"}</h1><p>{zh ? "这里的每个单词都是你努力收集的。" : "Every word here is one you’ve earned."}</p></div><aside><b>{profile.learnedCount}</b><span>{t.learned}</span></aside></header>
      <div className="word-tabs"><button className={tab === "collection" ? "active" : ""} onClick={() => { setTab("collection"); location.hash = "#/words?tab=collection"; }}>{t.allWords}<small>{profile.learnedCount}</small></button><button className={tab === "book" ? "active" : ""} onClick={() => { setTab("book"); location.hash = "#/words?tab=wordbook"; }}>{t.wordBook}<small>{words.filter((word) => word.mastered).length}</small></button></div>
      {tab === "collection" && <nav>{[["all", zh ? "全部" : "All words"], ["mastered", zh ? "已掌握" : "Mastered"], ["learning", zh ? "学习中" : "Learning"]].map(([id, label]) => <button className={filter === id ? "active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}</nav>}
      {tab === "book" && <div className="book-banner"><Icon name="sparkle" /><span><b>{zh ? "你的单词图鉴" : "Your illustrated Word Book"}</b><small>{zh ? "掌握的单词会收藏在这里。" : "Mastered words live here as keepsakes."}</small></span></div>}
      <div className={`word-grid ${tab === "book" ? "book-grid" : ""}`}>{visible.map((item) => <button className={`word-tile ${topics.find((topic) => topic.id === item.topicId)?.tone}`} key={item.id} onClick={() => setSelected(item)}><WordArt word={item} /><small>{item.partOfSpeech}</small><h3>{item.text}</h3><strong>{item.meaningZh}</strong><p>{zh ? item.definitionZh : item.definitionEn}</p><footer><span><i style={{ width: `${item.strength * 100}%` }} /></span><em>{item.mastered ? (zh ? "已掌握" : "Mastered") : (zh ? "成长中" : "Growing")}</em></footer></button>)}</div>
    </section>
  );
}

function Buddy({ profile, onUpdate, goPractice }: { profile: Profile; onUpdate: (profile: Profile) => void; goPractice: () => void }) {
  const idleDays = Math.max(0, Math.floor((Date.now() - Math.max(profile.lastPracticeAt, profile.lastWakeAt ?? 0)) / 86_400_000) - profile.frozenDays);
  const state = idleDays >= 7 ? "sleeping" : idleDays >= 4 ? "sleepy" : "awake";
  const vitality = Math.max(0, 100 - 15 * idleDays);
  const zh = profile.locale === "zh";
  const spend = (action: "freeze" | "wake") => {
    if (!profile.careTokens) return;
    onUpdate(action === "wake" ? { ...profile, careTokens: profile.careTokens - 1, lastWakeAt: Date.now(), frozenDays: 0 } : { ...profile, careTokens: profile.careTokens - 1, frozenDays: profile.frozenDays + 1 });
  };
  return (
    <section className="buddy">
      <div className={`buddy-art ${state}`}><Character avatarId={profile.avatar} sleeping={state === "sleeping"} />{state !== "awake" && <span className="sleep-mark"><Icon name="moon" /> {state === "sleeping" ? "Z z z" : "..."}</span>}</div>
      <div className="buddy-copy">
        <span className="eyebrow">Your word buddy · 单词伙伴</span><h1>{profile.characterName}</h1><p>Hatchling · 幼年伙伴</p>
        {state !== "awake" && <div className={`care-alert ${state}`}><Icon name="moon" /><span><b>{state === "sleeping" ? (zh ? "伙伴睡着了" : "Your buddy is sleeping") : (zh ? "伙伴有点困了" : "Your buddy is getting sleepy")}</b><small>{zh ? "完成一次短练习就能免费唤醒伙伴。" : "Complete a short practice to restore their sparkle."}</small></span></div>}
        <article><header><span>{zh ? "下一个阶段" : "Next stage"}</span><b>Juvenile · 少年</b></header><div className="progress"><i /></div><small>{zh ? "继续练习，你已经完成 42%！" : "Keep practicing — you’re 42% there!"}</small></article>
        <div className="vitality"><header><span>{zh ? "活力" : "Vitality"}</span><b>{state === "awake" ? (zh ? "充满活力" : "Bright") : state === "sleepy" ? (zh ? "有点困" : "Sleepy") : (zh ? "睡眠中" : "Sleeping")}</b></header><div><i style={{ width: `${vitality}%` }} /></div></div>
        <aside><div><Icon name="heart" /><b>{profile.careTokens} {zh ? "枚关爱币" : "Care Tokens"}</b><small>{profile.sessionsSinceLastToken}/5 {zh ? "次任务进度" : "quests toward the next"}</small></div><div><Icon name="flame" /><b>{profile.streakCount} {zh ? "天连续学习" : "day streak"}</b><small>{zh ? `最佳纪录 ${profile.bestStreak} 天` : `Best: ${profile.bestStreak} days`}</small></div></aside>
        <div className="care-actions">{state === "sleeping" ? <><Button className="primary" onClick={goPractice}>{zh ? "练习并免费唤醒" : "Practice to wake"}</Button><Button disabled={!profile.careTokens} onClick={() => spend("wake")}>{zh ? "使用 1 币快速唤醒" : "Quick wake · 1 token"}</Button></> : <Button disabled={!profile.careTokens} onClick={() => spend("freeze")}><Icon name="shield" /> {zh ? "保护一天 · 1 币" : "Protect one day · 1 token"}</Button>}</div>
      </div>
    </section>
  );
}

function Settings({ profile, onUpdate }: { profile: Profile; onUpdate: (profile: Profile) => void }) {
  const [name, setName] = useState(profile.characterName);
  const installed = matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const zh = profile.locale === "zh";
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "words-wizard-progress.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <section className="settings-page">
      <span className="eyebrow">Settings · 设置</span><h1>{zh ? "调整你的冒险" : "Make the adventure yours"}</h1>
      <div className="settings-grid">
        <article><header><Icon name="globe" /><div><h2>{zh ? "语言" : "Language"}</h2><p>Interface language · 界面语言</p></div></header><div className="language-toggle"><button className={profile.locale === "en" ? "active" : ""} onClick={() => onUpdate({ ...profile, locale: "en" })}>English</button><button className={profile.locale === "zh" ? "active" : ""} onClick={() => onUpdate({ ...profile, locale: "zh" })}>中文</button></div></article>
        <article><header><Icon name="user" /><div><h2>{zh ? "学习伙伴" : "Word buddy"}</h2><p>{zh ? "更改名字或外观" : "Change their name or look"}</p></div></header><label className="setting-input"><span>{zh ? "伙伴名字" : "Buddy name"}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={16} /></label><div className="settings-avatars">{avatars.map((avatar) => <button key={avatar.id} aria-label={avatar.name} className={profile.avatar === avatar.id ? "active" : ""} onClick={() => onUpdate({ ...profile, avatar: avatar.id })} style={{ background: avatar.pale }}><span style={{ background: avatar.color }} /></button>)}</div><Button className="primary" onClick={() => onUpdate({ ...profile, characterName: name.trim() || profile.characterName, name: name.trim() || profile.name })}>{zh ? "保存更改" : "Save changes"}</Button></article>
        <article><header><Icon name="shield" /><div><h2>{zh ? "设备与安全" : "Device & safety"}</h2><p>{zh ? "学习进度保存在此设备" : "Progress stays on this device"}</p></div></header><ul className="diagnostics"><li><span>{zh ? "应用安装" : "App installed"}</span><b className={installed ? "good" : ""}>{installed ? (zh ? "已安装" : "Installed") : (zh ? "浏览器模式" : "Browser mode")}</b></li><li><span>{zh ? "离线模式" : "Offline shell"}</span><b className="good">{zh ? "可用" : "Ready"}</b></li><li><span>{zh ? "语音功能" : "Speech"}</span><b className="good">{"speechSynthesis" in window ? (zh ? "可用" : "Available") : (zh ? "仅显示音标" : "IPA only")}</b></li></ul><Button onClick={exportData}><Icon name="download" /> {zh ? "导出学习进度" : "Export progress"}</Button></article>
        <article><header><Icon name="chart" /><div><h2>{zh ? "本机统计" : "On-device activity"}</h2><p>{zh ? "不会发送到任何服务器" : "Never sent to a server"}</p></div></header><div className="metric-row"><span><b>{profile.completedSessions}</b><small>{zh ? "已完成任务" : "quests completed"}</small></span><span><b>{profile.learnedCount}</b><small>{zh ? "已收集单词" : "words collected"}</small></span><span><b>{profile.bestStreak}</b><small>{zh ? "最佳连续天数" : "best streak"}</small></span></div></article>
      </div>
    </section>
  );
}

function MonthlyReview({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const zh = profile.locale === "zh";
  return <section className="review-page"><div className="review-art"><Icon name="sparkle" size={44} /></div><span className="eyebrow">Monthly check-in · 每月复习</span><h1>{zh ? "这些单词想再见见你" : "These words want another visit"}</h1><p>{zh ? "这不是考试。我们会轻松地看看哪些单词还很熟悉。" : "This isn’t a test. We’ll gently revisit your words and see which ones still feel strong."}</p><div className="review-preview">{words.slice(0, Math.min(profile.learnedCount, 6)).map((word) => <WordArt word={word} key={word.id} />)}</div><Button className="primary" onClick={onBack}>{zh ? "开始 5 个单词的复习" : "Review 5 words"} <Icon name="arrow" /></Button><button className="quiet-action" onClick={onBack}>{zh ? "稍后再说" : "Maybe later"}</button></section>;
}

function Shell({ profile, route, go, children }: { profile: Profile; route: Route; go: (route: Route) => void; children: React.ReactNode }) {
  const t = copy[profile.locale];
  const items: { id: Route; label: string; icon: IconName }[] = [
    { id: "home", label: t.home, icon: "home" }, { id: "session", label: t.practice, icon: "sparkle" },
    { id: "words", label: t.words, icon: "book" }, { id: "buddy", label: t.buddy, icon: "user" },
  ];
  return (
    <div className="shell">
      <aside className="sidebar"><Brand /><nav>{items.map((item) => <button className={route === item.id ? "active" : ""} onClick={() => go(item.id)} key={item.id}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><button className="mini-profile" onClick={() => go("settings")}><Character avatarId={profile.avatar} small /><span><b>{profile.name}</b><small>{profile.locale === "zh" ? "单词魔法师" : "Word wizard"}</small></span><Icon name="settings" size={16} /></button></aside>
      <main className="content">{children}</main>
      <nav className="mobile-nav">{items.map((item) => <button className={route === item.id ? "active" : ""} onClick={() => go(item.id)} key={item.id}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav>
    </div>
  );
}

function routeFromHash(): Route {
  const value = location.hash.replace(/^#\//, "").split("?")[0];
  return (["home", "topics", "session", "words", "buddy", "settings", "review"].includes(value) ? value : "home") as Route;
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [showInstall, setShowInstall] = useState(false);
  useEffect(() => {
    db.profiles.toCollection().first().then((saved) => {
      setProfile(saved ? normalizeProfile(saved) : null);
      const installed = matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (saved && !installed) setShowInstall(true);
    });
    navigator.storage?.persist?.().catch(() => undefined);
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const save = async (next: Profile) => {
    const id = await db.profiles.put(next);
    setProfile({ ...next, id: Number(id) });
  };
  const go = (next: Route) => {
    location.hash = `#/${next}`;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const create = async (next: Profile) => { await save(next); setShowInstall(true); };
  const chooseTopic = (id: string) => { if (profile) save({ ...profile, currentTopicId: id }); go("home"); };

  if (profile === undefined) return <div className="loading"><Brand /></div>;
  if (profile === null) return <Creation onCreate={create} />;
  if (showInstall) return <InstallPrompt onContinue={() => setShowInstall(false)} />;
  if (!profile.currentTopicId || route === "topics") return <TopicPicker profile={profile} onChoose={chooseTopic} />;

  let view: React.ReactNode = <Home profile={profile} go={go} />;
  if (route === "session") view = <PracticeSession profile={profile} onExit={() => go("home")} onDone={(next) => { save(next); go("home"); }} />;
  if (route === "words") view = <MyWords profile={profile} />;
  if (route === "buddy") view = <Buddy profile={profile} onUpdate={save} goPractice={() => go("session")} />;
  if (route === "settings") view = <Settings profile={profile} onUpdate={save} />;
  if (route === "review") view = <MonthlyReview profile={profile} onBack={() => go("home")} />;
  return <Shell profile={profile} route={route} go={go}>{view}</Shell>;
}
