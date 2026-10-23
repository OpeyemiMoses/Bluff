import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { MarketEvent, ForecasterProfile, Wager, WalrusMemoryRecord } from '../types/index.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(path.join(DB_DIR, 'bluff.db'));

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    outcomes TEXT NOT NULL,
    outcome_probabilities TEXT NOT NULL,
    live_score TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    winner_outcome TEXT,
    ends_at TEXT,
    source_url TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forecasters (
    id TEXT PRIMARY KEY,
    label TEXT,
    brier_score REAL NOT NULL DEFAULT 0.5,
    total_wagers INTEGER NOT NULL DEFAULT 0,
    won_wagers INTEGER NOT NULL DEFAULT 0,
    lost_wagers INTEGER NOT NULL DEFAULT 0,
    reputation_multiplier REAL NOT NULL DEFAULT 1.0,
    last_memory_summary TEXT,
    last_active TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wagers (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    forecaster_id TEXT NOT NULL,
    pick TEXT NOT NULL,
    implied_prob REAL NOT NULL,
    stake_sui REAL NOT NULL,
    payout_sui REAL NOT NULL,
    payment_status TEXT NOT NULL,
    wager_status TEXT NOT NULL DEFAULT 'pending',
    payment_signature TEXT,
    tx_digest TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(forecaster_id) REFERENCES forecasters(id)
  );

  CREATE TABLE IF NOT EXISTS walrus_memories (
    id TEXT PRIMARY KEY,
    forecaster_id TEXT NOT NULL,
    category TEXT NOT NULL,
    memory_text TEXT NOT NULL,
    brier_delta REAL NOT NULL DEFAULT 0,
    walrus_job_id TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY(forecaster_id) REFERENCES forecasters(id)
  );
`);

export const dbService = {
  // Events
  upsertEvent(event: MarketEvent) {
    const stmt = db.prepare(`
      INSERT INTO events (id, source, category, title, description, outcomes, outcome_probabilities, live_score, status, winner_outcome, ends_at, source_url, updated_at)
      VALUES (@id, @source, @category, @title, @description, @outcomes, @outcomeProbabilities, @liveScore, @status, @winnerOutcome, @endsAt, @sourceUrl, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        outcome_probabilities = excluded.outcome_probabilities,
        live_score = excluded.live_score,
        status = excluded.status,
        winner_outcome = excluded.winner_outcome,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: event.id,
      source: event.source,
      category: event.category,
      title: event.title,
      description: event.description,
      outcomes: JSON.stringify(event.outcomes),
      outcomeProbabilities: JSON.stringify(event.outcomeProbabilities),
      liveScore: event.liveScore || null,
      status: event.status,
      winnerOutcome: event.winnerOutcome || null,
      endsAt: event.endsAt || null,
      sourceUrl: event.sourceUrl || null,
      updatedAt: event.updatedAt
    });
  },

  getEvent(id: string): MarketEvent | null {
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      source: row.source,
      category: row.category,
      title: row.title,
      description: row.description,
      outcomes: JSON.parse(row.outcomes),
      outcomeProbabilities: JSON.parse(row.outcome_probabilities),
      liveScore: row.live_score,
      status: row.status,
      winnerOutcome: row.winner_outcome,
      endsAt: row.ends_at,
      sourceUrl: row.source_url,
      updatedAt: row.updated_at
    };
  },

  listEvents(limit = 20): MarketEvent[] {
    const rows = db.prepare('SELECT * FROM events ORDER BY updated_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => ({
      id: row.id,
      source: row.source,
      category: row.category,
      title: row.title,
      description: row.description,
      outcomes: JSON.parse(row.outcomes),
      outcomeProbabilities: JSON.parse(row.outcome_probabilities),
      liveScore: row.live_score,
      status: row.status,
      winnerOutcome: row.winner_outcome,
      endsAt: row.ends_at,
      sourceUrl: row.source_url,
      updatedAt: row.updated_at
    }));
  },

  // Forecasters
  getOrCreateForecaster(id: string, label?: string): ForecasterProfile {
    const existing = db.prepare('SELECT * FROM forecasters WHERE id = ?').get(id) as any;
    const now = new Date().toISOString();
    if (existing) {
      return {
        id: existing.id,
        label: existing.label,
        brierScore: existing.brier_score,
        totalWagers: existing.total_wagers,
        wonWagers: existing.won_wagers,
        lostWagers: existing.lost_wagers,
        reputationMultiplier: existing.reputation_multiplier,
        lastMemorySummary: existing.last_memory_summary,
        lastActive: existing.last_active
      };
    }

    const defaultProfile: ForecasterProfile = {
      id,
      label: label || `Forecaster-${id.slice(0, 6)}`,
      brierScore: 0.5,
      totalWagers: 0,
      wonWagers: 0,
      lostWagers: 0,
      reputationMultiplier: 1.0,
      lastActive: now
    };

    db.prepare(`
      INSERT INTO forecasters (id, label, brier_score, total_wagers, won_wagers, lost_wagers, reputation_multiplier, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultProfile.id,
      defaultProfile.label,
      defaultProfile.brierScore,
      defaultProfile.totalWagers,
      defaultProfile.wonWagers,
      defaultProfile.lostWagers,
      defaultProfile.reputationMultiplier,
      defaultProfile.lastActive
    );

    return defaultProfile;
  },

  updateForecasterCalibration(id: string, won: boolean, confidence: number, memorySummary: string) {
    const forecaster = this.getOrCreateForecaster(id);
    const newTotal = forecaster.totalWagers + 1;
    const newWon = forecaster.wonWagers + (won ? 1 : 0);
    const newLost = forecaster.lostWagers + (won ? 0 : 1);

    // Brier Score calculation for binary: (probability - actual)^2
    // actual = 1 if won, 0 if lost
    const actual = won ? 1 : 0;
    const currentWagerBrier = Math.pow(confidence - actual, 2);
    // Cumulative average Brier score (0.0 is clairvoyant, 1.0 is totally wrong)
    const newBrier = ((forecaster.brierScore * forecaster.totalWagers) + currentWagerBrier) / newTotal;

    // Reputation multiplier:
    // Low brier score (close to 0) -> high reputation (> 1.5x, up to 3.0x)
    // High brier score (close to 1.0) -> negative reputation (< 0.5x, bluffers get faded!)
    let reputationMultiplier = 1.0;
    if (newBrier < 0.2) {
      reputationMultiplier = 2.5; // Expert / Sharp
    } else if (newBrier < 0.35) {
      reputationMultiplier = 1.5; // Solid
    } else if (newBrier > 0.65) {
      reputationMultiplier = 0.3; // Chronic Bluffer (auto-fade)
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE forecasters SET
        brier_score = ?,
        total_wagers = ?,
        won_wagers = ?,
        lost_wagers = ?,
        reputation_multiplier = ?,
        last_memory_summary = ?,
        last_active = ?
      WHERE id = ?
    `).run(
      newBrier,
      newTotal,
      newWon,
      newLost,
      reputationMultiplier,
      memorySummary,
      now,
      id
    );

    return this.getOrCreateForecaster(id);
  },

  // Wagers
  createWager(wager: Wager) {
    db.prepare(`
      INSERT INTO wagers (id, event_id, forecaster_id, pick, implied_prob, stake_sui, payout_sui, payment_status, wager_status, payment_signature, tx_digest, created_at)
      VALUES (@id, @eventId, @forecasterId, @pick, @impliedProb, @stakeSui, @payoutSui, @paymentStatus, @wagerStatus, @paymentSignature, @txDigest, @createdAt)
    `).run({
      id: wager.id,
      eventId: wager.eventId,
      forecasterId: wager.forecasterId,
      pick: wager.pick,
      impliedProb: wager.impliedProb,
      stakeSui: wager.stakeSui,
      payoutSui: wager.payoutSui,
      paymentStatus: wager.paymentStatus,
      wagerStatus: wager.wagerStatus,
      paymentSignature: wager.paymentSignature || null,
      txDigest: wager.txDigest || null,
      createdAt: wager.createdAt
    });
  },

  settleWagerPayment(wagerId: string, txDigest: string, signature: string) {
    db.prepare(`
      UPDATE wagers SET
        payment_status = 'paid_settled',
        tx_digest = ?,
        payment_signature = ?
      WHERE id = ?
    `).run(txDigest, signature, wagerId);
  },

  getWager(id: string): Wager | null {
    const row = db.prepare('SELECT * FROM wagers WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      eventId: row.event_id,
      forecasterId: row.forecaster_id,
      pick: row.pick,
      impliedProb: row.implied_prob,
      stakeSui: row.stake_sui,
      payoutSui: row.payout_sui,
      paymentStatus: row.payment_status,
      wagerStatus: row.wager_status,
      paymentSignature: row.payment_signature,
      txDigest: row.tx_digest,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    };
  },

  listWagersForEvent(eventId: string): Wager[] {
    const rows = db.prepare('SELECT * FROM wagers WHERE event_id = ?').all(eventId) as any[];
    return rows.map(row => ({
      id: row.id,
      eventId: row.event_id,
      forecasterId: row.forecaster_id,
      pick: row.pick,
      impliedProb: row.implied_prob,
      stakeSui: row.stake_sui,
      payoutSui: row.payout_sui,
      paymentStatus: row.payment_status,
      wagerStatus: row.wager_status,
      paymentSignature: row.payment_signature,
      txDigest: row.tx_digest,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at
    }));
  },

  // Walrus Memories Log
  logWalrusMemory(record: WalrusMemoryRecord) {
    db.prepare(`
      INSERT INTO walrus_memories (id, forecaster_id, category, memory_text, brier_delta, walrus_job_id, timestamp)
      VALUES (@id, @forecasterId, @category, @memoryText, @brierDelta, @walrusJobId, @timestamp)
    `).run({
      id: record.id,
      forecasterId: record.forecasterId,
      category: record.category,
      memoryText: record.memoryText,
      brierDelta: record.brierDelta,
      walrusJobId: record.walrusJobId || null,
      timestamp: record.timestamp
    });
  },

  listWalrusMemories(forecasterId?: string, limit = 50): WalrusMemoryRecord[] {
    if (forecasterId) {
      const rows = db.prepare('SELECT * FROM walrus_memories WHERE forecaster_id = ? ORDER BY timestamp DESC LIMIT ?').all(forecasterId, limit) as any[];
      return rows.map(r => ({
        id: r.id,
        forecasterId: r.forecaster_id,
        category: r.category,
        memoryText: r.memory_text,
        brierDelta: r.brier_delta,
        walrusJobId: r.walrus_job_id,
        timestamp: r.timestamp
      }));
    }
    const rows = db.prepare('SELECT * FROM walrus_memories ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      forecasterId: r.forecaster_id,
      category: r.category,
      memoryText: r.memory_text,
      brierDelta: r.brier_delta,
      walrusJobId: r.walrus_job_id,
      timestamp: r.timestamp
    }));
  }
};
