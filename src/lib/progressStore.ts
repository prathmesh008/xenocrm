interface CampaignProgress {
  sent: number;
  failed: number;
  total: number;
  done: boolean;
}

// Use globalThis so the same Map instance is shared across
// all route handlers regardless of module caching
declare global {
  var __progressStore: Map<string, CampaignProgress> | undefined;
}

if (!globalThis.__progressStore) {
  globalThis.__progressStore = new Map<string, CampaignProgress>();
}

export const progressStore = globalThis.__progressStore;