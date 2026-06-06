module Api
  class MatchesController < ApplicationController
    def index
      matches = Match.includes(match_players: :player).order(date: :desc)
      render json: matches.map { |m| serialize(m) }
    end

    def show
      render json: serialize(match)
    end

    def create
      m = Match.new(match_params)
      if m.save
        sync_players(m)
        render json: serialize(m.reload), status: :created
      else
        render json: { errors: m.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def update
      if match.update(match_params)
        sync_players(match)
        render json: serialize(match.reload)
      else
        render json: { errors: match.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      match.destroy
      head :no_content
    end

    private

    def match
      @match ||= Match.includes(match_players: :player).find(params[:id])
    end

    def match_params
      params.permit(:date, :location, :home_team, :away_team,
                    :home_score, :away_score, :note,
                    :home_formation, :away_formation)
    end

    def sync_players(m)
      return unless params.key?(:players)
      m.match_players.destroy_all
      Array(params[:players]).each do |pd|
        m.match_players.create!(
          player_id: pd[:player_id],
          team:      pd[:team],
          rating:    pd[:rating].presence,
          note:      pd[:note]
        )
      end
    end

    def serialize(m)
      m.as_json.merge(
        players: m.match_players.map { |mp|
          mp.as_json.merge(player: mp.player.as_json)
        }
      )
    end
  end
end
