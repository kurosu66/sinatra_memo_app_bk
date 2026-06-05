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
  data = begin
    JSON.parse(request.body.read)
  rescue JSON::ParserError
    halt 400, { error: 'リクエストの解析に失敗しました' }.to_json
  end
  begin
    frames = Array(data['frames'])
    halt 400, { error: 'フレームデータが見つかりません' }.to_json if frames.empty?
    analyze_frames(frames.first(60)).to_json
  rescue => e
    status 500
    { error: e.message }.to_json
  end
end

# YouTubeリンクからサーバー側でダウンロード＆フレーム抽出
post '/analyze-youtube' do
  content_type :json
  data = begin
    JSON.parse(request.body.read)
  rescue JSON::ParserError
    halt 400, { error: 'リクエストの解析に失敗しました' }.to_json
  end
  begin
    url = data['url'].to_s.strip
    halt 400, { error: '有効なYouTube URLを入力してください' }.to_json unless valid_youtube_url?(url)
    frames = download_and_extract_frames(url)
    analyze_frames(frames).to_json
  rescue => e
    status 500
    { error: e.message }.to_json
  end
end

# ── YouTube処理 ──────────────────────────────────────

def valid_youtube_url?(url)
  url =~ /\A https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/x
end

def download_and_extract_frames(url, frame_count = 60)
  check_tool!('yt-dlp', 'pip install yt-dlp')
  check_tool!('ffmpeg',  'brew install ffmpeg')

  Dir.mktmpdir('soccer_') do |tmp|
    video_path = download_with_ytdlp(url, tmp)
    extract_frames_from_file(video_path, tmp, frame_count, nil)
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

def download_with_ytdlp(youtube_url, dir)
  output_tmpl = File.join(dir, 'video.%(ext)s')

  cookies_file = find_cookies_file
  if cookies_file
    warn "[yt-dlp] cookies.txt を使用: #{cookies_file}"
  else
    warn "[yt-dlp] cookies.txt 未検出"
  end

  base_args = ['yt-dlp', '--no-playlist', '--no-part', '-o', output_tmpl]
  base_args += ['--cookies', cookies_file] if cookies_file

  fmt = 'best[height<=480][ext=mp4]/best[height<=480]/best'

  # SABRを回避するためクライアントを順番に試す（formatは動的に選択させる）
  candidates = [
    ['tv'],
    ['android'],
    ['tv_embedded'],
    ['mweb'],
    [],  # クライアント指定なし（yt-dlpデフォルト）
  ]

  last_error = nil
  candidates.each do |clients|
    label = clients.empty? ? 'default' : clients.join(',')
    warn "[yt-dlp] client=#{label} でダウンロード試行..."
    args = base_args.dup
    args += ['-f', fmt]
    args += ['--extractor-args', "youtube:player_client=#{clients.join(',')}"] unless clients.empty?
    args << youtube_url

    _stdout, stderr, status = Open3.capture3(*args)
    downloaded = Dir[File.join(dir, 'video.*')].find { |f| File.size?(f).to_i > 1024 }
    if downloaded
      mb = (File.size(downloaded) / 1024.0 / 1024.0).round(1)
      warn "[yt-dlp] #{mb}MB ダウンロード完了 (client=#{label})"
      return downloaded
    end
    last_error = stderr.lines.grep(/ERROR/).last&.strip || stderr.lines.last&.strip
    warn "[yt-dlp] client=#{label} 失敗: #{last_error}"
  end

  raise "動画のダウンロードに失敗しました: #{last_error}"
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
  duration = [actual_duration || fallback_duration || 60.0, 1.0].max

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
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 360) do |http|
    req = Net::HTTP::Post.new(uri)
    req['Content-Type']      = 'application/json'
    req['x-api-key']         = api_key
    req['anthropic-version'] = '2023-06-01'
    req.body = {
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: content }]
    }.to_json
    http.request(req)
  end

  parsed = begin
    JSON.parse(response.body)
  rescue JSON::ParserError
    raise "APIレスポンスのパースに失敗しました (HTTP #{response.code}): #{response.body[0, 200]}"
  end
  raise "API エラー: #{parsed.dig('error', 'message')}" if parsed['error']

  text = parsed.dig('content', 0, 'text') || ''
  warn "[claude] レスポンス先頭200文字: #{text[0, 200]}"
  m = text.match(/```json\s*(.*?)\s*```/m) || text.match(/(\{[\s\S]*\})/m)
  raise 'AIの応答からJSONを抽出できませんでした' unless m
  begin
    JSON.parse(m[1])
  rescue JSON::ParserError => e
    raise "AIレスポンスのJSON解析に失敗しました: #{e.message}\n---\n#{m[1][0, 300]}"
  end
end

