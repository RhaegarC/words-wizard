"use client"

import { useMemo, useState, type ReactNode } from "react"

type Screen =
  | "topics"
  | "topic-form"
  | "packs"
  | "pack-form"
  | "contents"
  | "words"
  | "word-form"
  | "archived"
type AuthState = "staff" | "signed-out" | "denied"
type IconName =
  | "topics"
  | "words"
  | "archive"
  | "plus"
  | "arrow"
  | "edit"
  | "search"
  | "chevron"
  | "more"
  | "up"
  | "down"
  | "close"
  | "grip"
  | "upload"
  | "check"
  | "menu"
  | "logout"
  | "warning"
  | "restore"

type Topic = {
  id: string
  title: string
  titleZh: string
  icon: string
  description: string
  descriptionZh: string
  packs: number
  words: number
  archived?: boolean
  archivedAt?: string
}

type Pack = {
  id: string
  topicId: string
  title: string
  titleZh: string
  wordIds: string[]
  archived?: boolean
  archivedAt?: string
}

type Word = {
  id: string
  text: string
  phonetic: string
  partOfSpeech: string
  meaningEn: string
  meaningZh: string
  definitionEn: string
  definitionZh: string
  exampleEn: string
  exampleZh: string
  level: 1 | 2 | 3
  tags: string[]
  emoji: string
  packs: string[]
}

const initialTopics: Topic[] = [
  { id: "craft-build", title: "Craft & Build", titleZh: "手工与建造", icon: "CB", description: "Make, shape, and create useful things.", descriptionZh: "制作、塑造并创造实用的物品。", packs: 3, words: 56 },
  { id: "explore-discover", title: "Explore & Discover", titleZh: "探索与发现", icon: "ED", description: "Journey into curious places and ideas.", descriptionZh: "探索有趣的地方和新想法。", packs: 3, words: 60 },
  { id: "puzzle-mystery", title: "Puzzle & Mystery", titleZh: "谜题与神秘", icon: "PM", description: "Find clues and solve clever problems.", descriptionZh: "寻找线索，解决有趣的难题。", packs: 3, words: 58 },
  { id: "coop-quest", title: "Co-op Quest", titleZh: "合作任务", icon: "CQ", description: "Share, help, and succeed together.", descriptionZh: "分享、互助，一起取得成功。", packs: 3, words: 54 },
  { id: "battle-survive", title: "Battle & Survive", titleZh: "挑战与生存", icon: "BS", description: "Be brave, careful, and prepared.", descriptionZh: "勇敢、细心，并做好准备。", packs: 3, words: 57 },
  { id: "race-speed", title: "Race & Speed", titleZh: "竞速与速度", icon: "RS", description: "Move quickly and learn how things travel.", descriptionZh: "快速行动，了解事物如何移动。", packs: 2, words: 38, archived: true, archivedAt: "6 Nov 2026" },
]

const initialWords: Word[] = [
  { id: "box", text: "box", phonetic: "/bɒks/", partOfSpeech: "noun", meaningEn: "a container", meaningZh: "盒子", definitionEn: "A container with flat sides.", definitionZh: "有平面侧边的容器。", exampleEn: "Put the paper in the box.", exampleZh: "把纸放进盒子里。", level: 1, tags: ["object", "craft"], emoji: "BX", packs: ["my-workshop", "build-it"] },
  { id: "paper", text: "paper", phonetic: "/ˈpeɪpə/", partOfSpeech: "noun", meaningEn: "thin material for writing", meaningZh: "纸", definitionEn: "A thin material used for writing and making things.", definitionZh: "用于书写和制作物品的薄材料。", exampleEn: "Fold the paper in half.", exampleZh: "把纸对折。", level: 1, tags: ["object", "craft"], emoji: "PA", packs: ["my-workshop"] },
  { id: "glue", text: "glue", phonetic: "/ɡluː/", partOfSpeech: "noun", meaningEn: "something that sticks", meaningZh: "胶水", definitionEn: "A sticky material used to join things.", definitionZh: "用于把物品粘在一起的材料。", exampleEn: "Use glue to fix the card.", exampleZh: "用胶水粘好卡片。", level: 1, tags: ["object", "craft"], emoji: "GL", packs: ["my-workshop"] },
  { id: "discover", text: "discover", phonetic: "/dɪˈskʌvə/", partOfSpeech: "verb", meaningEn: "find something new", meaningZh: "发现", definitionEn: "To find something you did not know before.", definitionZh: "找到以前不知道的事物。", exampleEn: "We discover a hidden path.", exampleZh: "我们发现了一条隐秘的小路。", level: 2, tags: ["action"], emoji: "DI", packs: ["hidden-paths", "clue-finders"] },
  { id: "brave", text: "brave", phonetic: "/breɪv/", partOfSpeech: "adjective", meaningEn: "ready to face danger", meaningZh: "勇敢的", definitionEn: "Ready to face something difficult.", definitionZh: "勇于面对困难。", exampleEn: "Mia is brave enough to cross.", exampleZh: "米娅勇敢地走了过去。", level: 2, tags: ["abstract", "emotion"], emoji: "BR", packs: ["ready-set-go"] },
  { id: "together", text: "together", phonetic: "/təˈɡeðə/", partOfSpeech: "adverb", meaningEn: "with each other", meaningZh: "一起", definitionEn: "With another person or as a group.", definitionZh: "和别人或一群人在一起。", exampleEn: "We solved it together.", exampleZh: "我们一起解决了它。", level: 2, tags: ["abstract", "teamwork"], emoji: "TO", packs: ["team-up"] },
  { id: "careful", text: "careful", phonetic: "/ˈkeəfəl/", partOfSpeech: "adjective", meaningEn: "avoiding mistakes", meaningZh: "小心的", definitionEn: "Thinking before you act to avoid mistakes.", definitionZh: "行动前认真思考以避免错误。", exampleEn: "Be careful with the glass.", exampleZh: "拿玻璃杯时要小心。", level: 2, tags: ["abstract"], emoji: "CA", packs: ["clue-finders", "ready-set-go"] },
  { id: "portal", text: "portal", phonetic: "/ˈpɔːtəl/", partOfSpeech: "noun", meaningEn: "an entrance", meaningZh: "入口", definitionEn: "An entrance to another place.", definitionZh: "通往另一个地方的入口。", exampleEn: "The portal glows at night.", exampleZh: "入口在夜里发光。", level: 3, tags: ["place"], emoji: "PO", packs: [] },
]

