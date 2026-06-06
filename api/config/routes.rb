Rails.application.routes.draw do
  namespace :api do
    resources :players
    resources :matches
  end
  get '/health', to: proc { [200, {}, ['ok']] }
end
