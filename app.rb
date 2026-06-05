require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'open3'
require 'tmpdir'
require 'base64'
require 'fileutils'

begin
  require 'dotenv/load'
rescue LoadError
end

set :public_folder, File.dirname(__FILE__) + '/public'
set :views, File.dirname(__FILE__) + '/views'
set :bind, '0.0.0.0'
set :server_settings, timeout: 360

# ── ルーティング ──────────────────────────────────────

get '/' do
  erb :index
end

# クライアントでフレーム抽出済み（ファイルアップロード）
post '/analyze' do
  content_type :json
  begin
    data = JSON.parse(request.body.read)
    frames = Array(data['frames'])
    halt 400, { error: 'フレームデータが見つかりません' }.to_json if frames.empty?
    analyze_frames(frames.first(20)).to_json
  rescue JSON::ParserError
    halt 400, { error: 'リクエストの解析に失敗しました' }.to_json
  rescue => e
    status 500
    { error: e.message }.to_json
  end
end

# YouTubeリンクからサーバー側でダウンロード＆フレーム抽出
post '/analyze-youtube' do
  content_type :json
  begin
    data = JSON.parse(request.body.read)
    url  = data['url'].to_s.strip
    halt 400, { error: '有効なYouTube URLを入力してください' }.to_json unless valid_youtube_url?(url)

    frames = download_and_extract_frames(url)
    analyze_frames(frames).to_json
  rescue JSON::ParserError
    halt 400, { error: 'リクエストの解析に失敗しました' }.to_json
  rescue => e
    status 500
    { error: e.message }.to_json
  end
end

# ── YouTube処理 ──────────────────────────────────────

def valid_youtube_url?(url)
  url =~ /\A https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/x
end

def download_and_extract_frames(url, frame_count = 20)
  check_tool!('yt-dlp', 'pip install yt-dlp')
  check_tool!('ffmpeg',  'brew install ffmpeg')

  stream_url, duration = get_stream_info(url)

  Dir.mktmpdir('soccer_') do |tmp|
    extract_frames_from_stream(stream_url, duration, tmp, frame_count)
  end
end

def check_tool!(name, install_hint)
  _, status = Open3.capture2e('which', name)
  raise "#{name} が見つかりません。#{install_hint} でインストールしてください。" unless status.success?
end

def find_cookies_file
  if ENV['YTDLP_COOKIES'] && File.exist?(ENV['YTDLP_COOKIES'])
    return ENV['YTDLP_COOKIES']
  end
  [
    File.join(File.dirname(File.expand_path(__FILE__)), 'cookies.txt'),
    File.join(Dir.pwd, 'cookies.txt'),
    File.expand_path('~/sinatra_memo_app_bk/cookies.txt')
  ].find { |f| File.exist?(f) }
end

def get_stream_info(youtube_url)
  args = [
    'yt-dlp',
    '-f', '18/best[height<=480]/best',
    '--no-playlist',
    '--dump-json',
  ]

  cookies_file = find_cookies_file
  if cookies_file
    warn "[yt-dlp] cookies.txt を使用: #{cookies_file}"
    args += ['--cookies', cookies_file]
  else
    warn "[yt-dlp] cookies.txt 未検出"
  end

  stdout, stderr, status = Open3.capture3(*args, youtube_url)
  unless status.success?
    raise "動画情報の取得に失敗しました: #{stderr.lines.last&.strip}"
  end

  info = JSON.parse(stdout)
  url = info['url'] || info.dig('requested_formats', 0, 'url')
  raise 'ストリームURLが取得できませんでした' if url.nil? || url.empty?

  duration = info['duration']&.to_f || 60.0
  warn "[yt-dlp] 取得完了: #{info['title']} (#{duration.round}秒)"

  [url, duration]
end

def extract_frames_from_stream(stream_url, duration, dir, count)
  video_path = File.join(dir, 'video.mp4')

  # システムcurl（macOS: Apple Secure Transport）でダウンロード
  curl = File.exist?('/usr/bin/curl') ? '/usr/bin/curl' : 'curl'
  warn "[curl] 動画をダウンロード中... (#{(duration / 60).round}分の動画)"

  _, stderr, status = Open3.capture3(
    curl, '-L', '-o', video_path,
    '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '-e', 'https://www.youtube.com/',
    '--silent', '--show-error',
    '--max-time', '600',
    stream_url
  )

  unless File.exist?(video_path) && File.size(video_path) > 1024
    raise "動画のダウンロードに失敗しました: #{stderr.strip}"
  end

  mb = (File.size(video_path) / 1024.0 / 1024.0).round(1)
  warn "[curl] #{mb}MB ダウンロード完了"

  extract_frames_from_file(video_path, dir, count, duration)
end

