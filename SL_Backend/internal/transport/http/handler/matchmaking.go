package handler

import (
	"net/http"

	contracts "ludo-game-engine/internal/contracts"
	"ludo-game-engine/pkg/httpx"

	"github.com/gin-gonic/gin"
)

type MatchmakingHandler struct {
	matchmakingService contracts.MatchmakingService
}

func NewMatchmakingHandler(matchmakingService contracts.MatchmakingService) *MatchmakingHandler {
	return &MatchmakingHandler{matchmakingService: matchmakingService}
}

func (h *MatchmakingHandler) StartMatchmaking(c *gin.Context) {
	var req struct {
		PlayerName string `json:"player_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	result, err := h.matchmakingService.StartMatchmaking(req.PlayerName)
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (h *MatchmakingHandler) JoinRoom(c *gin.Context) {
	var req struct {
		PlayerName string `json:"player_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	result, err := h.matchmakingService.JoinRoom(req.PlayerName, c.Param("roomId"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	httpx.JSON(c, http.StatusOK, result)
}

func (h *MatchmakingHandler) ShowRooms(c *gin.Context) {
	rooms, err := h.matchmakingService.ShowAvailableRooms()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err)
		return
	}
	httpx.JSON(c, http.StatusOK, rooms)
}
