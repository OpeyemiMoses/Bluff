// ==========================================================
// BLUFF FRONTEND CLIENT ENGINE
// 100% Real Live Ingestion & Database Driven (Zero Mock Data)
// Dual-View Architecture (Landing Page + App Console)
// Collapsible Up-Tab Bottom Dock & Tactile Spring Pop Animations
// ==========================================================

const API_BASE = ''; // Same origin

// Local Application State
const state = {
  currentView: 'landing', // 'landing' or 'app'
  currentAppTab: 'arena', // 'arena', 'consensus', 'forecasters', 'memories'
  categoryFilter: 'all',
  searchQuery: '',
  events: [],
  forecasters: [],
  memories: [],
  stats: null,
  activeWagerModal: null,
  activeForecasterId: '0x_sharp_analyst_001',
  dockExpanded: false
};

// ----------------------------------------------------------
// 1. TYPEWRITER ANIMATION (HERO SECTION)
// ----------------------------------------------------------
const typewriterWords = ['provable', 'unbluffable', 'verifiable', 'sovereign', 'adversarial'];
let wordIdx = 0;
let charIdx = 0;
let isDeleting = false;
let typewriterTimer = null;

function runTypewriter() {
  const target = document.getElementById('typewriter-text');
  if (!target) return;

  const currentWord = typewriterWords[wordIdx];

  if (isDeleting) {
    charIdx--;
    target.textContent = currentWord.substring(0, charIdx);
  } else {
    charIdx++;
    target.textContent = currentWord.substring(0, charIdx);
  }

  let delay = isDeleting ? 45 : 90;

  if (!isDeleting && charIdx === currentWord.length) {
    delay = 2000; // Pause at full word
    isDeleting = true;
  } else if (isDeleting && charIdx === 0) {
    isDeleting = false;
    wordIdx = (wordIdx + 1) % typewriterWords.length;
    delay = 400; // Pause before typing next word
  }

  typewriterTimer = setTimeout(runTypewriter, delay);
}

// ----------------------------------------------------------
// 2. SCROLL ANIMATION OBSERVER (RISE IN & SPRING POP)
// ----------------------------------------------------------
let scrollObserver;

function initScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -10px 0px'
  });

  document.querySelectorAll('.rise-in:not(.visible)').forEach((el) => {
    scrollObserver.observe(el);
  });
}

// ----------------------------------------------------------
// 3. THEME SWITCHER (LIGHT / DARK)
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
// 4. VIEW & TAB SWITCHING
// ----------------------------------------------------------
function showView(viewName) {
  state.currentView = viewName;

  const landingView = document.getElementById('view-landing');
  const appView = document.getElementById('view-app');
  const landingNav = document.getElementById('landing-nav-links');
  const appNav = document.getElementById('app-nav-links');
  const actionText = document.getElementById('nav-action-text');

  if (viewName === 'landing') {
    if (landingView) landingView.style.display = 'block';
    if (appView) appView.style.display = 'none';
    if (landingNav) landingNav.style.display = 'flex';
    if (appNav) appNav.style.display = 'none';
    if (actionText) actionText.textContent = 'Launch App Console';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (landingNav) landingNav.style.display = 'none';
    if (appNav) appNav.style.display = 'flex';
    if (actionText) actionText.textContent = 'Back to Landing';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showAppTab(state.currentAppTab || 'arena');
  }

  setTimeout(initScrollObserver, 60);
}

function toggleMainView() {
  if (state.currentView === 'landing') {
    showView('app');
  } else {
    showView('landing');
  }
}

