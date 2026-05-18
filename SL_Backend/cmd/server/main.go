package main

import (
	"log"
	"os"

	"ludo-game-engine/internal/app"
)

func main() {
	server := app.NewLudoGameServer()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	log.Printf("Starting Ludo Game Engine server on port %s\n", port)
	if err := server.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}