const initialPacks: Pack[] = [
  { id: "my-workshop", topicId: "craft-build", title: "My Workshop", titleZh: "我的工作坊", wordIds: ["box", "paper", "glue"] },
  { id: "build-it", topicId: "craft-build", title: "Build It", titleZh: "动手建造", wordIds: ["box", "careful"] },
  { id: "plans-ideas", topicId: "craft-build", title: "Plans & Ideas", titleZh: "计划与想法", wordIds: ["together", "discover"] },
  { id: "hidden-paths", topicId: "explore-discover", title: "Hidden Paths", titleZh: "隐秘小路", wordIds: ["discover", "portal"] },
  { id: "clue-finders", topicId: "puzzle-mystery", title: "Clue Finders", titleZh: "线索侦探", wordIds: ["discover", "careful"] },
  { id: "old-tracks", topicId: "race-speed", title: "Old Tracks", titleZh: "旧赛道", wordIds: ["careful"], archived: true, archivedAt: "8 Nov 2026" },
]

const tones = [
  "bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]",
  "bg-sky-50 text-[var(--admin-blue)]",
  "bg-[var(--admin-amber-pale)] text-[var(--admin-amber)]",
  "bg-emerald-50 text-[var(--admin-green)]",
  "bg-[var(--admin-coral-pale)] text-[var(--admin-coral)]",
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    topics: <><rect x="3" y="4" width="7" height="7" rx="2" /><rect x="14" y="4" width="7" height="7" rx="2" /><rect x="3" y="15" width="7" height="6" rx="2" /><rect x="14" y="15" width="7" height="6" rx="2" /></>,
    words: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22Z" /></>,
    archive: <><path d="M4 8v12h16V8M3 4h18v4H3Z" /><path d="M9 12h6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10Z" /><path d="m13.5 7 3.5 3.5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    up: <><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>,
    down: <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    grip: <><circle cx="9" cy="7" r="1" /><circle cx="15" cy="7" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="17" r="1" /><circle cx="15" cy="17" r="1" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 14v6h16v-6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></>,
    warning: <><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v4m0 3h.01" /></>,
    restore: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></>,
  }
  return <svg aria-hidden="true" className="shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]" viewBox="0 0 24 24" width={size} height={size}>{paths[name]}</svg>
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[12px_12px_12px_4px] bg-[var(--admin-purple)] text-white shadow-sm"><span className="text-lg leading-none">W</span></span>{!compact && <span className="text-[17px] font-extrabold tracking-[-0.03em]">Words <b className="text-[var(--admin-purple)]">Wizard</b><small className="ml-2 rounded-md bg-[var(--admin-purple-pale)] px-1.5 py-1 align-middle text-[9px] font-black uppercase tracking-wider text-[var(--admin-purple)]">Admin</small></span>}</div>
}

function PrimaryButton({ children, onClick, type = "button", disabled = false }: { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} disabled={disabled} onClick={onClick} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] bg-[var(--admin-purple)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--admin-purple-dark)] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>
}

