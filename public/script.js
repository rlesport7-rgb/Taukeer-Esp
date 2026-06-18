// ---------- API ----------
const API = '/api';
let players = [], games = [], library = [], team = {};
let adminAuthenticated = false;
let autoRefreshInterval = null;
let saveDebounceTimer = null;

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ---------- Loading screen ----------
window.addEventListener('load', () => {
  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('fade');
  }, 800);
});

// ---------- Fetch data ----------
async function fetchData() {
  try {
    const [pRes, gRes, lRes, tRes] = await Promise.all([
      fetch(API + '/players'),
      fetch(API + '/games'),
      fetch(API + '/library'),
      fetch(API + '/team')
    ]);
    players = await pRes.json();
    games = await gRes.json();
    library = await lRes.json();
    team = await tRes.json();
  } catch (e) { console.error('Fetch error', e); }
}

// ---------- Render public sections ----------
function renderRoster() {
  const grid = $('rosterGrid');
  if (!grid) return;
  if (!players.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1; text-align:center; padding:40px;">No players yet.</div>`;
    return;
  }
  grid.innerHTML = players.map(p => `
    <div class="card player-card scroll-animate">
      <img src="${p.photo || '/uploads/default-u.png'}" alt="${p.name}">
      <h3>${p.name}</h3>
      <span class="role-badge ${p.role}">${p.role}</span>
      <div class="stat-line">K/D: ${(p.stats?.kills / p.stats?.deaths || 0).toFixed(2)}</div>
      <div class="stat-line">Kills: ${p.stats?.kills || 0}</div>
    </div>
  `).join('');
  observeScroll();
}