def analysis_prompt(frame_count)
  <<~PROMPT
    あなたはプロのサッカー試合アナリストです。#{frame_count}枚のサッカー試合の動画フレームを分析してください。

    フレームを詳しく観察し、以下のJSON形式のみで分析結果を返してください。
    マークダウンや説明文は不要です。純粋なJSONオブジェクトのみを返してください。

    【レーティング採点基準】
    各選手のratingはフレームで観察した具体的なプレーを根拠に加点・減点してください。

    加点要素（観察できた場合に加点）:
    - ゴール: +1.5〜2.0
    - アシスト・決定的なラストパス: +0.8〜1.2
    - シュートが枠を捉えた: +0.3
    - キーパスや崩しのパス: +0.3〜0.5
    - タックル成功・ボール奪取: +0.2〜0.4
    - GKのビッグセーブ: +0.5〜1.0
    - 積極的なドリブル突破成功: +0.2〜0.4

    減点要素（観察できた場合に減点）:
    - 守備のポジショニングミスで失点に絡む: -0.5〜1.0
    - 明らかなシュートミス（至近距離で外す等）: -0.3〜0.5
    - パスミスでボールを失う場面: -0.2〜0.4
    - 不要なファウル: -0.2〜0.3
    - GKが防げたはずの失点: -0.5〜1.0
    - ボールウォッチャーになっている場面: -0.2

    ベースライン: 試合に参加していて目立ったプレーがない選手は6.5〜7.0。
    良いプレーが多い選手は8.0〜9.0。複数のミスがある選手は5.5〜6.5。

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
          "jersey_number": "ユニフォームに書かれた背番号（数字）。複数フレームを精査して読み取ること。どうしても読み取れない場合のみポジション名 (例: 'GK', 'CB') を使用",
          "team": "home または away",
          "position": "GK/CB/SB/CM/CAM/LW/RW/ST のいずれか",
          "name": "選手名 (不明な場合は 'Unknown')",
          "rating": 7.5,
          "good_plays": "観察できた良いプレーを具体的に列挙（日本語）",
          "bad_plays": "観察できたミス・悪いプレーを具体的に列挙。なければ空文字",
          "attributes": {
            "pace": 75, "shooting": 70, "passing": 72,
            "dribbling": 68, "defending": 65, "physical": 72
          },
          "stats": {
            "goals": 0, "assists": 0, "shots": 2, "shots_on_target": 1,
            "passes_attempted": 35, "pass_accuracy": 85, "key_passes": 1,
            "tackles": 3, "interceptions": 1, "dribbles": 2, "fouls": 1, "aerials_won": 2
          },
          "highlight": "採点根拠となった良いプレー・悪いプレーを含む総評（日本語）"
        }
      ],
      "team_stats": {
        "home": { "possession": 52, "shots": 12, "shots_on_target": 5, "corners": 4, "fouls": 10, "yellow_cards": 0, "red_cards": 0 },
        "away": { "possession": 48, "shots": 8,  "shots_on_target": 3, "corners": 3, "fouls": 12, "yellow_cards": 0, "red_cards": 0 }
      },
      "match_highlights": ["試合の重要なシーン（日本語）"],
      "mvp_jersey_number": "最優秀選手の背番号またはID",
      "mvp_team": "home または away"
    }

    注意:
    - 背番号の読み取りを最優先にしてください。フレームを拡大して観察し、ユニフォーム背面・正面に書かれた数字を丁寧に読み取ること
    - 同じ選手が複数フレームに登場する場合、最も番号が読みやすいフレームを参照してください
    - 背番号が読めた選手は必ず数字で記録し、ポジション名（GK等）は本当に読めない場合のみ使用してください
    - レーティングは上記採点基準に従い、根拠のある加減点を行ってください。全員を7.0付近にまとめないこと
    - 属性値は0〜100の範囲で設定してください
    - ボール支配率: 各フレームで「どちらのチームの選手がボールを持っているか（またはボール周辺にいるか）」を数えてください。ホームが12/20フレームならhome=60%, away=40%のように算出してください
    - コーナーキック: フレームにコーナーキックのシーン（コーナーフラッグ付近でのキック）が実際に映っている場合のみカウントしてください。映っていない場合は0にしてください
    - シュート・タックル・ファウル: 実際に映っているプレーのみカウントし、推測で水増ししないでください
    - イエローカード・レッドカード: 審判がカードを提示する場面が映っている場合のみ計上。見えない場合は必ず0にしてください
    - ゴール数: 得点シーンまたはスコアボードが映っている場合のみ計上してください
    - ハイライトは日本語で、実際にフレームから観察できた事実を記述してください
    - できるだけ多くの選手を識別・分析してください (最低でも6〜11名)
  PROMPT
end
