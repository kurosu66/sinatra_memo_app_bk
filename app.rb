require 'sinatra'
require 'json'
require 'net/http'
require 'uri'

begin
  require 'dotenv/load'
rescue LoadError
end

set :public_folder, File.dirname(__FILE__) + '/public'
set :views, File.dirname(__FILE__) + '/views'
set :bind, '0.0.0.0'

get '/' do
  erb :index
end

post '/analyze' do
  content_type :json

  begin
    data = JSON.parse(request.body.read)
    frames = Array(data['frames'])

    if frames.empty?
      halt 400, { error: 'フレームデータが見つかりません' }.to_json
    end

    frames = frames.first(20)
    result = analyze_frames(frames)
    result.to_json
  rescue JSON::ParserError
    halt 400, { error: 'リクエストの解析に失敗しました' }.to_json
  rescue => e
    status 500
    { error: e.message }.to_json
  end
end

def analyze_frames(frames_data)
  api_key = ENV['ANTHROPIC_API_KEY']
  raise 'ANTHROPIC_API_KEY が設定されていません。.env ファイルを確認してください。' unless api_key

  content = [{ type: 'text', text: analysis_prompt(frames_data.length) }]

  frames_data.each do |frame|
    base64 = frame.include?(',') ? frame.split(',', 2)[1] : frame
    content << {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
    }
  end

  uri = URI('https://api.anthropic.com/v1/messages')
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 180) do |http|
    req = Net::HTTP::Post.new(uri)
    req['Content-Type'] = 'application/json'
    req['x-api-key'] = api_key
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

  if (match = text.match(/```json\s*(.*?)\s*```/m) || text.match(/(\{[\s\S]*\})/m))
    JSON.parse(match[1])
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
            "pace": 75,
            "shooting": 70,
            "passing": 72,
            "dribbling": 68,
            "defending": 65,
            "physical": 72
          },
          "stats": {
            "goals": 0,
            "assists": 0,
            "shots": 2,
            "shots_on_target": 1,
            "passes_attempted": 35,
            "pass_accuracy": 85,
            "key_passes": 1,
            "tackles": 3,
            "interceptions": 1,
            "dribbles": 2,
            "fouls": 1,
            "aerials_won": 2
          },
          "highlight": "選手のパフォーマンスの特徴的なポイント（日本語）"
        }
      ],
      "team_stats": {
        "home": {
          "possession": 52,
          "shots": 12,
          "shots_on_target": 5,
          "corners": 4,
          "fouls": 10,
          "yellow_cards": 1,
          "red_cards": 0
        },
        "away": {
          "possession": 48,
          "shots": 8,
          "shots_on_target": 3,
          "corners": 3,
          "fouls": 12,
          "yellow_cards": 2,
          "red_cards": 0
        }
      },
      "match_highlights": [
        "試合の重要なシーンや特筆すべき出来事（日本語）"
      ],
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
