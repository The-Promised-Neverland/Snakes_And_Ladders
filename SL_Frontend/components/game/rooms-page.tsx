"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Users, X, DoorOpen } from "lucide-react";
import { usePolling } from "@/hooks/use-polling";
import * as api from "@/lib/api";
import type { RoomState } from "@/types/game";

interface RoomsPageProps {
  playerName: string;
  onJoinRoom: (roomId: string) => void;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function RoomsPage({
  playerName,
  onJoinRoom,
  onBack,
  isLoading,
  error,
  onClearError,
}: RoomsPageProps) {
  const fetchRooms = useCallback(() => api.showRooms(), []);

  const { data: rooms, isSyncing, refetch } = usePolling<RoomState[]>({
    fetcher: fetchRooms,
    interval: 3000,
    enabled: true,
  });

  // Sort rooms: highest joined first, then lowest available slots, then by name
  const sortedRooms = [...(rooms || [])].sort((a, b) => {
    if (b.joined_players !== a.joined_players) {
      return b.joined_players - a.joined_players;
    }
    if (a.available_slots !== b.available_slots) {
      return a.available_slots - b.available_slots;
    }
    return a.room_name.localeCompare(b.room_name);
  });

  const joinableRooms = sortedRooms.filter(
    (room) => room.status === "queued" && room.available_slots > 0
  );

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {isSyncing && (
              <span className="text-xs text-muted-foreground sync-indicator">
                Syncing...
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Available Rooms
          </h1>
          <p className="text-muted-foreground">
            Playing as <span className="font-semibold text-foreground">{playerName}</span>
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 relative">
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

        {/* Rooms List */}
        <div className="space-y-4">
          {joinableRooms.length === 0 ? (
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="py-12 text-center">
                <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground mb-2">
                  No rooms available
                </p>
                <p className="text-sm text-muted-foreground">
                  Start matchmaking to create a new game
                </p>
              </CardContent>
            </Card>
          ) : (
            joinableRooms.map((room) => (
              <RoomCard
                key={room.room_id}
                room={room}
                onJoin={() => onJoinRoom(room.room_id)}
                isJoining={isLoading}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface RoomCardProps {
  room: RoomState;
  onJoin: () => void;
  isJoining: boolean;
}

function RoomCard({ room, onJoin, isJoining }: RoomCardProps) {
  const fillPercentage = (room.joined_players / room.required_players) * 100;

  return (
    <Card className="border-2 border-border/50 hover:border-primary/30 transition-colors bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{room.room_name}</CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              {room.room_id.slice(0, 8)}...
            </CardDescription>
          </div>
          <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
            {room.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="w-4 h-4" />
              Players
            </span>
            <span className="font-medium">
              {room.joined_players} / {room.required_players}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* Player list */}
        {room.players.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {room.players.map((player, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {player}
              </Badge>
            ))}
            {Array.from({ length: room.available_slots }).map((_, index) => (
              <Badge
                key={`empty-${index}`}
                variant="outline"
                className="text-xs text-muted-foreground border-dashed"
              >
                Waiting...
              </Badge>
            ))}
          </div>
        )}

        {/* Join button */}
        <Button
          className="w-full"
          onClick={onJoin}
          disabled={isJoining || room.available_slots === 0}
        >
          {isJoining ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Joining...
            </span>
          ) : (
            <>
              Join Room
              <span className="ml-2 text-primary-foreground/70">
                ({room.available_slots} {room.available_slots === 1 ? "spot" : "spots"} left)
              </span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
