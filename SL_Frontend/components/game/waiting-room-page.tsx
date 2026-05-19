"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Clock, Loader2 } from "lucide-react";
import type { BoardState } from "@/types/game";

interface WaitingRoomPageProps {
  roomId: string;
  playerName: string;
  requiredPlayers: number | null;
  boardState: BoardState | null;
  isConnected: boolean;
  onBack: () => void;
}

export function WaitingRoomPage({
  roomId,
  playerName,
  requiredPlayers: requiredPlayersProp,
  boardState,
  isConnected,
  onBack,
}: WaitingRoomPageProps) {
  const players = boardState?.players || [];
  const joinedCount = players.length;
  const requiredPlayers = Math.max(requiredPlayersProp ?? 1, joinedCount, 1);
  const waitingCount = Math.max(requiredPlayers - joinedCount, 0);
  const roomName = boardState?.name || "Joining room...";
  const roomStatus = boardState?.status || (isConnected ? "queued" : "connecting");

  return (
    <div className="min-h-screen p-4 bg-background flex items-center justify-center">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Room
          </Button>
          <span className="text-xs text-muted-foreground sync-indicator flex items-center gap-1">
            {isConnected ? (
              <>
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </>
            )}
          </span>
        </div>

        <Card className="border-2 border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
              <Clock className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl">Waiting for Players</CardTitle>
            <CardDescription>
              Game will start automatically when all players join
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Room Name
                </p>
                <p className="font-medium text-foreground">{roomName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Status
                </p>
                <Badge variant="secondary" className="bg-accent/20">
                  {roomStatus}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Room ID
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {roomId}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-foreground">
                  <Users className="w-5 h-5" />
                  Players
                </span>
                <span className="font-bold text-lg">
                  {joinedCount} / {requiredPlayers}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(joinedCount / requiredPlayers) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">
                Player Roster
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {players.map((player, index) => (
                  <PlayerSlot
                    key={player.pid}
                    playerName={player.player_name}
                    isCurrentPlayer={player.player_name === playerName}
                    index={index}
                    filled
                  />
                ))}
                {Array.from({ length: waitingCount }).map((_, index) => (
                  <PlayerSlot
                    key={`waiting-${index}`}
                    index={joinedCount + index}
                    filled={false}
                  />
                ))}
              </div>
            </div>

            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {boardState
                  ? `Waiting for ${waitingCount} more ${waitingCount === 1 ? "player" : "players"}...`
                  : "Syncing room state..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface PlayerSlotProps {
  playerName?: string;
  isCurrentPlayer?: boolean;
  index: number;
  filled: boolean;
}

const playerColors = [
  "bg-chart-1/20 border-chart-1/50 text-chart-1",
  "bg-chart-2/20 border-chart-2/50 text-chart-2",
  "bg-chart-3/20 border-chart-3/50 text-chart-3",
  "bg-chart-4/20 border-chart-4/50 text-chart-4",
];

function PlayerSlot({ playerName, isCurrentPlayer, index, filled }: PlayerSlotProps) {
  if (!filled) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border/50 bg-muted/20">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <span className="text-muted-foreground text-lg">?</span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Waiting...</p>
          <p className="text-xs text-muted-foreground/50">Slot {index + 1}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${playerColors[index % playerColors.length]} ${
        isCurrentPlayer ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-current/20 flex items-center justify-center">
        <DwarfIcon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {playerName}
          {isCurrentPlayer && (
            <span className="text-xs text-primary ml-1">(You)</span>
          )}
        </p>
        <p className="text-xs opacity-70">Player {index + 1}</p>
      </div>
    </div>
  );
}

function DwarfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z" />
      <rect x="10" y="3" width="4" height="2" rx="1" />
    </svg>
  );
}
