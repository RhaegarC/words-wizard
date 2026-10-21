import { useEffect, useState } from "react";
import { db, type Profile } from "./db";

type Screen = "home" | "practice" | "words" | "buddy";
type IconName = "home" | "book" | "sparkle" | "user" | "flame" | "heart" | "play" | "volume" | "arrow" | "check" | "settings";

const avatars = [
  { id: "luma", name: "Luma", color: "#7562df", pale: "#ded9ff" },
  { id: "pippin", name: "Pippin", color: "#e9825d", pale: "#ffe0d2" },
  { id: "moss", name: "Moss", color: "#55a57a", pale: "#cfeedd" },
];

const words = [
  { word: "discover", type: "verb", meaning: "To find something new.", strength: 88, tone: "violet" },
  { word: "brave", type: "adjective", meaning: "Ready to face something difficult.", strength: 76, tone: "coral" },
  { word: "together", type: "adverb", meaning: "With each other, as a group.", strength: 62, tone: "green" },
  { word: "create", type: "verb", meaning: "To make something new.", strength: 94, tone: "yellow" },
  { word: "careful", type: "adjective", meaning: "Taking time to avoid mistakes.", strength: 71, tone: "blue" },
  { word: "journey", type: "noun", meaning: "A trip from one place to another.", strength: 83, tone: "pink" },
];

const questions = [
  { word: "discover", prompt: "What does “discover” mean?", answers: ["To find something new", "To hide something", "To move very slowly"], correct: 0 },
  { word: "brave", prompt: "Which word means ready to face something difficult?", answers: ["quiet", "brave", "tiny"], correct: 1 },
  { word: "together", prompt: "We solved the puzzle _____!", answers: ["apart", "yesterday", "together"], correct: 2 },
];

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
  };
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>;
}

function Character({ avatarId, small = false }: { avatarId: string; small?: boolean }) {
  const avatar = avatars.find((item) => item.id === avatarId) ?? avatars[0];
  return (
    <div className={`character ${small ? "small" : ""}`} style={{ "--pet": avatar.color, "--pet-pale": avatar.pale } as React.CSSProperties}>
      {!small && <><i className="spark one" /><i className="spark two" /></>}
      <svg viewBox="0 0 210 210" role="img" aria-label={`${avatar.name} character`}>
        <ellipse cx="105" cy="180" rx="55" ry="13" fill="#292147" opacity=".09" />
        <path className="pet" d="M153 130c31-8 40 10 22 24-10 8-23 4-24-5 12 4 21-4 13-9-4-3-8-2-13 0Z" />
        <path className="pet" d="M67 115c-4 30 3 59 38 62 36 3 47-27 39-61Z" />
        <path className="pale" d="M72 125c-27 8-32 35-5 38 13 1 22-10 21-28ZM140 125c25 7 28 31 6 35-13 2-21-8-20-25Z" />
        <path className="pale" d="m68 80-16-28c-3-5 3-10 8-6l25 20Zm73-1 16-28c3-5-3-10-8-6l-25 20Z" />
        <path className="pet" d="M62 90c0-31 18-49 43-49 28 0 46 21 45 51-1 31-20 50-46 50-25 0-42-20-42-52Z" />
        <ellipse cx="86" cy="92" rx="8" ry="10" fill="#fff" /><ellipse cx="124" cy="92" rx="8" ry="10" fill="#fff" />
        <circle cx="88" cy="94" r="4" fill="#292147" /><circle cx="122" cy="94" r="4" fill="#292147" />
        <path d="M99 109c4 3 9 3 13 0" fill="none" stroke="#292147" strokeWidth="4" strokeLinecap="round" />
        <circle cx="75" cy="110" r="7" fill="#f59e9e" opacity=".55" /><circle cx="136" cy="110" r="7" fill="#f59e9e" opacity=".55" />
        <path className="pale" d="m94 46 11-22 11 22" />
      </svg>
    </div>
  );
}

function Button({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props}>{children}</button>;
}

function Brand() {
  return <div className="brand"><span><Icon name="sparkle" size={22} /></span><b>Words<em>Wizard</em></b></div>;
}

