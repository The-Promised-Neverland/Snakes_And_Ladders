package manager

import (
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	contracts "snakes-and-ladders-engine/internal/contracts"
	"snakes-and-ladders-engine/internal/domain"
	"snakes-and-ladders-engine/internal/engine"
	"snakes-and-ladders-engine/internal/service"

	"github.com/google/uuid"
)

type GameManager struct {
	games map[string]*gameSession
	mu    sync.RWMutex
	ws    *service.WebSocketService
}

type gameSession struct {
	ID              string
	Name            string
	Status          domain.GameStatus
	Players         []string
	RequiredPlayers int
	CreatedAt       time.Time
	UpdatedAt       time.Time
	Engine          contracts.GameEngine
}

const (
	defaultSnakeCount  = 10
	defaultLadderCount = 10
	minBoardCell       = 1
	maxSnakeCell       = 98
	winningCell        = 99
)

var _ contracts.GameManager = (*GameManager)(nil)

func NewGameManager(ws *service.WebSocketService) *GameManager {
	return &GameManager{
		games: make(map[string]*gameSession),
		ws:    ws,
	}
}

func (gm *GameManager) GetBoardGameState(gameID string) (*domain.BoardState, error) {
	game, err := gm.getGame(gameID)
	if err != nil {
		return nil, err
	}
	return gm.buildBoardState(game), nil
}

func (gm *GameManager) RollDiceForPlayer(gameID string, playerID int) (*domain.RollDiceResult, error) {
	gm.mu.Lock()
	game, exists := gm.games[gameID]
	if !exists {
		gm.mu.Unlock()
		return nil, fmt.Errorf("game not found")
	}
	if err := gm.validateGameTurn(game, playerID); err != nil {
		state := gm.buildBoardState(game)
		gm.mu.Unlock()
		return &domain.RollDiceResult{
			GameOver: false,
			State:    state,
		}, err
	}
	if err := game.Engine.DiceRoll(); err != nil {
		state := gm.buildBoardState(game)
		gm.mu.Unlock()
		return &domain.RollDiceResult{
			GameOver: false,
			State:    state,
		}, err
	}
	gameOver, moveErr := game.Engine.MovePlayer()
	if gameOver {
		game.Status = domain.GameStatusCompleted
	}
	game.UpdatedAt = time.Now()
	boardState := gm.buildBoardState(game)
	if gameOver {
		delete(gm.games, gameID)
	}
	gm.mu.Unlock()
	result := &domain.RollDiceResult{
		GameOver: gameOver,
		State:    boardState,
	}
	if moveErr != nil {
		if isCompletedTurnOutcome(moveErr) {
			result.Message = moveErr.Error()
			gm.publishBoardState(gameID, boardState, result.Message)
			return result, nil
		}
		gm.publishBoardState(gameID, boardState, "")
		return result, moveErr
	}
	gm.publishBoardState(gameID, boardState, "")
	if !gameOver {
		return result, nil
	}
	roomPlayers := extractPlayerNames(boardState)
	gm.closeBoardStream(roomPlayers)
	return result, nil
}

func (gm *GameManager) DeleteGame(gameID string) error {
	gm.mu.Lock()
	defer gm.mu.Unlock()
	if _, exists := gm.games[gameID]; !exists {
		return fmt.Errorf("game not found")
	}
	delete(gm.games, gameID)
	return nil
}

