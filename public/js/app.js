// ── Player form management ──

let players = [];

const POSITIONS = ['GK','CB','SB','CM','CAM','LW','RW','ST'];

function initForm() {
  if (typeof INITIAL_PLAYERS === 'undefined') return;
  players = INITIAL_PLAYERS.map(p => ({ ...p }));
  renderPlayers();
}

function addPlayer(team) {
  players.push({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    team,
    name: '',
    jersey_number: '',
    position: '',
    rating: '',
    note: ''
  });
  renderPlayers();
  // フォーカスを新しい行の名前フィールドへ
  const inputs = document.querySelectorAll('.player-row-name');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removePlayer(idx) {
  players.splice(idx, 1);
  renderPlayers();
}

function updatePlayer(idx, field, value) {
  players[idx][field] = value;
  syncJson();
}

function syncJson() {
  document.getElementById('players-json').value = JSON.stringify(players);
}

function renderPlayers() {
  syncJson();
  const container = document.getElementById('players-container');
  const empty     = document.getElementById('players-empty');
  if (!container) return;

  if (players.length === 0) {
    container.innerHTML = '';
    empty && (empty.style.display = 'block');
    return;
  }
  empty && (empty.style.display = 'none');

  container.innerHTML = players.map((p, i) => `
    <div class="player-row ${p.team}">
      <div class="player-row-team-badge ${p.team}">${p.team === 'home' ? 'HOME' : 'AWAY'}</div>
      <div class="player-row-fields">
        <input class="form-input player-row-name" type="text" placeholder="選手名" value="${esc(p.name)}"
               oninput="updatePlayer(${i},'name',this.value)">
        <input class="form-input player-row-number" type="text" placeholder="#" value="${esc(p.jersey_number)}"
               oninput="updatePlayer(${i},'jersey_number',this.value)">
        <select class="form-input player-row-pos" onchange="updatePlayer(${i},'position',this.value)">
          <option value="">ポジション</option>
          ${POSITIONS.map(pos => `<option value="${pos}"${p.position===pos?' selected':''}>${pos}</option>`).join('')}
        </select>
        <div class="rating-field">
          <input class="form-input player-row-rating" type="number" min="1" max="10" step="0.1"
                 placeholder="採点" value="${p.rating !== '' ? p.rating : ''}"
                 oninput="updatePlayer(${i},'rating',this.value ? parseFloat(this.value) : '')">
          <span class="rating-suffix">/10</span>
        </div>
        <input class="form-input player-row-note" type="text" placeholder="メモ（任意）" value="${esc(p.note)}"
               oninput="updatePlayer(${i},'note',this.value)">
      </div>
      <button type="button" class="btn-remove-player" onclick="removePlayer(${i})" title="削除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Form submit: sync JSON before submit ──
document.addEventListener('DOMContentLoaded', () => {
  initForm();
  const form = document.getElementById('match-form');
  if (form) {
    form.addEventListener('submit', () => syncJson());
  }
});
