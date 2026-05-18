package handler

import (
	"net/http"
	"strconv"

	contracts "ludo-game-engine/internal/contracts"
	"ludo-game-engine/pkg/httpx"

	"github.com/gin-gonic/gin"
)

type BoardGameHandler struct {
	gameManager contracts.GameManager
}

func NewBoardGameHandler(gameManager contracts.GameManager) *BoardGameHandler {
	return &BoardGameHandler{gameManager: gameManager}
}

func (h *BoardGameHandler) GetBoardGameState(c *gin.Context) {
	state, err := h.gameManager.GetBoardGameState(c.Param("gameId"))
	if err != nil {
		httpx.Error(c, http.StatusNotFound, err)
		return
	}
	httpx.JSON(c, http.StatusOK, state)
}

func (h *BoardGameHandler) RollBoardGameDice(c *gin.Context) {
	playerID, err := strconv.Atoi(c.Param("playerId"))
	if err != nil {
		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	result, err := h.gameManager.RollDiceForPlayer(c.Param("gameId"), playerID)
	if err != nil {
		if result != nil {
			httpx.JSON(c, http.StatusBadRequest, gin.H{
				"error": err.Error(),
				"state": result.State,
			})
			return
		}

		httpx.Error(c, http.StatusBadRequest, err)
		return
	}
	httpx.JSON(c, http.StatusOK, result)
}
