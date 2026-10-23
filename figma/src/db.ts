import Dexie, { type EntityTable } from "dexie";

export interface Profile {
  id?: number;
  name: string;
  characterName: string;
  avatar: string;
  currentTopicId: string | null;
  locale: "en" | "zh";
  xp: number;
  streakCount: number;
  bestStreak: number;
  careTokens: number;
  sessionsSinceLastToken: number;
  completedSessions: number;
  learnedCount: number;
  createdAt: number;
  lastPracticeAt: number;
  lastWakeAt: number | null;
  frozenDays: number;
  lastMonthlyReviewAt: number | null;
}

class WordsWizardDB extends Dexie {
  profiles!: EntityTable<Profile, "id">;

  constructor() {
    super("WordsWizardDB");
    this.version(1).stores({ profiles: "++id, name, createdAt" });
    this.version(2).stores({
      profiles: "++id, name, createdAt",
      progress: "++id, profileId, wordId, status, nextReviewAt, &[profileId+wordId]",
      metrics: "++id, profileId, name, updatedAt",
      device: "key",
    });
  }
}

const globalDatabase = globalThis as typeof globalThis & {
  wordsWizardDatabase?: WordsWizardDB;
};

// Reuse the same connection across Vite hot reloads. Creating a second Dexie
// instance during HMR can otherwise make the old connection block an upgrade.
export const db = globalDatabase.wordsWizardDatabase ?? new WordsWizardDB();
globalDatabase.wordsWizardDatabase = db;

// Another tab may load a newer app version while this one is still open.
// Closing here lets its schema upgrade continue without Dexie's default warning.
db.on("versionchange", () => {
  db.close();
});