function SecondaryButton({ children, onClick, danger = false, disabled = false }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] border px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "border-[var(--admin-coral)]/30 bg-[var(--admin-coral-pale)] text-[var(--admin-coral)] hover:border-[var(--admin-coral)]/60" : "border-[var(--admin-line)] bg-white text-[var(--admin-ink)] hover:bg-zinc-50"}`}>{children}</button>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>{eyebrow && <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--admin-purple)]">{eyebrow}</p>}<h1 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--admin-ink)]">{title}</h1>{description && <p className="mt-1.5 text-sm text-[var(--admin-muted)]">{description}</p>}</div>{action}</header>
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5"><span className="text-xs font-bold text-[var(--admin-ink)]">{label}</span>{children}{hint && <small className="text-[10px] text-[var(--admin-muted)]">{hint}</small>}</label>
}

const inputClass = "min-h-11 w-full rounded-[10px] border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] placeholder:text-zinc-400 focus:border-[var(--admin-purple)]"
const textareaClass = `${inputClass} min-h-24 resize-y py-3`

export default function AdminPortal() {
  const [authState, setAuthState] = useState<AuthState>("staff")
  const [screen, setScreen] = useState<Screen>("topics")
  const [topics, setTopics] = useState(initialTopics)
  const [packs, setPacks] = useState(initialPacks)
  const [words, setWords] = useState(initialWords)
  const [selectedTopicId, setSelectedTopicId] = useState("craft-build")
  const [selectedPackId, setSelectedPackId] = useState("my-workshop")
  const [selectedWordId, setSelectedWordId] = useState("box")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [level, setLevel] = useState("all")
  const [archiveTab, setArchiveTab] = useState<"topics" | "packs">("topics")
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [addWordsOpen, setAddWordsOpen] = useState(false)
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])
  const [confirmArchive, setConfirmArchive] = useState<{ type: "topic" | "pack"; id: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [draftWordIds, setDraftWordIds] = useState<string[] | null>(null)

  const selectedTopic = topics.find((item) => item.id === selectedTopicId) ?? topics[0]
  const selectedPack = packs.find((item) => item.id === selectedPackId) ?? packs[0]
  const selectedWord = words.find((item) => item.id === selectedWordId) ?? words[0]
  const activeTopics = topics.filter((item) => !item.archived)
  const currentTopicPacks = packs.filter((item) => item.topicId === selectedTopicId && !item.archived)
  const currentWordIds = draftWordIds ?? selectedPack.wordIds
  const filteredWords = useMemo(() => words.filter((word) => {
    const query = search.toLowerCase()
    const matchesSearch = !query || `${word.text} ${word.meaningZh} ${word.phonetic}`.toLowerCase().includes(query)
    return matchesSearch && (level === "all" || word.level === Number(level))
  }), [level, search, words])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  const navigate = (next: Screen) => {
    setScreen(next)
    setMenuOpen(false)
  }

  const openTopic = (id: string) => {
    setSelectedTopicId(id)
    navigate("packs")
  }

  const openPackContents = (id: string) => {
    const pack = packs.find((item) => item.id === id)
    if (pack) setSelectedTopicId(pack.topicId)
    setSelectedPackId(id)
    setDraftWordIds(null)
    navigate("contents")
  }

  const movePack = (id: string, direction: -1 | 1) => {
    const scoped = currentTopicPacks
    const index = scoped.findIndex((item) => item.id === id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= scoped.length) return
    const ids = scoped.map((item) => item.id)
    ;[ids[index], ids[swapWith]] = [ids[swapWith], ids[index]]
    const others = packs.filter((item) => item.topicId !== selectedTopicId || item.archived)
    setPacks([...others, ...ids.map((packId) => packs.find((item) => item.id === packId)!)])
    notify("Pack order updated")
  }

  const archiveItem = () => {
    if (!confirmArchive) return
    const archivedAt = "12 Nov 2026"
    if (confirmArchive.type === "topic") setTopics((items) => items.map((item) => item.id === confirmArchive.id ? { ...item, archived: true, archivedAt } : item))
    else setPacks((items) => items.map((item) => item.id === confirmArchive.id ? { ...item, archived: true, archivedAt } : item))
    setConfirmArchive(null)
    setScreen("topics")
    notify(`${confirmArchive.type === "topic" ? "Topic" : "Pack"} archived`)
  }

  const restoreItem = (type: "topic" | "pack", id: string) => {
    if (type === "topic") setTopics((items) => items.map((item) => item.id === id ? { ...item, archived: false } : item))
    else setPacks((items) => items.map((item) => item.id === id ? { ...item, archived: false } : item))
    notify(`${type === "topic" ? "Topic" : "Pack"} restored · Undo`)
  }

  const addSelectedWords = () => {
    setDraftWordIds((current) => [...(current ?? selectedPack.wordIds), ...selectedToAdd])
    setSelectedToAdd([])
    setAddWordsOpen(false)
  }

  if (authState !== "staff") {
    return <AuthCard state={authState} onSignIn={() => setAuthState("staff")} onDenied={() => setAuthState("denied")} onSignOut={() => setAuthState("signed-out")} />
  }

  return (
    <div className="min-h-screen bg-[var(--admin-canvas)]">
      {sessionExpired && <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b border-[var(--admin-amber)]/20 bg-[var(--admin-amber-pale)] px-4 py-2.5 text-xs font-semibold text-[var(--admin-amber)] shadow-sm"><Icon name="warning" size={16} /><span>Your session expired. Sign in again to continue.</span><button onClick={() => setSessionExpired(false)} className="rounded-lg bg-white px-3 py-1.5 font-bold shadow-sm">Sign in again</button></div>}

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-[var(--admin-line)] bg-white px-4 py-5 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2"><Brand /><button className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" /></button></div>
        <nav className="mt-8 grid gap-1">
          <SidebarButton active={["topics", "topic-form", "packs", "pack-form", "contents"].includes(screen)} icon="topics" label="Topics" onClick={() => navigate("topics")} />
          <SidebarButton active={["words", "word-form"].includes(screen)} icon="words" label="Words" onClick={() => navigate("words")} />
          <SidebarButton active={screen === "archived"} icon="archive" label="Archived" onClick={() => navigate("archived")} />
        </nav>
        <div className="absolute inset-x-4 bottom-5 rounded-xl border border-[var(--admin-line)] bg-[var(--admin-canvas)] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-muted)]">Changes are live</p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--admin-muted)]">Anything you save appears for learners immediately.</p>
        </div>
      </aside>

      {menuOpen && <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-[var(--admin-ink)]/30 lg:hidden" />}

      <div className="lg:pl-60">
        <header className={`sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--admin-line)] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8 ${sessionExpired ? "mt-10" : ""}`}>
          <div className="flex items-center gap-3"><button className="grid size-9 place-items-center rounded-lg border border-[var(--admin-line)] lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><div className="lg:hidden"><Brand compact /></div><span className="hidden text-xs text-[var(--admin-muted)] sm:block">Vocabulary workspace</span></div>
          <div className="relative"><button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--admin-canvas)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--admin-purple-pale)] text-xs font-black text-[var(--admin-purple)]">LT</span><span className="hidden sm:grid"><b className="text-xs">Lin Tao</b><small className="text-[10px] text-[var(--admin-muted)]">lin.tao@school.org</small></span><Icon name="down" size={14} /></button>{accountOpen && <div className="absolute right-0 top-12 w-56 rounded-xl border border-[var(--admin-line)] bg-white p-1.5 shadow-xl"><button onClick={() => { setSessionExpired(true); setAccountOpen(false) }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--admin-canvas)]">Preview expired session</button><button onClick={() => { setAuthState("denied"); setAccountOpen(false) }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--admin-canvas)]">Preview access denied</button><button onClick={() => setAuthState("signed-out")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--admin-coral)] hover:bg-[var(--admin-coral-pale)]"><Icon name="logout" size={15} />Sign out</button></div>}</div>
        </header>

        <main className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
          {screen === "topics" && <TopicsScreen topics={activeTopics} onNew={() => { setEditingId(null); navigate("topic-form") }} onEdit={(id) => { setEditingId(id); navigate("topic-form") }} onOpen={openTopic} onArchive={(id) => setConfirmArchive({ type: "topic", id })} />}
          {screen === "topic-form" && <TopicForm topic={editingId ? topics.find((item) => item.id === editingId) : undefined} onCancel={() => navigate("topics")} onSave={(topic) => { setTopics((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...topic } : item) : [...items, { ...topic, id: topic.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), packs: 0, words: 0 }]); navigate("topics"); notify(`Topic ${editingId ? "updated" : "created"}`) }} onArchive={editingId ? () => setConfirmArchive({ type: "topic", id: editingId }) : undefined} />}
          {screen === "packs" && <PacksScreen topic={selectedTopic} packs={currentTopicPacks} onBack={() => navigate("topics")} onNew={() => { setEditingId(null); navigate("pack-form") }} onEdit={(id) => { setEditingId(id); navigate("pack-form") }} onContents={openPackContents} onMove={movePack} onArchive={(id) => setConfirmArchive({ type: "pack", id })} />}
          {screen === "pack-form" && <PackForm topic={selectedTopic} pack={editingId ? packs.find((item) => item.id === editingId) : undefined} onCancel={() => navigate("packs")} onSave={(pack) => { setPacks((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...pack } : item) : [...items, { ...pack, id: pack.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), topicId: selectedTopicId, wordIds: [] }]); navigate("packs"); notify(`Pack ${editingId ? "updated" : "created"}`) }} onArchive={editingId ? () => setConfirmArchive({ type: "pack", id: editingId }) : undefined} />}
          {screen === "contents" && <PackContents topic={selectedTopic} pack={selectedPack} wordIds={currentWordIds} words={words} onBack={() => navigate("packs")} onAdd={() => setAddWordsOpen(true)} onRemove={(id) => setDraftWordIds(currentWordIds.filter((wordId) => wordId !== id))} onMove={(id, direction) => { const next = [...currentWordIds]; const index = next.indexOf(id); const target = index + direction; if (target >= 0 && target < next.length) { [next[index], next[target]] = [next[target], next[index]]; setDraftWordIds(next) } }} onSave={() => { setPacks((items) => items.map((item) => item.id === selectedPack.id ? { ...item, wordIds: currentWordIds } : item)); setDraftWordIds(null); notify("Pack contents saved") }} onDiscard={() => setDraftWordIds(null)} changed={draftWordIds !== null} />}
          {screen === "words" && <WordsScreen words={filteredWords} search={search} level={level} onSearch={setSearch} onLevel={setLevel} onNew={() => { setEditingId(null); navigate("word-form") }} onOpen={(id) => { setEditingId(id); setSelectedWordId(id); navigate("word-form") }} />}
          {screen === "word-form" && <WordForm word={editingId ? selectedWord : undefined} onCancel={() => navigate("words")} onSave={(word) => { setWords((items) => editingId ? items.map((item) => item.id === editingId ? { ...item, ...word } : item) : [...items, { ...word, id: word.text.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"), packs: [] }]); navigate("words"); notify(`Word ${editingId ? "updated" : "created"}`) }} />}
          {screen === "archived" && <ArchivedScreen topics={topics.filter((item) => item.archived)} packs={packs.filter((item) => item.archived)} tab={archiveTab} onTab={setArchiveTab} onRestore={restoreItem} />}
        </main>
      </div>

      {addWordsOpen && <AddWordsDialog words={words} existing={currentWordIds} selected={selectedToAdd} onToggle={(id) => setSelectedToAdd((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} onClose={() => { setAddWordsOpen(false); setSelectedToAdd([]) }} onAdd={addSelectedWords} />}
      {confirmArchive && <ConfirmDialog type={confirmArchive.type} onCancel={() => setConfirmArchive(null)} onConfirm={archiveItem} />}
      {toast && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-[var(--admin-line)] bg-white px-4 py-3 text-xs font-bold shadow-xl"><span className="grid size-6 place-items-center rounded-full bg-emerald-50 text-[var(--admin-green)]"><Icon name="check" size={14} /></span>{toast}</div>}
    </div>
  )
}

function SidebarButton({ active, icon, label, onClick }: { active: boolean; icon: IconName; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]" : "text-[var(--admin-muted)] hover:bg-[var(--admin-canvas)] hover:text-[var(--admin-ink)]"}`}><Icon name={icon} /><span>{label}</span></button>
}

