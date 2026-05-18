package contracts

import "ludo-game-engine/internal/domain"

type GameEngine interface {
	DiceRoll() error
	MovePlayer() (bool, error)
	Snapshot() domain.EngineState
}
