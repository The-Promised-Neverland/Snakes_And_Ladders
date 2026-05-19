package contracts

import "snakes-and-ladders-engine/internal/domain"

type GameEngine interface {
	DiceRoll() error
	MovePlayer() (bool, error)
	Snapshot() domain.EngineState
}
