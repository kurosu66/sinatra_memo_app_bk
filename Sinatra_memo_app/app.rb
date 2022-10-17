# frozen_string_literal: true

require 'sinatra'
require 'sinatra/reloader'
require 'json'

helpers do
  def sanitize(text)
    Rack::Utils.escape_html(text)
  end
end

memos = File.open('memos.json') do |memo|
  JSON.parse(memo.read)
end

get '/memos' do
  @memos = memos
  erb :memos
end

get '/new' do
  erb :new
end

post '/memos' do
  next_memo_id = 1
  unless memos.nil?
    memos['memos'].each do |memo|
      next_memo_id = memo.keys[0].to_i + 1
    end
  end

  File.open('memos.json', 'w') do |file|
    memos['memos'] << { next_memo_id.to_s => { 'title' => params[:title], 'content' => params[:content] } }
    JSON.dump(memos, file)
  end

  redirect '/memos'
end

get '/memos/:id' do
  @memo_id = params[:id].to_i
  memos['memos'].each do |memo|
    if memo[@memo_id.to_s]
      @memo_title = memo[@memo_id.to_s]['title']
      @memo_content = memo[@memo_id.to_s]['content']
    end
  end

  erb :detail
end

get '/memos/:id/edit' do
  @memo_id = params[:id].to_i
  memos['memos'].each do |memo|
    if memo[@memo_id.to_s]
      @memo_title = memo[@memo_id.to_s]['title']
      @memo_content = memo[@memo_id.to_s]['content']
    end
  end

  erb :edit
end

patch '/memos/:id/update' do
  @memo_id = params[:id].to_i
  File.open('memos.json', 'w') do |file|
    memos['memos'].each do |memo|
      if memo[@memo_id.to_s]
        memo[@memo_id.to_s]['title'] = params[:title]
        memo[@memo_id.to_s]['content'] = params[:content]
      end
    end
    JSON.dump(memos, file)
  end

  redirect '/memos'
end

delete '/memos/:id' do
  @memo_id = params[:id].to_i
  memos['memos'].delete_if do |memo|
    memo[@memo_id.to_s]
  end

  File.open('memos.json', 'w') do |file|
    JSON.dump(memos, file)
  end

  redirect '/memos'
end
