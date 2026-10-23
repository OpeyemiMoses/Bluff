import axios from 'axios';
import { MarketEvent } from '../types/index.js';
import { dbService } from '../db/database.js';

export class LiveDataService {
  /**
   * Fetch live prediction events from Polymarket Gamma API
   */
  static async fetchPolymarketEvents(limit = 10): Promise<MarketEvent[]> {
    try {
      const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false`;
      const response = await axios.get(url, { timeout: 10000 });
      const rawEvents = response.data;
      const events: MarketEvent[] = [];

      for (const item of rawEvents) {
        if (!item.markets || item.markets.length === 0) continue;
        const mainMarket = item.markets[0];
        
        let outcomeProbabilities: Record<string, number> = {};
        let outcomes: string[] = ['Yes', 'No'];

        try {
          if (mainMarket.outcomePrices) {
            const prices = JSON.parse(mainMarket.outcomePrices);
            if (Array.isArray(prices) && prices.length >= 2) {
              const yesProb = parseFloat(prices[0]) || 0.5;
              const noProb = parseFloat(prices[1]) || (1 - yesProb);
              outcomeProbabilities = {
                'Yes': Math.round(yesProb * 100) / 100,
                'No': Math.round(noProb * 100) / 100
              };
            }
          }
        } catch {
          outcomeProbabilities = { 'Yes': 0.5, 'No': 0.5 };
        }

        let category: MarketEvent['category'] = 'markets';
        const titleLower = (item.title || '').toLowerCase();
        if (titleLower.includes('vs') || titleLower.includes('fc') || titleLower.includes('championship')) {
          category = 'sports';
        } else if (titleLower.includes('btc') || titleLower.includes('sui') || titleLower.includes('eth') || titleLower.includes('crypto')) {
          category = 'crypto';
        } else if (titleLower.includes('election') || titleLower.includes('president')) {
          category = 'politics';
        }

        const event: MarketEvent = {
          id: `poly-${item.id}`,
          source: 'polymarket',
          category,
          title: item.title,
          description: item.description || '',
          outcomes,
          outcomeProbabilities,
          status: 'open',
          endsAt: item.endDate || undefined,
          sourceUrl: item.slug ? `https://polymarket.com/event/${item.slug}` : undefined,
          updatedAt: new Date().toISOString()
        };

        dbService.upsertEvent(event);
        events.push(event);
      }

      return events;
    } catch (error: any) {
      console.error('[LiveDataService] Error fetching Polymarket events:', error?.message);
      return [];
    }
  }

  /**
   * Fetch live NFL sports fixtures and scores from ESPN public API
   */
  static async fetchEspnNflEvents(): Promise<MarketEvent[]> {
    try {
      const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      const response = await axios.get(url, { timeout: 10000 });
      const events: MarketEvent[] = [];
      const rawEvents = response.data?.events || [];

      for (const item of rawEvents) {
        const competition = item.competitions?.[0];
        if (!competition) continue;

        const competitors = competition.competitors || [];
        if (competitors.length < 2) continue;

        const teamA = competitors[0].team.displayName;
        const teamB = competitors[1].team.displayName;
        const scoreA = competitors[0].score || '0';
        const scoreB = competitors[1].score || '0';
        const statusType = competition.status?.type?.state; // 'pre', 'in', 'post'

        let status: MarketEvent['status'] = 'open';
        let winnerOutcome: string | undefined = undefined;

        if (statusType === 'in') {
          status = 'active';
        } else if (statusType === 'post') {
          status = 'resolved';
          winnerOutcome = parseInt(scoreA) > parseInt(scoreB) ? teamA : teamB;
        }

        const outcomes = [teamA, teamB];
        // Implied 50/50 baseline probability if moneyline not parsed
        const outcomeProbabilities: Record<string, number> = {
          [teamA]: 0.5,
          [teamB]: 0.5
        };

        const event: MarketEvent = {
          id: `espn-nfl-${item.id}`,
          source: 'espn',
          category: 'sports',
          title: `${teamA} vs ${teamB}`,
          description: `NFL: ${item.name} (${competition.status?.type?.detail || 'Scheduled'})`,
          outcomes,
          outcomeProbabilities,
          liveScore: `${teamA} ${scoreA} - ${scoreB} ${teamB}`,
          status,
          winnerOutcome,
          endsAt: competition.date,
          sourceUrl: item.links?.[0]?.href,
          updatedAt: new Date().toISOString()
        };

        dbService.upsertEvent(event);
        events.push(event);
      }

      return events;
    } catch (error: any) {
      console.error('[LiveDataService] Error fetching ESPN NFL events:', error?.message);
      return [];
    }
  }

  /**
   * Sync all live feeds into database
   */
  static async syncAllLiveEvents(): Promise<MarketEvent[]> {
    const [poly, nfl] = await Promise.all([
      this.fetchPolymarketEvents(15),
      this.fetchEspnNflEvents()
    ]);
    return [...poly, ...nfl];
  }
}
