# Suggests the next workout based on recently recorded history
# (imported from Apple Health or entered manually).
class WorkoutSuggester
  DEFAULT_TYPES = ['ウォーキング', 'ランニング', 'サイクリング', '筋トレ', 'ヨガ'].freeze
  INTENSE_DURATION_MINUTES = 45
  INTENSE_CALORIES = 400
  COMEBACK_THRESHOLD_DAYS = 3

  def initialize(workouts_relation, now: Time.now)
    @workouts = workouts_relation.to_a # expected ordered most-recent-first
    @now = now
  end

  def suggest
    return first_timer_suggestion if @workouts.empty?

    last = @workouts.first
    days_since_last = (@now - last.performed_at) / 86_400.0

    if days_since_last < 1
      recovery_suggestion(last)
    elsif days_since_last >= COMEBACK_THRESHOLD_DAYS
      comeback_suggestion(days_since_last)
    else
      regular_suggestion(last)
    end
  end

  private

  def first_timer_suggestion
    {
      headline: '運動記録がまだありません',
      workout_type: 'ウォーキング',
      duration_minutes: 20,
      intensity: '低',
      reason: 'まずは20分程度の軽いウォーキングから始めて、体を運動に慣らしましょう。'
    }
  end

  def recovery_suggestion(last)
    if intense?(last)
      {
        headline: '今日はしっかり運動済みです',
        workout_type: 'ストレッチ・軽いヨガ',
        duration_minutes: 15,
        intensity: '低',
        reason: "#{last.workout_type}(約#{last.duration_minutes&.round}分)を行ったばかりなので、体を休めるストレッチをおすすめします。"
      }
    else
      {
        headline: '今日はすでに運動しています',
        workout_type: '軽いウォーキング',
        duration_minutes: 15,
        intensity: '低',
        reason: '軽めの運動だったので、無理のない範囲でもう少し体を動かしても大丈夫です。'
      }
    end
  end

  def comeback_suggestion(days_since_last)
    {
      headline: "#{days_since_last.floor}日ぶりの運動です",
      workout_type: 'ウォーキング',
      duration_minutes: 20,
      intensity: '低〜中',
      reason: '運動から間が空いているので、軽めのメニューで無理なく再開しましょう。'
    }
  end

  def regular_suggestion(last)
    weekly_count = @workouts.count { |w| w.performed_at >= @now - 7 * 86_400 }
    next_type = rotate_type(last.workout_type)
    avg_duration = (average_duration(next_type) || 30).round

    if weekly_count >= 5
      {
        headline: '今週はよく運動しています',
        workout_type: next_type,
        duration_minutes: [avg_duration - 10, 15].max,
        intensity: '低',
        reason: '今週は運動量が多いので、強度を少し落として体を休めながら継続しましょう。'
      }
    else
      {
        headline: '今日のおすすめワークアウト',
        workout_type: next_type,
        duration_minutes: avg_duration,
        intensity: '中',
        reason: "前回は#{last.workout_type}だったので、#{next_type}で変化をつけましょう。"
      }
    end
  end

  def intense?(workout)
    (workout.duration_minutes || 0) >= INTENSE_DURATION_MINUTES ||
      (workout.calories || 0) >= INTENSE_CALORIES
  end

  # Prefer a type that hasn't been done recently (or ever) over repeating
  # the same type back-to-back.
  def rotate_type(last_type)
    last_used_at = DEFAULT_TYPES.each_with_object({}) do |type, memo|
      match = @workouts.find { |w| w.workout_type == type }
      memo[type] = match&.performed_at || Time.at(0)
    end

    ordered = DEFAULT_TYPES.sort_by { |type| last_used_at[type] }
    ordered.find { |type| type != last_type } || DEFAULT_TYPES.first
  end

  def average_duration(type)
    matching = @workouts.select { |w| w.workout_type == type && w.duration_minutes }
    return nil if matching.empty?

    matching.sum(&:duration_minutes) / matching.size.to_f
  end
end
