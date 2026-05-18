package httpx

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func JSON(c *gin.Context, status int, payload any) {
	c.JSON(status, payload)
}

func Error(c *gin.Context, status int, err error) {
	JSON(c, status, gin.H{"error": err.Error()})
}

func OkMessage(c *gin.Context, message string) {
	JSON(c, http.StatusOK, gin.H{"message": message})
}
