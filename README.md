# Bluff

> The Adversarial Prediction Arbiter with x402 Micropayments on Sui & Permanent Walrus Memory.

Bluff transforms prediction feeds into an accountable economic arena where talk is cheap, every call requires machine-payable Sui micro-stakes via the x402 protocol, and forecaster credibility is permanently audited in Walrus Memory on Mainnet.

---

## Overview

Public prediction feeds on social media and forums suffer from chronic memory loss and lack of accountability:
* Influencers boast about occasional lucky calls while quietly deleting their failures.
* Consensus models treat random bluffers with the exact same weight as calibrated sharps.
* Traditional prediction platforms lack native machine-to-machine payment infrastructure for autonomous AI agents.

**Bluff solves this by creating an economic arbiter where:**
1. **Talk Requires Capital**: Every hot take submitted by an agent or user requires an HTTP 402 micro-stake (0.1–1.0 SUI) settled atomically via Sui Programmable Transaction Blocks (PTB).
2. **Memory is Decentralized and Immutable**: Prediction histories, outcomes, and calibrated Brier accuracy scores are written directly to **Walrus Memory on Mainnet** (`relayer.memory.walrus.xyz`).
3. **The Product Visibly Adapts**: Stored memories actively reshape consensus odds. Proven sharps receive up to 2.5x weight amplification, while chronic bluffers are automatically **faded** (discounted to 0.3x).

---

## Hackathon Bonus Alignment

| Award Category | Hackathon Expectation | Bluff Implementation |
| :--- | :--- | :--- |
| **Best Walrus Memory** | *"Deepest learning loop. Memories that visibly change the product."* | Event resolutions trigger Brier calibration recalculations and persist structured memories to Walrus Mainnet. When evaluating incoming picks, the Arbiter recalls historical memories: if an analyst is flagged as a bluffer, the consensus model inverts or fades their weight in real time. |
| **Best Use of Agent Payments** | *"Best app across tracks using x402 or MPP, settled on Sui."* | Implements the x402 v2 protocol specification. When an agent submits a pick via `POST /api/wager`, the server responds with an HTTP 402 challenge (`PAYMENT-REQUIRED`). The agent pays on Sui and retries with `PAYMENT-SIGNATURE`. Payouts and settlements occur over Sui. |
| **Tatum Integration** | Sui RPC / Data APIs integration | All Sui blockchain interactions, transaction digest verifications, and checkpoint queries route through the authenticated Tatum Sui Gateway (`sui-mainnet.gateway.tatum.io`). |

---

## Architecture & Data Flow

```text
       [ Live Data Feeds ]
 ┌───────────────────────────────┐
 │ • Polymarket Gamma REST API   │
 │ • ESPN Live Scoreboard APIs   │
 └───────────────┬───────────────┘
                 │
                 ▼
       [ Bluff Core Engine ]
 ┌───────────────────────────────┐
 │ • Event Catalog (SQLite WAL)  │
 │ • Brier Calibration Model     │
 │ • Sharp vs. Bluffer Consensus │
 └───────┬───────────────┬───────┘
         │               │
         ▼               ▼
 [ x402 Payment Layer ] [ Walrus Memory Layer ]
 • HTTP 402 Negotiation  • @mysten-incubation/memwal
 • Sui PTB Micro-stakes  • Mainnet Relayer
 • Tatum Sui RPC Gateway • Living Forecaster Dossiers
```

### Protocol Flow
1. **Event Sync**: Bluff continuously pulls real-time markets from Polymarket and live sports fixtures from ESPN.
2. **Wager Submission**: A forecaster or agent submits a prediction to `/api/wager`.
3. **HTTP 402 Challenge**: If unpaid, Bluff responds with `402 Payment Required` and a base64-encoded `PAYMENT-REQUIRED` header containing the required SUI stake, vault address, and cryptographic nonce.
4. **Onchain Settlement**: The client executes a Sui PTB and retries with the `PAYMENT-SIGNATURE` header. Bluff verifies the transaction on Sui via the Tatum Gateway.
5. **Dossier Retrieval**: The Arbiter queries Walrus Memory to retrieve the forecaster's historical accuracy profile and applies their credibility multiplier.
6. **Resolution & Memory Write**: When the event closes, Bluff resolves outcomes, updates Brier scores, and writes updated calibration records to Walrus Mainnet.

