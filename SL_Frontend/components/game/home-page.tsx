"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dices, Users, Sparkles, X } from "lucide-react";

interface HomePageProps {
  playerName: string;
  preferredRoomSize: number | null;
  onPlayerNameChange: (name: string) => void;
  onPreferredRoomSizeChange: (roomSize: number | null) => void;
  onStartMatchmaking: (playerName: string, roomSize: number | null) => void;
  onShowRooms: (playerName: string, roomSize: number | null) => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function HomePage({
  playerName,
  preferredRoomSize,
  onPlayerNameChange,
  onPreferredRoomSizeChange,
  onStartMatchmaking,
  onShowRooms,
  isLoading,
  error,
  onClearError,
}: HomePageProps) {
  const [localName, setLocalName] = useState(playerName);
  const [localRoomSize, setLocalRoomSize] = useState<number | null>(preferredRoomSize);
  const isNameValid = localName.trim().length > 0;

  useEffect(() => {
    setLocalName(playerName);
  }, [playerName]);

  useEffect(() => {
    setLocalRoomSize(preferredRoomSize);
  }, [preferredRoomSize]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNameValid && !isLoading) {
      const trimmedName = localName.trim();
      onPlayerNameChange(trimmedName);
      onPreferredRoomSizeChange(localRoomSize);
      onStartMatchmaking(trimmedName, localRoomSize);
    }
  };

  const handleShowRooms = () => {
    if (isNameValid) {
      const trimmedName = localName.trim();
      onPlayerNameChange(trimmedName);
      onPreferredRoomSizeChange(localRoomSize);
      onShowRooms(trimmedName, localRoomSize);
    }
  };

  const handleRoomSizeChange = (value: string) => {
    const nextRoomSize = value === "any" ? null : Number(value);
    setLocalRoomSize(nextRoomSize);
    onPreferredRoomSizeChange(nextRoomSize);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-gold/10 rounded-full blur-2xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Dices className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">
            Snakes & Ladders
          </h1>
          <p className="text-muted-foreground text-lg">
            A classic adventure awaits
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-2 border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              Join the Quest
              <Sparkles className="w-5 h-5 text-gold" />
            </CardTitle>
            <CardDescription>
              Enter your name to begin your journey through the enchanted board
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="relative">
                  <AlertDescription className="pr-8">{error}</AlertDescription>
                  <button
                    type="button"
                    onClick={onClearError}
                    className="absolute right-2 top-2 p-1 rounded-md hover:bg-destructive/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="playerName" className="text-sm font-medium text-foreground">
                  Adventurer Name
                </label>
                <Input
                  id="playerName"
                  type="text"
                  placeholder="Enter your name..."
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="h-12 text-lg bg-input/50 border-2 focus:border-primary"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="roomSize" className="text-sm font-medium text-foreground">
                  Preferred Room Size
                </label>
                <Select
                  value={localRoomSize === null ? "any" : String(localRoomSize)}
                  onValueChange={handleRoomSizeChange}
                >
                  <SelectTrigger
                    id="roomSize"
                    className="h-12 w-full bg-input/50 border-2 focus:border-primary text-base"
                  >
                    <SelectValue placeholder="Any size for fastest match" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any size for fastest match</SelectItem>
                    {Array.from({ length: 9 }, (_, index) => index + 2).map((roomSize) => (
                      <SelectItem key={roomSize} value={String(roomSize)}>
                        {roomSize} players
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg"
                  disabled={!isNameValid || isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Finding Game...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Dices className="w-5 h-5" />
                      Start Matchmaking
                    </span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-lg font-medium border-2 hover:bg-secondary"
                  disabled={!isNameValid || isLoading}
                  onClick={handleShowRooms}
                >
                  <Users className="w-5 h-5 mr-2" />
                  Browse Rooms
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Roll the dice, climb ladders, avoid snakes!</p>
          <p className="mt-1">Play with 2-10 players in real-time</p>
        </div>
      </div>
    </div>
  );
}
