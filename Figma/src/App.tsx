import { useState } from "react";

type IconName =
  | "home"
  | "map"
  | "cards"
  | "user"
  | "bolt"
  | "coin"
  | "star"
  | "book"
  | "volume"
  | "lock"
  | "check"
  | "close"
  | "play"
  | "chevron";

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 11 9-7.2L21 11"/><path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/></>,
    cards: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 15 2-2 2 2 3-4"/><path d="M8 7h8"/></>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.6-4 2.9-6 7-6s6.4 2 7 6"/></>,
    bolt: <path d="m13.5 2-8 12h6l-1 8 8-12h-6Z"/>,
    coin: <><circle cx="12" cy="12" r="9"/><path d="M14.8 8.5c-.6-.6-1.4-.9-2.8-.9-1.5 0-2.7.7-2.7 1.8 0 2.9 5.5 1.2 5.5 4.4 0 1.3-1.2 2.2-2.9 2.2-1.3 0-2.3-.4-3-1.1M12 5.5v13"/></>,
    star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1-4.4-4.3 6.1-.9Z"/>,
    book: <><path d="M4 4.5h6a2 2 0 0 1 2 2V20a3 3 0 0 0-3-3H4Z"/><path d="M20 4.5h-6a2 2 0 0 0-2 2V20a3 3 0 0 1 3-3h5Z"/></>,
    volume: <><path d="M5 10v4h3l4 3V7l-4 3Z"/><path d="M15 9c1.3 1.5 1.3 4.5 0 6M18 6.5c3 3 3 8 0 11"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    play: <path d="m9 7 8 5-8 5Z"/>,
    chevron: <path d="m9 6 6 6-6 6"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Pet() {
  return (
    <svg className="pet" viewBox="0 0 170 150" role="img" aria-label="Leafy, your green forest pet">
      <ellipse cx="84" cy="136" rx="52" ry="8" fill="#133d32" opacity=".12"/>
      <path d="M45 61C25 49 25 30 31 18c15 2 28 12 32 29" fill="#72ba55" stroke="#194f3d" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M122 61c20-12 20-31 14-43-15 2-28 12-32 29" fill="#72ba55" stroke="#194f3d" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M50 48c-18 8-28 25-25 45 4 31 31 45 59 45s55-14 59-45c3-20-7-37-25-45-18-8-50-8-68 0Z" fill="#9bd66c" stroke="#194f3d" strokeWidth="5"/>
      <path d="M60 43c2-18 14-29 25-33 8 14 8 27 1 37" fill="#5aa847" stroke="#194f3d" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M82 44c11-18 29-18 38-15-2 13-13 23-27 25" fill="#7bc65c" stroke="#194f3d" strokeWidth="5" strokeLinejoin="round"/>
      <ellipse cx="62" cy="86" rx="7" ry="9" fill="#194f3d"/>
      <ellipse cx="108" cy="86" rx="7" ry="9" fill="#194f3d"/>
      <circle cx="60" cy="83" r="2.2" fill="white"/>
      <circle cx="106" cy="83" r="2.2" fill="white"/>
      <path d="M75 102c6 6 13 6 19 0" fill="none" stroke="#194f3d" strokeWidth="4" strokeLinecap="round"/>
      <ellipse cx="48" cy="101" rx="9" ry="5" fill="#efa188" opacity=".6"/>
      <ellipse cx="120" cy="101" rx="9" ry="5" fill="#efa188" opacity=".6"/>
      <path d="m81 91 4 3 4-3" fill="#f4a278" stroke="#194f3d" strokeWidth="2.5" strokeLinejoin="round"/>
    </svg>
  );
}

