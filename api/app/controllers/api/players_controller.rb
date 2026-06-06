module Api
  class PlayersController < ApplicationController
    def index
      render json: Player.order(:name)
    end

    def show
      render json: player
    end

    def create
      p = Player.new(player_params)
      if p.save
        render json: p, status: :created
      else
        render json: { errors: p.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def update
      if player.update(player_params)
        render json: player
      else
        render json: { errors: player.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      player.destroy
      head :no_content
    end

    private

    def player
      @player ||= Player.find(params[:id])
    end

    def player_params
      params.require(:player).permit(:name, :jersey_number, :position, :photo_url, :note)
    end
  end
end