function Creation({ onCreate }: { onCreate: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("luma");
  const submit = () => {
    const now = Date.now();
    onCreate({ name: name.trim() || "Wizard", characterName: name.trim() || "Luma", avatar, xp: 124, streak: 4, careTokens: 2, learnedCount: 12, createdAt: now, lastPracticeAt: now });
  };
  return (
    <main className="creation">
      <header><Brand /><span>Made for curious minds</span></header>
      <section className="creation-card">
        <div className="creation-copy">
          <label className="eyebrow">Your adventure starts here</label>
          <h1>Make a new<br /><em>word buddy!</em></h1>
          <p>Choose a magical friend to learn and grow with you.</p>
          <label className="name-field"><b>What should we call your buddy?</b><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Type a name..." maxLength={16} /></label>
        </div>
        <div className="avatar-builder">
          <Character avatarId={avatar} />
          <div className="avatar-list">
            {avatars.map((item) => <button key={item.id} aria-label={`Choose ${item.name}`} className={avatar === item.id ? "selected" : ""} onClick={() => setAvatar(item.id)} style={{ "--swatch": item.color, "--pale": item.pale } as React.CSSProperties}><i />{avatar === item.id && <b><Icon name="check" size={13} /></b>}</button>)}
          </div>
          <Button className="primary wide" onClick={submit}>Meet my buddy <Icon name="arrow" /></Button>
        </div>
      </section>
      <p className="safe"><Icon name="heart" size={15} /> Your progress stays safely on this device.</p>
    </main>
  );
}

function Home({ profile, go }: { profile: Profile; go: (screen: Screen) => void }) {
  return (
    <>
      <header className="topbar">
        <div><span className="eyebrow">Welcome back, {profile.name}!</span><h1>Ready for a word adventure?</h1></div>
        <div className="top-stats"><span><Icon name="flame" /><b>{profile.streak}</b><small>day streak</small></span><span><Icon name="heart" /><b>{profile.careTokens}</b><small>care tokens</small></span><button aria-label="Settings"><Icon name="settings" /></button></div>
      </header>
      <section className="hero">
        <div className="hero-pet"><Character avatarId={profile.avatar} /></div>
        <div className="hero-copy"><label><Icon name="sparkle" size={15} /> Hatchling</label><h2>{profile.characterName} is feeling bright!</h2><p>Every new word helps your buddy grow stronger.</p><div className="growth-label"><span>Growing to Juvenile</span><b>42%</b></div><div className="progress"><i /></div></div>
        <button onClick={() => go("buddy")}>Visit buddy <Icon name="arrow" size={17} /></button>
      </section>
      <section className="today">
        <header><div><span className="eyebrow">Today’s quest</span><h2>A little practice goes a long way</h2></div><label>About 5 min</label></header>
        <article className="quest"><span className="quest-icon"><Icon name="book" size={28} /></span><div><h3>Explore & Discover</h3><p>3 new words + 2 quick reviews</p><aside><i>discover</i><i>brave</i><i>together</i><small>+2</small></aside></div><Button className="primary" onClick={() => go("practice")}><Icon name="play" size={19} /> Start practice</Button></article>
      </section>
      <section className="feature-grid">
        <button onClick={() => go("words")}><i><Icon name="book" size={28} /></i><span><small>Your collection</small><b>{profile.learnedCount} words learned</b><em>See every word you’ve earned</em></span><Icon name="arrow" /></button>
        <button><i><Icon name="sparkle" size={28} /></i><span><small>Coming up</small><b>Monthly check-in</b><em>Keep collecting words!</em></span><label>8 more</label></button>
      </section>
    </>
  );
}

function Practice({ profile, done, exit }: { profile: Profile; done: (profile: Profile) => void; exit: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const speak = () => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(question.word)); };
  const next = () => { if (index === questions.length - 1) setFinished(true); else { setIndex(index + 1); setAnswer(null); } };

  if (finished) {
    return <section className="summary"><Character avatarId={profile.avatar} /><span className="eyebrow">Quest complete</span><h1>You made word magic!</h1><p>{profile.characterName} grew stronger, and you added 3 new words.</p><div><span><b>+21</b><small>growth points</small></span><span><b>3</b><small>words practiced</small></span></div><Button className="primary wide" onClick={() => done({ ...profile, xp: profile.xp + 21, learnedCount: profile.learnedCount + 3, lastPracticeAt: Date.now() })}>Back to home <Icon name="arrow" /></Button></section>;
  }
  return (
    <section className="practice">
      <header><button onClick={exit} aria-label="Close">×</button><div><i style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div><b>{index + 1} of {questions.length}</b></header>
      <div className="exercise">
        <div className="exercise-art"><Icon name="sparkle" size={34} /></div><span className="eyebrow">Choose the best answer</span><h1>{question.prompt}</h1>
        <button className="listen" onClick={speak}><Icon name="volume" /> Hear “{question.word}”</button>
        <div className="answers">{question.answers.map((item, itemIndex) => <button key={item} onClick={() => setAnswer(itemIndex)} className={answer === itemIndex ? (itemIndex === question.correct ? "correct" : "try") : ""}><i>{String.fromCharCode(65 + itemIndex)}</i><span>{item}</span>{answer === itemIndex && itemIndex === question.correct && <b><Icon name="check" /></b>}</button>)}</div>
        {answer !== null && <div className={`feedback ${answer === question.correct ? "success" : ""}`}><span><b>{answer === question.correct ? "Wonderful work!" : "Nearly there — try another!"}</b><small>{answer === question.correct ? "That’s exactly right." : "Think about the clue one more time."}</small></span>{answer === question.correct && <Button className="primary" onClick={next}>Continue <Icon name="arrow" /></Button>}</div>}
      </div>
    </section>
  );
}

