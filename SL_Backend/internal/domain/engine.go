package domain

type EnginePlayerState struct {
	PID            int
	PlayerName     string
	Position       int
	ConseqSixCount int
	IsWinner       bool
}

type EngineState struct {
	CurrentTurnPID    int
	CurrentTurnPlayer string
	DiceValue         int
	DiceRolled        bool
	Players           []EnginePlayerState
	Snakes            map[int]int
	Ladders           map[int]int
}
