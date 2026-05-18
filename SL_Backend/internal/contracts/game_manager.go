package contracts

import "ludo-game-engine/internal/domain"

type GameManager interface {
	GetBoardGameState(gameID string) (*domain.BoardState, error)
	RollDiceForPlayer(gameID string, playerID int) (*domain.RollDiceResult, error)
}
