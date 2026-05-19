package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	contracts "snakes-and-ladders-engine/internal/contracts"
	"snakes-and-ladders-engine/internal/domain"
	"snakes-and-ladders-engine/internal/engine"
)

type WebSocketEvent struct {
	Type    WebSocketEventType `json:"type"`
	State   *domain.BoardState `json:"state,omitempty"`
	Message string             `json:"message,omitempty"`
}

type WebSocketEventType string

const (
	WebSocketEventTypeBoardState WebSocketEventType = "board_state"
	WebSocketEventTypeRollDice   WebSocketEventType = "roll_dice"
	WebSocketEventTypeError      WebSocketEventType = "error"
)

type WebSocketClientEvent struct {
	Type WebSocketEventType `json:"type"`
}

type WebSocketService struct {
	socketEngine *engine.SocketEngine
	gameManager  contracts.GameManager
}

func NewWebSocketService() *WebSocketService {
	return &WebSocketService{
		socketEngine: engine.NewSocketEngine(),
	}
}

func (s *WebSocketService) AttachGameManager(gameManager contracts.GameManager) {
	s.gameManager = gameManager
}

func (s *WebSocketService) UpgradeToWebSocket(w http.ResponseWriter, r *http.Request, roomID string) error {
	if s.gameManager == nil {
		return errors.New("game manager is not attached")
	}
	state, err := s.gameManager.GetBoardGameState(roomID)
	if err != nil {
		return err
	}
	if len(state.Players) == 0 {
		return errors.New("room has no joined players")
	}
	playerID := len(state.Players) - 1
	playerName := state.Players[playerID].PlayerName
	client, err := s.socketEngine.Upgrade(w, r, roomID, playerID, playerName)
	if err != nil {
		return err
	}
	if err := s.socketEngine.SendJSON(roomID, playerID, WebSocketEvent{
		Type:  WebSocketEventTypeBoardState,
		State: state,
	}); err != nil {
		s.socketEngine.Disconnect(roomID, playerID)
		return err
	}
	go s.socketEngine.Listen(roomID, playerID, client, func(message []byte) {
		s.handleClientEvent(roomID, playerID, message)
	})
	return nil
}

func (s *WebSocketService) handleClientEvent(roomID string, playerID int, message []byte) {
	var event WebSocketClientEvent
	if err := json.Unmarshal(message, &event); err != nil {
		s.sendEvent(roomID, playerID, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "invalid websocket event payload",
		})
		return
	}
	switch event.Type {
	case WebSocketEventTypeRollDice:
		s.handleRollDiceEvent(roomID, playerID)
	default:
		s.sendEvent(roomID, playerID, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: fmt.Sprintf("unsupported websocket event type: %s", event.Type),
		})
	}
}

func (s *WebSocketService) handleRollDiceEvent(roomID string, playerID int) {
	result, err := s.gameManager.RollDiceForPlayer(roomID, playerID)
	if err != nil {
		event := WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		}
		if result != nil {
			event.State = result.State
		}
		s.sendEvent(roomID, playerID, event)
		return
	}
}

func (s *WebSocketService) sendEvent(roomID string, playerID int, event WebSocketEvent) {
	_ = s.socketEngine.SendJSON(roomID, playerID, event)
}

func (s *WebSocketService) BroadcastBoardState(roomID string, state *domain.BoardState, message string) {
	if state == nil {
		return
	}
	_ = s.socketEngine.BroadcastJSON(roomID, WebSocketEvent{
		Type:    WebSocketEventTypeBoardState,
		State:   state,
		Message: message,
	})
}

func (s *WebSocketService) CloseGame(roomID string) {
	s.socketEngine.CloseRoom(roomID)
}