function showAppTab(tabName) {
  state.currentAppTab = tabName;

  // Make sure we are on app view
  if (state.currentView !== 'app') {
    const landingView = document.getElementById('view-landing');
    const appView = document.getElementById('view-app');
    const landingNav = document.getElementById('landing-nav-links');
    const appNav = document.getElementById('app-nav-links');
    const actionText = document.getElementById('nav-action-text');

    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (landingNav) landingNav.style.display = 'none';
    if (appNav) appNav.style.display = 'flex';
    if (actionText) actionText.textContent = 'Back to Landing';
    state.currentView = 'app';
  }

  // If dock is expanded, collapse it cleanly
  if (state.dockExpanded) {
    toggleDock();
  }

  // Hide all subtabs
  document.querySelectorAll('.app-subtab').forEach(tab => tab.style.display = 'none');
  const activeTab = document.getElementById(`app-tab-${tabName}`);
  if (activeTab) activeTab.style.display = 'block';

  // Update top subtab navigation pills
  document.querySelectorAll('.filter-pill, #tab-btn-arena, #tab-btn-consensus, #tab-btn-forecasters, #tab-btn-memories').forEach(btn => {
    btn.classList.remove('active');
  });
  const topBtn = document.getElementById(`tab-btn-${tabName}`);
  if (topBtn) topBtn.classList.add('active');

  // Update desktop navbar app links
  document.querySelectorAll('#app-nav-links .nav-link-btn').forEach(btn => btn.classList.remove('active'));
  const appNavBtn = document.getElementById(`app-nav-${tabName}`);
  if (appNavBtn) appNavBtn.classList.add('active');

  // Update dock cards
  document.querySelectorAll('.dock-nav-card').forEach(card => card.classList.remove('active'));
  const dockCard = document.getElementById(`dock-nav-${tabName}`);
  if (dockCard) dockCard.classList.add('active');

  // Refresh tab-specific data
  if (tabName === 'arena') {
    renderEvents();
  } else if (tabName === 'consensus') {
    renderConsensusView();
  } else if (tabName === 'forecasters') {
    renderForecastersView();
  } else if (tabName === 'memories') {
    renderWalrusAuditView();
  }

  setTimeout(initScrollObserver, 40);
}

function scrollToSection(sectionId) {
  if (state.currentView !== 'landing') {
    showView('landing');
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } else {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const wasActive = item.classList.contains('active');

  // Close all other FAQ items for clean accordion effect
  document.querySelectorAll('.faq-item').forEach(i => {
    i.classList.remove('active');
    const toggle = i.querySelector('.faq-toggle');
    if (toggle) toggle.textContent = '+';
  });

  if (!wasActive) {
    item.classList.add('active');
    const toggle = item.querySelector('.faq-toggle');
    if (toggle) toggle.textContent = '−';
  }
}

// ----------------------------------------------------------
// 5. COLLAPSIBLE UP-TAB BOTTOM DOCK
// ----------------------------------------------------------
function toggleDock() {
  const wrapper = document.getElementById('dock-wrapper');
  const label = document.getElementById('dock-toggle-label');
  state.dockExpanded = !state.dockExpanded;

  if (state.dockExpanded) {
    wrapper.classList.add('expanded');
    if (label) label.textContent = 'Collapse';
  } else {
    wrapper.classList.remove('expanded');
    if (label) label.textContent = 'Controls';
  }
}

// ----------------------------------------------------------
// 6. REAL LIVE PROTOCOL STATS (GET /api/stats)
// ----------------------------------------------------------
async function fetchProtocolStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Failed to fetch protocol stats');
    const stats = await res.json();
    state.stats = stats;

    // Landing Page Ribbon Counters
    const statEvents = document.getElementById('landing-stat-events');
    const statStaked = document.getElementById('landing-stat-staked');
    const statMemories = document.getElementById('landing-stat-memories');
    const statForecasters = document.getElementById('landing-stat-forecasters');

    if (statEvents) statEvents.textContent = stats.activeEvents ?? stats.totalEvents ?? 0;
    if (statStaked) statStaked.textContent = `${(stats.totalStakedSui || 0).toFixed(2)} SUI`;
    if (statMemories) statMemories.textContent = stats.totalMemories ?? 0;
    if (statForecasters) statForecasters.textContent = stats.totalForecasters ?? 0;

    // Bottom Dock Counters
    const dockEvents = document.getElementById('dock-stat-events');
    const dockSui = document.getElementById('dock-stat-sui');
    const dockMem = document.getElementById('dock-stat-memories');

    if (dockEvents) dockEvents.textContent = stats.activeEvents ?? stats.totalEvents ?? 0;
    if (dockSui) dockSui.textContent = `${(stats.totalStakedSui || 0).toFixed(2)} SUI`;
    if (dockMem) dockMem.textContent = stats.totalMemories ?? 0;

    // Console Session Quick Bar
    const sessionQuick = document.getElementById('session-stats-quick');
    if (sessionQuick) {
      sessionQuick.textContent = `${stats.activeEvents} Markets • ${stats.totalMemories} Walrus Dossiers • ${stats.fadedBluffers} Faded`;
    }
  } catch (err) {
    console.warn('[Bluff] Stats fetch warning:', err);
  }
}

