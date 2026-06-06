class CreateMatchPlayers < ActiveRecord::Migration[7.1]
  def change
    create_table :match_players do |t|
      t.references :match,  null: false, foreign_key: true
      t.references :player, null: false, foreign_key: true
      t.string  :team
      t.decimal :rating, precision: 3, scale: 1
      t.text    :note
      t.timestamps
    end
  end
end
