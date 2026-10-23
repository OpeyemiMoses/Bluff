import { MemWal } from '@mysten-incubation/memwal';
import { generateDelegateKey } from '@mysten-incubation/memwal/account';
import { dbService } from '../db/database.js';
import dotenv from 'dotenv';
dotenv.config();

export class WalrusMemoryService {
  private static client: any = null;
  private static isInitialized = false;

  /**
   * Initialize or retrieve MemWal client
   */
  static async getClient(): Promise<any> {
    if (this.client) return this.client;

    const key = process.env.MEMWAL_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;
    const serverUrl = process.env.MEMWAL_SERVER_URL || 'https://relayer.memory.walrus.xyz';
    const namespace = process.env.MEMWAL_NAMESPACE || 'bluff-mainnet';

    if (!key || !accountId) {
      console.warn('[WalrusMemoryService] MEMWAL_KEY or MEMWAL_ACCOUNT_ID missing in .env.');
      console.warn('[WalrusMemoryService] Memories will be logged locally in SQLite until credentials are configured.');
      return null;
    }

    try {
      this.client = MemWal.create({
        key,
        accountId,
        serverUrl,
        namespace
      });
      this.isInitialized = true;
      return this.client;
    } catch (err: any) {
      console.error('[WalrusMemoryService] Error initializing MemWal client:', err.message);
      return null;
    }
  }

  /**
   * Health check for Walrus Relayer
   */
  static async checkHealth(): Promise<any> {
    try {
      const client = await this.getClient();
      if (client) {
        return await client.health();
      }
      return { status: 'unconfigured_local_fallback', relayer: 'https://relayer.memory.walrus.xyz' };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /**
   * Store a structured forecaster memory on Walrus Mainnet
   */
  static async recordForecasterMemory(params: {
    forecasterId: string;
    eventTitle: string;
    pick: string;
    won: boolean;
    confidence: number;
    brierScore: number;
    reputationMultiplier: number;
    category: string;
  }): Promise<{ id: string; memoryText: string; walrusJobId?: string }> {
    const memoryId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const outcomeStr = params.won ? 'WON' : 'LOST (BLUFF)';
    const verdict = params.won
      ? `Calibrated trust weight: ${params.reputationMultiplier.toFixed(2)}x.`
      : `Bluff detected. Calibration faded to ${params.reputationMultiplier.toFixed(2)}x.`;

    const memoryText = `[BLUFF-AUDIT] Forecaster ${params.forecasterId} predicted "${params.pick}" for "${params.eventTitle}" (${params.category}) with ${(params.confidence * 100).toFixed(0)}% confidence. Result: ${outcomeStr}. Updated Brier Score: ${params.brierScore.toFixed(3)}. ${verdict}`;

    let walrusJobId: string | undefined = undefined;

    // Send to Walrus Mainnet relayer if client is configured
    try {
      const client = await this.getClient();
      if (client) {
        console.log(`[WalrusMemoryService] Writing memory to Walrus Mainnet for ${params.forecasterId}...`);
        const job = await client.remember(memoryText);
        walrusJobId = job.job_id;
        // Wait for asynchronous job confirmation on Walrus
        await client.waitForRememberJob(job.job_id);
        console.log(`[WalrusMemoryService] Successfully committed memory to Walrus! Job ID: ${job.job_id}`);
      }
    } catch (err: any) {
      console.error('[WalrusMemoryService] Failed to write memory to Walrus relayer:', err.message);
    }

    // Always log to local SQLite audit log
    dbService.logWalrusMemory({
      id: memoryId,
      forecasterId: params.forecasterId,
      category: params.category,
      memoryText,
      brierDelta: params.brierScore,
      walrusJobId,
      timestamp: new Date().toISOString()
    });

    return { id: memoryId, memoryText, walrusJobId };
  }

  /**
   * Recall past memories and reputation track record for a forecaster
   */
  static async recallForecasterDossier(forecasterId: string): Promise<{
    summary: string;
    memories: string[];
    isFaded: boolean;
  }> {
    const localRecords = dbService.listWalrusMemories(forecasterId, 10);
    const forecaster = dbService.getOrCreateForecaster(forecasterId);

    let memories: string[] = localRecords.map(r => r.memoryText);

    // Attempt semantic recall via Walrus relayer
    try {
      const client = await this.getClient();
      if (client) {
        const recallRes = await client.recall({
          query: `What is the prediction accuracy and credibility of ${forecasterId}?`
        });
        if (recallRes?.results && recallRes.results.length > 0) {
          memories = recallRes.results.map((r: any) => r.text || r.content);
        }
      }
    } catch (err: any) {
      console.warn('[WalrusMemoryService] Recall query warning:', err.message);
    }

    const isFaded = forecaster.reputationMultiplier < 0.6;
    let summary = `Forecaster ${forecaster.id} has ${forecaster.totalWagers} calls (${forecaster.wonWagers} won, ${forecaster.lostWagers} lost). Brier Score: ${forecaster.brierScore.toFixed(3)}.`;
    if (isFaded) {
      summary += ` WARNING: This forecaster has high historical prediction error. Picks are automatically faded by the Bluff consensus engine!`;
    } else if (forecaster.reputationMultiplier > 1.5) {
      summary += ` VERIFIED SHARP: High historical accuracy. Picks receive amplified weighting.`;
    }

    return {
      summary,
      memories,
      isFaded
    };
  }

  /**
   * Helper to generate a new delegate key pair
   */
  static async generateNewKeys() {
    return await generateDelegateKey();
  }
}
