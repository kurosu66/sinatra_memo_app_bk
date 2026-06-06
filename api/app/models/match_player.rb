class MatchPlayer < ApplicationRecord
  belongs_to :match
  belongs_to :player

  validates :team, inclusion: { in: %w[home away] }, allow_blank: true
end
