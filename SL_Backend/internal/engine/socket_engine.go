package engine

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	socketWriteWait      = 10 * time.Second
	socketPongWait       = 60 * time.Second
	socketPingPeriod     = (socketPongWait * 9) / 10
	socketMaxMessageSize = 8 * 1024
	socketSendBufferSize = 64
)

const duplicatePlayerNameReason = "Player name already connected. Choose another one."

type SocketClient struct {
	conn       *websocket.Conn
	playerName string
	roomID     *string
	playerID   *int
	send       chan []byte
	mu         sync.Mutex
	closeOnce  sync.Once
	closed     bool
}

type SocketMessage struct {
	Client  *SocketClient
	Payload []byte
}

type SocketEngine struct {
	mu           sync.RWMutex
	upgrader     websocket.Upgrader
	clients      map[string]*SocketClient
	processorCh  chan SocketMessage
	disconnected chan *SocketClient
}

func NewSocketEngine() *SocketEngine {
	socketEngine := &SocketEngine{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		clients:      make(map[string]*SocketClient),
		processorCh:  make(chan SocketMessage, socketSendBufferSize),
		disconnected: make(chan *SocketClient, socketSendBufferSize),
	}
	return socketEngine
}

func (e *SocketEngine) ProcessorMessages() <-chan SocketMessage {
	return e.processorCh
}

func (e *SocketEngine) DisconnectedClients() <-chan *SocketClient {
	return e.disconnected
}

func (e *SocketEngine) ClientCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.clients)
}

func (c *SocketClient) PlayerName() string {
	return c.playerName
}

func (c *SocketClient) RoomID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.roomID == nil {
		return ""
	}
	return *c.roomID
}

func (c *SocketClient) PlayerID() (int, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.playerID == nil {
		return 0, false
	}
	return *c.playerID, true
}

func (c *SocketClient) assignGame(roomID string, playerID int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.roomID = &roomID
	c.playerID = &playerID
}

func (c *SocketClient) clearGame() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.roomID = nil
	c.playerID = nil
}

func (e *SocketEngine) Upgrade(w http.ResponseWriter, r *http.Request, playerName string) (*SocketClient, error) {
	conn, err := e.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return nil, err
	}
	client := &SocketClient{
		conn:       conn,
		playerName: playerName,
		send:       make(chan []byte, socketSendBufferSize),
	}
	if !e.register(client) {
		_ = conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.ClosePolicyViolation, duplicatePlayerNameReason),
			time.Now().Add(socketWriteWait),
		)
		_ = conn.Close()
		return nil, nil
	}
	return client, nil
}

func (e *SocketEngine) Run(client *SocketClient) {
	go e.writePump(client)
	go e.readPump(client)
}

func (e *SocketEngine) SendClientJSON(client *SocketClient, payload any) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if ok := e.enqueue(client, message); !ok {
		return websocket.ErrCloseSent
	}
	return nil
}

func (e *SocketEngine) BroadcastJSONPlayers(playerNames []string, payload any) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	for _, client := range e.snapshotClients(playerNames) {
		e.enqueue(client, message)
	}
	return nil
}

func (e *SocketEngine) BroadcastJSONGlobal(payload any) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	for _, client := range e.snapshotAllClients() {
		e.enqueue(client, message)
	}
	return nil
}

func (e *SocketEngine) ClearPlayersGame(playerNames []string) {
	for _, client := range e.snapshotClients(playerNames) {
		client.clearGame()
	}
}

func (e *SocketEngine) AssignGame(client *SocketClient, roomID string, playerID int) {
	if client == nil {
		return
	}
	client.assignGame(roomID, playerID)
}

func (e *SocketEngine) SyncPlayersGame(roomID string, playerNames []string) {
	for playerID, playerName := range playerNames {
		client := e.lookupClient(playerName)
		if client == nil {
			continue
		}
		client.assignGame(roomID, playerID)
	}
}

func (e *SocketEngine) readPump(client *SocketClient) {
	defer e.disconnect(client)
	_ = client.conn.SetReadDeadline(time.Now().Add(socketPongWait))
	client.conn.SetReadLimit(socketMaxMessageSize)
	client.conn.SetPongHandler(func(string) error {
		return client.conn.SetReadDeadline(time.Now().Add(socketPongWait))
	})
	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			return
		}
		e.processorCh <- SocketMessage{
			Client:  client,
			Payload: message,
		}
	}
}

func (e *SocketEngine) writePump(client *SocketClient) {
	ticker := time.NewTicker(socketPingPeriod)
	defer func() {
		ticker.Stop()
		e.disconnect(client)
	}()
	for {
		select {
		case message, ok := <-client.send:
			if err := client.conn.SetWriteDeadline(time.Now().Add(socketWriteWait)); err != nil {
				return
			}
			if !ok {
				_ = client.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := client.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := client.conn.SetWriteDeadline(time.Now().Add(socketWriteWait)); err != nil {
				return
			}
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (e *SocketEngine) register(client *SocketClient) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, exists := e.clients[client.playerName]; exists {
		return false
	}
	e.clients[client.playerName] = client
	return true
}

func (e *SocketEngine) unregister(client *SocketClient) {
	e.mu.Lock()
	defer e.mu.Unlock()
	currentClient, exists := e.clients[client.playerName]
	if !exists || currentClient != client {
		return
	}
	delete(e.clients, client.playerName)
}

func (e *SocketEngine) disconnect(client *SocketClient) {
	client.closeOnce.Do(func() {
		client.mu.Lock()
		if !client.closed {
			client.closed = true
			close(client.send)
		}
		client.mu.Unlock()
		e.unregister(client)
		_ = client.conn.Close()
		e.disconnected <- client
	})
}

func (e *SocketEngine) enqueue(client *SocketClient, message []byte) bool {
	client.mu.Lock()
	defer client.mu.Unlock()
	if client.closed {
		return false
	}
	select {
	case client.send <- message:
		return true
	default:
		go e.disconnect(client)
		return false
	}
}

func (e *SocketEngine) lookupClient(playerName string) *SocketClient {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.clients[playerName]
}

func (e *SocketEngine) snapshotClients(playerNames []string) []*SocketClient {
	e.mu.RLock()
	defer e.mu.RUnlock()
	clients := make([]*SocketClient, 0, len(playerNames))
	for _, playerName := range playerNames {
		client, exists := e.clients[playerName]
		if exists {
			clients = append(clients, client)
		}
	}
	return clients
}

func (e *SocketEngine) snapshotAllClients() []*SocketClient {
	e.mu.RLock()
	defer e.mu.RUnlock()
	clients := make([]*SocketClient, 0, len(e.clients))
	for _, client := range e.clients {
		clients = append(clients, client)
	}
	return clients
}
