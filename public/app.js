// ==========================================================
// BLUFF FRONTEND CLIENT ENGINE
// Handles Live Feeds, x402 Protocol Handshake, Walrus Recall,
// Collapsible Up Tab Dock & Spring Scroll Animations
// ==========================================================

const API_BASE = ''; // Same origin

// Local Application State
const state = {
  currentView: 'arena',
  categoryFilter: 'all',
  events: [],
  forecasters: {},
  memories: [],
  activeWagerModal: null,
  wallet: {
    address: '0x68ca62935f09c2ccc0d8dfb99d1806c3dab9d394922d3d9dcd4a48952ea4427a',
    balanceSui: 25.00
  },
  dockExpanded: false
};

// ----------------------------------------------------------
// 1. SCROLL ANIMATION OBSERVER (RISE IN & SPRING POP)
// ----------------------------------------------------------
let scrollObserver;

function initScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Once visible, don't un-animate
        scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  document.querySelectorAll('.rise-in:not(.visible)').forEach((el) => {
    scrollObserver.observe(el);
  });
}

// ----------------------------------------------------------
// 2. THEME SWITCHER (LIGHT / DARK)
// ----------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem('bluff_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bluff_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  } else {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  }
}

// ----------------------------------------------------------
// 3. COLLAPSIBLE UP TAB DOCK
// ----------------------------------------------------------
function toggleDock() {
  const wrapper = document.getElementById('dock-wrapper');
  const label = document.getElementById('dock-btn-label');
  state.dockExpanded = !state.dockExpanded;

  if (state.dockExpanded) {
    wrapper.classList.add('expanded');
    label.textContent = 'Collapse Dock';
  } else {
    wrapper.classList.remove('expanded');
    label.textContent = 'Dashboard & Controls';
  }
}

// ----------------------------------------------------------
// 4. VIEW SWITCHING
// ----------------------------------------------------------
function switchView(viewName) {
  state.currentView = viewName;

  // Hide all views
  document.querySelectorAll('.page-view').forEach(el => el.style.display = 'none');
  
  // Show target view
  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.style.display = 'block';
  }

  // Update top navbar active state
  document.querySelectorAll('.nav-link-btn').forEach(btn => btn.classList.remove('active'));
  const navBtn = document.getElementById(`nav-btn-${viewName}`);
  if (navBtn) navBtn.classList.add('active');

  // Update dock active state
  document.querySelectorAll('.dock-nav-card').forEach(card => card.classList.remove('active'));
  const dockCard = document.getElementById(`dock-card-${viewName}`);
  if (dockCard) dockCard.classList.add('active');

  // Trigger relevant view render
  if (viewName === 'arena') renderEvents();
  if (viewName === 'consensus') renderConsensusView();
  if (viewName === 'forecasters') renderForecastersView();
  if (viewName === 'memories') renderMemoriesView();

  // Scroll smoothly to section if needed
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Re-observe newly visible rise-in elements
  setTimeout(initScrollObserver, 60);
}

// ----------------------------------------------------------
// 5. TOAST NOTIFICATIONS
// ----------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ----------------------------------------------------------
// 6. DATA INGESTION & RENDERING
// ----------------------------------------------------------
async function loadInitialData() {
  try {
    const res = await fetch(`${API_BASE}/api/events`);
    const data = await res.json();
    state.events = data.events || [];

    // Also fetch memories
    const memRes = await fetch(`${API_BASE}/api/memories`);
    const memData = await memRes.json();
    state.memories = memData.memories || [];

    updateStatsCounters();
    renderEvents();
    renderResolveSelect();
    setTimeout(initScrollObserver, 100);
  } catch (err) {
    console.error('Failed to load initial events:', err);
    showToast('Failed to connect to Bluff API server.', 'error');
  }
}

async function syncLiveFeeds() {
  showToast('Connecting to Polymarket Gamma & ESPN live scoreboards...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/events/sync`, { method: 'POST' });
    const data = await res.json();
    state.events = data.events || [];
    renderEvents();
    updateStatsCounters();
    showToast(`Synced ${data.count} live events from Polymarket & ESPN!`, 'success');
  } catch (err) {
    showToast('Sync failed. Please check network connection.', 'error');
  }
}

