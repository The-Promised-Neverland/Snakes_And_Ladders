package engine

import "testing"

func TestMovePlayerDoesNotChangeTurnWithoutDiceRoll(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	gameEngine.CurrDiceValue = 5

	_, err := gameEngine.MovePlayer()
	if err == nil {
		t.Fatal("expected MovePlayer to fail when dice has not been rolled")
	}
	if gameEngine.CurrentTurnPID != 0 {
		t.Fatalf("expected current turn to stay on player 0, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to stay false")
	}
}

func TestMovePlayerAfterSingleSixKeepsTurn(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	player := gameEngine.Players[0]
	player.ConseqSixCount = 1
	gameEngine.CurrDiceValue = 6
	gameEngine.DiceRolled = true

	_, err := gameEngine.MovePlayer()
	if err == nil {
		t.Fatal("expected MovePlayer to require another roll after a six")
	}
	if player.Position != 0 {
		t.Fatalf("expected player position to stay 0, got %d", player.Position)
	}
	if player.ConseqSixCount != 1 {
		t.Fatalf("expected consecutive six count to stay 1, got %d", player.ConseqSixCount)
	}
	if gameEngine.CurrentTurnPID != 0 {
		t.Fatalf("expected turn to stay on player 0, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to reset to false")
	}
}

func TestMovePlayerAfterSixThenFive(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	player := gameEngine.Players[0]
	player.ConseqSixCount = 1
	gameEngine.CurrDiceValue = 5
	gameEngine.DiceRolled = true

	_, err := gameEngine.MovePlayer()
	if err != nil {
		t.Fatalf("expected MovePlayer to succeed after 6 then 5, got %v", err)
	}
	if player.Position != 11 {
		t.Fatalf("expected player position 11 after 6 then 5, got %d", player.Position)
	}
	if player.ConseqSixCount != 0 {
		t.Fatalf("expected consecutive six count to reset, got %d", player.ConseqSixCount)
	}
	if gameEngine.CurrentTurnPID != 1 {
		t.Fatalf("expected turn to pass to player 1, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to reset to false")
	}
}

func TestMovePlayerAfterThreeConsecutiveSixes(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	player := gameEngine.Players[0]
	player.ConseqSixCount = 3
	gameEngine.CurrDiceValue = 6
	gameEngine.DiceRolled = true

	_, err := gameEngine.MovePlayer()
	if err == nil {
		t.Fatal("expected MovePlayer to forfeit after three consecutive sixes")
	}
	if player.Position != 0 {
		t.Fatalf("expected player position to stay 0, got %d", player.Position)
	}
	if player.ConseqSixCount != 0 {
		t.Fatalf("expected consecutive six count to reset after forfeit, got %d", player.ConseqSixCount)
	}
	if gameEngine.CurrentTurnPID != 1 {
		t.Fatalf("expected turn to pass to player 1, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to reset to false")
	}
}

func TestWinningMoveDoesNotAdvanceTurn(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	player := gameEngine.Players[0]
	player.Position = 98
	gameEngine.CurrDiceValue = 1
	gameEngine.DiceRolled = true

	gameOver, err := gameEngine.MovePlayer()
	if err != nil {
		t.Fatalf("expected winning move to succeed, got %v", err)
	}
	if !gameOver {
		t.Fatal("expected gameOver to be true")
	}
	if gameEngine.CurrentTurnPID != 0 {
		t.Fatalf("expected current turn to stay on winning player, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to reset to false")
	}
}

func TestWinnerTurnDefensivelyPassesToNextPlayer(t *testing.T) {
	gameEngine := NewGameEngine(map[int]int{}, map[int]int{}, []string{"Alice", "Bob"}).(*boardEngine)
	gameEngine.Players[0].IsWinner = true
	gameEngine.DiceRolled = true
	gameEngine.CurrDiceValue = 4

	_, err := gameEngine.MovePlayer()
	if err == nil {
		t.Fatal("expected MovePlayer to reject a winner turn")
	}
	if gameEngine.CurrentTurnPID != 1 {
		t.Fatalf("expected turn to pass to player 1, got %d", gameEngine.CurrentTurnPID)
	}
	if gameEngine.DiceRolled {
		t.Fatal("expected dice_rolled to reset to false")
	}
}
