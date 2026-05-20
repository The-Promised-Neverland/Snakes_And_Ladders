package engine

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	contracts "snakes-and-ladders-engine/internal/contracts"
	"snakes-and-ladders-engine/internal/domain"
)

type playerState struct {
	PID            int
	Position       int
	ConseqSixCount int
	PlayerName     string
	IsWinner       bool
}

type boardEngine struct {
	Position          []int
	Players           map[int]*playerState
	SnakePosi         map[int]int
	LadderPosi        map[int]int
	CurrentTurnPID    int
	PlayerLeaderboard []int
	CurrDiceValue     int
	DiceRolled        bool
	m                 sync.Mutex
}

var _ contracts.GameEngine = (*boardEngine)(nil)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func NewGameEngine(snakes map[int]int, ladders map[int]int, players []string) contracts.GameEngine {
	playerMap := make(map[int]*playerState, len(players))
	for pid := 0; pid < len(players); pid++ {
		playerMap[pid] = &playerState{
			PID:            pid,
			Position:       0,
			ConseqSixCount: 0,
			PlayerName:     players[pid],
			IsWinner:       false,
		}
	}

	return &boardEngine{
		Position:          make([]int, 100),
		Players:           playerMap,
		SnakePosi:         clonePositionMap(snakes),
		LadderPosi:        clonePositionMap(ladders),
		CurrentTurnPID:    0,
		PlayerLeaderboard: make([]int, 0, len(players)),
		CurrDiceValue:     0,
		DiceRolled:        false,
	}
}

func (b *boardEngine) DiceRoll() error {
	b.m.Lock()
	defer b.m.Unlock()
	if b.DiceRolled {
		return fmt.Errorf("Dice already rolled..Don't cheat... %v", nil)
	}
	diceValue := rand.Intn(6) + 1
	player := b.Players[b.CurrentTurnPID]
	if diceValue == 6 {
		player.ConseqSixCount++
	}
	b.DiceRolled = true
	b.CurrDiceValue = diceValue
	return nil
}

func (b *boardEngine) MovePlayer() (bool, error) {
	b.m.Lock()
	defer b.m.Unlock()
	player := b.Players[b.CurrentTurnPID]
	if player.IsWinner {
		b.DiceRolled = false
		b.changeTurn()
		return false, fmt.Errorf("Cannot move. Player already won... %v", nil)
	}
	if !b.DiceRolled {
		return false, fmt.Errorf("Gang..Atleast roll the dice first... %v", nil)
	}
	b.DiceRolled = false
	if player.ConseqSixCount == 3 {
		player.ConseqSixCount = 0
		b.changeTurn()
		return false, fmt.Errorf("Three conseq sixes found. Move forfeit")
	}
	if b.CurrDiceValue == 6 {
		return false, fmt.Errorf("last roll is six, need to diceroll again")
	}
	newPlayerPosition := player.Position + player.ConseqSixCount*6 + b.CurrDiceValue
	player.ConseqSixCount = 0
	if newPlayerPosition > 99 {
		b.changeTurn()
		return false, fmt.Errorf("Player cannot move. Position overshooting!!!")
	}

	player.Position = newPlayerPosition
	if snakeTo, ok := b.SnakePosi[newPlayerPosition]; ok {
		player.Position = snakeTo
	}
	if ladderTo, ok := b.LadderPosi[newPlayerPosition]; ok {
		player.Position = ladderTo
	}
	if player.Position == 99 {
		b.PlayerLeaderboard = append(b.PlayerLeaderboard, player.PID)
		player.IsWinner = true
		if b.majorityWonCheck() {
			for _, queuedPlayer := range b.Players {
				if !queuedPlayer.IsWinner {
					b.PlayerLeaderboard = append(b.PlayerLeaderboard, queuedPlayer.PID)
					queuedPlayer.IsWinner = true
				}
			}
			return true, nil
		}
	}
	b.changeTurn()
	return false, nil
}

func (b *boardEngine) Snapshot() domain.EngineState {
	b.m.Lock()
	defer b.m.Unlock()

	players := make([]domain.EnginePlayerState, 0, len(b.Players))
	for pid := 0; pid < len(b.Players); pid++ {
		player := b.Players[pid]
		players = append(players, domain.EnginePlayerState{
			PID:            player.PID,
			PlayerName:     player.PlayerName,
			Position:       player.Position,
			ConseqSixCount: player.ConseqSixCount,
			IsWinner:       player.IsWinner,
		})
	}
	currentTurnPlayer := ""
	if player, ok := b.Players[b.CurrentTurnPID]; ok {
		currentTurnPlayer = player.PlayerName
	}
	return domain.EngineState{
		CurrentTurnPID:    b.CurrentTurnPID,
		CurrentTurnPlayer: currentTurnPlayer,
		DiceValue:         b.CurrDiceValue,
		DiceRolled:        b.DiceRolled,
		Leaderboard:       append([]int(nil), b.PlayerLeaderboard...),
		Players:           players,
		Snakes:            clonePositionMap(b.SnakePosi),
		Ladders:           clonePositionMap(b.LadderPosi),
	}
}

func (b *boardEngine) changeTurn() {
	for {
		b.CurrentTurnPID = (b.CurrentTurnPID + 1) % len(b.Players)
		if !b.Players[b.CurrentTurnPID].IsWinner {
			return
		}
	}
}

func (b *boardEngine) majorityWonCheck() bool {
	return len(b.PlayerLeaderboard)+1 == len(b.Players)
}

func clonePositionMap(input map[int]int) map[int]int {
	output := make(map[int]int, len(input))
	for from, to := range input {
		output[from] = to
	}
	return output
}
