require 'sinatra'
require 'sinatra/activerecord'
require 'json'

set :database_file, 'config/database.yml'

require_relative 'models/memo'
require_relative 'models/workout'
require_relative 'lib/workout_suggester'
require_relative 'lib/health_export_parser'

configure do
  set :views, File.join(File.dirname(__FILE__), 'views')
  set :public_folder, File.join(File.dirname(__FILE__), 'public')
end

helpers do
  def format_time(time)
    time&.strftime('%Y-%m-%d %H:%M')
  end
end

# --- Memos ---

get '/' do
  @memos = Memo.order(created_at: :desc)
  erb :index
end

get '/memos/new' do
  erb :new_memo
end

post '/memos' do
  Memo.create!(title: params[:title], body: params[:body])
  redirect '/'
end

post '/memos/:id/delete' do
  Memo.find(params[:id]).destroy
  redirect '/'
end

# --- Workouts (Apple Health integration) ---

get '/workouts' do
  @workouts = Workout.recent.limit(30)
  @suggestion = WorkoutSuggester.new(Workout.recent).suggest
  erb :workouts
end

post '/workouts' do
  workout = Workout.new(
    workout_type: params[:workout_type],
    performed_at: params[:performed_at],
    duration_minutes: params[:duration_minutes],
    calories: params[:calories],
    avg_heart_rate: params[:avg_heart_rate],
    distance_km: params[:distance_km],
    source: 'manual'
  )
  if workout.save
    redirect '/workouts'
  else
    @errors = workout.errors.full_messages
    @workouts = Workout.recent.limit(30)
    @suggestion = WorkoutSuggester.new(Workout.recent).suggest
    status 422
    erb :workouts
  end
end

# Import endpoint for Apple Health export data.
#
# Accepts either:
#  - a single workout object
#  - { "data": { "workouts": [ ... ] } }  (Health Auto Export app format)
#  - { "workouts": [ ... ] }
post '/api/workouts/import' do
  request.body.rewind
  payload = JSON.parse(request.body.read)
  records = HealthExportParser.extract_workouts(payload)

  imported = []
  skipped = []
  records.each do |record|
    attrs = HealthExportParser.normalize(record)
    next skipped << attrs if attrs[:performed_at].nil? || attrs[:workout_type].nil?

    workout = Workout.find_or_initialize_by(external_uuid: attrs[:external_uuid]) if attrs[:external_uuid]
    workout ||= Workout.new
    workout.assign_attributes(attrs.merge(source: 'apple_health', raw_payload: record.to_json))

    if workout.save
      imported << workout
    else
      skipped << attrs.merge(errors: workout.errors.full_messages)
    end
  end

  content_type :json
  { imported: imported.size, skipped: skipped.size, skipped_details: skipped }.to_json
rescue JSON::ParserError => e
  content_type :json
  status 400
  { error: "invalid JSON: #{e.message}" }.to_json
end

get '/api/workouts' do
  content_type :json
  Workout.recent.limit(100).to_json
end

get '/api/workouts/suggestion' do
  content_type :json
  WorkoutSuggester.new(Workout.recent).suggest.to_json
end
