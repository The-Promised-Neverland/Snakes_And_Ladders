package service

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	contracts "snakes-and-ladders-engine/internal/contracts"
	"snakes-and-ladders-engine/internal/domain"
	"snakes-and-ladders-engine/internal/engine"
)

type WebSocketEvent struct {
	Type       WebSocketEventType        `json:"type"`
	State      *domain.BoardState        `json:"state,omitempty"`
	Result     *domain.MatchmakingResult `json:"result,omitempty"`
	Rooms      *[]domain.RoomState       `json:"rooms,omitempty"`
	Count      *int                      `json:"count,omitempty"`
	PlayerName string                    `json:"player_name,omitempty"`
	RoomID     string                    `json:"room_id,omitempty"`
	Message    string                    `json:"message,omitempty"`
}

type WebSocketEventType string

const (
	WebSocketEventTypeMatchmaking WebSocketEventType = "matchmaking"
	WebSocketEventTypeJoinRoom    WebSocketEventType = "join_room"
	WebSocketEventTypeShowRooms   WebSocketEventType = "show_rooms"

	WebSocketEventTypeBoardState WebSocketEventType = "board_state"
	WebSocketEventTypeRollDice   WebSocketEventType = "roll_dice"

	WebSocketEventTypeGlobalChat WebSocketEventType = "global_chat"
	WebSocketEventTypeRoomChat   WebSocketEventType = "room_chat"
	WebSocketEventTypeOnlineCount WebSocketEventType = "online_count"

	WebSocketEventTypeError WebSocketEventType = "error"
)

type WebSocketClientEvent struct {
	Type       WebSocketEventType `json:"type"`
	RoomID     string             `json:"room_id,omitempty"`
	RoomSize   int                `json:"room_size,omitempty"`
	Message    string             `json:"message,omitempty"`
}

type WebSocketService struct {
	socketEngine *engine.SocketEngine
	gameManager  contracts.GameManager
}

func NewWebSocketService() *WebSocketService {
	service := &WebSocketService{
		socketEngine: engine.NewSocketEngine(),
	}
	go service.run()
	return service
}

func (s *WebSocketService) AttachGameManager(gameManager contracts.GameManager) {
	s.gameManager = gameManager
}

func (s *WebSocketService) UpgradeToWebSocket(w http.ResponseWriter, r *http.Request, playerName string) error {
	playerName = strings.TrimSpace(playerName)
	if playerName == "" {
		return fmt.Errorf("player_name query parameter is required")
	}
	client, err := s.socketEngine.Upgrade(w, r, playerName)
	if err != nil {
		return err
	}
	if client == nil {
		return nil
	}
	s.socketEngine.Run(client)
	s.broadcastOnlineCount()
	return nil
}

func (s *WebSocketService) BroadcastBoardState(roomID string, state *domain.BoardState, message string) {
	if state == nil {
		return
	}
	playerNames := make([]string, 0, len(state.Players))
	for _, player := range state.Players {
		playerName := strings.TrimSpace(player.PlayerName)
		if playerName == "" {
			continue
		}
		playerNames = append(playerNames, playerName)
	}
	_ = roomID
	_ = s.socketEngine.BroadcastJSONPlayers(playerNames, WebSocketEvent{
		Type:    WebSocketEventTypeBoardState,
		State:   state,
		Message: message,
	})
}

func (s *WebSocketService) SyncRoomPlayers(roomID string, playerNames []string) {
	s.socketEngine.SyncPlayersGame(roomID, playerNames)
}

func (s *WebSocketService) CloseGame(playerNames []string) {
	s.socketEngine.ClearPlayersGame(playerNames)
}

func (s *WebSocketService) run() {
	for {
		select {
		case processMessage := <-s.socketEngine.ProcessorMessages():
			s.handleClientEvent(processMessage.Client, processMessage.Payload)
		case client := <-s.socketEngine.DisconnectedClients():
			s.handleDisconnect(client)
		}
	}
}

func (s *WebSocketService) handleClientEvent(client *engine.SocketClient, message []byte) {
	var event WebSocketClientEvent
	if err := json.Unmarshal(message, &event); err != nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "invalid websocket event payload",
		})
		return
	}
	switch event.Type {
	case WebSocketEventTypeRollDice:
		s.handleRollDiceEvent(client, event)
	case WebSocketEventTypeGlobalChat, WebSocketEventTypeRoomChat:
		s.handleChatEvent(client, event)
	case WebSocketEventTypeMatchmaking:
		s.handleMatchmakingEvent(client, event)
	case WebSocketEventTypeJoinRoom:
		s.handleJoinRoomEvent(client, event)
	case WebSocketEventTypeShowRooms:
		s.handleShowRoomsEvent(client)
	default:
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: fmt.Sprintf("unsupported websocket event type: %s", event.Type),
		})
	}
}

