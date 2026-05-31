#!/usr/bin/env ruby
# frozen_string_literal: true

require 'faraday'
require 'faraday/cookie_jar'
require 'json'
require 'yaml'
require 'logger'
require 'time'

# ロガー設定
logger = Logger.new($stdout)
logger.formatter = proc do |severity, time, _progname, msg|
  "#{time.strftime('%H:%M:%S')} [#{severity}] #{msg}\n"
end

# 設定ファイル読み込み
config_path = File.join(__dir__, 'config.yml')
unless File.exist?(config_path)
  logger.error "config.yml が見つかりません: #{config_path}"
  exit 1
end

CONFIG = YAML.load_file(config_path)
DC = CONFIG['disney']
POLLING = CONFIG['polling']

# HTTPクライアント（Cookieセッション対応）
def build_client(base_url, timeout)
  Faraday.new(url: base_url) do |f|
    f.use :cookie_jar
    f.request :json
    f.response :json, content_type: /\bjson$/
    f.options.timeout = timeout
    f.options.open_timeout = timeout
  end
end

# ログイン処理
def login(client, logger)
  logger.info "ログイン中..."
  resp = client.post(DC['login_path'], {
    email: DC['email'],
    password: DC['password']
  })

  if resp.success?
    token = resp.body.dig('data', 'token') ||
            resp.body.dig('access_token') ||
            resp.body.dig('token')
    logger.info "ログイン成功"
    token
  else
    logger.error "ログイン失敗: HTTP #{resp.status} - #{resp.body}"
    nil
  end
rescue Faraday::Error => e
  logger.error "ログインエラー: #{e.message}"
  nil
end

# 予約状況確認
def check_availability(client, token, logger)
  attraction_id = DC.dig('attraction', 'id')
  headers = token ? { 'Authorization' => "Bearer #{token}" } : {}

  resp = client.get(DC['availability_path']) do |req|
    req.params['attraction_id'] = attraction_id
    req.headers.merge!(headers)
  end

  if resp.success?
    body = resp.body
    # 空き状況のキーはAPIによって異なる（要調整）
    available = body.dig('data', 'available') ||
                body.dig('available') ||
                body.dig('standby', 'available') ||
                false
    wait_time = body.dig('data', 'wait_time') ||
                body.dig('wait_time') ||
                body.dig('standby', 'wait_minutes')

    { available: available, wait_time: wait_time, raw: body }
  else
    logger.warn "確認失敗: HTTP #{resp.status}"
    nil
  end
rescue Faraday::Error => e
  logger.warn "接続エラー: #{e.message}"
  nil
end

# 予約リクエスト送信
def book_attraction(client, token, logger)
  attraction_id = DC.dig('attraction', 'id')
  attraction_name = DC.dig('attraction', 'name')
  extra_params = DC.dig('booking_params') || {}
  headers = token ? { 'Authorization' => "Bearer #{token}" } : {}

  logger.info "予約リクエスト送信中: #{attraction_name}"

  payload = { attraction_id: attraction_id }.merge(extra_params)
  resp = client.post(DC['booking_path'], payload) do |req|
    req.headers.merge!(headers)
  end

  if resp.success?
    logger.info "予約成功! レスポンス: #{resp.body}"
    true
  else
    logger.error "予約失敗: HTTP #{resp.status} - #{resp.body}"
    false
  end
rescue Faraday::Error => e
  logger.error "予約エラー: #{e.message}"
  false
end

# 通知（macOS / Linux beep）
def notify(attraction_name)
  message = "#{attraction_name} の予約が完了しました！"
  if RUBY_PLATFORM.include?('darwin')
    system("osascript -e 'display notification \"#{message}\" with title \"ディズニー予約\"'")
  end
  puts "\a" # ターミナルbeep
end

# ========== メイン処理 ==========

attraction_name = DC.dig('attraction', 'name')
interval = POLLING['interval_seconds'] || 5
max_attempts = POLLING['max_attempts'] || 720
timeout = POLLING['timeout_seconds'] || 10

logger.info "=" * 50
logger.info "ディズニーアトラクション自動予約システム"
logger.info "対象: #{attraction_name}"
logger.info "確認間隔: #{interval}秒 / 最大試行: #{max_attempts}回"
logger.info "=" * 50

client = build_client(DC['base_url'], timeout)

# ログインしてトークン取得
token = login(client, logger)
exit 1 if token.nil? && DC['login_path'] != 'skip'

attempt = 0
booked = false

trap('INT') do
  logger.info "\n中断しました。終了します。"
  exit 0
end

while attempt < max_attempts && !booked
  attempt += 1
  logger.info "[#{attempt}/#{max_attempts}] #{attraction_name} の空き状況を確認中..."

  result = check_availability(client, token, logger)

  if result.nil?
    logger.warn "レスポンス取得失敗。#{interval}秒後に再試行します。"
    sleep interval
    next
  end

  if result[:available]
    wait_str = result[:wait_time] ? "待ち時間: #{result[:wait_time]}分" : "空きあり"
    logger.info "空きを検出！（#{wait_str}）予約を試みます..."

    booked = book_attraction(client, token, logger)

    if booked
      notify(attraction_name)
      logger.info "予約完了！プログラムを終了します。"
    else
      logger.warn "予約失敗。#{interval}秒後に再試行します。"
      sleep interval
    end
  else
    wait_str = result[:wait_time] ? "待ち時間: #{result[:wait_time]}分" : "満員"
    logger.info "空きなし（#{wait_str}）。#{interval}秒後に再確認します。"
    sleep interval
  end
end

unless booked
  logger.info "最大試行回数に達しました。予約できませんでした。"
  exit 1
end
