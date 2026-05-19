package contracts

import "snakes-and-ladders-engine/internal/domain"

type GameManager interface {
	GetBoardGameState(gameID string) (*domain.BoardState, error)
	RollDiceForPlayer(gameID string, playerID int) (*domain.RollDiceResult, error)
	RemovePlayerFromGame(gameID string, playerName string) error
}
