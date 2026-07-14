ENV['RACK_ENV'] = 'test'

require 'bundler/setup'
require 'rack/test'
require_relative '../app'

ActiveRecord::Migrator.migrations_paths = ['db/migrate'] if defined?(ActiveRecord::Migrator)
ActiveRecord::MigrationContext.new('db/migrate').migrate

RSpec.configure do |config|
  config.include Rack::Test::Methods

  config.before(:each) do
    Workout.delete_all
    Memo.delete_all
  end

  def app
    Sinatra::Application
  end
end