func (gm *GameManager) createQueuedGame(roomSize int) (*domain.RoomState, error) {
	requiredPlayers, err := resolveRoomSize(roomSize)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	gameID := uuid.New().String()
	game := &gameSession{
		ID:              gameID,
		Name:            "Room " + gameID[:8],
		Status:          domain.GameStatusQueued,
		Players:         make([]string, 0, requiredPlayers),
		RequiredPlayers: requiredPlayers,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	gm.mu.Lock()
	gm.games[game.ID] = game
	gm.mu.Unlock()
	room := gm.buildRoomState(game)
	return &room, nil
}

func (gm *GameManager) StartMatchmaking(playerName string, roomSize int) (*domain.MatchmakingResult, error) {
	target, err := gm.findBestJoinableGame(roomSize)
	if err != nil {
		if err != domain.ErrNoJoinableGames {
			return nil, err
		}
		target, err = gm.createQueuedGame(resolveRequestedRoomSize(roomSize))
		if err != nil {
			return nil, err
		}
	}
	result, err := gm.joinGame(playerName, target.RoomID)
	if err == nil {
		return result, nil
	}
	if isJoinTargetUnavailable(err) {
		if roomSize == 0 {
			target, createErr := gm.createQueuedGame(resolveRequestedRoomSize(roomSize))
			if createErr != nil {
				return nil, createErr
			}
			return gm.joinGame(playerName, target.RoomID)
		}
		return nil, domain.ErrNoJoinableGames
	}

	return nil, err
}

func (gm *GameManager) JoinRoom(playerName string, roomID string) (*domain.MatchmakingResult, error) {
	target, err := gm.findJoinableGame(roomID)
	if err != nil {
		return nil, err
	}
	return gm.joinGame(playerName, target.RoomID)
}

func (gm *GameManager) findJoinableGame(gameID string) (*domain.RoomState, error) {
	game, err := gm.getGame(gameID)
	if err != nil {
		return nil, err
	}
	if game.Status != domain.GameStatusQueued {
		return nil, fmt.Errorf("game is not accepting players")
	}
	if len(game.Players) >= game.RequiredPlayers {
		return nil, fmt.Errorf("room is full")
	}
	room := gm.buildRoomState(game)
	return &room, nil
}

func (gm *GameManager) findBestJoinableGame(roomSize int) (*domain.RoomState, error) {
	minRequiredPlayers := roomSize
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	var best *gameSession
	for _, game := range gm.games {
		if game.Status != domain.GameStatusQueued || len(game.Players) >= game.RequiredPlayers {
			continue
		}
		if minRequiredPlayers > 0 && game.RequiredPlayers < minRequiredPlayers {
			continue
		}
		if best == nil || len(game.Players) > len(best.Players) || (len(game.Players) == len(best.Players) && game.CreatedAt.Before(best.CreatedAt)) {
			best = game
		}
	}
	if best == nil {
		return nil, domain.ErrNoJoinableGames
	}
	room := gm.buildRoomState(best)
	return &room, nil
}

func (gm *GameManager) addPlayerToGame(gameID string, playerName string) (*domain.RoomState, bool, error) {
	playerName = strings.TrimSpace(playerName)
	if playerName == "" {
		return nil, false, fmt.Errorf("player_name is required")
	}
	gm.mu.Lock()
	game, exists := gm.games[gameID]
	if !exists {
		gm.mu.Unlock()
		return nil, false, fmt.Errorf("game not found")
	}
	if game.Status != domain.GameStatusQueued {
		gm.mu.Unlock()
		return nil, false, fmt.Errorf("game is not accepting players")
	}
	if len(game.Players) >= game.RequiredPlayers {
		gm.mu.Unlock()
		return nil, false, fmt.Errorf("room is full")
	}
	for _, existing := range game.Players {
		if existing == playerName {
			gm.mu.Unlock()
			return nil, false, fmt.Errorf("player already joined room")
		}
	}
	game.Players = append(game.Players, playerName)
	game.UpdatedAt = time.Now()
	gameStarted := len(game.Players) == game.RequiredPlayers
	roomState := gm.buildRoomState(game)
	var queuedState *domain.BoardState
	if !gameStarted {
		queuedState = gm.buildBoardState(game)
	}
	gm.mu.Unlock()
	if gameStarted {
		boardState, err := gm.startQueuedGame(gameID)
		if err != nil {
			return nil, false, err
		}
		roomState.Status = string(domain.GameStatusInProgress)
		roomState.AvailableSlots = 0
		gm.publishBoardState(gameID, boardState, "")
	} else {
		gm.publishBoardState(gameID, queuedState, "")
	}
	return &roomState, gameStarted, nil
}

func (gm *GameManager) RemovePlayerFromGame(gameID string, playerName string) error {
	playerName = strings.TrimSpace(playerName)
	gameID = strings.TrimSpace(gameID)
	if playerName == "" || gameID == "" {
		return nil
	}
	var queuedState *domain.BoardState
	shouldCloseRoom := false
	var roomPlayers []string
	gm.mu.Lock()
	game, exists := gm.games[gameID]
	if !exists {
		gm.mu.Unlock()
		return nil
	}
	playerIndex := indexOfPlayer(game.Players, playerName)
	if playerIndex == -1 {
		gm.mu.Unlock()
		return nil
	}
	switch game.Status {
	case domain.GameStatusQueued:
		game.Players = removePlayerAt(game.Players, playerIndex)
		game.UpdatedAt = time.Now()
		if len(game.Players) == 0 {
			delete(gm.games, gameID)
			shouldCloseRoom = true
			gm.mu.Unlock()
			if shouldCloseRoom {
				gm.closeBoardStream(nil)
			}
			return nil
		}
		queuedState = gm.buildBoardState(game)
		roomPlayers = append([]string(nil), game.Players...)
		gm.mu.Unlock()
		if gm.ws != nil {
			gm.ws.SyncRoomPlayers(gameID, roomPlayers)
		}
		gm.publishBoardState(gameID, queuedState, "")
		return nil
	case domain.GameStatusInProgress, domain.GameStatusCompleted:
		roomPlayers = append([]string(nil), game.Players...)
		delete(gm.games, gameID)
		shouldCloseRoom = true
		gm.mu.Unlock()
		if shouldCloseRoom {
			gm.closeBoardStream(roomPlayers)
		}
		return nil
	default:
		gm.mu.Unlock()
		return nil
	}
}

func (gm *GameManager) listJoinableGames() ([]domain.RoomState, error) {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	rooms := make([]domain.RoomState, 0)
	for _, game := range gm.games {
		if game.Status != domain.GameStatusQueued || len(game.Players) >= game.RequiredPlayers {
			continue
		}
		rooms = append(rooms, gm.buildRoomState(game))
	}
	return rooms, nil
}

func (gm *GameManager) ShowAvailableRooms() ([]domain.RoomState, error) {
	return gm.listJoinableGames()
}

func (gm *GameManager) GetRoomPlayers(gameID string) ([]string, error) {
	game, err := gm.getGame(gameID)
	if err != nil {
		return nil, err
	}
	return append([]string(nil), game.Players...), nil
}

func (gm *GameManager) getGame(gameID string) (*gameSession, error) {
	gm.mu.RLock()
	defer gm.mu.RUnlock()
	game, exists := gm.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}
	return game, nil
}

