class Player < ApplicationRecord
  POSITIONS = %w[GK CB SB CM CAM LW RW ST CF].freeze

  has_many :match_players, dependent: :destroy
  has_many :matches, through: :match_players

  validates :name, presence: true
  validates :position, inclusion: { in: POSITIONS }, allow_blank: true
end
