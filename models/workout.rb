class Workout < ActiveRecord::Base
  validates :workout_type, presence: true
  validates :performed_at, presence: true

  scope :recent, -> { order(performed_at: :desc) }
  scope :since, ->(time) { where('performed_at >= ?', time) }
end