func (gm *GameManager) startQueuedGame(gameID string) (*domain.BoardState, error) {
	snakes, ladders := generateRandomSnakesAndLadders(defaultSnakeCount, defaultLadderCount)
	gm.mu.Lock()
	defer gm.mu.Unlock()
	game, exists := gm.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}
	game.Status = domain.GameStatusInProgress
	game.Engine = engine.NewGameEngine(toPositionMap(snakes), toPositionMap(ladders), game.Players)
	game.UpdatedAt = time.Now()
	return gm.buildBoardState(game), nil
}

func (gm *GameManager) validateGameTurn(game *gameSession, playerID int) error {
	if game.Engine == nil {
		return fmt.Errorf("game has not started")
	}
	snapshot := game.Engine.Snapshot()
	if playerID < 0 || playerID >= len(snapshot.Players) {
		return fmt.Errorf("player %d not found in game", playerID)
	}
	if game.Status != domain.GameStatusInProgress {
		return fmt.Errorf("game is not in progress")
	}
	if snapshot.CurrentTurnPID != playerID {
		return fmt.Errorf("invalid turn: expected player %d", snapshot.CurrentTurnPID)
	}
	return nil
}

func (gm *GameManager) buildBoardState(game *gameSession) *domain.BoardState {
	if game.Engine == nil {
		return &domain.BoardState{
			ID:          game.ID,
			Name:        game.Name,
			Status:      game.Status,
			DiceValue:   0,
			DiceRolled:  false,
			Leaderboard: []int{},
			Players:     buildPendingPlayers(game.Players),
			Snakes:      map[int]int{},
			Ladders:     map[int]int{},
		}
	}
	snapshot := game.Engine.Snapshot()
	players := make([]domain.BoardPlayerState, 0, len(snapshot.Players))
	for _, player := range snapshot.Players {
		players = append(players, domain.BoardPlayerState{
			PID:            player.PID,
			PlayerName:     player.PlayerName,
			Position:       player.Position,
			ConseqSixCount: player.ConseqSixCount,
		})
	}
	return &domain.BoardState{
		ID:                game.ID,
		Name:              game.Name,
		Status:            game.Status,
		CurrentTurnPID:    snapshot.CurrentTurnPID,
		CurrentTurnPlayer: snapshot.CurrentTurnPlayer,
		DiceValue:         snapshot.DiceValue,
		DiceRolled:        snapshot.DiceRolled,
		Leaderboard:       append([]int(nil), snapshot.Leaderboard...),
		Players:           players,
		Snakes:            clonePositionMap(snapshot.Snakes),
		Ladders:           clonePositionMap(snapshot.Ladders),
	}
}

func (gm *GameManager) buildRoomState(game *gameSession) domain.RoomState {
	return domain.RoomState{
		RoomID:          game.ID,
		RoomName:        game.Name,
		Status:          string(game.Status),
		RequiredPlayers: game.RequiredPlayers,
		JoinedPlayers:   len(game.Players),
		AvailableSlots:  game.RequiredPlayers - len(game.Players),
		Players:         append([]string(nil), game.Players...),
	}
}