function updateStatsCounters() {
  const marketsEl = document.getElementById('stat-markets-count');
  const memoriesEl = document.getElementById('stat-memories-written');
  
  if (marketsEl) marketsEl.textContent = state.events.length;
  if (memoriesEl) memoriesEl.textContent = state.memories.length;

  const dockBalance = document.getElementById('dock-balance-display');
  if (dockBalance) dockBalance.textContent = `${state.wallet.balanceSui.toFixed(2)} SUI`;
}

function filterCategory(cat) {
  state.categoryFilter = cat;
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  renderEvents();
}

function renderEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  const filtered = state.events.filter(e => {
    if (state.categoryFilter === 'all') return true;
    return e.category === state.categoryFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:48px; color:var(--muted);">No events found in this category.</div>`;
    return;
  }

  container.innerHTML = filtered.map(event => {
    const isResolved = event.status === 'resolved';
    const tagClass = `tag-${event.category}`;
    
    const outcomesHtml = event.outcomes.map(outcome => {
      const prob = event.outcomeProbabilities[outcome] || 0.5;
      const probPercent = Math.round(prob * 100);
      const isWinner = isResolved && event.winnerOutcome === outcome;

      return `
        <div class="outcome-row ${isWinner ? 'selected' : ''}" onclick="openWagerModal('${event.id}', '${outcome}', ${prob})">
          <div class="outcome-bar-fill" style="width: ${probPercent}%;"></div>
          <span class="outcome-name">
            ${outcome} ${isWinner ? '🏆' : ''}
          </span>
          <span class="outcome-prob">${probPercent}%</span>
        </div>
      `;
    }).join('');

    return `
      <div class="event-card rise-in">
        <div>
          <div class="event-header">
            <span class="event-tag ${tagClass}">${event.category.toUpperCase()} &bull; ${event.source.toUpperCase()}</span>
            <span class="event-status-badge ${isResolved ? 'mono text-emerald' : 'mono text-muted'}">
              <span class="tag-pulse-dot" style="background:${isResolved ? 'var(--emerald)' : 'var(--gold)'}; width:6px; height:6px;"></span>
              ${isResolved ? 'RESOLVED' : 'LIVE'}
            </span>
          </div>

          <h3 class="event-title">${event.title}</h3>
          <p class="event-desc">${event.description || (event.liveScore ? `Live: ${event.liveScore}` : 'Real-time prediction event')}</p>
        </div>

        <div>
          <div class="outcomes-list">
            ${outcomesHtml}
          </div>

          <div class="event-footer">
            <span class="mono" style="font-size:0.75rem; color:var(--muted);">
              ${event.endsAt ? new Date(event.endsAt).toLocaleDateString() : 'Active Market'}
            </span>
            <button class="btn-wager-x402" onclick="openWagerModal('${event.id}', '${event.outcomes[0]}', ${event.outcomeProbabilities[event.outcomes[0]] || 0.5})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Challenge via x402
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(initScrollObserver, 40);
}

// ----------------------------------------------------------
// 7. x402 STAKING NEGOTIATION MODAL
// ----------------------------------------------------------
async function openWagerModal(eventId, pick, impliedProb) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  const stakeSui = 0.25;
  const potentialPayout = stakeSui * (1 / Math.max(impliedProb, 0.05));

  state.activeWagerModal = {
    eventId,
    pick,
    impliedProb,
    stakeSui,
    potentialPayout
  };

  document.getElementById('wager-event-title').textContent = event.title;
  document.getElementById('wager-pick-name').textContent = pick;
  document.getElementById('wager-pick-prob').textContent = `${Math.round(impliedProb * 100)}%`;
  document.getElementById('wager-pick-stake').textContent = `${stakeSui.toFixed(2)} SUI`;
  document.getElementById('wager-pick-payout').textContent = `${potentialPayout.toFixed(2)} SUI`;

  // Request x402 challenge from server without payment to show genuine HTTP 402 negotiation!
  try {
    const res = await fetch(`${API_BASE}/api/wager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        forecasterId: state.wallet.address,
        pick,
        stakeSui
      })
    });

    if (res.status === 402) {
      const data = await res.json();
      const rawHeader = res.headers.get('PAYMENT-REQUIRED');
      document.getElementById('x402-challenge-preview').textContent = 
        `// HTTP 402 Payment Required Response\n` +
        `HTTP/1.1 402 Payment Required\n` +
        `PAYMENT-REQUIRED: ${rawHeader ? rawHeader.slice(0, 48) + '...' : 'eyJ4NDAy...'}\n\n` +
        JSON.stringify(data.challenge, null, 2);
    }
  } catch (err) {
    document.getElementById('x402-challenge-preview').textContent = '// Generating x402 challenge payload...';
  }

  document.getElementById('modal-wager-x402').classList.add('open');
}

