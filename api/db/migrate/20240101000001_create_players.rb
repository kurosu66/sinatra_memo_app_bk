class CreatePlayers < ActiveRecord::Migration[7.1]
  def change
    create_table :players do |t|
      t.string :name, null: false
      t.string :jersey_number
      t.string :position
      t.text :note
      t.timestamps
    end
  end
end