---

## 100% Live Data Stack

Bluff runs exclusively against live endpoints:
* **Live Prediction Markets**: Ingested directly from the Polymarket Gamma API (`https://gamma-api.polymarket.com/events`).
* **Live Sports**: Ingested from ESPN Scoreboard APIs (`https://site.api.espn.com/apis/site/v2/sports/...`).
* **Live Decentralized Storage**: Writes to Walrus Mainnet via `https://relayer.memory.walrus.xyz`.
* **Live Blockchain RPC**: Tatum Sui Gateway (`https://sui-mainnet.gateway.tatum.io`).

---

## Project Structure

```text
bluff/
├── src/
│   ├── types/index.ts            # Domain types for events, wagers, x402, and Walrus
│   ├── db/database.ts            # High-performance SQLite database (WAL mode)
│   ├── services/
│   │   ├── live_data.ts          # Live Polymarket and ESPN ingester
│   │   ├── tatum_sui.ts          # Tatum Sui RPC Gateway client & verifier
│   │   ├── x402.ts               # x402 HTTP challenge & settlement middleware
│   │   ├── walrus_memory.ts      # Walrus Memory SDK client & dossier generator
│   │   └── bluff_engine.ts       # Brain: wagers, Brier scoring, and consensus
│   ├── server.ts                 # Express REST + x402 API server
│   └── scripts/
│       └── test_live_flow.ts     # Automated live pipeline test script
├── .github/                      # Issue & Pull Request templates
├── .env.example                  # Environment configuration template
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
* Node.js v18+ or v20+
* npm v9+

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/OpeyemiMoses/Bluff.git
   cd Bluff
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

### Environment Configuration (`.env`)
```env
PORT=3402
SUI_NETWORK=mainnet

# Tatum Sui Gateway (Free key from https://dashboard.tatum.io/)
TATUM_API_KEY=your_tatum_key

# Walrus Memory Credentials (From https://memory.walrus.xyz/dashboard)
MEMWAL_KEY=your_ed25519_private_key_hex
MEMWAL_ACCOUNT_ID=your_memwal_account_id
MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz
MEMWAL_NAMESPACE=bluff-mainnet

# Vault Address for x402 Stakes
ARBITER_SUI_ADDRESS=0x68ca62935f09c2ccc0d8dfb99d1806c3dab9d394922d3d9dcd4a48952ea4427a
```

*(Note: If Walrus credentials are not yet supplied, Bluff logs all memories locally in the SQLite audit log with full Walrus format so the system runs out of the box.)*

---

## Running the Application

### 1. Execute End-to-End Test Suite
Runs the full live pipeline: ingests live Polymarket & ESPN feeds, evaluates an x402 challenge, submits stakes, tests consensus calculations, and resolves an event with Walrus Memory logging:
```bash
npm run test:flow
```

### 2. Start the API Server
Starts the Express server with live x402 negotiation on port 3402:
```bash
npm start
```
For auto-reloading development mode:
```bash
npm run dev
```

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service status, Walrus Relayer connectivity, and Tatum Sui Gateway state |
| `GET` | `/api/events` | List live prediction and sports events from Polymarket and ESPN |
| `POST` | `/api/events/sync` | Force refresh live feeds into database |
| `GET` | `/api/events/:id` | Event details with Sharp-weighted Bluff Consensus vs. Market Odds |
| `POST` | `/api/wager` | **x402 Gated**: Submit prediction. Returns 402 if unpaid, 201 if verified |
| `POST` | `/api/events/:id/resolve` | Settle event, grade picks, and write calibration records to Walrus Mainnet |
| `GET` | `/api/forecasters/:id` | Profile, Brier calibration score, and historical Walrus memories |
| `GET` | `/api/memories` | Full audit log of all Walrus Memory records committed |
| `GET` | `/api/walrus/generate-keys` | Generate new Ed25519 delegate keys for Walrus Memory agent |

---

## License

This project is licensed under the [MIT License](LICENSE).
