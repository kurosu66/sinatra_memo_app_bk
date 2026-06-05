require 'sinatra'
require 'json'
require 'securerandom'
require 'fileutils'

begin
  require 'dotenv/load'
rescue LoadError
end

set :public_folder, File.dirname(__FILE__) + '/public'
set :views, File.dirname(__FILE__) + '/views'
set :bind, '0.0.0.0'
set :method_override, true

DATA_FILE = File.join(File.dirname(__FILE__), 'data', 'matches.json')

def rating_color(r)
  return '#888' if r <= 0
  return '#ffd600' if r >= 9.0
  return '#00e676' if r >= 8.0
  return '#69f0ae' if r >= 7.0
  return '#ffeb3b' if r >= 6.0
  return '#ffa726' if r >= 5.0
  '#ff5252'
end

def rating_label(r)
  return '-'    if r <= 0
  return '卓越' if r >= 9.0
  return '優秀' if r >= 8.0
  return '良好' if r >= 7.0
  return '平均' if r >= 6.0
  return '平均以下' if r >= 5.0
  '不振'
end

def load_matches
  return [] unless File.exist?(DATA_FILE)
  JSON.parse(File.read(DATA_FILE))
rescue
  []
end

def save_matches(matches)
  FileUtils.mkdir_p(File.dirname(DATA_FILE))
  File.write(DATA_FILE, JSON.pretty_generate(matches))
end

# ── 一覧 ──────────────────────────────────────────────

get '/' do
  @matches = load_matches.sort_by { |m| m['date'] || '' }.reverse
  erb :index
end

# ── 新規作成 ──────────────────────────────────────────

get '/matches/new' do
  @match = { 'players' => [] }
  @mode  = 'new'
  erb :match_form
end

post '/matches' do
  players = JSON.parse(params[:players_json] || '[]') rescue []
  match = {
    'id'         => SecureRandom.uuid,
    'date'       => params[:date].to_s.strip,
    'location'   => params[:location].to_s.strip,
    'home_team'  => params[:home_team].to_s.strip,
    'away_team'  => params[:away_team].to_s.strip,
    'home_score' => params[:home_score].to_i,
    'away_score' => params[:away_score].to_i,
    'note'       => params[:note].to_s.strip,
    'players'    => players,
    'created_at' => Time.now.iso8601
  }
  matches = load_matches
  matches << match
  save_matches(matches)
  redirect "/matches/#{match['id']}"
end

# ── 詳細 ──────────────────────────────────────────────

get '/matches/:id' do
  @match = load_matches.find { |m| m['id'] == params[:id] }
  halt 404, '試合が見つかりません' unless @match
  erb :match_detail
end

# ── 編集 ──────────────────────────────────────────────

get '/matches/:id/edit' do
  @match = load_matches.find { |m| m['id'] == params[:id] }
  halt 404, '試合が見つかりません' unless @match
  @mode = 'edit'
  erb :match_form
end

put '/matches/:id' do
  matches = load_matches
  idx = matches.index { |m| m['id'] == params[:id] }
  halt 404, '試合が見つかりません' unless idx
  players = JSON.parse(params[:players_json] || '[]') rescue []
  matches[idx].merge!(
    'date'       => params[:date].to_s.strip,
    'location'   => params[:location].to_s.strip,
    'home_team'  => params[:home_team].to_s.strip,
    'away_team'  => params[:away_team].to_s.strip,
    'home_score' => params[:home_score].to_i,
    'away_score' => params[:away_score].to_i,
    'note'       => params[:note].to_s.strip,
    'players'    => players,
    'updated_at' => Time.now.iso8601
  )
  save_matches(matches)
  redirect "/matches/#{params[:id]}"
end

# ── 削除 ──────────────────────────────────────────────

delete '/matches/:id' do
  matches = load_matches
  matches.reject! { |m| m['id'] == params[:id] }
  save_matches(matches)
  redirect '/'
end
