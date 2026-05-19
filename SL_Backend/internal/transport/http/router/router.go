package router

import (
	"fmt"
	"ludo-game-engine/internal/transport/http/handler"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func NewRouter(boardGameHandler *handler.BoardGameHandler, matchmakingHandler *handler.MatchmakingHandler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(requestLogger())
	router.Use(corsMiddleware())
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Ludo Game Engine is running",
		})
	})
	matchmakingGroup := router.Group("/api/matchmaking")
	{
		matchmakingGroup.POST("/start-matchmaking", matchmakingHandler.StartMatchmaking)
		matchmakingGroup.GET("/show-rooms", matchmakingHandler.ShowRooms)
		matchmakingGroup.POST("/:roomId/join", matchmakingHandler.JoinRoom)
	}
	boardGameGroup := router.Group("/api/board-games")
	{
		boardGameGroup.GET("/:gameId/state", boardGameHandler.GetBoardGameState)
		boardGameGroup.POST("/:gameId/:playerId/roll-dice", boardGameHandler.RollBoardGameDice)
	}
	return router
}

func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		if shouldSkipRequestLog(c) {
			return
		}

		fmt.Fprintf(
			gin.DefaultWriter,
			"[GIN] %s | %3d | %6s | %-15s | %-6s %s\n",
			time.Now().Format("2006/01/02 - 15:04:05"),
			c.Writer.Status(),
			time.Since(start).Round(time.Millisecond),
			c.ClientIP(),
			c.Request.Method,
			c.Request.URL.Path,
		)
	}
}

func shouldSkipRequestLog(c *gin.Context) bool {
	if c.Request.Method == http.MethodOptions {
		return true
	}
	if c.Request.Method == http.MethodGet && c.Writer.Status() < http.StatusBadRequest {
		return true
	}

	return false
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