function ForestScene() {
  return (
    <svg className="forest-art" viewBox="0 0 720 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d9f6d6"/><stop offset="1" stopColor="#88cf9d"/></linearGradient>
        <linearGradient id="path" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f2d39d"/><stop offset="1" stopColor="#d8ae78"/></linearGradient>
      </defs>
      <rect width="720" height="440" fill="url(#sky)"/>
      <circle cx="570" cy="75" r="45" fill="#fff7bf" opacity=".8"/>
      <path d="M0 198Q95 128 193 192t190-8q100-77 205 5t132-12v263H0Z" fill="#4d9b68"/>
      <path d="M0 260q120-80 250 3t250-15q105-70 220 7v185H0Z" fill="#287354"/>
      <path d="M335 440c-5-80 30-143 87-195 25-23 35-45 22-69 73 47 21 108-24 143-38 30-47 72-42 121Z" fill="url(#path)"/>
      <g fill="#123f35">
        <path d="M43 316V95h22v221Z"/><path d="M-20 170 55 45l75 125-34-8 39 68H-25l39-68Z"/>
        <path d="M654 324V88h20v236Z"/><path d="m592 160 72-119 76 119-34-7 41 73H576l44-73Z"/>
      </g>
      <g transform="translate(390 110)">
        <path d="M2 126V35c0-22 18-40 40-40h66c22 0 40 18 40 40v91" fill="#6f4d3e" stroke="#173f35" strokeWidth="7"/>
        <path d="M31 126V42c0-14 11-25 25-25h38c14 0 25 11 25 25v84" fill="#184d43"/>
        <path d="M74 17v109" stroke="#76d184" strokeWidth="3" opacity=".55"/>
        <circle cx="75" cy="68" r="27" fill="#8de18f" opacity=".24"/>
        <path d="M68 60c10-11 20-4 15 5-3 5-8 7-15 15-7-8-12-10-15-15-5-9 5-16 15-5Z" fill="#f8df7b"/>
      </g>
      <g fill="#e6f29f">
        <circle cx="184" cy="108" r="4"/><circle cx="220" cy="155" r="3"/><circle cx="534" cy="169" r="4"/><circle cx="567" cy="130" r="3"/>
      </g>
      <g transform="translate(202 245)">
        <path d="M8 76c-18-18-13-49 5-63 18-14 45-11 57 9 10 17 5 43-9 56" fill="#8d6b51" stroke="#173f35" strokeWidth="5"/>
        <path d="M16 27c13-16 41-17 54 2-5 8-13 13-21 14-3-8-9-12-17-12-7 0-12 2-16 5Z" fill="#d57c55"/>
        <circle cx="30" cy="50" r="4" fill="#173f35"/><circle cx="54" cy="50" r="4" fill="#173f35"/>
        <path d="M35 62c5 4 10 4 15 0" fill="none" stroke="#173f35" strokeWidth="3" strokeLinecap="round"/>
        <path d="m4 45-22-13M5 58l-25 3" stroke="#173f35" strokeWidth="5" strokeLinecap="round"/>
      </g>
      <g fill="#f8e09c" opacity=".8">
        <circle cx="105" cy="295" r="3"/><circle cx="147" cy="330" r="4"/><circle cx="565" cy="315" r="3"/><circle cx="610" cy="274" r="4"/>
      </g>
    </svg>
  );
}

const answers = ["勇敢的", "明亮的", "安静的", "快速的"];

const scenes = [
  { id: 1, name: "魔法森林", subtitle: "咒语门", tone: "forest", progress: "3 / 9", status: "active" },
  { id: 2, name: "星际救援", subtitle: "字母星球", tone: "space", progress: "0 / 9", status: "open" },
  { id: 3, name: "海底王国", subtitle: "珍珠迷宫", tone: "ocean", progress: "0 / 9", status: "open" },
  { id: 4, name: "恐龙岛", subtitle: "化石密码", tone: "dino", progress: "0 / 9", status: "locked" },
  { id: 5, name: "糖果王国", subtitle: "巧克力城堡", tone: "candy", progress: "0 / 9", status: "locked" },
  { id: 6, name: "海盗湾", subtitle: "藏宝图之谜", tone: "pirate", progress: "0 / 9", status: "locked" },
  { id: 7, name: "精灵村", subtitle: "四季树", tone: "elf", progress: "0 / 9", status: "locked" },
  { id: 8, name: "机械城", subtitle: "齿轮工厂", tone: "machine", progress: "0 / 9", status: "locked" },
  { id: 9, name: "童话城堡", subtitle: "镜子迷宫", tone: "fairy", progress: "0 / 9", status: "locked" },
  { id: 10, name: "神秘金字塔", subtitle: "法老圣甲虫", tone: "pyramid", progress: "0 / 9", status: "locked" },
];

function PageHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{copy}</p>
    </div>
  );
}

