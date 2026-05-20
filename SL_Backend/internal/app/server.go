package app

import (
	"snakes-and-ladders-engine/internal/manager"
	"snakes-and-ladders-engine/internal/service"
	"snakes-and-ladders-engine/internal/transport/http/handler"
	"snakes-and-ladders-engine/internal/transport/http/router"

	"github.com/gin-gonic/gin"
)

func NewSnakesAndLaddersGameServer() *gin.Engine {
	webSocketService := service.NewWebSocketService()
	gameManager := manager.NewGameManager(webSocketService)
	webSocketService.AttachGameManager(gameManager)
	webSocketHandler := handler.NewWebSocketHandler(webSocketService)
	return router.NewRouter(webSocketHandler)
}
