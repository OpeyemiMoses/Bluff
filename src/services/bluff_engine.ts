import { dbService } from '../db/database.js';
import { WalrusMemoryService } from './walrus_memory.js';
import { MarketEvent, Wager, ForecasterProfile } from '../types/index.js';

export class BluffEngine {
  /**
   * Submit a wager with x402 payment verification
   */
  static async submitWager(params: {
    eventId: string;
    forecasterId: string;
    pick: string;
    stakeSui: number;
    paymentSignature?: string;
    txDigest?: string;
  }): Promise<{
    wager: Wager;
    forecaster: ForecasterProfile;
    dossier: { summary: string; memories: string[]; isFaded: boolean };
    reputationEffect: string;
  }> {
    const event = dbService.getEvent(params.eventId);
    if (!event) {
      throw new Error(`Event ${params.eventId} not found`);
    }

    if (!event.outcomes.includes(params.pick)) {
      throw new Error(`Invalid pick "${params.pick}". Valid outcomes are: ${event.outcomes.join(', ')}`);
    }

    // Retrieve forecaster profile and historical Walrus memories
    const forecaster = dbService.getOrCreateForecaster(params.forecasterId);
    const dossier = await WalrusMemoryService.recallForecasterDossier(params.forecasterId);

    const impliedProb = event.outcomeProbabilities[params.pick] || 0.5;
    // Payout multiplier inversely proportional to probability
    const oddsMultiplier = 1 / Math.max(impliedProb, 0.05);
    const potentialPayout = params.stakeSui * oddsMultiplier;

    const wagerId = `wager-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const wager: Wager = {
      id: wagerId,
      eventId: params.eventId,
      forecasterId: params.forecasterId,
      pick: params.pick,
      impliedProb,
      stakeSui: params.stakeSui,
      payoutSui: Math.round(potentialPayout * 1000) / 1000,
      paymentStatus: params.txDigest ? 'paid_settled' : 'unpaid_402',
      wagerStatus: 'pending',
      paymentSignature: params.paymentSignature,
      txDigest: params.txDigest,
      createdAt: new Date().toISOString()
    };

    dbService.createWager(wager);

    let reputationEffect = `Neutral weight (1.0x).`;
    if (dossier.isFaded) {
      reputationEffect = `WARNING: Faded pick! Due to past inaccurate calls in Walrus Memory, this forecaster's weight is discounted to ${forecaster.reputationMultiplier}x.`;
    } else if (forecaster.reputationMultiplier > 1.5) {
      reputationEffect = `SHARP ALERT: This forecaster has high Walrus credibility. Pick weight amplified to ${forecaster.reputationMultiplier}x in the consensus model.`;
    }

