package router

import (
	"snakes-and-ladders-engine/internal/transport/http/handler"

	"github.com/gin-gonic/gin"
)

func NewRouter(webSocketHandler *handler.WebSocketHandler, matchmakingHandler *handler.MatchmakingHandler) *gin.Engine {
	router := gin.New()
	gin.SetMode(gin.ReleaseMode) // Disable debug logs in production
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	healthHandler := func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Snakes & Ladders Game Engine is running",
		})
	}
	router.GET("/api/health", healthHandler)
	matchmakingGroup := router.Group("/api/matchmaking")
	{
		matchmakingGroup.POST("/start-matchmaking", matchmakingHandler.StartMatchmaking)
		matchmakingGroup.GET("/show-rooms", matchmakingHandler.ShowRooms)
		matchmakingGroup.POST("/:roomId/join", matchmakingHandler.JoinRoom)
	}
	upgradeGroup := router.Group("/ws")
	{
		upgradeGroup.GET("/board-games/:roomId", webSocketHandler.UpgradeToWebSocket)
	}
	return router
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
