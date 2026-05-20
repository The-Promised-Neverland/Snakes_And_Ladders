package handler

import (
	"net/http"
	"strings"

	"snakes-and-ladders-engine/internal/service"

	"github.com/gin-gonic/gin"
)

type WebSocketHandler struct {
	ws *service.WebSocketService
}

func NewWebSocketHandler(ws *service.WebSocketService) *WebSocketHandler {
	return &WebSocketHandler{
		ws: ws,
	}
}

func (h *WebSocketHandler) UpgradeToWebSocket(c *gin.Context) {
	playerName := strings.TrimSpace(c.Request.URL.Query().Get("player_name"))
	if err := h.ws.UpgradeToWebSocket(c.Writer, c.Request, playerName); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
}
