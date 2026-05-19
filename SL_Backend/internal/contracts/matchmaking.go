package contracts

import "snakes-and-ladders-engine/internal/domain"

type MatchmakingService interface {
	StartMatchmaking(playerName string, roomSize int) (*domain.MatchmakingResult, error)
	JoinRoom(playerName string, roomID string) (*domain.MatchmakingResult, error)
	ShowAvailableRooms() ([]domain.RoomState, error)
}

type MatchmakingEngine interface {
	FindJoinableGame(gameID string) (*domain.RoomState, error)
	FindBestJoinableGame(roomSize int) (*domain.RoomState, error)
	AddPlayerToGame(gameID string, playerName string) (*domain.RoomState, bool, error)
	ListJoinableGames() ([]domain.RoomState, error)
	CreateQueuedGame(roomSize int) (*domain.RoomState, error)
}
