package domain

type PositionJump struct {
	From int `json:"from"`
	To   int `json:"to"`
}

type BoardPlayerState struct {
	PID            int    `json:"pid"`
	PlayerName     string `json:"player_name"`
	Position       int    `json:"position"`
	ConseqSixCount int    `json:"conseq_six_count"`
}

type BoardState struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Status            GameStatus         `json:"status"`
	CurrentTurnPID    int                `json:"current_turn_pid"`
	CurrentTurnPlayer string             `json:"current_turn_player"`
	DiceValue         int                `json:"dice_value"`
	DiceRolled        bool               `json:"dice_rolled"`
	Players           []BoardPlayerState `json:"players"`
	Snakes            map[int]int        `json:"snakes"`
	Ladders           map[int]int        `json:"ladders"`
}

type RollDiceResult struct {
	GameOver bool        `json:"game_over"`
	Message  string      `json:"message,omitempty"`
	State    *BoardState `json:"state"`
}
