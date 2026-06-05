// ── State ──
let selectedFile = null;
let currentTab   = 'file';

// ── Tab Switching ──
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-file').classList.toggle('active', tab === 'file');
  document.getElementById('tab-youtube').classList.toggle('active', tab === 'youtube');
  document.getElementById('panel-file').classList.toggle('hidden', tab !== 'file');
  document.getElementById('panel-youtube').classList.toggle('hidden', tab !== 'youtube');
}

// ── YouTube URL Input ──
function onYtUrlInput(val) {
  const btn = document.getElementById('yt-analyze-btn');
  const previewWrap = document.getElementById('yt-preview-wrap');
  const videoId = extractYouTubeId(val.trim());

  if (videoId) {
    document.getElementById('yt-thumbnail').src =
      `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    document.getElementById('yt-title').textContent = val.trim();
    previewWrap.classList.remove('hidden');
    btn.disabled = false;
  } else {
    previewWrap.classList.add('hidden');
    btn.disabled = true;
  }
}

function extractYouTubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ── YouTube Analysis ──
async function startYouTubeAnalysis() {
  const url = document.getElementById('yt-url-input').value.trim();
  if (!url) return;

  showView('progress-view');
  setProgress(10);
  setStep(1);
  setSubtitle('YouTubeから動画をダウンロード中...');

  try {
    setProgress(30);
    setStep(2);
    setSubtitle('Claude AI が分析中... (動画の長さによっては数分かかります)');

    const response = await fetch('/analyze-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(360000)  // 6分タイムアウト
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

  const homePlayers = [...players].filter(p => p.team === 'home').sort((a, b) => b.rating - a.rating);
  const awayPlayers = [...players].filter(p => p.team === 'away').sort((a, b) => b.rating - a.rating);

  const renderTeamGroup = (teamPlayers, teamClass, teamName) => {
    if (teamPlayers.length === 0) return '';
    let g = `<div class="players-team-group">`;
    g += `<div class="players-team-label ${teamClass}">${esc(teamName)}</div>`;
    g += `<div class="players-grid">`;
    for (const player of teamPlayers) {
      const isMvp = String(player.jersey_number) === String(mvp_jersey_number) && player.team === mvp_team;
      g += renderPlayerCard(player, isMvp);
    }
    g += `</div></div>`;
    return g;
  };

  html += renderTeamGroup(homePlayers, 'home', match.home_team);
  html += renderTeamGroup(awayPlayers, 'away', match.away_team);
  html += '</div>';

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

  const statDefs = [
    { label: 'ボール支配率', hv: h.possession + '%', av: a.possession + '%' },
    { label: 'シュート',     hv: h.shots,            av: a.shots },
    { label: '枠内シュート', hv: h.shots_on_target,  av: a.shots_on_target },
    { label: 'コーナーキック', hv: h.corners,         av: a.corners },
    { label: 'ファウル',     hv: h.fouls,            av: a.fouls },
    { label: 'イエローカード', hv: h.yellow_cards,   av: a.yellow_cards },
    { label: 'レッドカード',  hv: h.red_cards,       av: a.red_cards },
  ];

  const makeCard = (teamLabel, teamClass, vals) => {
    let rows = statDefs.map((d, i) => `
      <div class="ts-row">
        <span class="ts-label">${d.label}</span>
        <span class="ts-value">${vals[i]}</span>
      </div>
    `).join('');
    return `
      <div class="ts-card ${teamClass}">
        <div class="ts-card-header ${teamClass}">${esc(teamLabel)}</div>
        ${rows}
      </div>
    `;
  };

  const homeVals = statDefs.map(d => d.hv);
  const awayVals = statDefs.map(d => d.av);

  let html = '<div class="team-stats-section">';
  html += '<h2 class="section-title">チームスタッツ</h2>';
  html += '<div class="ts-grid">';
  html += makeCard(match.home_team, 'home', homeVals);
  html += makeCard(match.away_team, 'away', awayVals);
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

// ── Demo ──
function showDemo() {
  renderResults(DEMO_DATA);
  showView('results-view');
}

const DEMO_DATA = {
  match: {
    home_team: "VJ BRIDGE FC",
    away_team: "FC LIONS",
    home_color: "青・白ストライプ",
    away_color: "赤・黒",
    estimated_score: "3-1",
    venue_type: "outdoor",
    analysis_note: "デモ用サンプルデータです。実際の分析では動画フレームからAIが自動生成します。"
  },
  team_stats: {
    home: { possession: 58, shots: 16, shots_on_target: 8, corners: 6, fouls: 9, yellow_cards: 1, red_cards: 0 },
    away: { possession: 42, shots: 10, shots_on_target: 4, corners: 3, fouls: 13, yellow_cards: 3, red_cards: 0 }
  },
  players: [
    {
      jersey_number: "10", team: "home", position: "CAM", name: "Nguyen Van A",
      rating: 9.1,
      attributes: { pace: 82, shooting: 85, passing: 91, dribbling: 88, defending: 42, physical: 74 },
      stats: { goals: 2, assists: 1, shots: 5, shots_on_target: 4, passes_attempted: 54, pass_accuracy: 89, key_passes: 5, tackles: 1, interceptions: 0, dribbles: 7, fouls: 1, aerials_won: 1 },
      highlight: "2ゴール1アシストの圧倒的なパフォーマンス。ゲームを支配し続けた試合のMVP。"
    },
    {
      jersey_number: "9", team: "home", position: "ST", name: "Tran Minh B",
      rating: 7.8,
      attributes: { pace: 88, shooting: 80, passing: 65, dribbling: 72, defending: 30, physical: 82 },
      stats: { goals: 1, assists: 0, shots: 4, shots_on_target: 3, passes_attempted: 22, pass_accuracy: 77, key_passes: 1, tackles: 0, interceptions: 0, dribbles: 5, fouls: 2, aerials_won: 4 },
      highlight: "裏抜けからゴールを奪取。空中戦でも存在感を示した。"
    },
    {
      jersey_number: "7", team: "home", position: "LW", name: "Le Quoc C",
      rating: 7.4,
      attributes: { pace: 90, shooting: 70, passing: 74, dribbling: 85, defending: 38, physical: 68 },
      stats: { goals: 0, assists: 2, shots: 3, shots_on_target: 1, passes_attempted: 38, pass_accuracy: 82, key_passes: 4, tackles: 1, interceptions: 1, dribbles: 9, fouls: 2, aerials_won: 0 },
      highlight: "サイドを制圧し2アシスト。1対1では無敵の突破力を見せた。"
    },
    {
      jersey_number: "6", team: "home", position: "CM", name: "Pham Duc D",
      rating: 7.2,
      attributes: { pace: 70, shooting: 58, passing: 84, dribbling: 72, defending: 75, physical: 80 },
      stats: { goals: 0, assists: 0, shots: 1, shots_on_target: 0, passes_attempted: 62, pass_accuracy: 87, key_passes: 3, tackles: 5, interceptions: 3, dribbles: 2, fouls: 3, aerials_won: 3 },
      highlight: "中盤でゲームをコントロール。守備でも高いインターセプト率。"
    },
    {
      jersey_number: "5", team: "home", position: "CB", name: "Hoang Tuan E",
      rating: 7.0,
      attributes: { pace: 65, shooting: 40, passing: 72, dribbling: 55, defending: 85, physical: 88 },
      stats: { goals: 0, assists: 0, shots: 0, shots_on_target: 0, passes_attempted: 44, pass_accuracy: 84, key_passes: 0, tackles: 6, interceptions: 4, dribbles: 0, fouls: 2, aerials_won: 7 },
      highlight: "安定した守備でゴールを1失点に抑えた。空中戦でほぼ無敗。"
    },
    {
      jersey_number: "4", team: "home", position: "CB", name: "Do Van F",
      rating: 6.8,
      attributes: { pace: 62, shooting: 38, passing: 70, dribbling: 50, defending: 83, physical: 85 },
      stats: { goals: 0, assists: 0, shots: 0, shots_on_target: 0, passes_attempted: 40, pass_accuracy: 80, key_passes: 0, tackles: 5, interceptions: 2, dribbles: 0, fouls: 3, aerials_won: 5 },
      highlight: "堅実なマーキングで相手エースを封じ込めた。"
    },
    {
      jersey_number: "1", team: "home", position: "GK", name: "Bui Thanh G",
      rating: 7.3,
      attributes: { pace: 55, shooting: 20, passing: 68, dribbling: 30, defending: 88, physical: 78 },
      stats: { goals: 0, assists: 0, shots: 0, shots_on_target: 0, passes_attempted: 18, pass_accuracy: 83, key_passes: 0, tackles: 0, interceptions: 0, dribbles: 0, fouls: 0, aerials_won: 3 },
      highlight: "相手の3本のシュートを確実にセーブ。判断力の高いキーパー。"
    },
    {
      jersey_number: "11", team: "away", position: "ST", name: "Yamada K",
      rating: 7.5,
      attributes: { pace: 85, shooting: 82, passing: 68, dribbling: 75, defending: 28, physical: 79 },
      stats: { goals: 1, assists: 0, shots: 5, shots_on_target: 3, passes_attempted: 20, pass_accuracy: 72, key_passes: 1, tackles: 0, interceptions: 0, dribbles: 4, fouls: 1, aerials_won: 3 },
      highlight: "個人技で1ゴールを奪取。守備の裏を取る動きが秀逸だった。"
    },
    {
      jersey_number: "8", team: "away", position: "CM", name: "Suzuki T",
      rating: 6.7,
      attributes: { pace: 68, shooting: 62, passing: 78, dribbling: 65, defending: 70, physical: 75 },
      stats: { goals: 0, assists: 1, shots: 2, shots_on_target: 1, passes_attempted: 48, pass_accuracy: 80, key_passes: 2, tackles: 4, interceptions: 2, dribbles: 3, fouls: 4, aerials_won: 2 },
      highlight: "ゴールアシストを記録。ファウルが多く後半は警告を受けた。"
    },
    {
      jersey_number: "3", team: "away", position: "SB", name: "Tanaka R",
      rating: 6.2,
      attributes: { pace: 75, shooting: 45, passing: 70, dribbling: 60, defending: 76, physical: 72 },
      stats: { goals: 0, assists: 0, shots: 1, shots_on_target: 0, passes_attempted: 35, pass_accuracy: 74, key_passes: 0, tackles: 3, interceptions: 1, dribbles: 2, fouls: 3, aerials_won: 1 },
      highlight: "右サイドを担当したが、相手WGの突破を数回許した。"
    },
    {
      jersey_number: "1", team: "away", position: "GK", name: "Watanabe S",
      rating: 5.8,
      attributes: { pace: 50, shooting: 15, passing: 60, dribbling: 25, defending: 74, physical: 70 },
      stats: { goals: 0, assists: 0, shots: 0, shots_on_target: 0, passes_attempted: 14, pass_accuracy: 71, key_passes: 0, tackles: 0, interceptions: 0, dribbles: 0, fouls: 0, aerials_won: 1 },
      highlight: "3失点を喫した。特に前半は連続失点で立て直しができなかった。"
    }
  ],
  match_highlights: [
    "前半22分 — #10 Nguyen が見事なフリーキックを直接ゴール。VJ Bridge が先制。",
    "前半38分 — #7 Le のクロスから #9 Tran がヘッドで追加点。2-0。",
    "後半5分 — FC Lions #11 Yamada が反撃の1点。2-1とゲームが動く。",
    "後半31分 — #10 Nguyen が個人技でDF2枚を外し、冷静にゴール右隅に流し込む。3-1で試合を決定づけた。",
    "後半ロスタイム — FC Lions に退場者が出るも試合はそのまま終了。"
  ],
  mvp_jersey_number: "10",
  mvp_team: "home"
};
