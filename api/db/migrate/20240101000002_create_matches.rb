class CreateMatches < ActiveRecord::Migration[7.1]
  def change
    create_table :matches do |t|
      t.date   :date
      t.string :location
      t.string :home_team
      t.string :away_team
      t.integer :home_score, default: 0
      t.integer :away_score, default: 0
      t.text :note
      t.timestamps
    end
  end
end
