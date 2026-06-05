// ── State ──
let selectedFile = null;

// ── View Management ──
function showView(id) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  const target = document.getElementById(id);
  target.classList.remove('hidden');
  target.classList.add('active');
}

// ── Upload Zone Setup ──
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const videoInput = document.getElementById('video-input');

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleVideoSelect(file);
  });
  dropZone.addEventListener('click', () => videoInput.click());

  videoInput.addEventListener('change', e => {
    if (e.target.files[0]) handleVideoSelect(e.target.files[0]);
  });
});

function handleVideoSelect(file) {
  selectedFile = file;
  const videoEl = document.getElementById('video-preview');
  const url = URL.createObjectURL(file);
  videoEl.src = url;

  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatBytes(file.size);

  videoEl.addEventListener('loadedmetadata', () => {
    const frameCount = Math.min(20, Math.max(8, Math.floor(videoEl.duration / 15)));
    document.getElementById('frame-count-label').textContent =
      `動画時間: ${formatDuration(videoEl.duration)} / ${frameCount} フレームを分析`;
  }, { once: true });

  document.getElementById('drop-zone').classList.add('hidden');
  document.getElementById('video-preview-area').classList.remove('hidden');
}

function resetUpload() {
  selectedFile = null;
  const videoEl = document.getElementById('video-preview');
  if (videoEl.src) URL.revokeObjectURL(videoEl.src);
  videoEl.src = '';
  document.getElementById('video-input').value = '';
  document.getElementById('drop-zone').classList.remove('hidden');
  document.getElementById('video-preview-area').classList.add('hidden');
}

function resetToUpload() {
  resetUpload();
  showView('upload-view');
}

// ── Frame Extraction ──
async function extractFrames(videoEl, count) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const frames = [];
  const duration = videoEl.duration;
  const MAX_W = 854;
  const MAX_H = 480;

  const scale = Math.min(MAX_W / videoEl.videoWidth, MAX_H / videoEl.videoHeight, 1);
  canvas.width = Math.floor(videoEl.videoWidth * scale);
  canvas.height = Math.floor(videoEl.videoHeight * scale);

  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (duration - 0.1);
    videoEl.currentTime = Math.max(0, t);
    await new Promise(resolve => videoEl.addEventListener('seeked', resolve, { once: true }));

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL('image/jpeg', 0.72));

    setProgress(10 + Math.floor((i / count) * 40));
  }

  return frames;
}

// ── Progress Helpers ──
function setProgress(pct) {
  document.getElementById('progress-bar').style.width = pct + '%';
}

function setStep(n) {
  [1, 2, 3].forEach(i => {
    const el = document.getElementById('step-' + i);
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    else if (i === n) el.classList.add('active');
  });
}

function setSubtitle(text) {
  document.getElementById('progress-subtitle').textContent = text;
}

// ── Analysis ──
async function startAnalysis() {
  if (!selectedFile) return;

  showView('progress-view');
  setProgress(5);
  setStep(1);
  setSubtitle('フレームを抽出しています...');

  try {
    const videoEl = document.getElementById('video-preview');
    const duration = videoEl.duration || 0;
    const frameCount = Math.min(20, Math.max(8, Math.floor(duration / 15)));

    const frames = await extractFrames(videoEl, frameCount);

    setStep(2);
    setSubtitle('Claude AI が分析中...');
    setProgress(55);

    const response = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frames })
    });

    setProgress(85);
    setStep(3);
    setSubtitle('レポートを生成しています...');

    const data = await response.json();

    if (data.error) throw new Error(data.error);

    setProgress(100);
    await sleep(600);

    renderResults(data);
    showView('results-view');

  } catch (err) {
    renderError(err.message);
    showView('results-view');
  }
}