    return {
      wager,
      forecaster,
      dossier,
      reputationEffect
    };
  }

  /**
   * Calculate reputation-adjusted consensus odds for an event based on Walrus Memory
   */
  static calculateConsensus(eventId: string): {
    event: MarketEvent;
    bookmakerOdds: Record<string, number>;
    bluffConsensus: Record<string, number>;
    alphaDivergence: Record<string, number>;
    participatingForecasters: number;
    wagersCount: number;
    sharpsCount: number;
    bluffersCount: number;
    picksBreakdown: Record<string, { totalStakeSui: number; effectiveWeight: number; sharps: number; bluffers: number }>;
  } {
    const event = dbService.getEvent(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    const wagers = dbService.listWagersForEvent(eventId).filter(w => w.paymentStatus === 'paid_settled');
    const outcomeWeights: Record<string, number> = {};
    const picksBreakdown: Record<string, { totalStakeSui: number; effectiveWeight: number; sharps: number; bluffers: number }> = {};
    for (const outcome of event.outcomes) {
      outcomeWeights[outcome] = 0;
      picksBreakdown[outcome] = { totalStakeSui: 0, effectiveWeight: 0, sharps: 0, bluffers: 0 };
    }

    const forecasterIds = new Set<string>();
    let sharpsCount = 0;
    let bluffersCount = 0;

    for (const wager of wagers) {
      forecasterIds.add(wager.forecasterId);
      const forecaster = dbService.getOrCreateForecaster(wager.forecasterId);
      if (forecaster.reputationMultiplier > 1.0) sharpsCount++;
      if (forecaster.reputationMultiplier < 1.0) bluffersCount++;

      // Effective stake is actual SUI staked * historical reputation multiplier from Walrus Memory
      const effectiveWeight = wager.stakeSui * forecaster.reputationMultiplier;
      outcomeWeights[wager.pick] = (outcomeWeights[wager.pick] || 0) + effectiveWeight;

      if (picksBreakdown[wager.pick]) {
        picksBreakdown[wager.pick].totalStakeSui += wager.stakeSui;
        picksBreakdown[wager.pick].effectiveWeight += effectiveWeight;
        if (forecaster.reputationMultiplier > 1.0) picksBreakdown[wager.pick].sharps++;
        if (forecaster.reputationMultiplier < 1.0) picksBreakdown[wager.pick].bluffers++;
      }
    }

    const totalWeight = Object.values(outcomeWeights).reduce((a, b) => a + b, 0);

    const bluffConsensus: Record<string, number> = {};
    const alphaDivergence: Record<string, number> = {};

    for (const outcome of event.outcomes) {
      const bookmakerProb = event.outcomeProbabilities[outcome] || 0.5;
      if (totalWeight === 0) {
        bluffConsensus[outcome] = bookmakerProb;
        alphaDivergence[outcome] = 0;
      } else {
        const consensusProb = Math.round((outcomeWeights[outcome] / totalWeight) * 100) / 100;
        bluffConsensus[outcome] = consensusProb;
        // Divergence: positive means our sharps favor this outcome more than the bookmaker
        alphaDivergence[outcome] = Math.round((consensusProb - bookmakerProb) * 100) / 100;
      }
    }

    return {
      event,
      bookmakerOdds: event.outcomeProbabilities,
      bluffConsensus,
      alphaDivergence,
      participatingForecasters: forecasterIds.size,
      wagersCount: wagers.length,
      sharpsCount,
      bluffersCount,
      picksBreakdown
    };
  }

  /**
   * Resolve an event, grade all wagers, and commit persistent calibration to Walrus Memory
   */
  static async resolveEvent(eventId: string, winnerOutcome: string): Promise<{
    event: MarketEvent;
    resolvedWagersCount: number;
    walrusMemoriesCreated: Array<{
      forecasterId: string;
      won: boolean;
      memoryId: string;
      walrusJobId?: string;
    }>;
  }> {
    const event = dbService.getEvent(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    event.status = 'resolved';
    event.winnerOutcome = winnerOutcome;
    event.updatedAt = new Date().toISOString();
    dbService.upsertEvent(event);

    const wagers = dbService.listWagersForEvent(eventId);
    const walrusMemoriesCreated: any[] = [];

    for (const wager of wagers) {
      if (wager.wagerStatus !== 'pending') continue;

      const won = wager.pick === winnerOutcome;
      wager.wagerStatus = won ? 'won' : 'lost';
      wager.resolvedAt = new Date().toISOString();

      // Recalibrate forecaster
      const updatedProfile = dbService.updateForecasterCalibration(
        wager.forecasterId,
        won,
        wager.impliedProb,
        `Result on "${event.title}": ${won ? 'Won' : 'Lost'}`
      );

      // Persist to Walrus Memory on Mainnet
      const memRecord = await WalrusMemoryService.recordForecasterMemory({
        forecasterId: wager.forecasterId,
        eventTitle: event.title,
        pick: wager.pick,
        won,
        confidence: wager.impliedProb,
        brierScore: updatedProfile.brierScore,
        reputationMultiplier: updatedProfile.reputationMultiplier,
        category: event.category
      });

      walrusMemoriesCreated.push({
        forecasterId: wager.forecasterId,
        won,
        memoryId: memRecord.id,
        walrusJobId: memRecord.walrusJobId
      });
    }

    return {
      event,
      resolvedWagersCount: wagers.length,
      walrusMemoriesCreated
    };
  }
}
