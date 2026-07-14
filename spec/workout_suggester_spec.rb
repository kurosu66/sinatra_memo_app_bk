require_relative 'spec_helper'

RSpec.describe WorkoutSuggester do
  let(:now) { Time.utc(2026, 7, 14, 12, 0, 0) }

  def build_workout(type:, performed_at:, duration: 30, calories: 200)
    Workout.new(workout_type: type, performed_at: performed_at, duration_minutes: duration, calories: calories)
  end

  it 'suggests a beginner walk when there is no history' do
    result = WorkoutSuggester.new(Workout.none, now: now).suggest
    expect(result[:workout_type]).to eq('ウォーキング')
    expect(result[:intensity]).to eq('低')
  end

  it 'suggests recovery after an intense workout earlier today' do
    workouts = [build_workout(type: 'ランニング', performed_at: now - 3600, duration: 60, calories: 500)]
    result = WorkoutSuggester.new(workouts, now: now).suggest
    expect(result[:workout_type]).to match(/ストレッチ/)
    expect(result[:intensity]).to eq('低')
  end

  it 'allows a bit more activity after a light workout earlier today' do
    workouts = [build_workout(type: 'ヨガ', performed_at: now - 3600, duration: 20, calories: 100)]
    result = WorkoutSuggester.new(workouts, now: now).suggest
    expect(result[:workout_type]).to eq('軽いウォーキング')
  end

  it 'suggests easing back in after a multi-day gap' do
    workouts = [build_workout(type: '筋トレ', performed_at: now - (5 * 86_400))]
    result = WorkoutSuggester.new(workouts, now: now).suggest
    expect(result[:headline]).to include('日ぶり')
    expect(result[:workout_type]).to eq('ウォーキング')
  end

  it 'rotates the workout type away from what was done yesterday' do
    workouts = [build_workout(type: 'ランニング', performed_at: now - 86_400)]
    result = WorkoutSuggester.new(workouts, now: now).suggest
    expect(result[:workout_type]).not_to eq('ランニング')
  end

  it 'dials back intensity when the week has already been busy' do
    # Most recent workout was yesterday, with 5 total in the last 7 days.
    workouts = (1..5).map { |i| build_workout(type: 'ランニング', performed_at: now - (i * 86_400)) }
    result = WorkoutSuggester.new(workouts, now: now).suggest
    expect(result[:intensity]).to eq('低')
    expect(result[:headline]).to include('よく運動')
  end
end