async function executeX402Stake() {
  if (!state.activeWagerModal) return;
  const { eventId, pick, stakeSui } = state.activeWagerModal;

  if (state.wallet.balanceSui < stakeSui) {
    showToast('Insufficient SUI balance. Use Faucet +10 in the bottom dock.', 'error');
    return;
  }

  showToast('Signing Sui PTB micro-stake transaction...', 'info');

  // Client creates simulated or real transaction digest
  const simTxDigest = `sui_ptb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Retry request with PAYMENT-SIGNATURE header!
    const res = await fetch(`${API_BASE}/api/wager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-SIGNATURE': simTxDigest
      },
      body: JSON.stringify({
        eventId,
        forecasterId: state.wallet.address,
        pick,
        stakeSui
      })
    });

    if (res.ok || res.status === 201) {
      const data = await res.json();
      state.wallet.balanceSui -= stakeSui;
      updateStatsCounters();
      closeModal('modal-wager-x402');

      showToast(`x402 Stake Confirmed on Sui! Wager locked for ${pick}.`, 'success');

      // Refresh event consensus in background
      switchView('arena');
    } else {
      const err = await res.json();
      showToast(`Settlement failed: ${err.message || err.error}`, 'error');
    }
  } catch (err) {
    showToast('Network error during x402 settlement.', 'error');
  }
}

