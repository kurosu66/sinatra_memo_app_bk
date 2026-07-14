class Memo < ActiveRecord::Base
  validates :title, presence: true
end
