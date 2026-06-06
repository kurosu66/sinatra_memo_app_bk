require_relative 'boot'
require 'rails/all'
Bundler.require(*Rails.groups)

module SoccerApi
  class Application < Rails::Application
    config.load_defaults 7.1
    config.api_only = true
    config.time_zone = 'Tokyo'
  end
end
