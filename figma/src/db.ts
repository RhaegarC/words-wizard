import Dexie, { type EntityTable } from "dexie";

export interface Profile {
  id?: number;
  name: string;
  characterName: string;
  avatar: string;
  xp: number;
  streak: number;
  careTokens: number;
  learnedCount: number;
  createdAt: number;
  lastPracticeAt: number;
}

class WordsWizardDB extends Dexie {
  profiles!: EntityTable<Profile, "id">;

  constructor() {
    super("WordsWizardDB");
    this.version(1).stores({ profiles: "++id, name, createdAt" });
  }
}

export const db = new WordsWizardDB();
