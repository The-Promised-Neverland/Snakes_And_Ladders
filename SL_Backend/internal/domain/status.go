package domain

type GameStatus string

const (
	GameStatusQueued     GameStatus = "queued"
	GameStatusInProgress GameStatus = "in_progress"
	GameStatusCompleted  GameStatus = "completed"
)
