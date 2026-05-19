package handler

import (
	"fmt"
	"net/http"

	contracts "snakes-and-ladders-engine/internal/contracts"
	"snakes-and-ladders-engine/internal/domain"
	"snakes-and-ladders-engine/pkg/httpx"

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
		RoomSize   *int   `json:"room_size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	roomSize := 0
	if req.RoomSize != nil {
		if *req.RoomSize < domain.MinPlayersToStart || *req.RoomSize > domain.MaxPlayersPerGame {
			httpx.Error(c, http.StatusBadRequest, fmt.Errorf(
				"room_size must be between %d and %d",
				domain.MinPlayersToStart,
				domain.MaxPlayersPerGame,
			))
			return
		}
		roomSize = *req.RoomSize
	}
	result, err := h.matchmakingService.StartMatchmaking(req.PlayerName, roomSize)
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

func (h *MatchmakingHandler) LeaveRoom(c *gin.Context) {
	var req struct {
		PlayerName string `json:"player_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	if err := h.matchmakingService.LeaveRoom(req.PlayerName, c.Param("roomId")); err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *MatchmakingHandler) ShowRooms(c *gin.Context) {
	rooms, err := h.matchmakingService.ShowAvailableRooms()
	if err != nil {
		httpx.Error(c, http.StatusInternalServerError, err)
		return
	}
	httpx.JSON(c, http.StatusOK, rooms)
}