function AuthCard({ state, onSignIn, onDenied, onSignOut }: { state: AuthState; onSignIn: () => void; onDenied: () => void; onSignOut: () => void }) {
  const denied = state === "denied"
  return <main className="grid min-h-screen place-items-center bg-[var(--admin-purple-pale)] p-5"><section className="w-full max-w-[430px] rounded-2xl border border-white/80 bg-white p-9 text-center shadow-[0_22px_65px_rgba(48,39,71,0.12)]"><div className="mb-7 flex justify-center"><Brand /></div>{denied ? <><span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--admin-amber-pale)] text-[var(--admin-amber)]"><Icon name="warning" size={25} /></span><h1 className="text-2xl font-extrabold tracking-[-0.03em]">You don&apos;t have access to the admin portal.</h1><p className="mt-3 text-sm leading-6 text-[var(--admin-muted)]">The admin portal is for teachers and administrators. Ask your administrator if you think this is a mistake.</p><p className="my-5 rounded-xl bg-[var(--admin-canvas)] px-3 py-2.5 text-xs font-bold">visitor@school.org</p><SecondaryButton onClick={onSignOut}><Icon name="logout" /> Sign out</SecondaryButton></> : <><h1 className="text-2xl font-extrabold tracking-[-0.03em]">Words Wizard Admin</h1><p className="mt-2 text-sm text-[var(--admin-muted)]">For teachers and administrators.</p><button onClick={onSignIn} className="mt-7 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--admin-purple)] px-4 text-sm font-bold text-white hover:bg-[var(--admin-purple-dark)]"><span className="grid grid-cols-2 gap-0.5"><i className="size-2 bg-white" /><i className="size-2 bg-white/80" /><i className="size-2 bg-white/80" /><i className="size-2 bg-white" /></span>Sign in with Microsoft</button><button onClick={onDenied} className="mt-4 text-[10px] font-semibold text-[var(--admin-muted)] underline underline-offset-4">Preview access-denied state</button></>}</section></main>
}

function TopicsScreen({ topics, onNew, onEdit, onOpen, onArchive }: { topics: Topic[]; onNew: () => void; onEdit: (id: string) => void; onOpen: (id: string) => void; onArchive: (id: string) => void }) {
  return <><PageHeading title="Topics" description="Manage the worlds learners choose from." action={<PrimaryButton onClick={onNew}><Icon name="plus" />New topic</PrimaryButton>} /><div className="grid gap-3">{topics.map((topic, index) => <article key={topic.id} className="grid gap-4 rounded-[15px] border border-[var(--admin-line)] bg-white p-4 shadow-[0_3px_12px_rgba(48,39,71,0.03)] sm:grid-cols-[52px_1fr_auto] sm:items-center"><span className={`grid size-[52px] place-items-center rounded-[13px] text-xs font-black ${tones[index % tones.length]}`}>{topic.icon}</span><div className="min-w-0"><h2 className="text-[15px] font-extrabold">{topic.title}</h2><p className="text-xs text-[var(--admin-muted)]">{topic.titleZh}</p><p className="mt-1 truncate text-xs text-[var(--admin-muted)]">{topic.description}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{topic.packs} packs · {topic.words} words</p></div><div className="flex flex-wrap gap-2 sm:justify-end"><SecondaryButton onClick={() => onEdit(topic.id)}><Icon name="edit" size={15} />Edit</SecondaryButton><SecondaryButton onClick={() => onOpen(topic.id)}>View packs <Icon name="arrow" size={15} /></SecondaryButton><button onClick={() => onArchive(topic.id)} className="px-2 text-xs font-bold text-[var(--admin-coral)]">Archive</button></div></article>)}</div></>
}

