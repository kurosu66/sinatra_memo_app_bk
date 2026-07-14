require_relative 'spec_helper'

RSpec.describe HealthExportParser do
  describe '.extract_workouts' do
    it 'reads the Health Auto Export nested shape' do
      payload = { 'data' => { 'workouts' => [{ 'name' => 'Run' }] } }
      expect(HealthExportParser.extract_workouts(payload)).to eq([{ 'name' => 'Run' }])
    end

    it 'reads a top-level workouts array' do
      payload = { 'workouts' => [{ 'name' => 'Run' }] }
      expect(HealthExportParser.extract_workouts(payload)).to eq([{ 'name' => 'Run' }])
    end

    it 'wraps a single workout object' do
      payload = { 'name' => 'Run', 'start' => '2026-07-14 07:00:00 +0900' }
      expect(HealthExportParser.extract_workouts(payload)).to eq([payload])
    end

    it 'returns an empty array for unrecognized shapes' do
      expect(HealthExportParser.extract_workouts({ 'foo' => 'bar' })).to eq([])
    end
  end

  describe '.normalize' do
    it 'extracts qty-wrapped fields and converts duration to minutes' do
      record = {
        'id' => 'UUID-1',
        'name' => 'ランニング',
        'start' => '2026-07-14 07:00:00 +0900',
        'duration' => 1800,
        'activeEnergyBurned' => { 'qty' => 260 },
        'avgHeartRate' => { 'qty' => 145 },
        'distance' => { 'qty' => 5.2 }
      }
      attrs = HealthExportParser.normalize(record)

      expect(attrs[:external_uuid]).to eq('UUID-1')
      expect(attrs[:workout_type]).to eq('ランニング')
      expect(attrs[:duration_minutes]).to eq(30.0)
      expect(attrs[:calories]).to eq(260.0)
      expect(attrs[:avg_heart_rate]).to eq(145.0)
      expect(attrs[:distance_km]).to eq(5.2)
    end

    it 'returns nil for performed_at when the date cannot be parsed' do
      attrs = HealthExportParser.normalize({ 'name' => 'Run', 'start' => 'not-a-date' })
      expect(attrs[:performed_at]).to be_nil
    end
  end
end