// ----------------------------------------------------------
// 8. ALPHA DIVERGENCE & CONSENSUS VIEW
// ----------------------------------------------------------
async function renderConsensusView() {
  const container = document.getElementById('consensus-container');
  if (!container) return;

  container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:36px;" class="mono text-muted">Calculating Walrus Memory Calibration & Alpha Divergence...</div>`;

  const cardsHtml = await Promise.all(state.events.slice(0, 12).map(async event => {
    let consensusData = null;
    try {
      const res = await fetch(`${API_BASE}/api/events/${event.id}`);
      if (res.ok) consensusData = await res.json();
    } catch {}

    const bookmakerOdds = event.outcomeProbabilities;
    const bluffConsensus = consensusData?.bluffConsensus || bookmakerOdds;
    const alphaDivergence = consensusData?.alphaDivergence || {};

    const rowsHtml = event.outcomes.map(out => {
      const bookmakerProb = Math.round((bookmakerOdds[out] || 0.5) * 100);
      const consensusProb = Math.round((bluffConsensus[out] || 0.5) * 100);
      const diff = consensusProb - bookmakerProb;
      const diffColor = diff > 0 ? 'var(--emerald)' : diff < 0 ? 'var(--danger)' : 'var(--muted)';
      const diffSign = diff > 0 ? `+${diff}%` : `${diff}%`;

      return `
        <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; padding:10px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <strong style="color:var(--ink);">${out}</strong>
          <div class="mono" style="display:flex; align-items:center; gap:14px; font-size:0.85rem;">
            <span>Market: <strong>${bookmakerProb}%</strong></span>
            <span>Bluff: <strong>${consensusProb}%</strong></span>
            <span style="font-weight:800; color:${diffColor};">${diffSign}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="event-card rise-in">
        <div class="event-header">
          <span class="event-tag">${event.category.toUpperCase()}</span>
          <span class="mono" style="font-size:0.75rem; color:var(--sui-blue);">
            ${consensusData?.participatingForecasters || 0} Forecasters Calibrated
          </span>
        </div>
        <h3 class="event-title">${event.title}</h3>
        <div style="margin-top:14px;">
          ${rowsHtml}
        </div>
      </div>
    `;
  }));

  container.innerHTML = cardsHtml.join('');
  setTimeout(initScrollObserver, 40);
}

// ----------------------------------------------------------
// 9. FORECASTER DOSSIERS & HALL OF SHAME
// ----------------------------------------------------------
async function renderForecastersView() {
  const container = document.getElementById('forecasters-grid');
  if (!container) return;

  const mockForecasters = [
    { id: '0x_sharp_analyst_001', label: 'AlphaSui_Sharp', brier: 0.180, calls: 14, won: 12, lost: 2, mult: 2.20, badge: 'VERIFIED SHARP', isSharp: true },
    { id: '0x_chronic_bluffer_999', label: 'MoonBoy_Crypto', brier: 0.820, calls: 9, won: 1, lost: 8, mult: 0.30, badge: 'CHRONIC BLUFFER (FADED)', isSharp: false },
    { id: '0x_nfl_guru_42', label: 'GridironGuru', brier: 0.220, calls: 18, won: 15, lost: 3, mult: 1.85, badge: 'VERIFIED SHARP', isSharp: true },
    { id: '0x_tout_master', label: 'FreePicks100x', brier: 0.740, calls: 11, won: 2, lost: 9, mult: 0.30, badge: 'CHRONIC BLUFFER (FADED)', isSharp: false }
  ];

  container.innerHTML = mockForecasters.map(f => {
    const badgeColor = f.isSharp ? 'var(--emerald)' : 'var(--danger)';
    const badgeBg = f.isSharp ? 'var(--emerald-tint)' : 'var(--danger-tint)';

    return `
      <div class="event-card rise-in" style="cursor:pointer;" onclick="openForecasterDossier('${f.id}')">
        <div class="event-header">
          <span style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:0.7rem; padding:4px 8px; border-radius:6px; letter-spacing:0.04em;">
            ${f.badge}
          </span>
          <span class="mono" style="font-size:0.75rem; color:var(--muted);">${f.id.slice(0, 10)}...</span>
        </div>

        <h3 class="event-title">${f.label}</h3>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:16px 0; text-align:center;">
          <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
            <div class="mono" style="font-size:1.1rem; font-weight:900;">${f.brier.toFixed(3)}</div>
            <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">BRIER SCORE</div>
          </div>
          <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
            <div class="mono" style="font-size:1.1rem; font-weight:900; color:${badgeColor};">${f.won}/${f.calls}</div>
            <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">WIN RATE</div>
          </div>
          <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
            <div class="mono" style="font-size:1.1rem; font-weight:900; color:var(--sui-blue);">${f.mult.toFixed(2)}x</div>
            <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">WEIGHT MULT</div>
          </div>
        </div>

        <button class="btn-ghost-sm" style="width:100%; justify-content:center;">
          Inspect Walrus Memory Dossier &rarr;
        </button>
      </div>
    `;
  }).join('');

  setTimeout(initScrollObserver, 40);
}

async function openForecasterDossier(forecasterId) {
  try {
    const res = await fetch(`${API_BASE}/api/forecasters/${forecasterId}`);
    const data = await res.json();
    
    document.getElementById('dossier-forecaster-id').textContent = data.forecaster.label || forecasterId;
    document.getElementById('dossier-brier').textContent = data.forecaster.brierScore.toFixed(3);
    document.getElementById('dossier-record').textContent = `${data.forecaster.wonWagers} / ${data.forecaster.totalWagers}`;
    document.getElementById('dossier-weight').textContent = `${data.forecaster.reputationMultiplier.toFixed(2)}x`;

    const isFaded = data.dossier.isFaded;
    const badge = document.getElementById('dossier-rating-badge');
    badge.textContent = isFaded ? 'CHRONIC BLUFFER (AUTO-FADED)' : 'CALIBRATED ACCURACY';
    badge.style.color = isFaded ? 'var(--danger)' : 'var(--emerald)';
    badge.style.background = isFaded ? 'var(--danger-tint)' : 'var(--emerald-tint)';

    const list = document.getElementById('dossier-memories-list');
    if (data.walrusMemories && data.walrusMemories.length > 0) {
      list.innerHTML = data.walrusMemories.map(m => `
        <div style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:10px; padding:10px 12px; font-size:0.8rem; line-height:1.4;">
          <div class="mono" style="font-size:0.68rem; color:var(--muted); margin-bottom:4px;">${new Date(m.timestamp).toLocaleString()} &bull; ID: ${m.id}</div>
          <div style="color:var(--ink);">${m.memoryText}</div>
        </div>
      `).join('');
    } else {
      list.innerHTML = `<div style="font-size:0.85rem; color:var(--muted); padding:14px; text-align:center;">No Walrus memories recorded yet for this address.</div>`;
    }

    document.getElementById('modal-dossier').classList.add('open');
  } catch (err) {
    showToast('Failed to load forecaster dossier.', 'error');
  }
}

// ----------------------------------------------------------
// 10. WALRUS MEMORIES AUDIT VIEW
// ----------------------------------------------------------
async function renderMemoriesView() {
  const container = document.getElementById('memories-list');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/memories`);
    const data = await res.json();
    state.memories = data.memories || [];

    if (state.memories.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:48px; color:var(--muted);">No memories logged yet. Resolve an event to write the first record!</div>`;
      return;
    }

    container.innerHTML = state.memories.map(m => `
      <div class="paper-card rise-in" style="background:var(--card); border:1px solid var(--border); border-left:4px solid var(--sui-blue); border-radius:14px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div class="mono" style="font-size:0.75rem; color:var(--muted);">
            RECORD: <strong>${m.id}</strong> &bull; WALRUS RELAYER: MAINNET
          </div>
          <span class="mono" style="font-size:0.75rem; color:var(--muted);">${new Date(m.timestamp).toLocaleString()}</span>
        </div>
        <p style="font-size:0.9rem; color:var(--ink); line-height:1.5;">${m.memoryText}</p>
        <div style="display:flex; gap:10px; margin-top:10px; font-size:0.75rem;" class="mono">
          <span style="color:var(--sui-blue);">CATEGORY: ${m.category.toUpperCase()}</span>
          <span style="color:var(--muted);">TARGET: ${m.forecasterId}</span>
        </div>
      </div>
    `).join('');

    setTimeout(initScrollObserver, 40);
  } catch (err) {
    console.error('Failed to load memories:', err);
  }
}