func buildPendingPlayers(players []string) []domain.BoardPlayerState {
	states := make([]domain.BoardPlayerState, 0, len(players))
	for pid, playerName := range players {
		states = append(states, domain.BoardPlayerState{
			PID:            pid,
			PlayerName:     playerName,
			Position:       0,
			ConseqSixCount: 0,
		})
	}
	return states
}

func isCompletedTurnOutcome(err error) bool {
	switch err.Error() {
	case "last roll is six, need to diceroll again":
		return true
	case "Three conseq sixes found. Move forfeit":
		return true
	case "Player cannot move. Position overshooting!!!":
		return true
	default:
		return false
	}
}

func generateRandomSnakesAndLadders(snakeCount int, ladderCount int) ([]domain.PositionJump, []domain.PositionJump) {
	usedPositions := make(map[int]bool)
	snakes := make([]domain.PositionJump, 0, snakeCount)
	ladders := make([]domain.PositionJump, 0, ladderCount)

	for len(snakes) < snakeCount {
		from := rand.Intn(maxSnakeCell-minBoardCell) + minBoardCell + 1
		to := rand.Intn(from-minBoardCell) + minBoardCell
		rowf := from / 10
		rowt := to / 10
		if from <= to || usedPositions[from] || usedPositions[to] || rowf == rowt {
			continue
		}
		usedPositions[from] = true
		usedPositions[to] = true
		snakes = append(snakes, domain.PositionJump{From: from, To: to})
	}
	for len(ladders) < ladderCount {
		from := rand.Intn(maxSnakeCell-minBoardCell+1) + minBoardCell
		to := rand.Intn(winningCell-from) + from + 1
		rowf := from / 10
		rowt := to / 10
		if to <= from || usedPositions[from] || usedPositions[to] || rowf == rowt {
			continue
		}
		usedPositions[from] = true
		usedPositions[to] = true
		ladders = append(ladders, domain.PositionJump{From: from, To: to})
	}
	return snakes, ladders
}

func toPositionMap(jumps []domain.PositionJump) map[int]int {
	positions := make(map[int]int, len(jumps))
	for _, jump := range jumps {
		positions[jump.From] = jump.To
	}
	return positions
}

func clonePositionMap(input map[int]int) map[int]int {
	output := make(map[int]int, len(input))
	for from, to := range input {
		output[from] = to
	}
	return output
}

func indexOfPlayer(players []string, playerName string) int {
	for index, existingPlayer := range players {
		if existingPlayer == playerName {
			return index
		}
	}
	return -1
}

func removePlayerAt(players []string, index int) []string {
	return append(players[:index], players[index+1:]...)
}

func (gm *GameManager) joinGame(playerName string, gameID string) (*domain.MatchmakingResult, error) {
	room, gameStarted, err := gm.addPlayerToGame(gameID, playerName)
	if err != nil {
		return nil, err
	}
	result := &domain.MatchmakingResult{
		Room:        *room,
		PlayerID:    room.JoinedPlayers - 1,
		GameStarted: gameStarted,
	}
	if gameStarted {
		result.GameID = room.RoomID
	}
	return result, nil
}

func resolveRequestedRoomSize(roomSize int) int {
	if roomSize == 0 {
		return domain.DefaultRoomRequiredPlayers
	}
	return roomSize
}

func isJoinTargetUnavailable(err error) bool {
	switch err.Error() {
	case "game not found":
		return true
	case "game is not accepting players":
		return true
	case "room is full":
		return true
	default:
		return false
	}
}

func resolveRoomSize(roomSize int) (int, error) {
	if roomSize == 0 {
		return domain.DefaultRoomRequiredPlayers, nil
	}
	if roomSize < domain.MinPlayersToStart || roomSize > domain.MaxPlayersPerGame {
		return 0, fmt.Errorf(
			"room_size must be between %d and %d",
			domain.MinPlayersToStart,
			domain.MaxPlayersPerGame,
		)
	}
	return roomSize, nil
}

func (gm *GameManager) publishBoardState(gameID string, state *domain.BoardState, message string) {
	if gm.ws == nil || state == nil {
		return
	}
	gm.ws.BroadcastBoardState(gameID, state, message)
}

func (gm *GameManager) closeBoardStream(playerNames []string) {
	if gm.ws == nil {
		return
	}
	gm.ws.CloseGame(playerNames)
}

func extractPlayerNames(state *domain.BoardState) []string {
	if state == nil {
		return nil
	}
	playerNames := make([]string, 0, len(state.Players))
	for _, player := range state.Players {
		playerName := strings.TrimSpace(player.PlayerName)
		if playerName == "" {
			continue
		}
		playerNames = append(playerNames, playerName)
	}
	return playerNames
}
