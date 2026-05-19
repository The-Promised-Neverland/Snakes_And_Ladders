package engine

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const socketWriteWait = 10 * time.Second

type SocketClient struct {
	conn       *websocket.Conn
	playerName string
}

type SocketEngine struct {
	mu       sync.RWMutex
	upgrader websocket.Upgrader
	rooms    map[string]map[int]*SocketClient
}

func NewSocketEngine() *SocketEngine {
	return &SocketEngine{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		rooms: make(map[string]map[int]*SocketClient),
	}
}

func (e *SocketEngine) Upgrade(w http.ResponseWriter, r *http.Request, roomID string, playerID int, playerName string) (*SocketClient, error) {
	conn, err := e.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, err
	}
	client := &SocketClient{
		conn:       conn,
		playerName: playerName,
	}
	e.register(roomID, playerID, client)
	return client, nil
}

func (e *SocketEngine) Listen(roomID string, playerID int, client *SocketClient, dispatchHandler func([]byte), disconnectHandler func()) {
	defer func() {
		e.unregister(roomID, playerID)
		_ = client.conn.Close()
		if disconnectHandler != nil {
			disconnectHandler()
		}
	}()
	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			return
		}
		if dispatchHandler != nil {
			dispatchHandler(message)
		}
	}
}

func (e *SocketEngine) SendJSON(roomID string, playerID int, payload any) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	roomClients, exists := e.rooms[roomID]
	if !exists {
		return nil
	}
	client, exists := roomClients[playerID]
	if !exists {
		return nil
	}
	if err := writeMessage(client.conn, message); err != nil {
		_ = client.conn.Close()
		delete(roomClients, playerID)
		if len(roomClients) == 0 {
			delete(e.rooms, roomID)
		}
		return err
	}
	return nil
}

func (e *SocketEngine) BroadcastJSON(roomID string, payload any) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	roomClients, exists := e.rooms[roomID]
	if !exists {
		return nil
	}
	for playerID, client := range roomClients {
		if err := writeMessage(client.conn, message); err != nil {
			_ = client.conn.Close()
			delete(roomClients, playerID)
		}
	}
	if len(roomClients) == 0 {
		delete(e.rooms, roomID)
	}
	return nil
}

func (e *SocketEngine) Disconnect(roomID string, playerID int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	roomClients, exists := e.rooms[roomID]
	if !exists {
		return
	}
	client, exists := roomClients[playerID]
	if !exists {
		return
	}
	_ = client.conn.Close()
	delete(roomClients, playerID)
	if len(roomClients) == 0 {
		delete(e.rooms, roomID)
	}
}

func (e *SocketEngine) CloseRoom(roomID string) {
	e.mu.Lock()
	roomClients := e.rooms[roomID]
	delete(e.rooms, roomID)
	e.mu.Unlock()

	for _, client := range roomClients {
		_ = client.conn.Close()
	}
}

func (e *SocketEngine) ReindexRoom(roomID string, playerNames []string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	roomClients, exists := e.rooms[roomID]
	if !exists {
		return
	}

	reindexedClients := make(map[int]*SocketClient, len(roomClients))
	for playerID, playerName := range playerNames {
		for _, client := range roomClients {
			if client.playerName == playerName {
				reindexedClients[playerID] = client
				break
			}
		}
	}

	if len(reindexedClients) == 0 {
		delete(e.rooms, roomID)
		return
	}

	e.rooms[roomID] = reindexedClients
}

func (e *SocketEngine) register(roomID string, playerID int, client *SocketClient) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, exists := e.rooms[roomID]; !exists {
		e.rooms[roomID] = make(map[int]*SocketClient)
	}
	if existing, exists := e.rooms[roomID][playerID]; exists {
		_ = existing.conn.Close()
	}
	e.rooms[roomID][playerID] = client
}

func (e *SocketEngine) unregister(roomID string, playerID int) {
	e.mu.Lock()
	defer e.mu.Unlock()
	roomClients, exists := e.rooms[roomID]
	if !exists {
		return
	}
	delete(roomClients, playerID)
	if len(roomClients) == 0 {
		delete(e.rooms, roomID)
	}
}

func writeMessage(conn *websocket.Conn, message []byte) error {
	if err := conn.SetWriteDeadline(time.Now().Add(socketWriteWait)); err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, message)
}
