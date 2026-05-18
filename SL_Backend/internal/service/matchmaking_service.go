package service

import (
	contracts "ludo-game-engine/internal/contracts"
	"ludo-game-engine/internal/domain"
)

type MatchmakingService struct {
	matchmakingEngine contracts.MatchmakingEngine
}

var _ contracts.MatchmakingService = (*MatchmakingService)(nil)

func NewMatchmakingService(matchmakingEngine contracts.MatchmakingEngine) *MatchmakingService {
	return &MatchmakingService{
		matchmakingEngine: matchmakingEngine,
	}
}

func (s *MatchmakingService) StartMatchmaking(playerName string) (*domain.MatchmakingResult, error) {
	target, err := s.matchmakingEngine.FindBestJoinableGame()
	if err != nil {
		if err != domain.ErrNoJoinableGames {
			return nil, err
		}
		target, err = s.matchmakingEngine.CreateQueuedGame()
		if err != nil {
			return nil, err
		}
	}
	return s.joinGame(playerName, target.RoomID)
}

func (s *MatchmakingService) JoinRoom(playerName string, roomID string) (*domain.MatchmakingResult, error) {
	target, err := s.matchmakingEngine.FindJoinableGame(roomID)
	if err != nil {
		return nil, err
	}
	return s.joinGame(playerName, target.RoomID)
}

func (s *MatchmakingService) ShowAvailableRooms() ([]domain.RoomState, error) {
	return s.matchmakingEngine.ListJoinableGames()
}

func (s *MatchmakingService) joinGame(playerName string, gameID string) (*domain.MatchmakingResult, error) {
	room, gameStarted, err := s.matchmakingEngine.AddPlayerToGame(gameID, playerName)
	if err != nil {
		return nil, err
	}

	result := &domain.MatchmakingResult{
		Room:        *room,
		GameStarted: gameStarted,
	}
	if gameStarted {
		result.GameID = room.RoomID
	}

	return result, nil
}