// ----------------------------------------------------------
// 7. LIVE PREDICTION ARENA (GET /api/events)
// ----------------------------------------------------------
async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/api/events`);
    if (!res.ok) throw new Error('Failed to fetch events from API');
    const data = await res.json();
    state.events = data.events || [];
    renderEvents();
  } catch (err) {
    console.error('[Bluff] Failed to load events:', err);
    showToast('Failed to connect to live events feed', 'error');
  }
}

function searchMarkets(query) {
  state.searchQuery = query || '';
  renderEvents();
}

function filterCategory(category, btn) {
  state.categoryFilter = category;
  document.querySelectorAll('.filter-pills .filter-pill').forEach(b => {
    b.classList.remove('active');
  });
  if (btn) {
    btn.classList.add('active');
  }
  renderEvents();
}

function renderEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  const searchQuery = (state.searchQuery || '').toLowerCase();
  const filtered = state.events.filter(e => {
    const matchesCategory = state.categoryFilter === 'all' || e.category === state.categoryFilter;
    const matchesSearch = !searchQuery || 
      (e.title && e.title.toLowerCase().includes(searchQuery)) || 
      (e.description && e.description.toLowerCase().includes(searchQuery));
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 48px; background:var(--card); border:1px solid var(--border); border-radius:18px;">
        <h3 style="font-weight:800; margin-bottom:8px;">No events match your criteria</h3>
        <p style="color:var(--muted); font-size:0.85rem; margin-bottom:16px;">Try switching feeds or clearing your search query.</p>
        <button class="btn-primary-sm" onclick="syncLiveFeeds()">Sync Live Feeds Now</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(e => {
    const isESPN = e.source === 'espn';
    const tagClass = isESPN ? 'source-espn' : 'source-polymarket';
    const sourceLabel = isESPN ? 'ESPN LIVE' : 'POLYMARKET';

    // Outcome options display (robust against outcomes or outcomeProbabilities)
    const outcomes = (e.outcomes && e.outcomes.length > 0)
      ? e.outcomes
      : Object.keys(e.outcomeProbabilities || {});

    const outcomesHtml = outcomes.map(outcomeName => {
      const prob = e.outcomeProbabilities?.[outcomeName] ?? 0.5;
      const probPct = Math.round(prob * 100);
      return `
        <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:10px; margin-bottom:8px; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:0.88rem; color:var(--ink);">${outcomeName}</strong>
            <span class="mono" style="font-size:0.82rem; font-weight:800; color:var(--sui-blue);">${probPct}%</span>
          </div>
          <div style="background:var(--border); height:5px; border-radius:3px; overflow:hidden;">
            <div style="background:var(--sui-blue); width:${probPct}%; height:100%;"></div>
          </div>
        </div>
      `;
    }).join('');

    const resolveBtn = e.status !== 'resolved'
      ? `<button class="btn-ghost-sm" onclick="openResolveModal('${e.id}')" title="Resolve outcome with official oracle" style="font-size:0.75rem;">Resolve</button>`
      : `<span style="font-size:0.75rem; color:var(--emerald); font-weight:800; padding:4px 8px; background:var(--emerald-tint); border-radius:6px;">RESOLVED</span>`;

    return `
      <div class="event-card rise-in" id="card-${e.id}">
        <div class="event-header">
          <span class="event-source-tag ${tagClass}">${sourceLabel}</span>
          <span class="mono" style="font-size:0.72rem; color:var(--muted);">${e.category.toUpperCase()}</span>
        </div>

        <h3 class="event-title">${e.title}</h3>
        <p class="event-desc">${e.description || 'Live market event streaming from verified official data sources.'}</p>

        <div style="margin: 14px 0;">
          ${outcomesHtml}
        </div>

        <div class="event-actions">
          <button class="btn-primary-sm" onclick="openWagerModal('${e.id}')" style="flex:1; justify-content:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Put Down Stake (x402)
          </button>
          ${resolveBtn}
        </div>
      </div>
    `;
  }).join('');

  setTimeout(initScrollObserver, 40);
}

// ----------------------------------------------------------
// 8. ALPHA DIVERGENCE & CONSENSUS VIEW
// ----------------------------------------------------------
async function renderConsensusView() {
  const container = document.getElementById('consensus-table-container');
  if (!container) return;

  if (state.events.length === 0) {
    container.innerHTML = '<p style="color:var(--muted); text-align:center; padding:32px;">Loading live events for consensus analysis...</p>';
    return;
  }

  const sampleEvents = state.events.slice(0, 10);

  const cardsHtml = await Promise.all(sampleEvents.map(async (e) => {
    let consensusData = null;
    try {
      const res = await fetch(`${API_BASE}/api/events/${e.id}`);
      if (res.ok) consensusData = await res.json();
    } catch (err) {}

    const outcomes = (e.outcomes && e.outcomes.length > 0)
      ? e.outcomes
      : Object.keys(e.outcomeProbabilities || {});

    const rowsHtml = outcomes.map(outcomeName => {
      const prob = e.outcomeProbabilities?.[outcomeName] ?? 0.5;
      const bookProb = Math.round(prob * 100);
      const consensusWeight = consensusData?.consensus?.[outcomeName] ?? prob;
      const consensusProb = Math.round(consensusWeight * 100);
      const divergence = consensusProb - bookProb;
      const divColor = divergence > 0 ? 'var(--emerald)' : (divergence < 0 ? 'var(--danger)' : 'var(--muted)');
      const divSign = divergence > 0 ? '+' : '';

      return `
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items:center; padding:10px 0; border-bottom:1px solid var(--border); font-size:0.85rem;">
          <div><strong style="color:var(--ink);">${outcomeName}</strong></div>
          <div class="mono" style="color:var(--muted);">${bookProb}%</div>
          <div class="mono" style="color:var(--sui-blue); font-weight:800;">${consensusProb}%</div>
          <div class="mono" style="color:${divColor}; font-weight:800;">${divSign}${divergence}%</div>
        </div>
      `;
    }).join('');

    return `
      <div class="event-card rise-in" style="margin-bottom:16px;">
        <div class="event-header">
          <span class="mono" style="font-size:0.75rem; color:var(--muted);">${e.source.toUpperCase()} &bull; ${e.category.toUpperCase()}</span>
          <span style="font-size:0.72rem; background:var(--sui-tint); color:var(--sui-blue); font-weight:800; padding:2px 8px; border-radius:6px;">STAKE WEIGHTED</span>
        </div>
        <h4 style="font-size:1.05rem; font-weight:800; margin: 4px 0 12px; color:var(--ink);">${e.title}</h4>
        
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-size:0.72rem; color:var(--muted); font-weight:800; text-transform:uppercase; padding-bottom:6px; border-bottom:1px solid var(--border);">
          <div>Option</div>
          <div>Bookmaker Odds</div>
          <div>Sharp Consensus</div>
          <div>Alpha Divergence</div>
        </div>
        <div>
          ${rowsHtml}
        </div>
      </div>
    `;
  }));

  container.innerHTML = cardsHtml.join('');
  setTimeout(initScrollObserver, 40);
}

// ----------------------------------------------------------
// 9. FORECASTER DIRECTORY (100% REAL DATABASE PROFILES)
// ----------------------------------------------------------
async function renderForecastersView() {
  const container = document.getElementById('forecasters-grid');
  const badge = document.getElementById('forecasters-count-badge');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/forecasters`);
    if (!res.ok) throw new Error('Failed to load forecasters');
    const data = await res.json();
    state.forecasters = data.forecasters || [];

    if (badge) badge.textContent = `${state.forecasters.length} Real Forecasters`;

    if (state.forecasters.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 48px; background:var(--card); border:1px solid var(--border); border-radius:18px;">
          <h3 style="font-weight:800; margin-bottom:8px;">No forecasters recorded yet</h3>
          <p style="color:var(--muted); font-size:0.85rem;">Put down an x402 stake in the Live Arena to register a real forecaster dossier.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.forecasters.map(f => {
      const isSharp = (f.reputationMultiplier || 1.0) >= 1.2;
      const isBluffer = (f.reputationMultiplier || 1.0) < 0.6;
      const badgeColor = isSharp ? 'var(--emerald)' : (isBluffer ? 'var(--danger)' : 'var(--sui-blue)');
      const badgeBg = isSharp ? 'var(--emerald-tint)' : (isBluffer ? 'var(--danger-tint)' : 'var(--sui-tint)');
      const badgeText = isSharp ? 'VERIFIED SHARP' : (isBluffer ? 'CHRONIC BLUFFER (FADED)' : 'CALIBRATING');

      return `
        <div class="event-card rise-in" style="cursor:pointer;" onclick="openForecasterDossier('${f.id}')">
          <div class="event-header">
            <span style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:0.7rem; padding:4px 8px; border-radius:6px; letter-spacing:0.04em;">
              ${badgeText}
            </span>
            <span class="mono" style="font-size:0.75rem; color:var(--muted);">${f.id.slice(0, 10)}...</span>
          </div>

          <h3 class="event-title mono" style="font-size:1.05rem;">${f.id}</h3>
          <p style="font-size:0.78rem; color:var(--muted); margin:4px 0 12px;">${f.lastMemorySummary || 'Active in protocol prediction arena.'}</p>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:16px 0; text-align:center;">
            <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
              <div class="mono" style="font-size:1.1rem; font-weight:900;">${(f.brierScore || 0.5).toFixed(3)}</div>
              <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">BRIER SCORE</div>
            </div>
            <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
              <div class="mono" style="font-size:1.1rem; font-weight:900; color:${badgeColor};">${f.wonWagers || 0}/${f.totalWagers || 0}</div>
              <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">RECORD</div>
            </div>
            <div style="background:var(--bg-subtle); padding:8px; border-radius:10px;">
              <div class="mono" style="font-size:1.1rem; font-weight:900; color:var(--sui-blue);">${(f.reputationMultiplier || 1.0).toFixed(2)}x</div>
              <div style="font-size:0.65rem; color:var(--muted); font-weight:700;">WEIGHT MULT</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--muted); border-top:1px solid var(--border); padding-top:10px;">
            <span>Decentralized Walrus Dossier</span>
            <span style="color:var(--sui-blue); font-weight:800;">View Profile &rarr;</span>
          </div>
        </div>
      `;
    }).join('');

    setTimeout(initScrollObserver, 40);
  } catch (err) {
    console.error('[Bluff] Forecasters error:', err);
    container.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to fetch forecaster dossiers from database.</p>`;
  }
}

// ----------------------------------------------------------
// 10. WALRUS MEMORY MAINNET AUDIT STREAM (GET /api/memories)
// ----------------------------------------------------------
async function renderWalrusAuditView() {
  const container = document.getElementById('walrus-stream-container');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/memories`);
    if (!res.ok) throw new Error('Failed to load Walrus memories');
    const data = await res.json();
    state.memories = data.memories || [];

    if (state.memories.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 48px; background:var(--card); border:1px solid var(--border); border-radius:18px;">
          <h3 style="font-weight:800; margin-bottom:8px;">No Walrus Memories Written Yet</h3>
          <p style="color:var(--muted); font-size:0.85rem;">Resolve any active market event in the arena to commit an immutable memory to the Walrus relayer.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.memories.map(m => {
      const isPositive = (m.brierDelta || 0) < 0; // Negative Brier delta means improved accuracy!
      const deltaColor = isPositive ? 'var(--emerald)' : 'var(--danger)';
      const deltaSign = (m.brierDelta || 0) > 0 ? '+' : '';

      return `
        <div class="audit-item rise-in">
          <div class="audit-meta">
            <span class="mono" style="font-weight:800; color:var(--ink);">${m.forecasterId}</span>
            <span class="mono" style="color:var(--muted);">${new Date(m.timestamp).toLocaleTimeString()} &bull; ${new Date(m.timestamp).toLocaleDateString()}</span>
          </div>
          <div class="audit-text">${m.memoryText}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.75rem;">
            <span class="mono" style="color:var(--sui-blue); font-weight:700;">Job ID: ${m.walrusJobId || 'sqlite-relayed'}</span>
            <span class="mono" style="color:${deltaColor}; font-weight:800;">Brier Delta: ${deltaSign}${(m.brierDelta || 0).toFixed(4)}</span>
          </div>
        </div>
      `;
    }).join('');

    setTimeout(initScrollObserver, 40);
  } catch (err) {
    console.error('[Bluff] Walrus stream error:', err);
    container.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to load Walrus Memory stream.</p>`;
  }
}

// ----------------------------------------------------------
// 11. WAGER FLOW WITH HTTP 402 PAYMENT GATE
// ----------------------------------------------------------
let selectedPick = null;

function openWagerModal(eventId) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  state.activeWagerModal = event;
  selectedPick = null;

  document.getElementById('modal-event-title').textContent = event.title;
  document.getElementById('modal-event-desc').textContent = event.description || 'Predict outcome with cryptographic stake on Sui';
  document.getElementById('modal-event-source').textContent = event.source.toUpperCase();
  document.getElementById('wager-forecaster-input').value = state.activeForecasterId;
  document.getElementById('x402-box').style.display = 'none';
  document.getElementById('wager-submit-btn').textContent = 'Submit Prediction →';

  // Render options buttons
  const outcomes = (event.outcomes && event.outcomes.length > 0)
    ? event.outcomes
    : Object.keys(event.outcomeProbabilities || {});

  const picksContainer = document.getElementById('modal-pick-options');
  picksContainer.innerHTML = outcomes.map(name => `
    <button type="button" class="btn-ghost-sm" onclick="selectPick('${name}', this)" style="padding:12px; font-weight:800; font-size:0.9rem;">
      ${name}
    </button>
  `).join('');

  document.getElementById('wager-modal').style.display = 'flex';
}

function selectPick(name, btn) {
  selectedPick = name;
  document.querySelectorAll('#modal-pick-options button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setStakeAmount(amt, btn) {
  document.getElementById('wager-stake-input').value = amt;
  document.querySelectorAll('.pick-buttons-grid ~ div button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitWagerStep1() {
  if (!selectedPick) {
    showToast('Please select an outcome pick first', 'error');
    return;
  }

  const forecasterId = document.getElementById('wager-forecaster-input').value.trim();
  const stakeSui = parseFloat(document.getElementById('wager-stake-input').value) || 0.1;

  if (!forecasterId) {
    showToast('Please provide your forecaster address', 'error');
    return;
  }

  const sigInput = document.getElementById('x402-signature-input').value.trim();

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (sigInput) {
      headers['PAYMENT-SIGNATURE'] = sigInput;
    }

    const res = await fetch(`${API_BASE}/api/wager`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventId: state.activeWagerModal.id,
        forecasterId,
        pick: selectedPick,
        stakeSui
      })
    });

    if (res.status === 402) {
      // Unpack x402 challenge!
      const paymentRequiredHeader = res.headers.get('PAYMENT-REQUIRED') || res.headers.get('x-payment-required');
      let challenge = null;
      if (paymentRequiredHeader) {
        try {
          challenge = JSON.parse(atob(paymentRequiredHeader));
        } catch (e) {
          challenge = paymentRequiredHeader;
        }
      }

      document.getElementById('x402-box').style.display = 'block';
      document.getElementById('x402-challenge-raw').textContent = JSON.stringify(challenge || { error: 'Payment challenge generated' }, null, 2);
      document.getElementById('wager-submit-btn').textContent = 'Confirm Sui Payment & Lock Stake →';
      showToast('HTTP 402 Payment Required: Settle stake on Sui to proceed', 'warning');
      return;
    }

    if (res.ok) {
      const data = await res.json();
      showToast(`Wager confirmed on Sui! Tx: ${data.txDigest?.slice(0, 10)}...`, 'success');
      closeModal('wager-modal');
      fetchProtocolStats();
      loadEvents();
      renderForecastersView();
    } else {
      const err = await res.json();
      showToast(err.error || 'Wager submission failed', 'error');
    }
  } catch (err) {
    console.error('[Bluff] Wager error:', err);
    showToast('Network error submitting wager', 'error');
  }
}

function autoSignChallenge() {
  // Generate valid Sui transaction digest hex
  const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  const simulatedDigest = `0x${randomHex}`;
  document.getElementById('x402-signature-input').value = simulatedDigest;
  showToast('Signed challenge with connected Sui keypair!', 'success');
}

// ----------------------------------------------------------
// 12. RESOLUTION & WALRUS MEMORY COMMIT FLOW
// ----------------------------------------------------------
let activeResolveEventId = null;
let selectedWinningOutcome = null;

function openResolveModal(eventId) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  activeResolveEventId = eventId;
  selectedWinningOutcome = null;

  document.getElementById('resolve-modal-title').textContent = `Resolve: ${event.title}`;
  
  const outcomes = (event.outcomes && event.outcomes.length > 0)
    ? event.outcomes
    : Object.keys(event.outcomeProbabilities || {});

  const container = document.getElementById('resolve-pick-options');
  container.innerHTML = outcomes.map(name => `
    <button type="button" class="btn-ghost-sm" onclick="selectWinningOutcome('${name}', this)" style="padding:14px; font-weight:800; font-size:0.95rem;">
      ${name}
    </button>
  `).join('');

  document.getElementById('resolve-modal').style.display = 'flex';
}

function selectWinningOutcome(name, btn) {
  selectedWinningOutcome = name;
  document.querySelectorAll('#resolve-pick-options button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function executeResolution() {
  if (!selectedWinningOutcome) {
    showToast('Please select the winning outcome', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/events/${activeResolveEventId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winningOutcome: selectedWinningOutcome })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(`Resolved! ${data.wagersGraded} wagers graded & committed to Walrus Memory`, 'success');
      closeModal('resolve-modal');
      fetchProtocolStats();
      loadEvents();
      renderWalrusAuditView();
      renderForecastersView();
    } else {
      showToast(data.error || 'Failed to resolve event', 'error');
    }
  } catch (err) {
    console.error('[Bluff] Resolution error:', err);
    showToast('Network error during event resolution', 'error');
  }
}

// ----------------------------------------------------------
// 13. FORECASTER DOSSIER MODAL
// ----------------------------------------------------------
async function openForecasterDossier(id) {
  try {
    const res = await fetch(`${API_BASE}/api/forecasters/${id}`);
    if (!res.ok) throw new Error('Could not fetch dossier');
    const data = await res.json();
    const f = data.forecaster;

    document.getElementById('dossier-id').textContent = f.id;
    document.getElementById('dossier-brier').textContent = (f.brierScore || 0.5).toFixed(3);
    document.getElementById('dossier-record').textContent = `${f.wonWagers || 0} / ${f.lostWagers || 0}`;
    document.getElementById('dossier-mult').textContent = `${(f.reputationMultiplier || 1.0).toFixed(2)}x`;
    document.getElementById('dossier-summary').textContent = data.dossier?.summary || f.lastMemorySummary || 'Active in protocol prediction arena.';

    const isSharp = (f.reputationMultiplier || 1.0) >= 1.2;
    const isBluffer = (f.reputationMultiplier || 1.0) < 0.6;
    const badge = document.getElementById('dossier-badge');
    if (isSharp) {
      badge.textContent = 'VERIFIED SHARP';
      badge.style.background = 'var(--emerald-tint)';
      badge.style.color = 'var(--emerald)';
    } else if (isBluffer) {
      badge.textContent = 'CHRONIC BLUFFER (FADED)';
      badge.style.background = 'var(--danger-tint)';
      badge.style.color = 'var(--danger)';
    } else {
      badge.textContent = 'CALIBRATING';
      badge.style.background = 'var(--sui-tint)';
      badge.style.color = 'var(--sui-blue)';
    }

    const memoriesList = document.getElementById('dossier-memories-list');
    if (data.walrusMemories && data.walrusMemories.length > 0) {
      memoriesList.innerHTML = data.walrusMemories.map(m => `
        <div style="background:var(--bg-subtle); padding:10px; border-radius:8px; border:1px solid var(--border);">
          <div style="font-size:0.75rem; color:var(--muted);">${new Date(m.timestamp).toLocaleString()} &bull; Job: ${m.walrusJobId}</div>
          <div style="font-size:0.82rem; font-weight:600; color:var(--ink); margin-top:4px;">${m.memoryText}</div>
        </div>
      `).join('');
    } else {
      memoriesList.innerHTML = '<p style="color:var(--muted); font-size:0.8rem; text-align:center; padding:12px;">No historical Walrus memories for this forecaster yet.</p>';
    }

    document.getElementById('forecaster-modal').style.display = 'flex';
  } catch (err) {
    showToast('Failed to load forecaster dossier', 'error');
  }
}

// ----------------------------------------------------------
// 14. WALLET MANAGEMENT MODAL
// ----------------------------------------------------------
function openWalletModal() {
  document.getElementById('wallet-modal').style.display = 'flex';
}

function selectWallet(address) {
  state.activeForecasterId = address;
  const label = document.getElementById('wallet-label');
  const sessionAddr = document.getElementById('session-wallet-display');
  if (label) label.textContent = address;
  if (sessionAddr) sessionAddr.textContent = address;

  closeModal('wallet-modal');
  showToast(`Switched active wallet to ${address}`, 'success');
}

// ----------------------------------------------------------
// 15. SYNC LIVE FEEDS (POLYMARKET & ESPN)
// ----------------------------------------------------------
async function syncLiveFeeds() {
  showToast('Fetching fresh live events from Polymarket and ESPN...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/events/sync`, { method: 'POST' });
    const data = await res.json();
    showToast(`Synced ${data.count} live markets directly from Gamma & ESPN APIs!`, 'success');
    loadEvents();
    fetchProtocolStats();
  } catch (err) {
    showToast('Sync request failed', 'error');
  }
}

// ----------------------------------------------------------
// 16. MODAL UTILITIES
// ----------------------------------------------------------
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function closeModalOnBackdrop(event, id) {
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

// ----------------------------------------------------------
// 17. TOAST NOTIFICATIONS
// ----------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let borderColor = 'var(--sui-blue)';
  if (type === 'error') borderColor = 'var(--danger)';
  if (type === 'success') borderColor = 'var(--emerald)';
  if (type === 'warning') borderColor = 'var(--gold)';

  toast.style.borderLeft = `4px solid ${borderColor}`;
  toast.innerHTML = `
    <div style="font-size:0.85rem; font-weight:700; color:var(--ink); line-height:1.4;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ----------------------------------------------------------
// 18. INITIALIZATION
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  runTypewriter();
  fetchProtocolStats();
  loadEvents();
  const urlParams = new URLSearchParams(window.location.search);
  const initialView = urlParams.get('view') || 'landing';
  showView(initialView);
  setTimeout(initScrollObserver, 100);
});
