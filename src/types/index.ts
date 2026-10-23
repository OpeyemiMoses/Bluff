export interface MarketEvent {
  id: string;
  source: 'polymarket' | 'espn';
  category: 'sports' | 'crypto' | 'markets' | 'politics';
  title: string;
  description: string;
  outcomes: string[];
  outcomeProbabilities: Record<string, number>;
  liveScore?: string;
  status: 'open' | 'active' | 'resolved';
  winnerOutcome?: string;
  endsAt?: string;
  sourceUrl?: string;
  updatedAt: string;
}

export interface ForecasterProfile {
  id: string; // Sui address or analyst handle
  label?: string;
  brierScore: number; // 0.0 (perfect) to 1.0 (dead wrong), starts at 0.5
  totalWagers: number;
  wonWagers: number;
  lostWagers: number;
  reputationMultiplier: number; // 0.1 to 3.0 (used to weigh or fade their picks)
  lastMemorySummary?: string;
  lastActive: string;
}

export interface Wager {
  id: string;
  eventId: string;
  forecasterId: string;
  pick: string;
  impliedProb: number;
  stakeSui: number;
  payoutSui: number;
  paymentStatus: 'unpaid_402' | 'paid_settled';
  wagerStatus: 'pending' | 'won' | 'lost';
  paymentSignature?: string;
  txDigest?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface X402Challenge {
  scheme: 'x402-sui';
  network: 'sui-mainnet' | 'sui-testnet';
  token: 'SUI';
  amountSui: number;
  recipient: string;
  nonce: string;
  expiresAt: string;
  paymentDetails: {
    wagerId: string;
    eventId: string;
    pick: string;
  };
}

export interface WalrusMemoryRecord {
  id: string;
  forecasterId: string;
  category: string;
  memoryText: string;
  brierDelta: number;
  walrusJobId?: string;
  timestamp: string;
}