function TopicForm({ topic, onCancel, onSave, onArchive }: { topic?: Topic; onCancel: () => void; onSave: (topic: Omit<Topic, "id" | "packs" | "words"> & Partial<Pick<Topic, "id" | "packs" | "words">>) => void; onArchive?: () => void }) {
  const [title, setTitle] = useState(topic?.title ?? "")
  const [titleZh, setTitleZh] = useState(topic?.titleZh ?? "")
  const [icon, setIcon] = useState(topic?.icon ?? "")
  const [description, setDescription] = useState(topic?.description ?? "")
  const [descriptionZh, setDescriptionZh] = useState(topic?.descriptionZh ?? "")
  const [attempted, setAttempted] = useState(false)
  const valid = title.trim() && titleZh.trim() && icon.trim() && description.trim() && descriptionZh.trim()
  return <><PageHeading eyebrow="Topics" title={topic ? `Edit ${topic.title}` : "New topic"} description="Changes are live as soon as you save." /><form onSubmit={(event) => { event.preventDefault(); setAttempted(true); if (valid) onSave({ title, titleZh, icon, description, descriptionZh }) }} className="mx-auto max-w-[720px]"><section className="grid gap-5 rounded-[15px] border border-[var(--admin-line)] bg-white p-5 sm:p-6">{attempted && !valid && <div className="rounded-xl border border-[var(--admin-coral)]/20 bg-[var(--admin-coral-pale)] px-4 py-3 text-xs font-bold text-[var(--admin-coral)]">Check the highlighted fields.</div>}<div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]"><Field label="English title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Craft & Build" /></Field><Field label="Chinese title"><input className={inputClass} value={titleZh} onChange={(e) => setTitleZh(e.target.value)} placeholder="手工与建造" /></Field><Field label="Icon" hint="Short symbol"><input className={inputClass} value={icon} maxLength={2} onChange={(e) => setIcon(e.target.value.toUpperCase())} placeholder="CB" /></Field></div><Field label="English description"><textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field><Field label="Chinese description"><textarea className={textareaClass} value={descriptionZh} onChange={(e) => setDescriptionZh(e.target.value)} /></Field>{topic && <Field label="Id" hint="Generated · read only"><input readOnly className={`${inputClass} font-mono text-xs text-[var(--admin-muted)]`} value={topic.id} /></Field>}<div className="flex justify-end gap-2 border-t border-[var(--admin-line)] pt-5"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton type="submit">Save topic</PrimaryButton></div></section>{onArchive && <section className="mt-5 rounded-[15px] border border-[var(--admin-coral)]/20 bg-white p-5"><h2 className="text-sm font-extrabold text-[var(--admin-coral)]">Archive topic</h2><p className="mt-1 mb-4 text-xs leading-5 text-[var(--admin-muted)]">Archived topics and their packs are hidden from children. You can restore them from the Archived view.</p><SecondaryButton danger onClick={onArchive}>Archive topic</SecondaryButton></section>}</form></>
}

function PacksScreen({ topic, packs, onBack, onNew, onEdit, onContents, onMove, onArchive }: { topic: Topic; packs: Pack[]; onBack: () => void; onNew: () => void; onEdit: (id: string) => void; onContents: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onArchive: (id: string) => void }) {
  return <><button onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-bold text-[var(--admin-purple)]">Topics <Icon name="chevron" size={13} /> {topic.title}</button><PageHeading title={topic.title} description={`${topic.titleZh} · Packs in curated order`} action={<PrimaryButton onClick={onNew}><Icon name="plus" />New pack</PrimaryButton>} /><div className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">{packs.map((pack, index) => <div key={pack.id} className="grid min-h-[72px] grid-cols-[36px_1fr] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-0 md:grid-cols-[36px_1fr_90px_auto]"><b className="text-sm text-zinc-400">{String(index + 1).padStart(2, "0")}</b><div><h3 className="text-sm font-extrabold">{pack.title}</h3><p className="text-[11px] text-[var(--admin-muted)]">{pack.titleZh}</p></div><span className="hidden text-xs text-[var(--admin-muted)] md:block">{pack.wordIds.length} words</span><div className="col-span-2 flex flex-wrap items-center justify-end gap-1 md:col-span-1"><button disabled={index === 0} onClick={() => onMove(pack.id, -1)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--admin-canvas)] disabled:opacity-25" aria-label="Move up"><Icon name="up" size={15} /></button><button disabled={index === packs.length - 1} onClick={() => onMove(pack.id, 1)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--admin-canvas)] disabled:opacity-25" aria-label="Move down"><Icon name="down" size={15} /></button><button onClick={() => onEdit(pack.id)} className="rounded-lg px-2 py-2 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)]">Edit</button><button onClick={() => onContents(pack.id)} className="rounded-lg px-2 py-2 text-xs font-bold text-[var(--admin-purple)] hover:bg-[var(--admin-purple-pale)]">Contents</button><button onClick={() => onArchive(pack.id)} className="rounded-lg px-2 py-2 text-xs font-bold text-[var(--admin-coral)] hover:bg-[var(--admin-coral-pale)]">Archive</button></div></div>)}</div></>
}

