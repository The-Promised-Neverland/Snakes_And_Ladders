package contracts

import "snakes-and-ladders-engine/internal/domain"

type MatchmakingService interface {
	StartMatchmaking(playerName string) (*domain.MatchmakingResult, error)
	JoinRoom(playerName string, roomID string) (*domain.MatchmakingResult, error)
	ShowAvailableRooms() ([]domain.RoomState, error)
}

type MatchmakingEngine interface {
	FindJoinableGame(gameID string) (*domain.RoomState, error)
	FindBestJoinableGame() (*domain.RoomState, error)
	AddPlayerToGame(gameID string, playerName string) (*domain.RoomState, bool, error)
	ListJoinableGames() ([]domain.RoomState, error)
	CreateQueuedGame() (*domain.RoomState, error)
}
