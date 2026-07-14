#!/usr/bin/env ruby
require 'bundler/setup'
require 'active_record'
require 'yaml'
require 'erb'

env = ENV['RACK_ENV'] || 'development'
root = File.expand_path('..', __dir__)
config = YAML.safe_load(ERB.new(File.read(File.join(root, 'config/database.yml'))).result)[env]

ActiveRecord::Base.establish_connection(config)
ActiveRecord::MigrationContext.new(File.join(root, 'db/migrate')).migrate
