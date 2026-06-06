class AddFormationToMatches < ActiveRecord::Migration[7.1]
  def change
    add_column :matches, :home_formation, :string
    add_column :matches, :away_formation, :string
    add_column :players, :photo_url, :string
  end
end
