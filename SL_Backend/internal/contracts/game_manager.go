package contracts

import "snakes-and-ladders-engine/internal/domain"

type GameManager interface {
	RollDiceForPlayer(gameID string, playerID int) (*domain.RollDiceResult, error)
	StartMatchmaking(playerName string, roomSize int) (*domain.MatchmakingResult, error)
	JoinRoom(playerName string, roomID string) (*domain.MatchmakingResult, error)
	ShowAvailableRooms() ([]domain.RoomState, error)
	GetRoomPlayers(gameID string) ([]string, error)
	RemovePlayerFromGame(gameID string, playerName string) error
}
