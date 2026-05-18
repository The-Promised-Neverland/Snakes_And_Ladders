package app

import (
	"ludo-game-engine/internal/service"
	"ludo-game-engine/internal/transport/http/handler"
	"ludo-game-engine/internal/transport/http/router"

	"github.com/gin-gonic/gin"
)

func NewLudoGameServer() *gin.Engine {
	gameManager := service.NewGameManager()
	matchmakingService := service.NewMatchmakingService(gameManager)
	boardGameHandler := handler.NewBoardGameHandler(gameManager)
	matchmakingHandler := handler.NewMatchmakingHandler(matchmakingService)
	return router.NewRouter(boardGameHandler, matchmakingHandler)
}