function AdventurePage({ onPlay, notify }: { onPlay: () => void; notify: (message: string) => void }) {
  const modes = [
    ["拼写挑战", "键盘拼出正确单词", "ABC"],
    ["配对消除", "连接英文与中文", "1:1"],
    ["单词泡泡", "听音找到正确泡泡", "♪"],
    ["单词迷宫", "用词语推动故事", "RPG"],
    ["听写训练", "听发音写出单词", "A_"],
  ];
  return (
    <main className="inner-page">
      <PageHeading eyebrow="CHOOSE YOUR QUEST" title="冒险世界" copy="每个世界都有不同的故事和单词挑战，带上叶芽一起探索吧。" />
      <section className="mode-strip" aria-label="Practice modes">
        {modes.map(([name, copy, mark], index) => (
          <button key={name} className={index === 3 ? "featured" : ""} onClick={() => index === 3 ? onPlay() : notify(`${name}已加入今日训练`)}>
            <span>{mark}</span><div><strong>{name}</strong><small>{copy}</small></div>
          </button>
        ))}
      </section>
      <div className="content-heading"><div><h2>故事世界</h2><p>完成每个世界的 8 个关卡和 1 场 Boss 战</p></div><span><Icon name="star" size={18}/> 5 / 270 星</span></div>
      <section className="scene-grid">
        {scenes.map((scene) => (
          <button key={scene.id} className={`scene-card ${scene.tone} ${scene.status}`} onClick={() => scene.status === "locked" ? notify("收集更多星星来解锁这个世界") : scene.status === "active" ? onPlay() : notify(`${scene.name}的第一关已准备好`)}>
            <span className="scene-number">{String(scene.id).padStart(2, "0")}</span>
            <div className="scene-landscape">
              <i /><i /><i />
              {scene.status === "locked" && <span className="scene-lock"><Icon name="lock" size={21}/></span>}
            </div>
            <div className="scene-copy">
              <small>{scene.subtitle}</small><strong>{scene.name}</strong>
              <span>{scene.status === "locked" ? "需要 18 星解锁" : scene.progress + " 关"}</span>
            </div>
            {scene.status === "active" && <b>继续</b>}
          </button>
        ))}
      </section>
    </main>
  );
}

const wordCards = [
  ["brave", "/breɪv/", "勇敢的", "mastered"],
  ["forest", "/ˈfɒrɪst/", "森林", "mastered"],
  ["magic", "/ˈmædʒɪk/", "魔法", "learning"],
  ["glow", "/ɡləʊ/", "发光", "learning"],
  ["ancient", "/ˈeɪnʃənt/", "古老的", "review"],
  ["path", "/pɑːθ/", "小路", "mastered"],
  ["quiet", "/ˈkwaɪət/", "安静的", "review"],
  ["guardian", "/ˈɡɑːdiən/", "守护者", "locked"],
];