function renderGames() {
  const container = $('gamesList');
  if (!container) return;
  if (!library.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:40px;">No games available.</div>`;
    return;
  }
  const gameNames = library.map(l => l.name);
  const gameStats = {};
  gameNames.forEach(name => { gameStats[name] = {}; });
  games.forEach(match => {
    const gName = match.gameName;
    if (gName && gameStats[gName]) {
      match.playerStats.forEach(ps => {
        if (!gameStats[gName][ps.playerId]) {
          gameStats[gName][ps.playerId] = { kills: 0, deaths: 0, assists: 0 };
        }
        gameStats[gName][ps.playerId].kills += ps.kills || 0;
        gameStats[gName][ps.playerId].deaths += ps.deaths || 0;
        gameStats[gName][ps.playerId].assists += ps.assists || 0;
      });
    }
  });

  container.innerHTML = library.map(lib => {
    const statsForGame = gameStats[lib.name] || {};
    const playerIds = Object.keys(statsForGame);
    const playerRows = playerIds.map(pid => {
      const p = players.find(pl => pl.id === pid);
      const s = statsForGame[pid];
      return `<tr><td>${p ? p.name : 'Unknown'}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.assists}</td></tr>`;
    }).join('') || '<tr><td colspan="4">No players yet</td></tr>';

    return `
      <div class="card game-item scroll-animate" data-game="${lib.name}">
        <div class="game-header" onclick="toggleGameDetails('${lib.name}')">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${lib.logo || '/uploads/shadow.png'}" style="height:30px; width:auto;" />
            <strong>${lib.name}</strong>
            <span style="color:#888; font-size:0.9rem;">${playerIds.length} players</span>
          </div>
          <span style="color:#00c8ff;">▼</span>
        </div>
        <div class="game-details" id="details-${lib.name}">
          <table class="game-stats-table">
            <thead><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>Assists</th></tr></thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  window.toggleGameDetails = (name) => {
    const details = document.getElementById(`details-${name}`);
    if (details) details.classList.toggle('open');
  };
  observeScroll();
}

function renderStats() {
  const container = $('statsTable');
  if (!container) return;
  if (!players.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:40px;">No data.</div>`;
    return;
  }
  const sorted = [...players].sort((a, b) => (b.stats?.kills || 0) - (a.stats?.kills || 0));
  let html = `<div class="card" style="overflow-x:auto;"><table class="stats-table">
    <thead><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>K/D</th><th>MVP</th></tr></thead><tbody>`;
  sorted.forEach(p => {
    const s = p.stats || {};
    const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : '0';
    html += `<tr><td><img src="${p.photo || '/uploads/default-u.png'}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:10px;">${p.name}</td>
      <td>${s.kills || 0}</td><td>${s.deaths || 0}</td><td>${kd}</td><td>${s.mvp || 0}</td></tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ---------- Admin Modal ----------
function initAdminModal() {
  const modal = $('adminModal');
  const toggleBtn = $('adminToggle');
  const closeBtn = modal.querySelector('.admin-close');

  toggleBtn.addEventListener('click', () => {
    modal.classList.add('show');
    renderAdmin();
    // Start auto-refresh when admin opens
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(() => {
      if (adminAuthenticated) {
        fetchData().then(() => {
          renderAdmin();
          renderRoster();
          renderGames();
          renderStats();
        });
      }
    }, 3000);
  });
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
      }
    }
  });
}

// ---------- Admin Rendering ----------
function renderAdmin() {
  const container = $('adminContainer');
  if (!container) return;

  if (!adminAuthenticated) {
    container.innerHTML = `
      <div class="admin-login-wrapper">
        <div class="admin-login">
          <span class="shield-icon">🛡️</span>
          <h3>Admin Panel</h3>
          <p>Enter password to access</p>
          <form id="adminLoginForm">
            <input type="password" id="adminPass" placeholder="Password" autofocus />
            <button type="submit" class="btn btn-primary">Unlock</button>
            <div id="loginError" class="error" style="display:none;">Incorrect password</div>
          </form>
        </div>
      </div>
    `;
    const loginForm = $('adminLoginForm');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = $('adminPass').value;
      if (pass === 'shadow') {
        adminAuthenticated = true;
        renderAdmin();
      } else {
        const err = $('loginError');
        err.style.display = 'block';
        setTimeout(() => err.style.display = 'none', 3000);
      }
    });
    return;
  }

  // Admin view
  if (!library.length) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:40px;">No games found.</div>`;
    return;
  }

  let html = `<h3>Manage Teams <span class="auto-save-indicator">⚡ auto‑save</span></h3>`;
  // Clear all button
  html += `<div style="margin-bottom:16px;"><button class="btn btn-danger" onclick="clearAllData()">🗑️ Clear All Data</button></div>`;
  html += `<div id="gameAdminList">`;

  library.forEach(lib => {
    const relatedMatches = games.filter(m => m.gameName === lib.name);
    const playerIds = new Set();
    relatedMatches.forEach(m => m.playerStats.forEach(ps => playerIds.add(ps.playerId)));
    const gamePlayers = Array.from(playerIds).map(pid => players.find(p => p.id === pid)).filter(Boolean);
    const playerRows = gamePlayers.map(p => {
      let totalKills = 0, totalDeaths = 0, totalAssists = 0;
      relatedMatches.forEach(m => {
        const ps = m.playerStats.find(s => s.playerId === p.id);
        if (ps) {
          totalKills += ps.kills || 0;
          totalDeaths += ps.deaths || 0;
          totalAssists += ps.assists || 0;
        }
      });
      return `<tr data-player-id="${p.id}">
        <td><img src="${p.photo || '/uploads/default-u.png'}" style="width:28px;height:28px;border-radius:50%;vertical-align:middle;margin-right:6px;">${p.name}</td>
        <td><input type="number" class="stat-kills" value="${totalKills}" data-player="${p.id}" /></td>
        <td><input type="number" class="stat-deaths" value="${totalDeaths}" data-player="${p.id}" /></td>
        <td><input type="number" class="stat-assists" value="${totalAssists}" data-player="${p.id}" /></td>
        <td><button class="remove-player" onclick="removePlayer('${lib.name}','${p.id}')" title="Remove player">🗑️</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="5">No players in this game yet.</td></tr>';

    html += `
      <div class="game-admin-card" data-game="${lib.name}">
        <div class="game-header">
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <img src="${lib.logo || '/uploads/shadow.png'}" style="height:30px;" />
            <strong>${lib.name}</strong>
            <span style="color:#888; font-size:0.9rem;">${gamePlayers.length} players</span>
          </div>
          <div>
            <button class="btn btn-outline btn-sm" onclick="toggleGameAdmin('${lib.name}')">${'Expand'}</button>
          </div>
        </div>
        <div class="game-body" id="gameBody-${lib.name}">
          <h5 style="margin-bottom:8px;">Team Roster</h5>
          <div class="add-player-form">
            <input type="text" id="newPlayerName-${lib.name}" placeholder="Player name" />
            <select id="newPlayerRole-${lib.name}">
              <option value="unknown">Unknown</option>
              <option value="igl">IGL</option>
              <option value="entry">Entry</option>
              <option value="support">Support</option>
              <option value="anchor">Anchor</option>
              <option value="flex">Flex</option>
            </select>
            <div class="file-upload-wrapper">
              <span class="file-upload-label">📷 Upload Photo</span>
              <input type="file" id="newPlayerPhoto-${lib.name}" accept="image/*" />
            </div>
            <button class="btn btn-primary btn-sm" onclick="addPlayerToGame('${lib.name}')">Add Player</button>
          </div>
          <div class="player-list">
            <table>
              <thead><tr><th>Player</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>Action</th></tr></thead>
              <tbody id="statRows-${lib.name}">
                ${playerRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Attach auto-save events to all stat inputs
  document.querySelectorAll('.stat-kills, .stat-deaths, .stat-assists').forEach(input => {
    input.addEventListener('input', () => {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        const gameName = input.closest('.game-admin-card')?.dataset.game;
        if (gameName) autoSaveStats(gameName);
      }, 500);
    });
  });

  // Expand/collapse toggle
  window.toggleGameAdmin = (gameName) => {
    const body = document.getElementById(`gameBody-${gameName}`);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    document.querySelectorAll('.game-body.open').forEach(b => b.classList.remove('open'));
    if (!isOpen) {
      body.classList.add('open');
      // Change button text
      const btn = body.closest('.game-admin-card').querySelector('.game-header .btn');
      if (btn) btn.textContent = 'Collapse';
    } else {
      const btn = body.closest('.game-admin-card').querySelector('.game-header .btn');
      if (btn) btn.textContent = 'Expand';
    }
  };

  // Function to auto-save stats for a specific game
  window.autoSaveStats = async (gameName) => {
    const rows = document.querySelectorAll(`#statRows-${gameName} tr`);
    const teamMatch = games.find(m => m.gameName === gameName && m.opponent === 'Team');
    if (!teamMatch) return; // no team match yet
    const newStats = [];
    rows.forEach(row => {
      const nameCell = row.querySelector('td:first-child');
      if (!nameCell) return;
      const name = nameCell.textContent.trim();
      const player = players.find(p => p.name === name);
      if (!player) return;
      const kills = parseInt(row.querySelector('.stat-kills')?.value) || 0;
      const deaths = parseInt(row.querySelector('.stat-deaths')?.value) || 0;
      const assists = parseInt(row.querySelector('.stat-assists')?.value) || 0;
      newStats.push({ playerId: player.id, kills, deaths, assists });
    });
    const updatedMatch = { ...teamMatch, playerStats: newStats };
    await fetch(API + '/games/' + teamMatch.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMatch)
    });
  };

  // Function to remove a player
  window.removePlayer = async (gameName, playerId) => {
    if (!confirm(`Remove this player from ${gameName}?`)) return;
    const relatedMatches = games.filter(m => m.gameName === gameName);
    for (let match of relatedMatches) {
      const updatedStats = match.playerStats.filter(ps => ps.playerId !== playerId);
      const updatedMatch = { ...match, playerStats: updatedStats };
      await fetch(API + '/games/' + match.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMatch)
      });
    }
    await fetchData();
    renderAdmin();
    renderGames();
    renderRoster();
    renderStats();
  };

  // Function to clear all data
  window.clearAllData = async () => {
    if (!confirm('⚠️ This will remove all players and match stats. Are you sure?')) return;
    await fetch(API + '/clear-all', { method: 'POST' });
    await fetchData();
    renderAdmin();
    renderRoster();
    renderGames();
    renderStats();
    alert('All data cleared.');
  };

  // Add player function
  window.addPlayerToGame = async (gameName) => {
    const nameInput = document.getElementById(`newPlayerName-${gameName}`);
    const roleSelect = document.getElementById(`newPlayerRole-${gameName}`);
    const photoInput = document.getElementById(`newPlayerPhoto-${gameName}`);
    const name = nameInput.value.trim();
    if (!name) { alert('Please enter a player name'); return; }
    const role = roleSelect.value;
    const formData = new FormData();
    const playerData = {
      name: name,
      role: role,
      bio: '',
      stats: { kills: 0, deaths: 0, assists: 0, accuracy: 0.5, headshots: 0, roundsWon: 0, mvp: 0 }
    };
    formData.append('player', JSON.stringify(playerData));
    if (photoInput.files.length > 0) formData.append('photo', photoInput.files[0]);
    const res = await fetch(API + '/players', { method: 'POST', body: formData });
    const newPlayer = await res.json();
    // Find or create a "Team" match
    let teamMatch = games.find(m => m.gameName === gameName && m.opponent === 'Team');
    if (!teamMatch) {
      const matchData = {
        date: new Date().toISOString().slice(0,10),
        opponent: 'Team',
        gameName: gameName,
        map: '',
        type: 'scrim',
        result: 'draw',
        score: '0-0',
        tournament: '',
        playerStats: []
      };
      const mRes = await fetch(API + '/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchData)
      });
      teamMatch = await mRes.json();
    }
    const updatedStats = [...teamMatch.playerStats, { playerId: newPlayer.id, kills: 0, deaths: 0, assists: 0 }];
    const updatedMatch = { ...teamMatch, playerStats: updatedStats };
    await fetch(API + '/games/' + teamMatch.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMatch)
    });
    // Clear the file input
    photoInput.value = '';
    nameInput.value = '';
    await fetchData();
    renderAdmin();
    renderGames();
    renderRoster();
    renderStats();
  };
}

// ---------- Scroll animations ----------
function observeScroll() {
  const els = document.querySelectorAll('.scroll-animate');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.15 });
  els.forEach(el => observer.observe(el));
}

// ---------- Init ----------
async function init() {
  await fetchData();
  renderRoster();
  renderGames();
  renderStats();
  initAdminModal();
  setTimeout(observeScroll, 300);
}

document.addEventListener('DOMContentLoaded', init);