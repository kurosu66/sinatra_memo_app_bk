require_relative 'spec_helper'

RSpec.describe 'Sinatra Memo App' do
  it 'creates and lists a memo' do
    post '/memos', title: 'Test', body: 'Body'
    expect(last_response.status).to eq(302).or eq(303)

    get '/'
    expect(last_response.body).to include('Test')
  end

  it 'imports Apple Health workout export JSON and deduplicates by external id' do
    payload = {
      'data' => {
        'workouts' => [
          {
            'id' => 'ABC-1',
            'name' => 'ランニング',
            'start' => '2026-07-13 06:00:00 +0900',
            'duration' => 1800,
            'activeEnergyBurned' => { 'qty' => 260 }
          }
        ]
      }
    }

    post '/api/workouts/import', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
    expect(last_response.status).to eq(200)
    body = JSON.parse(last_response.body)
    expect(body['imported']).to eq(1)

    # posting the same external id again should update, not duplicate
    post '/api/workouts/import', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
    expect(Workout.count).to eq(1)
  end

  it 'skips records missing a required field' do
    payload = { 'workouts' => [{ 'name' => 'Run' }] } # no start time
    post '/api/workouts/import', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
    body = JSON.parse(last_response.body)
    expect(body['skipped']).to eq(1)
    expect(Workout.count).to eq(0)
  end

  it 'returns 400 for invalid JSON' do
    post '/api/workouts/import', '{not json', { 'CONTENT_TYPE' => 'application/json' }
    expect(last_response.status).to eq(400)
  end

  it 'exposes a suggestion endpoint' do
    get '/api/workouts/suggestion'
    expect(last_response.status).to eq(200)
    body = JSON.parse(last_response.body)
    expect(body).to have_key('workout_type')
  end
end