function PackForm({ topic, pack, onCancel, onSave, onArchive }: { topic: Topic; pack?: Pack; onCancel: () => void; onSave: (pack: Omit<Pack, "id" | "topicId" | "wordIds"> & Partial<Pick<Pack, "id" | "topicId" | "wordIds">>) => void; onArchive?: () => void }) {
  const [title, setTitle] = useState(pack?.title ?? "")
  const [titleZh, setTitleZh] = useState(pack?.titleZh ?? "")
  return <><PageHeading eyebrow={`Topics / ${topic.title}`} title={pack ? `Edit ${pack.title}` : "New pack"} description="Changes are live as soon as you save." /><form onSubmit={(e) => { e.preventDefault(); if (title && titleZh) onSave({ title, titleZh }) }} className="mx-auto max-w-[720px]"><section className="grid gap-5 rounded-[15px] border border-[var(--admin-line)] bg-white p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="English title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Chinese title"><input className={inputClass} value={titleZh} onChange={(e) => setTitleZh(e.target.value)} /></Field></div><Field label="Topic" hint="A pack cannot move to another topic"><input readOnly className={`${inputClass} text-[var(--admin-muted)]`} value={topic.title} /></Field>{pack && <Field label="Id" hint="Generated · read only"><input readOnly className={`${inputClass} font-mono text-xs text-[var(--admin-muted)]`} value={pack.id} /></Field>}<div className="flex justify-end gap-2 border-t border-[var(--admin-line)] pt-5"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton type="submit">Save pack</PrimaryButton></div></section>{onArchive && <section className="mt-5 rounded-[15px] border border-[var(--admin-coral)]/20 bg-white p-5"><h2 className="text-sm font-extrabold text-[var(--admin-coral)]">Archive pack</h2><p className="mt-1 mb-4 text-xs text-[var(--admin-muted)]">Archived packs are hidden from children. The words stay in the word library.</p><SecondaryButton danger onClick={onArchive}>Archive pack</SecondaryButton></section>}</form></>
}

function PackContents({ topic, pack, wordIds, words, changed, onBack, onAdd, onRemove, onMove, onSave, onDiscard }: { topic: Topic; pack: Pack; wordIds: string[]; words: Word[]; changed: boolean; onBack: () => void; onAdd: () => void; onRemove: (id: string) => void; onMove: (id: string, direction: -1 | 1) => void; onSave: () => void; onDiscard: () => void }) {
  const selectedWords = wordIds.map((id) => words.find((word) => word.id === id)).filter(Boolean) as Word[]
  return <div className={changed ? "pb-24" : ""}><button onClick={onBack} className="mb-4 flex items-center gap-1 text-xs font-bold text-[var(--admin-purple)]">Topics <Icon name="chevron" size={13} /> {topic.title} <Icon name="chevron" size={13} /> {pack.title}</button><PageHeading title={pack.title} description="Choose which words learners see, and arrange their order." action={<PrimaryButton onClick={onAdd}><Icon name="plus" />Add words</PrimaryButton>} />{selectedWords.length < 5 && <div className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--admin-amber-pale)] px-4 py-3 text-xs font-semibold text-[var(--admin-amber)]"><Icon name="warning" size={16} />Packs usually hold at least 5 words.</div>}<div className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">{selectedWords.map((word, index) => <div key={word.id} className="grid min-h-[66px] grid-cols-[28px_42px_1fr_auto] items-center gap-3 border-b border-[var(--admin-line)] px-3 py-2 last:border-0 sm:grid-cols-[28px_36px_42px_1fr_120px_70px_auto]"><Icon name="grip" size={16} /><b className="hidden text-xs text-zinc-400 sm:block">{String(index + 1).padStart(2, "0")}</b><span className="grid size-10 place-items-center rounded-xl bg-[var(--admin-purple-pale)] text-[10px] font-black text-[var(--admin-purple)]">{word.emoji}</span><div><h3 className="text-sm font-extrabold">{word.text}</h3><p className="text-[10px] text-[var(--admin-muted)]">{word.phonetic}</p></div><span className="hidden text-xs text-[var(--admin-muted)] sm:block">{word.meaningZh}</span><span className="hidden w-fit rounded-lg bg-sky-50 px-2 py-1 text-[9px] font-black text-[var(--admin-blue)] sm:block">LEVEL {word.level}</span><div className="flex items-center"><button disabled={index === 0} onClick={() => onMove(word.id, -1)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--admin-canvas)] disabled:opacity-20"><Icon name="up" size={14} /></button><button disabled={index === selectedWords.length - 1} onClick={() => onMove(word.id, 1)} className="grid size-8 place-items-center rounded-lg hover:bg-[var(--admin-canvas)] disabled:opacity-20"><Icon name="down" size={14} /></button><button onClick={() => onRemove(word.id)} className="grid size-8 place-items-center rounded-lg text-[var(--admin-coral)] hover:bg-[var(--admin-coral-pale)]" aria-label={`Remove ${word.text}`}><Icon name="close" size={15} /></button></div></div>)}</div>{changed && <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t border-[var(--admin-line)] bg-white/95 px-5 py-3 shadow-[0_-8px_24px_rgba(48,39,71,0.08)] backdrop-blur lg:left-60"><span className="mr-auto hidden text-xs font-semibold text-[var(--admin-amber)] sm:block">You have unsaved changes</span><SecondaryButton onClick={onDiscard}>Discard changes</SecondaryButton><PrimaryButton onClick={onSave}>Save changes</PrimaryButton></div>}</div>
}

