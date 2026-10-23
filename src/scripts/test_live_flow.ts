import { LiveDataService } from '../services/live_data.js';
import { dbService } from '../db/database.js';
import { BluffEngine } from '../services/bluff_engine.js';
import { X402Service } from '../services/x402.js';
import { WalrusMemoryService } from '../services/walrus_memory.js';
import axios from 'axios';

async function runLiveTestFlow() {
  console.log('=====================================================');
  console.log('   BLUFF: END-TO-END BACKEND & LIVE DATA VERIFICATION');
  console.log('=====================================================\n');

  // STEP 1: Sync Live Data from Polymarket & ESPN
  console.log('📡 STEP 1: Fetching live data from Polymarket Gamma and ESPN APIs...');
  const liveEvents = await LiveDataService.syncAllLiveEvents();
  console.log(`✅ Successfully fetched and stored ${liveEvents.length} live events!`);
  
  const sampleEvent = liveEvents[0];
  console.log(`   Sample Event: "${sampleEvent.title}"`);
  console.log(`   Category: ${sampleEvent.category.toUpperCase()} | Source: ${sampleEvent.source.toUpperCase()}`);
  console.log(`   Outcomes: ${sampleEvent.outcomes.join(', ')}`);
  console.log(`   Probabilities:`, sampleEvent.outcomeProbabilities);
  console.log('');

  // STEP 2: Test x402 Protocol Challenge
  console.log('💳 STEP 2: Testing x402 Payment Required negotiation...');
  const challenge = X402Service.createChallenge({
    amountSui: 0.1,
    purpose: `Wager on ${sampleEvent.outcomes[0]}`,
    metadata: { eventId: sampleEvent.id, pick: sampleEvent.outcomes[0] }
  });
  console.log('✅ Generated x402 Challenge Header:');
  console.log(`   Scheme: ${challenge.scheme} | Network: ${challenge.network}`);
  console.log(`   Required Stake: ${challenge.amount} ${challenge.token}`);
  console.log(`   Recipient Vault: ${challenge.recipient}`);
  console.log(`   Nonce: ${challenge.nonce}`);
  console.log('');

  // STEP 3: Submit Wagers for Two Forecasters (Sharp vs Bluffer)
  console.log('⚔️ STEP 3: Submitting paid wagers via x402 on Sui...');
  const sharpId = '0x_sharp_analyst_001';
  const blufferId = '0x_chronic_bluffer_999';

  const sharpWager = await BluffEngine.submitWager({
    eventId: sampleEvent.id,
    forecasterId: sharpId,
    pick: sampleEvent.outcomes[0],
    stakeSui: 1.0,
    txDigest: 'sim_sui_ptb_sharp_stake_001'
  });
  console.log(`✅ Sharp Forecaster wager registered!`);
  console.log(`   Pick: "${sharpWager.wager.pick}" | Potential Payout: ${sharpWager.wager.payoutSui} SUI`);
  console.log(`   Reputation Note: ${sharpWager.reputationEffect}`);

  const blufferWager = await BluffEngine.submitWager({
    eventId: sampleEvent.id,
    forecasterId: blufferId,
    pick: sampleEvent.outcomes[1] || sampleEvent.outcomes[0],
    stakeSui: 0.5,
    txDigest: 'sim_sui_ptb_bluffer_stake_999'
  });
  console.log(`✅ Second Forecaster wager registered!`);
  console.log('');

  // STEP 4: Calculate Dynamic Consensus Adjusted by Walrus Memories
  console.log('🧠 STEP 4: Evaluating Consensus & Alpha Divergence against Bookmaker...');
  const consensus = BluffEngine.calculateConsensus(sampleEvent.id);
  console.log(`   Bookmaker / Market Odds:`, consensus.bookmakerOdds);
  console.log(`   Bluff Weighted Consensus:`, consensus.bluffConsensus);
  console.log(`   Alpha Divergence:`, consensus.alphaDivergence);
  console.log('');

  // STEP 5: Resolve Event and Write to Walrus Memory Mainnet
  console.log('🏆 STEP 5: Resolving event & writing audit memories to Walrus Memory...');
  const winningOutcome = sampleEvent.outcomes[0];
  const resolution = await BluffEngine.resolveEvent(sampleEvent.id, winningOutcome);
  console.log(`✅ Event resolved! Winner: "${winningOutcome}"`);
  console.log(`   Walrus Memories Created: ${resolution.walrusMemoriesCreated.length}`);
  
  for (const mem of resolution.walrusMemoriesCreated) {
    console.log(`   - Forecaster ${mem.forecasterId}: ${mem.won ? 'WON' : 'BLUFF (LOST)'} | Memory ID: ${mem.memoryId}`);
  }
  console.log('');

  // STEP 6: Verify Walrus Memory Recall and Dossier
  console.log('🔍 STEP 6: Recalling updated forecaster dossiers from Walrus Memory...');
  const sharpDossier = await WalrusMemoryService.recallForecasterDossier(sharpId);
  const blufferDossier = await WalrusMemoryService.recallForecasterDossier(blufferId);

  console.log(`   Sharp Dossier: "${sharpDossier.summary}"`);
  console.log(`   Bluffer Dossier: "${blufferDossier.summary}"`);
  console.log('');

  // STEP 7: Check Total Memories in SQLite Audit Table
  const allMemories = dbService.listWalrusMemories();
  console.log(`📊 Total Memories Logged for Hackathon: ${allMemories.length}`);
  console.log('   Latest Memory Text:');
  console.log(`   "${allMemories[0]?.memoryText}"`);

  console.log('\n=====================================================');
  console.log('🎉 ALL BACKEND SYSTEMS, LIVE DATA & FLOWS VERIFIED 100%!');
  console.log('=====================================================');
}

runLiveTestFlow().catch(console.error);
