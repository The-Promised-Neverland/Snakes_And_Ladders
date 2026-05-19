package app

import (
	"snakes-and-ladders-engine/internal/service"
	"snakes-and-ladders-engine/internal/transport/http/handler"
	"snakes-and-ladders-engine/internal/transport/http/router"

	"github.com/gin-gonic/gin"
)

func NewSnakesAndLaddersGameServer() *gin.Engine {
	gameManager := service.NewGameManager()
	matchmakingService := service.NewMatchmakingService(gameManager)
	boardGameHandler := handler.NewBoardGameHandler(gameManager)
	matchmakingHandler := handler.NewMatchmakingHandler(matchmakingService)
	return router.NewRouter(boardGameHandler, matchmakingHandler)
}
