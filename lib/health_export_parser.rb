require 'time'

# Parses workout JSON as produced by common Apple Health export tools
# (e.g. the "Health Auto Export" app or a Shortcuts-based HealthKit export).
# These tools disagree on exact key names, so we accept a handful of common
# shapes rather than a single fixed schema.
module HealthExportParser
  module_function

  def extract_workouts(payload)
    case payload
    when Array
      payload
    when Hash
      if payload.dig('data', 'workouts').is_a?(Array)
        payload.dig('data', 'workouts')
      elsif payload['workouts'].is_a?(Array)
        payload['workouts']
      elsif payload.key?('start') || payload.key?('startDate') || payload.key?('name')
        [payload]
      else
        []
      end
    else
      []
    end
  end

  def normalize(record)
    {
      external_uuid: dig_any(record, 'id', 'uuid', 'UUID'),
      workout_type: dig_any(record, 'name', 'workoutActivityType', 'type'),
      performed_at: parse_time(dig_any(record, 'start', 'startDate', 'date')),
      duration_minutes: duration_minutes(record),
      calories: quantity(record, 'activeEnergyBurned', 'calories', 'totalEnergyBurned'),
      avg_heart_rate: quantity(record, 'avgHeartRate', 'averageHeartRate', 'heartRateAvg'),
      distance_km: quantity(record, 'distance', 'distanceKm', 'totalDistance')
    }
  end

  def dig_any(record, *keys)
    keys.each do |key|
      value = record[key]
      return value if value
    end
    nil
  end

  def parse_time(value)
    return nil if value.nil?
    Time.parse(value.to_s)
  rescue ArgumentError
    nil
  end

  def duration_minutes(record)
    return record['durationMinutes'].to_f if record['durationMinutes']
    return record['duration'].to_f / 60.0 if record['duration']

    nil
  end

  # Handles both plain numeric fields ("calories": 250) and the
  # { "qty": 250, "units": "kcal" } shape some export tools use.
  def quantity(record, *keys)
    value = dig_any(record, *keys)
    return nil if value.nil?
    return value.to_f if value.is_a?(Numeric)
    return value['qty'].to_f if value.is_a?(Hash) && value['qty']

    nil
  end
end
