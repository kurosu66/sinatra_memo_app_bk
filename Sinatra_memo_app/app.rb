require 'sinatra'
require 'sinatra/reloader'
require 'active_record'


ActiveRecord::Base.establish_connection(
  "adapter" => "sqlite3",
  "database" => "./bbs.db"
)

class Comment < ActiveRecord::Base
end

get '/home' do
  @comments = Comment.order("id desc").all
  erb :home
end

get '/new' do
  erb :new
end

post '/new' do
  s = Comment.new
  s.title = params[:title]
  s.body = params[:body]
  s.save

  erb :new
end

get '/detail/:id' do
  @memo_detail = Comment.find(params[:id])
  erb :detail
end

get '/edit/:id' do
  @memo_detail = Comment.find(params[:id]) 

  erb :edit
end

delete '/detail/delete/:id' do
  s = Comment.find(params[:id])
  s.destroy
  redirect '/home'
end

patch '/patch/:id' do
  @memo_detail = Comment.find(params[:id])
  @memo_detail.update(title: params[:title], body: params[:body])
  redirect '/home'
end