def extract_frames_from_file(video_path, dir, count, fallback_duration)
  probe_out, = Open3.capture2(
    'ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', video_path
  )
  actual_duration = begin
    JSON.parse(probe_out).dig('format', 'duration')&.to_f
  rescue
    nil
  end
  duration = [actual_duration || fallback_duration, 1.0].max

  frames = []
  count.times do |i|
    t = (i.to_f / [count - 1, 1].max) * (duration - 1.0)
    t = [t, 0].max
    frame_path = File.join(dir, format('frame_%03d.jpg', i))

    Open3.capture2e(
      'ffmpeg', '-ss', t.to_s, '-i', video_path,
      '-vframes', '1', '-q:v', '3',
      '-vf', 'scale=854:480:force_original_aspect_ratio=decrease',
      frame_path, '-y'
    )

    next unless File.exist?(frame_path) && File.size(frame_path) > 0
    frames << Base64.strict_encode64(File.binread(frame_path))
    warn "[ffmpeg] フレーム #{i + 1}/#{count} 取得 (t=#{t.round}s)"
  end

  raise 'フレームの抽出に失敗しました' if frames.empty?
  warn "[ffmpeg] #{frames.size}フレーム取得完了"
  frames
end

# ── Claude API ──────────────────────────────────────

def analyze_frames(frames_data)
  api_key = ENV['ANTHROPIC_API_KEY']
  raise 'ANTHROPIC_API_KEY が設定されていません。.env ファイルを確認してください。' unless api_key

  content = [{ type: 'text', text: analysis_prompt(frames_data.length) }]
  frames_data.each do |frame|
    base64 = frame.include?(',') ? frame.split(',', 2)[1] : frame
    content << { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } }
  end

  uri = URI('https://api.anthropic.com/v1/messages')
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 180) do |http|
    req = Net::HTTP::Post.new(uri)
    req['Content-Type']      = 'application/json'
    req['x-api-key']         = api_key
    req['anthropic-version'] = '2023-06-01'
    req.body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: content }]
    }.to_json
    http.request(req)
  end

  parsed = JSON.parse(response.body)
  raise "API エラー: #{parsed.dig('error', 'message')}" if parsed['error']

  text = parsed.dig('content', 0, 'text') || ''
  if (m = text.match(/```json\s*(.*?)\s*```/m) || text.match(/(\{[\s\S]*\})/m))
    JSON.parse(m[1])
  else
    raise 'AIの応答からJSONを抽出できませんでした'
  end
end

def analysis_prompt(frame_count)
  <<~PROMPT
    あなたはプロのサッカー試合アナリストです。#{frame_count}枚のサッカー試合の動画フレームを分析してください。

    フレームを詳しく観察し、以下のJSON形式のみで分析結果を返してください。
    マークダウンや説明文は不要です。純粋なJSONオブジェクトのみを返してください。

    {
      "match": {
        "home_team": "ホームチーム名 (不明な場合は'ホームチーム')",
        "away_team": "アウェイチーム名 (不明な場合は'アウェイチーム')",
        "home_color": "ホームのジャージカラー",
        "away_color": "アウェイのジャージカラー",
        "estimated_score": "推定スコア (例: 2-1, 不明な場合は '?-?')",
        "venue_type": "outdoor または indoor",
        "analysis_note": "分析の信頼度や特記事項"
      },
      "players": [
        {
          "jersey_number": "背番号 (不明な場合はポジションで識別, 例: 'GK', 'CB1', 'ST')",
          "team": "home または away",
          "position": "GK/CB/SB/CM/CAM/LW/RW/ST のいずれか",
          "name": "選手名 (不明な場合は 'Unknown')",
          "rating": 7.5,
          "attributes": {
            "pace": 75, "shooting": 70, "passing": 72,
            "dribbling": 68, "defending": 65, "physical": 72
          },
          "stats": {
            "goals": 0, "assists": 0, "shots": 2, "shots_on_target": 1,
            "passes_attempted": 35, "pass_accuracy": 85, "key_passes": 1,
            "tackles": 3, "interceptions": 1, "dribbles": 2, "fouls": 1, "aerials_won": 2
          },
          "highlight": "選手のパフォーマンスの特徴的なポイント（日本語）"
        }
      ],
      "team_stats": {
        "home": { "possession": 52, "shots": 12, "shots_on_target": 5, "corners": 4, "fouls": 10, "yellow_cards": 1, "red_cards": 0 },
        "away": { "possession": 48, "shots": 8,  "shots_on_target": 3, "corners": 3, "fouls": 12, "yellow_cards": 2, "red_cards": 0 }
      },
      "match_highlights": ["試合の重要なシーン（日本語）"],
      "mvp_jersey_number": "最優秀選手の背番号またはID",
      "mvp_team": "home または away"
    }

    注意:
    - 選手は背番号またはポジション名で識別してください
    - レーティングは1〜10スケール (6.0〜7.0=平均的, 7.5〜8.5=良好, 9.0+=卓越)
    - 属性値は0〜100の範囲で設定してください
    - 観察した行動に基づいてスタッツを現実的に推定してください
    - ハイライトと選手のコメントは日本語で記述してください
    - できるだけ多くの選手を識別・分析してください (最低でも6〜11名)
  PROMPT
end
