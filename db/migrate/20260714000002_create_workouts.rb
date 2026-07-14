class CreateWorkouts < ActiveRecord::Migration[7.2]
  def change
    create_table :workouts do |t|
      t.string :workout_type, null: false
      t.datetime :performed_at, null: false
      t.float :duration_minutes
      t.float :calories
      t.float :avg_heart_rate
      t.float :distance_km
      t.string :source, null: false, default: 'manual'
      t.string :external_uuid
      t.text :raw_payload
      t.timestamps
    end

    add_index :workouts, :external_uuid, unique: true
    add_index :workouts, :performed_at
  end
end