function CardsPage({ notify }: { notify: (message: string) => void }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const visibleCards = wordCards.filter(([word, , meaning, status]) =>
    (filter === "all" || filter === status) && `${word}${meaning}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <main className="inner-page">
      <div className="heading-actions">
        <PageHeading eyebrow="MY COLLECTION" title="单词卡册" copy="每掌握一个单词，就能点亮一张属于你的冒险卡。" />
        <button className="outline-action" onClick={() => setImportOpen(true)}>＋ 导入单词库</button>
      </div>
      <section className="card-stats">
        <div><span><Icon name="cards"/></span><p>已收集<strong>126</strong></p><small>共 800 张</small></div>
        <div><span><Icon name="check"/></span><p>已掌握<strong>84</strong></p><small>连续答对 3 次</small></div>
        <div><span><Icon name="bolt"/></span><p>待复习<strong>12</strong></p><small>根据记忆曲线</small></div>
        <div><span><Icon name="star"/></span><p>本周新增<strong>28</strong></p><small>比上周多 6 个</small></div>
      </section>
      <section className="library-panel">
        <div className="library-tools">
          <div className="filter-tabs">
            {[["all","全部"],["mastered","已掌握"],["learning","学习中"],["review","待复习"]].map(([key,label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
          <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词或释义" /></label>
        </div>
        <div className="word-grid">
          {visibleCards.map(([word, phonetic, meaning, status], index) => (
            <button className={`word-card ${status}`} key={word} onClick={() => status === "locked" ? notify("继续冒险即可解锁这张卡") : window.speechSynthesis?.speak(new SpeechSynthesisUtterance(word))}>
              <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="word-card-art"><i>{word.slice(0, 1).toUpperCase()}</i></span>
              <strong>{word}</strong><small>{phonetic}</small><p>{meaning}</p>
              <span className="mastery">{status === "mastered" ? "已掌握" : status === "learning" ? "学习中" : status === "review" ? "待复习" : "未解锁"}</span>
            </button>
          ))}
        </div>
      </section>
      {importOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}>
          <section className="import-modal" role="dialog" aria-modal="true">
            <button className="close-btn" onClick={() => setImportOpen(false)}><Icon name="close"/></button>
            <div className="challenge-icon"><Icon name="book" size={30}/></div>
            <h2>创建我的单词库</h2>
            <p>上传 CSV、XLSX 或 JSON 文件，最多 2 MB。系统会自动检查格式和重复词。</p>
            <label className="drop-zone">
              <input type="file" accept=".csv,.xlsx,.json" onChange={(event) => { if (event.target.files?.length) notify(`已读取 ${event.target.files[0].name}，正在生成预览`); }} />
              <span>＋</span><strong>选择文件上传</strong><small>或将文件拖到这里</small>
            </label>
            <button className="template-btn" onClick={() => notify("单词库模板已准备下载")}>下载导入模板</button>
          </section>
        </div>
      )}
    </main>
  );
}

function ProfilePage({ notify }: { notify: (message: string) => void }) {
  const [role, setRole] = useState<"child" | "parent">("child");
  const [limit, setLimit] = useState(30);
  const bars = [54, 72, 42, 82, 64, 91, 76];
  return (
    <main className="inner-page">
      <div className="profile-heading">
        <PageHeading eyebrow="GROW TOGETHER" title={role === "child" ? "我的营地" : "家长观察站"} copy={role === "child" ? "照顾伙伴、收集勋章，也看看这一周的成长。" : "了解学习节奏，提供支持而不是压力。"} />
        <div className="role-switch"><button className={role === "child" ? "active" : ""} onClick={() => setRole("child")}>小宇</button><button className={role === "parent" ? "active" : ""} onClick={() => setRole("parent")}>家长</button></div>
      </div>
      {role === "child" ? (
        <>
          <section className="camp-grid">
            <article className="pet-room">
              <div><span className="eyebrow">MY PARTNER</span><h2>叶芽的小屋</h2><p>叶芽心情很好，今天还想和你学习 2 个新词。</p></div>
              <Pet />
              <div className="pet-actions"><button onClick={() => notify("叶芽吃饱了，成长值 +5")}>喂食 · 20</button><button onClick={() => notify("已打开叶芽的衣橱")}>换装</button></div>
            </article>
            <article className="week-summary">
              <span className="eyebrow">THIS WEEK</span><h2>本周成长</h2>
              <div className="summary-number"><strong>46</strong><span>学习单词<br/><b>+12%</b></span></div>
              <div className="mini-bars">{bars.map((height, i) => <i key={i} style={{ height: `${height}%` }}><span>{["一","二","三","四","五","六","日"][i]}</span></i>)}</div>
              <p>你在周六的专注力最好，真棒！</p>
            </article>
          </section>
          <div className="content-heading"><div><h2>勇者勋章</h2><p>坚持自己的节奏，每一步都算数</p></div><span>6 / 24 枚</span></div>
          <section className="badge-grid">
            {[["初见森林","完成第一场冒险"],["记忆达人","掌握 50 个单词"],["自律小勇士","7 天按时结束学习"],["连胜法师","连续答对 10 题"]].map(([name,copy],i) => <article className={i > 1 ? "locked" : ""} key={name}><span><Icon name={i > 1 ? "lock" : "star"} size={27}/></span><div><strong>{name}</strong><small>{copy}</small></div></article>)}
          </section>
        </>
      ) : (
        <>
          <section className="parent-stats">
            <article><small>本周学习</small><strong>68 <i>分钟</i></strong><span>在计划范围内</span></article>
            <article><small>新学单词</small><strong>46 <i>个</i></strong><span>较上周 +12%</span></article>
            <article><small>整体正确率</small><strong>87<i>%</i></strong><span>保持稳定</span></article>
            <article><small>复习完成率</small><strong>92<i>%</i></strong><span>4 个词待巩固</span></article>
          </section>
          <section className="parent-grid">
            <article className="report-card">
              <div className="content-heading"><div><h2>七日学习趋势</h2><p>每日有效学习时长</p></div><span>目标 15 分钟</span></div>
              <div className="report-chart">{bars.map((height,i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{["周一","周二","周三","周四","周五","周六","周日"][i]}</span></div>)}</div>
            </article>
            <article className="control-card">
              <span className="eyebrow">TIME MANAGEMENT</span><h2>学习时间设置</h2>
              <label><span>每日上限 <b>{limit} 分钟</b></span><input type="range" min="15" max="60" step="5" value={limit} onChange={(event) => setLimit(Number(event.target.value))}/></label>
              <div className="time-window"><span>可用时段</span><strong>07:00 — 20:30</strong></div>
              <div className="setting-row"><div><strong>锁定当前词库</strong><small>防止切换简单词库获取时长</small></div><button className="toggle active" onClick={(event) => event.currentTarget.classList.toggle("active")}><i/></button></div>
              <button className="save-settings" onClick={() => notify("家长设置已安全保存")}>保存设置</button>
            </article>
          </section>
          <section className="weak-words">
            <div><span className="eyebrow">NEEDS A LITTLE HELP</span><h2>本周待巩固词</h2><p>这些词的停顿时间较长，系统已自动安排复习。</p></div>
            {["ancient","quiet","through","guardian"].map((word, i) => <span key={word}><b>{word}</b><small>{[2,3,2,4][i]} 次错误</small></span>)}
          </section>
        </>
      )}
    </main>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("home");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function openChallenge() {
    setSelected(null);
    setSubmitted(false);
    setChallengeOpen(true);
  }

  const correct = selected === "勇敢的";

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setActiveNav("home")} aria-label="Word Hero home">
          <span className="brand-mark"><span>W</span></span>
          <span><b>单词小勇者</b><small>WORD HERO</small></span>
        </button>
        <div className="header-stats">
          <div className="energy-stat" title="Today's magic energy">
            <span className="stat-icon energy"><Icon name="bolt" size={17}/></span>
            <div><span>魔法能量</span><strong>18 / 30 min</strong></div>
            <div className="energy-track"><i /></div>
          </div>
          <div className="currency"><Icon name="coin" size={19}/><b>1,280</b></div>
          <button className="avatar" onClick={() => setActiveNav("user")} aria-label="Open profile">小宇</button>
        </div>
      </header>

      {activeNav === "home" && <main>
        <section className="welcome-row">
          <div>
            <p className="eyebrow">WEDNESDAY · 22 MAY</p>
            <h1>下午好，小宇！</h1>
            <p>森林深处的咒语门正在等你，准备好出发了吗？</p>
          </div>
          <div className="streak"><span><Icon name="star" size={19}/></span><div><small>连续学习</small><strong>5 天</strong></div></div>
        </section>

        <section className="dashboard-grid">
          <article className="quest-card">
            <ForestScene />
            <div className="quest-shade" />
            <div className="quest-copy">
              <span className="chapter-label">第一章 · 魔法森林</span>
              <h2>唤醒沉睡的咒语门</h2>
              <p>穿过迷雾，掌握 5 个新单词，找到开启古门的魔法。</p>
              <div className="quest-meta">
                <span><Icon name="book" size={18}/> 5 个单词</span>
                <span><Icon name="star" size={18}/> 最多 3 星</span>
              </div>
              <button className="primary-btn" onClick={openChallenge}>继续冒险 <Icon name="chevron" size={18}/></button>
            </div>
            <div className="level-flag"><small>当前关卡</small><strong>3</strong><span>/ 9</span></div>
          </article>

          <aside className="side-stack">
            <article className="pet-card">
              <div className="pet-copy"><span className="card-kicker">我的伙伴</span><h3>叶芽</h3><p>今天学习 2 个词，就能获得成长点！</p></div>
              <Pet />
              <div className="growth">
                <div><span>幼年期 · Lv. 4</span><strong>320 / 500</strong></div>
                <div className="growth-track"><i /></div>
              </div>
            </article>

            <article className="daily-card">
              <div className="daily-head">
                <div className="round-icon"><Icon name="book" size={23}/></div>
                <div><span className="card-kicker">今日任务</span><h3>复习旧单词</h3></div>
                <b>6 / 10</b>
              </div>
              <div className="daily-progress"><i /></div>
              <p>再复习 4 个，获得 <strong>+30</strong> 金币</p>
              <button onClick={() => showToast("已为你准备好 4 个复习词")}>开始复习 <Icon name="chevron" size={17}/></button>
            </article>
          </aside>
        </section>

        <section className="journey-section">
          <div className="section-heading">
            <div><span className="eyebrow">YOUR JOURNEY</span><h2>冒险地图</h2></div>
            <button onClick={() => setActiveNav("map")}>查看完整地图 <Icon name="chevron" size={17}/></button>
          </div>
          <div className="level-list">
            <button className="level complete" onClick={() => showToast("第一关已获得三星")}>
              <span className="level-number"><Icon name="check" size={24}/></span>
              <span className="level-info"><small>第一关</small><strong>发光的蘑菇</strong></span>
              <span className="level-stars"><Icon name="star" size={17}/><Icon name="star" size={17}/><Icon name="star" size={17}/></span>
            </button>
            <button className="level complete" onClick={() => showToast("第二关已获得两星")}>
              <span className="level-number"><Icon name="check" size={24}/></span>
              <span className="level-info"><small>第二关</small><strong>迷雾小径</strong></span>
              <span className="level-stars"><Icon name="star" size={17}/><Icon name="star" size={17}/><Icon name="star" size={17}/></span>
            </button>
            <button className="level current" onClick={openChallenge}>
              <span className="level-number">3</span>
              <span className="level-info"><small>正在进行</small><strong>古老的咒语门</strong></span>
              <span className="play-circle"><Icon name="play" size={20}/></span>
            </button>
            <button className="level locked" onClick={() => showToast("完成第三关后解锁")}>
              <span className="level-number"><Icon name="lock" size={20}/></span>
              <span className="level-info"><small>第四关</small><strong>溪流守护者</strong></span>
            </button>
          </div>
        </section>
      </main>}
      {activeNav === "map" && <AdventurePage onPlay={openChallenge} notify={showToast} />}
      {activeNav === "cards" && <CardsPage notify={showToast} />}
      {activeNav === "user" && <ProfilePage notify={showToast} />}

      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          ["home", "home", "首页"],
          ["map", "map", "冒险"],
          ["cards", "cards", "词卡"],
          ["user", "user", "我的"],
        ].map(([key, icon, label]) => (
          <button key={key} className={activeNav === key ? "active" : ""} onClick={() => setActiveNav(key)}>
            <Icon name={icon as IconName}/><span>{label}</span>
          </button>
        ))}
      </nav>

      {challengeOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setChallengeOpen(false); }}>
          <section className="challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
            <button className="close-btn" onClick={() => setChallengeOpen(false)} aria-label="Close challenge"><Icon name="close"/></button>
            <div className="challenge-top">
              <span>3 / 5</span>
              <div className="challenge-progress"><i /></div>
              <span className="hearts">♥ ♥ ♥</span>
            </div>
            <div className="challenge-icon"><Icon name="book" size={32}/></div>
            <p className="challenge-kicker">选择正确的中文意思</p>
            <div className="word-line">
              <h2 id="challenge-title">brave</h2>
              <button onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance("brave"))} aria-label="Listen to pronunciation"><Icon name="volume" size={23}/></button>
            </div>
            <p className="phonetic">/breɪv/</p>
            <div className="answers">
              {answers.map((answer, index) => {
                const answerState = submitted
                  ? answer === "勇敢的" ? "right" : answer === selected ? "wrong" : ""
                  : selected === answer ? "selected" : "";
                return <button key={answer} className={answerState} onClick={() => !submitted && setSelected(answer)}><span>{String.fromCharCode(65 + index)}</span>{answer}{submitted && answer === "勇敢的" && <Icon name="check" size={19}/>}</button>;
              })}
            </div>
            {submitted && <p className={`feedback ${correct ? "success" : "retry"}`}>{correct ? "回答正确！咒语门的光更亮了。" : "差一点！Brave 是“勇敢的”，记住它再出发。"}</p>}
            <button className="submit-btn" disabled={!selected} onClick={() => submitted ? (setChallengeOpen(false), showToast(correct ? "获得 10 金币和 1 点成长值" : "已加入明日复习")) : setSubmitted(true)}>
              {submitted ? "继续前进" : "确认答案"}
            </button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Icon name="check" size={18}/>{toast}</div>}
    </div>
  );
}
