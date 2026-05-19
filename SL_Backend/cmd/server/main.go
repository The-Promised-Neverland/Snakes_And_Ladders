package main

import (
	"log"
	"os"

	"snakes-and-ladders-engine/internal/app"
)

func main() {
	server := app.NewSnakesAndLaddersGameServer()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	log.Printf("Starting Snakes & Ladders Game Engine server on port %s\n", port)
	if err := server.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}