// ----------------------------------------------------------
// 11. EVENT RESOLUTION SIMULATOR (WALRUS COMMIT)
// ----------------------------------------------------------
function renderResolveSelect() {
  const select = document.getElementById('resolve-event-select');
  if (!select) return;

  select.innerHTML = state.events.map(e => `
    <option value="${e.id}">${e.title} (${e.category})</option>
  `).join('');

  updateResolveOutcomes();
}

function updateResolveOutcomes() {
  const eventSelect = document.getElementById('resolve-event-select');
  const winnerSelect = document.getElementById('resolve-winner-select');
  if (!eventSelect || !winnerSelect) return;

  const event = state.events.find(e => e.id === eventSelect.value);
  if (!event) return;

  winnerSelect.innerHTML = event.outcomes.map(o => `
    <option value="${o}">${o}</option>
  `).join('');
}

function openResolveModal() {
  renderResolveSelect();
  document.getElementById('modal-resolve-event').classList.add('open');
}

async function executeEventResolution() {
  const eventSelect = document.getElementById('resolve-event-select');
  const winnerSelect = document.getElementById('resolve-winner-select');
  if (!eventSelect || !winnerSelect) return;

  const eventId = eventSelect.value;
  const winnerOutcome = winnerSelect.value;

  showToast(`Resolving event and writing audit memories to Walrus Mainnet...`, 'info');

  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerOutcome })
    });

    if (res.ok) {
      const data = await res.json();
      closeModal('modal-resolve-event');
      showToast(`Event Resolved! ${data.walrusMemoriesCreated?.length || 0} memories committed to Walrus.`, 'success');
      await loadInitialData();
      switchView('memories');
    } else {
      showToast('Resolution failed. Check server logs.', 'error');
    }
  } catch (err) {
    showToast('Network error during resolution.', 'error');
  }
}

// ----------------------------------------------------------
// 12. WALLET HELPER
// ----------------------------------------------------------
function openWalletModal() {
  showToast(`Connected Agent: ${state.wallet.address.slice(0, 10)}... (Balance: ${state.wallet.balanceSui.toFixed(2)} SUI)`, 'info');
}

function resetWalletBalance() {
  state.wallet.balanceSui += 10.0;
  updateStatsCounters();
  showToast('Faucet: +10.00 SUI deposited to agent vault!', 'success');
}

// ----------------------------------------------------------
// 13. MODAL UTILITIES
// ----------------------------------------------------------
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function closeModalOnBackdrop(event, id) {
  if (event.target.id === id) {
    closeModal(id);
  }
}

// ----------------------------------------------------------
// 14. INITIALIZATION
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadInitialData();
  initScrollObserver();
});
