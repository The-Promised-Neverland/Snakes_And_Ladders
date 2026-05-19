package domain

import "errors"

var ErrNoJoinableGames = errors.New("no joinable game found")

type RoomState struct {
	RoomID          string   `json:"room_id"`
	RoomName        string   `json:"room_name"`
	Status          string   `json:"status"`
	RequiredPlayers int      `json:"required_players"`
	JoinedPlayers   int      `json:"joined_players"`
	AvailableSlots  int      `json:"available_slots"`
	Players         []string `json:"players"`
}

type MatchmakingResult struct {
	Room        RoomState `json:"room"`
	PlayerID    int       `json:"player_id"`
	GameStarted bool      `json:"game_started"`
	GameID      string    `json:"game_id,omitempty"`
}
