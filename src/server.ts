import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { dbService } from './db/database.js';
import { LiveDataService } from './services/live_data.js';
import { BluffEngine } from './services/bluff_engine.js';
import { X402Service } from './services/x402.js';
import { WalrusMemoryService } from './services/walrus_memory.js';
import { TatumSuiService } from './services/tatum_sui.js';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3402;

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Enable CORS for testing and client integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, PAYMENT-SIGNATURE, X-Payment-Signature, x-api-key');
  res.header('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Root Health & System Diagnostics
app.get('/health', async (req: Request, res: Response) => {
  const walrusHealth = await WalrusMemoryService.checkHealth();
  let tatumStatus = 'unconfigured';
  let latestCheckpoint = null;

  try {
    latestCheckpoint = await TatumSuiService.getLatestCheckpoint();
    tatumStatus = 'connected';
  } catch (err: any) {
    tatumStatus = err.response?.status === 401 ? 'unauthorized_missing_api_key' : 'offline';
  }

  res.json({
    app: 'Bluff - Adversarial Prediction Arbiter',
    status: 'online',
    timestamp: new Date().toISOString(),
    network: process.env.SUI_NETWORK || 'mainnet',
    walrusRelayer: walrusHealth,
    tatumSuiGateway: {
      status: tatumStatus,
      latestCheckpoint
    },
    x402RecipientVault: X402Service.getArbiterRecipientAddress()
  });
});

// GET /api/events - List live market and sports events with Bluff Smart Consensus
app.get('/api/events', async (req: Request, res: Response) => {
  let events = dbService.listEvents(30);
  if (events.length === 0) {
    console.log('[Bluff] No local events found, auto-syncing from live Polymarket and ESPN feeds...');
    events = await LiveDataService.syncAllLiveEvents();
  }
  const eventsWithConsensus = events.map(e => {
    try {
      const consensus = BluffEngine.calculateConsensus(e.id);
      return {
        ...e,
        consensus
      };
    } catch (_err) {
      return e;
    }
  });
  res.json({
    total: eventsWithConsensus.length,
    events: eventsWithConsensus
  });
});

// POST /api/events/sync - Force refresh live feeds
app.post('/api/events/sync', async (req: Request, res: Response) => {
  const synced = await LiveDataService.syncAllLiveEvents();
  res.json({
    message: 'Synced events from live Polymarket and ESPN feeds',
    count: synced.length,
    events: synced
  });
});

// GET /api/events/:id - Single event with live consensus analysis
app.get('/api/events/:id', (req: Request, res: Response) => {
  try {
    const eventId = String(req.params.id);
    const analysis = BluffEngine.calculateConsensus(eventId);
    res.json(analysis);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/stats - Real calculated protocol metrics directly from database
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = dbService.getProtocolStats();
  res.json(stats);
});

// GET /api/forecasters - List all real forecasters from database
app.get('/api/forecasters', (req: Request, res: Response) => {
  const forecasters = dbService.listForecasters(50);
  res.json({
    total: forecasters.length,
    forecasters
  });
});

// GET /api/forecasters/:id - Forecaster profile, Brier calibration, and Walrus memories
app.get('/api/forecasters/:id', async (req: Request, res: Response) => {
  const forecasterId = String(req.params.id);
  const forecaster = dbService.getOrCreateForecaster(forecasterId);
  const dossier = await WalrusMemoryService.recallForecasterDossier(forecasterId);
  const wagers = dbService.listWalrusMemories(forecasterId);

  res.json({
    forecaster,
    dossier,
    walrusMemoriesCount: wagers.length,
    walrusMemories: wagers
  });
});

/**
 * POST /api/wager - Put up your stake via x402 on Sui!
 * If PAYMENT-SIGNATURE header is missing, responds with HTTP 402 + payment challenge.
 * If provided and verified on Sui, registers the wager and updates consensus!
 */
app.post(
  '/api/wager',
  async (req: Request, res: Response) => {
    const { eventId, forecasterId, pick, stakeSui = 0.1 } = req.body;

    if (!eventId || !forecasterId || !pick) {
      return res.status(400).json({ error: 'Missing required fields: eventId, forecasterId, pick' });
    }

    const paymentSignature = req.headers['payment-signature'] as string || req.headers['x-payment-signature'] as string;

    // If no payment header provided, throw x402 Payment Required!
    if (!paymentSignature) {
      const challenge = X402Service.createChallenge({
        amountSui: stakeSui,
        purpose: `Wager stake on ${pick}`,
        metadata: { eventId, forecasterId, pick, stakeSui }
      });

      const encodedChallenge = Buffer.from(JSON.stringify(challenge)).toString('base64');
      res.setHeader('PAYMENT-REQUIRED', encodedChallenge);
      res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE');

      return res.status(402).json({
        statusCode: 402,
        error: 'Payment Required',
        protocol: 'x402-v2',
        message: `Prediction requires a verifiable ${stakeSui} SUI stake locked on Sui.`,
        challenge
      });
    }

    // Verify payment on Sui
    let txDigest = paymentSignature;
    try {
      if (paymentSignature.startsWith('{') || paymentSignature.startsWith('ey')) {
        const raw = paymentSignature.startsWith('ey')
          ? Buffer.from(paymentSignature, 'base64').toString('utf-8')
          : paymentSignature;
        const parsed = JSON.parse(raw);
        txDigest = parsed.txDigest || parsed.digest || paymentSignature;
      }
    } catch {
      // use raw
    }

    const verification = await TatumSuiService.verifyTransaction(txDigest);
    if (!verification.valid) {
      return res.status(402).json({
        statusCode: 402,
        error: 'Payment Verification Failed',
        message: `Sui transaction digest (${txDigest}) could not be verified on Sui via Tatum gateway.`,
        details: verification
      });
    }

    // Payment settled! Submit wager into Bluff engine
    try {
      const result = await BluffEngine.submitWager({
        eventId,
        forecasterId,
        pick,
        stakeSui,
        paymentSignature,
        txDigest
      });

      res.setHeader('PAYMENT-RESPONSE', Buffer.from(JSON.stringify({
        status: 'settled',
        txDigest,
        verifiedAt: new Date().toISOString()
      })).toString('base64'));

      return res.status(201).json({
        status: 'wager_confirmed',
        txDigest,
        ...result
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
);

// POST /api/events/:id/resolve - Settle event, grade wagers, and write memories to Walrus
app.post('/api/events/:id/resolve', async (req: Request, res: Response) => {
  const { winnerOutcome } = req.body;
  if (!winnerOutcome) {
    return res.status(400).json({ error: 'Missing winnerOutcome in body' });
  }

  try {
    const eventId = String(req.params.id);
    const result = await BluffEngine.resolveEvent(eventId, winnerOutcome);
    res.json({
      message: `Event ${eventId} resolved. Winner: ${winnerOutcome}`,
      ...result
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/memories - Audit list of Walrus memories
app.get('/api/memories', (req: Request, res: Response) => {
  const memories = dbService.listWalrusMemories();
  res.json({
    totalMemoriesLogged: memories.length,
    memories
  });
});

// Helper endpoint to generate delegate keys for Walrus Memory
app.get('/api/walrus/generate-keys', async (req: Request, res: Response) => {
  const keys = await WalrusMemoryService.generateNewKeys();
  res.json({
    message: 'Generated new Ed25519 delegate keys for Walrus Memory',
    publicKeyHex: Buffer.from(keys.publicKey).toString('hex'),
    suiAddress: keys.suiAddress,
    instructions: 'Use this suiAddress as MEMWAL_AGENT_ID on the submission form, and privateKey in your .env'
  });
});

// GET /api/wallet/balance/:address - Fetch live SUI balance for any Sui address
app.get('/api/wallet/balance/:address', async (req: Request, res: Response) => {
  try {
    const address = String(req.params.address);
    let rawBalance = '0';
    try {
      rawBalance = await TatumSuiService.getBalance(address);
    } catch (_e) {
      rawBalance = '0';
    }
    const balanceSui = (Number(rawBalance) / 1e9).toFixed(4);
    res.json({ address, balanceSui: Number(balanceSui), rawBalance, network: 'sui:mainnet' });
  } catch (err: any) {
    res.json({ address: req.params.address, balanceSui: 0, rawBalance: '0', error: err.message });
  }
});

// POST /api/wallet/generate - Generate authentic Sui Ed25519 keypair and address
app.post('/api/wallet/generate', (req: Request, res: Response) => {
  try {
    const keypair = new Ed25519Keypair();
    const address = keypair.toSuiAddress();
    res.json({
      address,
      publicKey: keypair.getPublicKey().toBase64(),
      message: 'Generated real Sui Ed25519 account'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const server = app.listen(PORT, () => {
  console.log(`[Bluff Engine] Running on http://localhost:${PORT}`);
  console.log(`[Bluff Engine] x402 Micropayments: Enabled`);
  console.log(`[Bluff Engine] Walrus Memory Mainnet Relayer: https://relayer.memory.walrus.xyz`);
});
