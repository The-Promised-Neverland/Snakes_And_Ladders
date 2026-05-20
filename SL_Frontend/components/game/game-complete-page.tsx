"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal, Home } from "lucide-react";
import type { BoardState, BoardPlayerState } from "@/types/game";

interface GameCompletePageProps {
  boardState: BoardState;
  playerName: string;
  onReturnToLobby: () => void;
}

export function GameCompletePage({
  boardState,
  playerName,
  onReturnToLobby,
}: GameCompletePageProps) {
  const leaderboardOrder = new Map(
    (boardState.leaderboard ?? []).map((pid, index) => [pid, index])
  );

  const rankedPlayers = [...boardState.players].sort((a, b) => {
    const aRank = leaderboardOrder.get(a.pid);
    const bRank = leaderboardOrder.get(b.pid);

    if (aRank !== undefined && bRank !== undefined) {
      return aRank - bRank;
    }
    if (aRank !== undefined) {
      return -1;
    }
    if (bRank !== undefined) {
      return 1;
    }
    return b.position - a.position;
  });

  const winner = rankedPlayers[0];
  const isLocalWinner = winner?.player_name === playerName;

  return (
    <div className="min-h-screen p-4 bg-background flex items-center justify-center">
      <div className="w-full max-w-lg">
        {/* Victory Animation */}
        <motion.div
          className="text-center mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.2,
          }}
        >
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gold/20 mb-4">
            <Trophy className="w-12 h-12 text-gold" />
          </div>
          <motion.h1
            className="text-4xl font-bold text-foreground mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Game Complete!
          </motion.h1>
          <motion.p
            className="text-xl text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {isLocalWinner ? "Congratulations! You won!" : `${winner?.player_name} wins!`}
          </motion.p>
        </motion.div>

        {/* Results Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="border-2 border-gold/30 bg-card/80 backdrop-blur-sm shadow-xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                Final Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Podium */}
              <div className="space-y-3">
                {rankedPlayers.map((player, index) => (
                  <PlayerRankCard
                    key={player.pid}
                    player={player}
                    rank={index + 1}
                    isLocalPlayer={player.player_name === playerName}
                    isWinner={index === 0}
                  />
                ))}
              </div>

              {/* Game Info */}
              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Game</p>
                    <p className="font-medium">{boardState.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="secondary" className="bg-accent/20">
                      {boardState.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Return Button */}
              <Button
                className="w-full h-12 mt-4"
                onClick={onReturnToLobby}
              >
                <Home className="w-5 h-5 mr-2" />
                Return to Lobby
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Confetti-like decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                backgroundColor: ["#FFD700", "#C0C0C0", "#CD7F32", "#FF6B6B", "#4ECDC4"][i % 5],
                left: `${Math.random() * 100}%`,
                top: "-20px",
              }}
              initial={{ y: -20, opacity: 1, rotate: 0 }}
              animate={{
                y: "100vh",
                opacity: 0,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                repeatDelay: Math.random() * 3,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PlayerRankCardProps {
  player: BoardPlayerState;
  rank: number;
  isLocalPlayer: boolean;
  isWinner: boolean;
}

const rankStyles = {
  1: {
    bg: "bg-gold/20 border-gold/50",
    icon: Crown,
    iconColor: "text-gold",
  },
  2: {
    bg: "bg-muted/50 border-muted-foreground/30",
    icon: Medal,
    iconColor: "text-muted-foreground",
  },
  3: {
    bg: "bg-chart-5/20 border-chart-5/50",
    icon: Medal,
    iconColor: "text-chart-5",
  },
  4: {
    bg: "bg-muted/30 border-border",
    icon: Medal,
    iconColor: "text-muted-foreground/50",
  },
};

function PlayerRankCard({ player, rank, isLocalPlayer, isWinner }: PlayerRankCardProps) {
  const style = rankStyles[rank as keyof typeof rankStyles] || rankStyles[4];
  const Icon = style.icon;

  return (
    <motion.div
      className={`flex items-center gap-4 p-4 rounded-lg border-2 ${style.bg} ${
        isLocalPlayer ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1 + rank * 0.15 }}
    >
      {/* Rank */}
      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10">
        {isWinner ? (
          <Icon className={`w-8 h-8 ${style.iconColor}`} />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground">
            {rank}
          </span>
        )}
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">
          {player.player_name}
          {isLocalPlayer && (
            <span className="text-xs text-primary ml-2">(You)</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Final Position: {player.position + 1}
        </p>
      </div>

      {/* Position Badge */}
      <Badge
        variant={isWinner ? "default" : "outline"}
        className={isWinner ? "bg-gold text-foreground" : ""}
      >
        {player.position === 99 ? "Winner!" : `Cell ${player.position + 1}`}
      </Badge>
    </motion.div>
  );
}