function WordsScreen({ words, search, level, onSearch, onLevel, onNew, onOpen }: { words: Word[]; search: string; level: string; onSearch: (value: string) => void; onLevel: (value: string) => void; onNew: () => void; onOpen: (id: string) => void }) {
  return <><PageHeading title="Words" description="Shared master vocabulary used across every pack." action={<PrimaryButton onClick={onNew}><Icon name="plus" />New word</PrimaryButton>} /><div className="mb-4 flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-muted)]"><Icon name="search" size={17} /></span><input value={search} onChange={(e) => onSearch(e.target.value)} className={`${inputClass} pl-10`} placeholder="Search English, Chinese, or phonetic" /></label><select value={level} onChange={(e) => onLevel(e.target.value)} className={`${inputClass} sm:w-40`}><option value="all">All levels</option><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></div><div className="admin-scrollbar overflow-x-auto rounded-[15px] border border-[var(--admin-line)] bg-white"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-[var(--admin-line)] bg-[var(--admin-canvas)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-muted)]"><th className="px-4 py-3">Word</th><th className="px-4 py-3">Chinese meaning</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Usage</th><th className="w-16 px-4 py-3" /></tr></thead><tbody>{words.map((word) => <tr key={word.id} onClick={() => onOpen(word.id)} className="cursor-pointer border-b border-[var(--admin-line)] last:border-0 hover:bg-[var(--admin-purple-pale)]/35"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--admin-purple-pale)] text-[10px] font-black text-[var(--admin-purple)]">{word.emoji}</span><span><b className="block text-sm">{word.text}</b><small className="text-[10px] text-[var(--admin-muted)]">{word.phonetic} · {word.partOfSpeech}</small></span></div></td><td className="px-4 py-3 text-xs">{word.meaningZh}</td><td className="px-4 py-3"><span className="rounded-lg bg-sky-50 px-2 py-1 text-[9px] font-black text-[var(--admin-blue)]">LEVEL {word.level}</span></td><td className="px-4 py-3">{word.packs.length ? <span className="text-xs text-[var(--admin-muted)]">Used in {word.packs.length} {word.packs.length === 1 ? "pack" : "packs"}</span> : <span className="rounded-lg bg-zinc-100 px-2 py-1.5 text-[9px] font-bold text-zinc-500">Not in any pack · hidden</span>}</td><td className="px-4 py-3 text-[var(--admin-purple)]"><Icon name="chevron" size={16} /></td></tr>)}</tbody></table>{!words.length && <div className="p-12 text-center"><p className="text-sm font-bold">No words match “{search}”.</p><p className="mt-1 text-xs text-[var(--admin-muted)]">Try a different word or level.</p></div>}</div></>
}

function WordForm({ word, onCancel, onSave }: { word?: Word; onCancel: () => void; onSave: (word: Omit<Word, "id" | "packs"> & Partial<Pick<Word, "id" | "packs">>) => void }) {
  const [form, setForm] = useState<Omit<Word, "id" | "packs">>({ text: word?.text ?? "", phonetic: word?.phonetic ?? "", partOfSpeech: word?.partOfSpeech ?? "", meaningEn: word?.meaningEn ?? "", meaningZh: word?.meaningZh ?? "", definitionEn: word?.definitionEn ?? "", definitionZh: word?.definitionZh ?? "", exampleEn: word?.exampleEn ?? "", exampleZh: word?.exampleZh ?? "", level: word?.level ?? 1, tags: word?.tags ?? [], emoji: word?.emoji ?? "" })
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }))
  const warning = form.text && form.exampleEn && !form.exampleEn.toLowerCase().includes(form.text.toLowerCase())
  return <><PageHeading eyebrow="Words" title={word ? `Edit ${word.text}` : "New word"} description="Changes are live as soon as you save." /><form onSubmit={(e) => { e.preventDefault(); if (form.text && form.phonetic && form.meaningEn && form.meaningZh) onSave(form) }} className="mx-auto grid max-w-[880px] gap-4">{warning && <div className="flex gap-3 rounded-[13px] border border-[var(--admin-amber)]/20 bg-[var(--admin-amber-pale)] p-4 text-xs text-[var(--admin-amber)]"><Icon name="warning" size={17} /><span><b className="block">Editorial warning</b>The first example doesn&apos;t contain the headword “{form.text}”. You can still save.</span></div>}<FormCard title="Basics"><div className="grid gap-4 sm:grid-cols-3"><Field label="English headword"><input className={inputClass} value={form.text} onChange={(e) => update("text", e.target.value)} /></Field><Field label="Phonetic"><input className={inputClass} value={form.phonetic} onChange={(e) => update("phonetic", e.target.value)} placeholder="/bɒks/" /></Field><Field label="Part of speech"><input className={inputClass} value={form.partOfSpeech} onChange={(e) => update("partOfSpeech", e.target.value)} /></Field></div>{word && <Field label="Id" hint="Generated · read only"><input readOnly className={`${inputClass} font-mono text-xs text-[var(--admin-muted)]`} value={word.id} /></Field>}</FormCard><FormCard title="Meanings & definitions"><div className="grid gap-4 sm:grid-cols-2"><Field label="English meaning"><input className={inputClass} value={form.meaningEn} onChange={(e) => update("meaningEn", e.target.value)} /></Field><Field label="Chinese meaning"><input className={inputClass} value={form.meaningZh} onChange={(e) => update("meaningZh", e.target.value)} /></Field><Field label="English definition"><textarea className={textareaClass} value={form.definitionEn} onChange={(e) => update("definitionEn", e.target.value)} /></Field><Field label="Chinese definition"><textarea className={textareaClass} value={form.definitionZh} onChange={(e) => update("definitionZh", e.target.value)} /></Field></div></FormCard><FormCard title="Examples"><div className="grid gap-4 sm:grid-cols-2"><Field label="English sentence"><textarea className={textareaClass} value={form.exampleEn} onChange={(e) => update("exampleEn", e.target.value)} /></Field><Field label="Chinese translation"><textarea className={textareaClass} value={form.exampleZh} onChange={(e) => update("exampleZh", e.target.value)} /></Field></div><button type="button" className="w-fit text-xs font-bold text-[var(--admin-purple)]">+ Add example</button></FormCard><FormCard title="Classification"><div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]"><Field label="Level"><div className="grid h-11 grid-cols-3 rounded-[10px] bg-[var(--admin-canvas)] p-1">{([1, 2, 3] as const).map((item) => <button type="button" key={item} onClick={() => update("level", item)} className={`rounded-lg text-xs font-black ${form.level === item ? "bg-white text-[var(--admin-purple)] shadow-sm" : "text-[var(--admin-muted)]"}`}>{item}</button>)}</div></Field><Field label="Tags" hint="Separate tags with commas"><input className={inputClass} value={form.tags.join(", ")} onChange={(e) => update("tags", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></Field><Field label="Icon tile"><input className={inputClass} maxLength={2} value={form.emoji} onChange={(e) => update("emoji", e.target.value.toUpperCase())} /></Field></div></FormCard><FormCard title="Image"><div className="grid min-h-40 place-items-center rounded-xl border-2 border-dashed border-[var(--admin-line)] bg-[var(--admin-canvas)] p-6 text-center"><span className="mb-2 grid size-11 place-items-center rounded-xl bg-white text-[var(--admin-purple)]"><Icon name="upload" /></span><b className="text-xs">Upload an image</b><p className="mt-1 text-[10px] text-[var(--admin-muted)]">PNG, JPEG, or WebP · up to 2 MB</p><button type="button" className="mt-3 text-xs font-bold text-[var(--admin-purple)]">Choose file</button></div></FormCard><div className="sticky bottom-3 flex justify-end gap-2 rounded-xl border border-[var(--admin-line)] bg-white/95 p-3 shadow-lg backdrop-blur"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton type="submit">Save word</PrimaryButton></div></form></>
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid gap-5 rounded-[15px] border border-[var(--admin-line)] bg-white p-5 sm:p-6"><h2 className="border-b border-[var(--admin-line)] pb-3 text-sm font-extrabold">{title}</h2>{children}</section>
}

