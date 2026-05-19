package handler

import (
	"net/http"

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
	roomID := c.Param("roomId")
	if err := h.ws.UpgradeToWebSocket(c.Writer, c.Request, roomID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
}