func (s *WebSocketService) sendEvent(client *engine.SocketClient, event WebSocketEvent) {
	_ = s.socketEngine.SendClientJSON(client, event)
}

func (s *WebSocketService) handleDisconnect(client *engine.SocketClient) {
	s.broadcastOnlineCount()
	if s.gameManager == nil {
		return
	}
	roomID := client.RoomID()
	if roomID == "" {
		return
	}
	_ = s.gameManager.RemovePlayerFromGame(roomID, client.PlayerName())
}

func (s *WebSocketService) broadcastOnlineCount() {
	count := s.socketEngine.ClientCount()
	_ = s.socketEngine.BroadcastJSONGlobal(WebSocketEvent{
		Type:  WebSocketEventTypeOnlineCount,
		Count: &count,
	})
}

// --------------------------------EVENT HANDLERS--------------------------------------------
func (s *WebSocketService) handleChatEvent(client *engine.SocketClient, event WebSocketClientEvent) {
	message := strings.TrimSpace(event.Message)
	if message == "" {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "message is required",
		})
		return
	}
	chatEvent := WebSocketEvent{
		Type:       event.Type,
		PlayerName: client.PlayerName(),
		Message:    message,
	}
	if event.Type == WebSocketEventTypeGlobalChat {
		_ = s.socketEngine.BroadcastJSONGlobal(chatEvent)
		return
	}
	roomID := client.RoomID()
	if roomID == "" {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "player has not joined a room yet",
		})
		return
	}
	if s.gameManager == nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "game manager is not attached",
		})
		return
	}
	playerNames, err := s.gameManager.GetRoomPlayers(roomID)
	if err != nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		})
		return
	}
	chatEvent.RoomID = roomID
	_ = s.socketEngine.BroadcastJSONPlayers(playerNames, chatEvent)
}

func (s *WebSocketService) handleRollDiceEvent(client *engine.SocketClient, event WebSocketClientEvent) {
	if s.gameManager == nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "game manager is not attached",
		})
		return
	}
	_ = event
	roomID := client.RoomID()
	playerID, hasPlayerID := client.PlayerID()
	if roomID == "" || !hasPlayerID {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "player has not joined a room yet",
		})
		return
	}
	result, err := s.gameManager.RollDiceForPlayer(roomID, playerID)
	if err != nil {
		event := WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		}
		if result != nil {
			event.State = result.State
		}
		s.sendEvent(client, event)
		return
	}
}

func (s *WebSocketService) handleMatchmakingEvent(client *engine.SocketClient, event WebSocketClientEvent) {
	if s.gameManager == nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "game manager is not attached",
		})
		return
	}
	playerName := client.PlayerName()
	if playerName == "" {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "player_name is required",
		})
		return
	}
	result, err := s.gameManager.StartMatchmaking(playerName, event.RoomSize)
	if err != nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		})
		return
	}
	s.socketEngine.AssignGame(client, result.Room.RoomID, result.PlayerID)
	s.sendEvent(client, WebSocketEvent{
		Type:    WebSocketEventTypeMatchmaking,
		Result:  result,
		Message: "Matchmaking completed successfully",
	})
}

func (s *WebSocketService) handleJoinRoomEvent(client *engine.SocketClient, event WebSocketClientEvent) {
	if s.gameManager == nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "game manager is not attached",
		})
		return
	}
	roomID := strings.TrimSpace(event.RoomID)
	if roomID == "" {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "room_id is required",
		})
		return
	}
	playerName := client.PlayerName()
	if playerName == "" {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "player_name is required",
		})
		return
	}
	result, err := s.gameManager.JoinRoom(playerName, roomID)
	if err != nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		})
		return
	}
	s.socketEngine.AssignGame(client, result.Room.RoomID, result.PlayerID)
	s.sendEvent(client, WebSocketEvent{
		Type:    WebSocketEventTypeJoinRoom,
		Result:  result,
		Message: "Joined room successfully",
	})
}

func (s *WebSocketService) handleShowRoomsEvent(client *engine.SocketClient) {
	if s.gameManager == nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: "game manager is not attached",
		})
		return
	}
	rooms, err := s.gameManager.ShowAvailableRooms()
	if err != nil {
		s.sendEvent(client, WebSocketEvent{
			Type:    WebSocketEventTypeError,
			Message: err.Error(),
		})
		return
	}
	s.sendEvent(client, WebSocketEvent{
		Type:    WebSocketEventTypeShowRooms,
		Rooms:   &rooms,
		Message: "Rooms displayed successfully",
	})
}