function WordCollection({ count }: { count: number }) {
  const [filter, setFilter] = useState("All words");
  return (
    <section className="word-page">
      <span className="eyebrow">Your collection</span><header><div><h1>Word treasure</h1><p>Every word here is one you’ve practiced.</p></div><aside><b>{count}</b><span>words learned</span></aside></header>
      <nav>{["All words", "Mastered", "Learning"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</nav>
      <div className="word-grid">{words.map((item) => <article className={item.tone} key={item.word}><header><i>{item.word[0].toUpperCase()}</i><button aria-label={`Hear ${item.word}`} onClick={() => speechSynthesis.speak(new SpeechSynthesisUtterance(item.word))}><Icon name="volume" size={18} /></button></header><small>{item.type}</small><h3>{item.word}</h3><p>{item.meaning}</p><footer><span><i style={{ width: `${item.strength}%` }} /></span><em>{item.strength > 80 ? "Strong" : "Growing"}</em></footer></article>)}</div>
    </section>
  );
}

function Buddy({ profile }: { profile: Profile }) {
  return <section className="buddy"><div className="buddy-art"><Character avatarId={profile.avatar} /></div><div className="buddy-copy"><span className="eyebrow">Your word buddy</span><h1>{profile.characterName}</h1><p>Hatchling · feeling bright</p><article><header><span>Next stage</span><b>Juvenile</b></header><div className="progress"><i /></div><small>Keep practicing — you’re 42% there!</small></article><aside><div><Icon name="heart" /><b>{profile.careTokens} care tokens</b><small>Earn one every 5 quests</small></div><div><Icon name="flame" /><b>{profile.streak} day streak</b><small>That’s a bright spark!</small></div></aside></div></section>;
}

function Shell({ profile, screen, setScreen, children }: { profile: Profile; screen: Screen; setScreen: (screen: Screen) => void; children: React.ReactNode }) {
  const items: { id: Screen; label: string; icon: IconName }[] = [{ id: "home", label: "Home", icon: "home" }, { id: "practice", label: "Practice", icon: "sparkle" }, { id: "words", label: "My words", icon: "book" }, { id: "buddy", label: "My buddy", icon: "user" }];
  return <div className="shell"><aside className="sidebar"><Brand /><nav>{items.map((item) => <button className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)} key={item.id}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav><button className="mini-profile" onClick={() => setScreen("buddy")}><Character avatarId={profile.avatar} small /><span><b>{profile.name}</b><small>Word wizard</small></span><Icon name="arrow" size={16} /></button></aside><main className="content">{children}</main><nav className="mobile-nav">{items.map((item) => <button className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)} key={item.id}><Icon name={item.icon} /><span>{item.label}</span></button>)}</nav></div>;
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>("home");
  useEffect(() => { db.profiles.toCollection().first().then((saved) => setProfile(saved ?? null)); navigator.storage?.persist?.().catch(() => undefined); }, []);
  const save = async (next: Profile) => { const id = await db.profiles.put(next); setProfile({ ...next, id: Number(id) }); };
  if (profile === undefined) return <div className="loading"><Brand /></div>;
  if (profile === null) return <Creation onCreate={save} />;
  let view: React.ReactNode = <Home profile={profile} go={setScreen} />;
  if (screen === "practice") view = <Practice profile={profile} exit={() => setScreen("home")} done={(next) => { save(next); setScreen("home"); }} />;
  if (screen === "words") view = <WordCollection count={profile.learnedCount} />;
  if (screen === "buddy") view = <Buddy profile={profile} />;
  return <Shell profile={profile} screen={screen} setScreen={setScreen}>{view}</Shell>;
}