// ── Render Results ──
function renderResults(data) {
  const { match, players, team_stats, match_highlights, mvp_jersey_number, mvp_team } = data;
  const container = document.getElementById('results-content');

  let html = '<div class="results-body">';

  // Analysis note
  if (match.analysis_note) {
    html += `<div class="analysis-note"><span>ℹ️</span><span>${esc(match.analysis_note)}</span></div>`;
  }

  // Match overview
  const homeColor = colorForTeam('home');
  const awayColor = colorForTeam('away');
  html += `
    <div class="match-overview">
      <div class="team-block home">
        <div class="team-name-lg">
          <span class="team-color-dot" style="background:${homeColor}"></span>
          ${esc(match.home_team)}
        </div>
        <div class="team-sub">${esc(match.home_color || '')}</div>
        <div class="match-meta">ボール支配率 ${team_stats.home.possession}%</div>
      </div>
      <div class="score-block">
        <div class="score-display">${esc(match.estimated_score || '?-?')}</div>
        <div class="score-label">推定スコア</div>
      </div>
      <div class="team-block away">
        <div class="team-name-lg">
          ${esc(match.away_team)}
          <span class="team-color-dot" style="background:${awayColor}"></span>
        </div>
        <div class="team-sub">${esc(match.away_color || '')}</div>
        <div class="match-meta">ボール支配率 ${team_stats.away.possession}%</div>
      </div>
    </div>
  `;

  // Team stats
  html += renderTeamStats(team_stats, match);

  // Players
  html += '<div class="players-section">';
  html += '<h2 class="section-title">選手評価</h2>';
  html += '<div class="players-grid">';

  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  for (const player of sorted) {
    const isMvp = String(player.jersey_number) === String(mvp_jersey_number) && player.team === mvp_team;
    html += renderPlayerCard(player, isMvp);
  }

  html += '</div></div>';

  // Highlights
  if (match_highlights && match_highlights.length > 0) {
    html += '<div class="highlights-section">';
    html += '<h2 class="section-title">試合ハイライト</h2>';
    html += '<ul class="highlights-list">';
    for (const h of match_highlights) {
      html += `<li class="highlight-item">${esc(h)}</li>`;
    }
    html += '</ul></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderTeamStats(team_stats, match) {
  const h = team_stats.home;
  const a = team_stats.away;

  const rows = [
    { label: 'ボール支配率', hv: h.possession + '%', av: a.possession + '%', hp: h.possession, ap: a.possession },
    { label: 'シュート', hv: h.shots, av: a.shots, hp: h.shots, ap: a.shots },
    { label: '枠内シュート', hv: h.shots_on_target, av: a.shots_on_target, hp: h.shots_on_target, ap: a.shots_on_target },
    { label: 'コーナーキック', hv: h.corners, av: a.corners, hp: h.corners, ap: a.corners },
    { label: 'ファウル', hv: h.fouls, av: a.fouls, hp: h.fouls, ap: a.fouls },
    { label: 'イエローカード', hv: h.yellow_cards, av: a.yellow_cards, hp: h.yellow_cards, ap: a.yellow_cards },
  ];

  let html = '<div class="team-stats-section">';
  html += '<h2 class="section-title">チームスタッツ</h2>';
  html += '<div class="stat-bars-card">';

  for (const row of rows) {
    const total = (row.hp || 0) + (row.ap || 0) || 1;
    const hw = Math.round((row.hp / total) * 100);
    const aw = Math.round((row.ap / total) * 100);
    html += `
      <div>
        <div class="stat-row">
          <div class="stat-val-home">${row.hv}</div>
          <div class="stat-label-center">${row.label}</div>
          <div class="stat-val-away">${row.av}</div>
        </div>
        <div class="stat-bar-row">
          <div class="bar-home-wrap"><div class="bar-fill home" style="width:${hw}%"></div></div>
          <div class="bar-away-wrap"><div class="bar-fill away" style="width:${aw}%"></div></div>
        </div>
      </div>
    `;
  }

  html += '</div></div>';
  return html;
}

function renderPlayerCard(player, isMvp) {
  const team = player.team === 'home' ? 'home' : 'away';
  const ratingColor = getRatingColor(player.rating);
  const ratingLabel = getRatingLabel(player.rating);
  const attrs = player.attributes || {};
  const stats = player.stats || {};

  const radar = createRadarChart(attrs);
  const posClass = team === 'home' ? 'pos-home' : 'pos-away';

  let card = `<div class="player-card${isMvp ? ' mvp' : ''}">`;

  // Header
  card += `<div class="player-card-header">
    <div class="player-left">
      <div class="jersey ${team}">${esc(player.jersey_number)}</div>
      <div class="player-info">
        <span class="player-pos ${posClass}">${esc(player.position)}</span>
        <span class="player-name">${esc(player.name || 'Unknown')}</span>
      </div>
    </div>
    <div class="rating-block">
      <div class="rating-number" style="color:${ratingColor}">${player.rating.toFixed(1)}</div>
      <div class="rating-label">${ratingLabel}</div>
      ${isMvp ? '<div class="mvp-badge">⭐ MVP</div>' : ''}
    </div>
  </div>`;

  // Body
  card += `<div class="player-card-body">
    <div class="radar-wrap">${radar}</div>
    <div class="stats-mini">
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.goals ?? 0}</span><span class="stat-mini-key">ゴール</span></div>
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.assists ?? 0}</span><span class="stat-mini-key">アシスト</span></div>
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.shots ?? 0}</span><span class="stat-mini-key">シュート</span></div>
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.pass_accuracy ?? 0}%</span><span class="stat-mini-key">パス精度</span></div>
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.tackles ?? 0}</span><span class="stat-mini-key">タックル</span></div>
      <div class="stat-mini-item"><span class="stat-mini-val">${stats.key_passes ?? 0}</span><span class="stat-mini-key">チャンス創出</span></div>
    </div>
  </div>`;

  // Highlight
  if (player.highlight) {
    card += `<div class="player-highlight">${esc(player.highlight)}</div>`;
  }

  card += '</div>';
  return card;
}

// ── Radar Chart ──
function createRadarChart(attrs) {
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size / 2) * 0.72;
  const lblR = (size / 2) * 0.96;

  const axes = [
    { key: 'pace', label: 'PAC' },
    { key: 'shooting', label: 'SHO' },
    { key: 'passing', label: 'PAS' },
    { key: 'dribbling', label: 'DRI' },
    { key: 'defending', label: 'DEF' },
    { key: 'physical', label: 'PHY' }
  ];
  const n = axes.length;

  const pt = (val, i, r) => {
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2;
    const radius = r !== undefined ? r : (val / 100) * maxR;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = axes.map((_, i) => pt(100, i, maxR * f).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
  }).join('');

  // Axis spokes
  const spokes = axes.map((_, i) => {
    const [x, y] = pt(100, i);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>`;
  }).join('');

  // Data shape
  const dataPts = axes.map(({ key }, i) => pt(attrs[key] || 50, i).join(',')).join(' ');

  // Dots
  const dots = axes.map(({ key }, i) => {
    const [x, y] = pt(attrs[key] || 50, i);
    return `<circle cx="${x}" cy="${y}" r="2.5" fill="#00e676"/>`;
  }).join('');

  // Labels
  const labels = axes.map(({ label }, i) => {
    const [x, y] = pt(100, i, lblR);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" fill="#666" font-weight="700" font-family="Inter,sans-serif">${label}</text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${rings}${spokes}
    <polygon points="${dataPts}" fill="rgba(0,230,118,0.2)" stroke="#00e676" stroke-width="1.5"/>
    ${dots}${labels}
  </svg>`;
}

// ── Error ──
function renderError(msg) {
  document.getElementById('results-content').innerHTML = `
    <div class="results-body">
      <div class="error-card">
        <h3>分析エラー</h3>
        <p>${esc(msg)}</p>
        <button class="btn-secondary" onclick="resetToUpload()">← 最初からやり直す</button>
      </div>
    </div>
  `;
}

// ── Utilities ──
function getRatingColor(r) {
  if (r >= 9.0) return '#ffd600';
  if (r >= 8.0) return '#00e676';
  if (r >= 7.0) return '#69f0ae';
  if (r >= 6.0) return '#ffeb3b';
  if (r >= 5.0) return '#ffa726';
  return '#ff5252';
}

function getRatingLabel(r) {
  if (r >= 9.0) return '卓越';
  if (r >= 8.0) return '優秀';
  if (r >= 7.0) return '良好';
  if (r >= 6.0) return '平均';
  if (r >= 5.0) return '平均以下';
  return '不振';
}

function colorForTeam(team) {
  return team === 'home' ? '#2979ff' : '#ff5252';
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
