package router

import (
	"snakes-and-ladders-engine/internal/transport/http/handler"

	"github.com/gin-gonic/gin"
)

func NewRouter(webSocketHandler *handler.WebSocketHandler) *gin.Engine {
	router := gin.New()
	gin.SetMode(gin.ReleaseMode) // Disable debug logs in production
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Snakes & Ladders Game Engine is running",
		})
	})
	upgradeGroup := router.Group("/api/ws")
	{
		upgradeGroup.GET("/board-games", webSocketHandler.UpgradeToWebSocket)
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