function ArchivedScreen({ topics, packs, tab, onTab, onRestore }: { topics: Topic[]; packs: Pack[]; tab: "topics" | "packs"; onTab: (tab: "topics" | "packs") => void; onRestore: (type: "topic" | "pack", id: string) => void }) {
  const items = tab === "topics" ? topics : packs
  return <><PageHeading title="Archived" description="Archived items are hidden from children. Restoring makes them visible again immediately." /><div className="mb-4 flex w-fit rounded-xl bg-zinc-200/60 p-1"><button onClick={() => onTab("topics")} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === "topics" ? "bg-white text-[var(--admin-purple)] shadow-sm" : "text-[var(--admin-muted)]"}`}>Topics <span className="ml-1 text-[10px]">{topics.length}</span></button><button onClick={() => onTab("packs")} className={`rounded-lg px-4 py-2 text-xs font-bold ${tab === "packs" ? "bg-white text-[var(--admin-purple)] shadow-sm" : "text-[var(--admin-muted)]"}`}>Packs <span className="ml-1 text-[10px]">{packs.length}</span></button></div><div className="overflow-hidden rounded-[15px] border border-[var(--admin-line)] bg-white">{items.length ? items.map((item) => <div key={item.id} className="grid min-h-[68px] grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--admin-line)] px-4 py-3 last:border-0"><div><b className="block text-sm">{item.title}</b><span className="text-xs text-[var(--admin-muted)]">{item.titleZh}</span>{tab === "packs" && <small className="ml-3 text-[10px] text-zinc-400">from {topics.find((topic) => topic.id === (item as Pack).topicId)?.title ?? "Race & Speed"}</small>}<p className="mt-1 text-[10px] text-zinc-400">Archived {item.archivedAt}</p></div><SecondaryButton onClick={() => onRestore(tab === "topics" ? "topic" : "pack", item.id)}><Icon name="restore" size={15} />Restore</SecondaryButton></div>) : <div className="p-14 text-center"><span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-[var(--admin-purple-pale)] text-[var(--admin-purple)]"><Icon name="archive" /></span><b className="text-sm">Nothing is archived.</b></div>}</div></>
}

function AddWordsDialog({ words, existing, selected, onToggle, onClose, onAdd }: { words: Word[]; existing: string[]; selected: string[]; onToggle: (id: string) => void; onClose: () => void; onAdd: () => void }) {
  const [query, setQuery] = useState("")
  const visible = words.filter((word) => `${word.text} ${word.meaningZh}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--admin-ink)]/40 p-4 backdrop-blur-[2px]"><section className="flex max-h-[80vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-[var(--admin-line)] p-5"><div><h2 className="text-lg font-extrabold">Add words</h2><p className="text-xs text-[var(--admin-muted)]">Choose one or more words from the library.</p></div><button onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--admin-canvas)]"><Icon name="close" /></button></header><div className="p-4"><label className="relative block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-muted)]"><Icon name="search" size={17} /></span><input autoFocus className={`${inputClass} pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search English or Chinese" /></label></div><div className="admin-scrollbar flex-1 overflow-y-auto border-y border-[var(--admin-line)]">{visible.map((word) => { const already = existing.includes(word.id); const checked = selected.includes(word.id); return <label key={word.id} className={`flex items-center gap-3 border-b border-[var(--admin-line)] px-5 py-3 last:border-0 ${already ? "opacity-45" : "cursor-pointer hover:bg-[var(--admin-canvas)]"}`}><input type="checkbox" disabled={already} checked={already || checked} onChange={() => onToggle(word.id)} className="size-4 accent-[var(--admin-purple)]" /><span className="grid size-9 place-items-center rounded-lg bg-[var(--admin-purple-pale)] text-[9px] font-black text-[var(--admin-purple)]">{word.emoji}</span><span className="flex-1"><b className="block text-sm">{word.text}</b><small className="text-[10px] text-[var(--admin-muted)]">{word.phonetic}</small></span><span className="text-xs">{word.meaningZh}</span>{already && <small className="text-[9px] font-bold text-[var(--admin-muted)]">Already added</small>}</label>})}</div><footer className="flex items-center justify-between p-4"><span className="text-xs text-[var(--admin-muted)]">{selected.length} selected</span><div className="flex gap-2"><SecondaryButton onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={!selected.length} onClick={onAdd}>Add selected</PrimaryButton></div></footer></section></div>
}

function ConfirmDialog({ type, onCancel, onConfirm }: { type: "topic" | "pack"; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--admin-ink)]/40 p-4 backdrop-blur-[2px]"><section className="w-full max-w-[430px] rounded-2xl bg-white p-6 shadow-2xl"><span className="grid size-11 place-items-center rounded-xl bg-[var(--admin-coral-pale)] text-[var(--admin-coral)]"><Icon name="archive" /></span><h2 className="mt-4 text-lg font-extrabold">Archive this {type}?</h2><p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{type === "topic" ? "The topic and its packs will be hidden from children. Learning history stays intact." : "The pack will be hidden from children. Its words remain in the word library."}</p><div className="mt-6 flex justify-end gap-2"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><SecondaryButton danger onClick={onConfirm}>Archive {type}</SecondaryButton></div></section></div>
}
