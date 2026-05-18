"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dices, X, Loader2 } from "lucide-react";
import { usePolling } from "@/hooks/use-polling";
import * as api from "@/lib/api";
import type { BoardState, BoardPlayerState } from "@/types/game";

interface GamePageProps {
  boardState: BoardState;
  playerName: string;
  playerId: number | null;
  gameId: string;
  onRollDice: () => void;
  onPollUpdate: (state: BoardState) => void;
  onPollError: (error: unknown) => void;
  isLoading: boolean;
  feedbackMessage: string | null;
  feedbackTone: "default" | "destructive";
  onClearFeedback: () => void;
}

export function GamePage({
  boardState,
  playerName,
  playerId,
  gameId,
  onRollDice,
  onPollUpdate,
  onPollError,
  isLoading,
  feedbackMessage,
  feedbackTone,
  onClearFeedback,
}: GamePageProps) {
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [animatingPlayers, setAnimatingPlayers] = useState<Map<number, number[]>>(new Map());
  const prevBoardStateRef = useRef<BoardState | null>(null);

  const fetchState = useCallback(() => api.getBoardGameState(gameId), [gameId]);

  const { isSyncing } = usePolling<BoardState>({
    fetcher: fetchState,
    interval: 1200,
    enabled: boardState.status === "in_progress" && animatingPlayers.size === 0,
    onSuccess: onPollUpdate,
    onError: onPollError,
  });

  // Generate step-by-step path for animation
  useEffect(() => {
    if (prevBoardStateRef.current) {
      const newAnimations = new Map<number, number[]>();
      
      boardState.players.forEach((player) => {
        const prevPlayer = prevBoardStateRef.current?.players.find(p => p.pid === player.pid);
        const prevPos = prevPlayer?.position ?? player.position;
        
        if (prevPos !== player.position) {
          // Generate path from prevPos to player.position
          const path: number[] = [];
          
          if (player.position > prevPos) {
            // Moving forward
            for (let i = prevPos + 1; i <= player.position; i++) {
              path.push(i);
            }
          } else {
            // Moving backward (snake)
            for (let i = prevPos - 1; i >= player.position; i--) {
              path.push(i);
            }
          }
          
          if (path.length > 0) {
            newAnimations.set(player.pid, path);
          }
        }
      });
      
      if (newAnimations.size > 0) {
        setAnimatingPlayers(newAnimations);
      }
    }
    prevBoardStateRef.current = boardState;
  }, [boardState]);

  // Clear animations after they complete
  useEffect(() => {
    if (animatingPlayers.size > 0) {
      const maxSteps = Math.max(...Array.from(animatingPlayers.values()).map(p => p.length));
      const timeout = setTimeout(() => {
        setAnimatingPlayers(new Map());
      }, maxSteps * 150 + 300);
      return () => clearTimeout(timeout);
    }
  }, [animatingPlayers]);

  const isMyTurn = playerId === boardState.current_turn_pid;
  const canRoll = isMyTurn;

  const handleRollDice = () => {
    setIsDiceRolling(true);
    setTimeout(() => {
      setIsDiceRolling(false);
      onRollDice();
    }, 600);
  };

  const snakePairs = Object.entries(boardState.snakes).map(([from, to]) => ({
    from: Number(from),
    to: to as number,
  }));

  const ladderPairs = Object.entries(boardState.ladders).map(([from, to]) => ({
    from: Number(from),
    to: to as number,
  }));

  return (
    <div className="min-h-screen p-2 md:p-4 bg-background">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {boardState.name}
            </h1>
            {isSyncing && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>
          <Badge variant="secondary" className="bg-accent/20">
            {boardState.status}
          </Badge>
        </div>

        {/* Turn Banner */}
        <TurnBanner
          currentTurnPlayer={boardState.current_turn_player}
          isMyTurn={isMyTurn}
          playerName={playerName}
        />

        {feedbackMessage && (
          <Alert
            variant={feedbackTone === "destructive" ? "destructive" : "default"}
            className="mb-4 relative"
          >
            <AlertDescription className="pr-8">{feedbackMessage}</AlertDescription>
            <button
              type="button"
              onClick={onClearFeedback}
              className="absolute right-2 top-2 p-1 rounded-md hover:bg-destructive/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Alert>
        )}

        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          {/* Game Board */}
          <BoardGrid
            players={boardState.players}
            snakes={snakePairs}
            ladders={ladderPairs}
            animatingPlayers={animatingPlayers}
            currentTurnPid={boardState.current_turn_pid}
            localPlayerId={playerId}
          />

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Action Panel */}
            <Card className="border-2 border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Your Player</p>
                  <p className="font-bold text-lg">{playerName}</p>
                  <p className="text-xs text-muted-foreground">PID: {playerId}</p>
                  <p className="text-xs text-muted-foreground">
                    Current six stack: {boardState.players.find((player) => player.pid === playerId)?.conseq_six_count ?? 0}
                  </p>
                </div>

                {/* Dice Display */}
                <div className="flex justify-center">
                  <DiceDisplay 
                    isRolling={isDiceRolling} 
                    value={boardState.dice_value}
                    hasRolled={boardState.dice_rolled || boardState.dice_value > 0}
                  />
                </div>

                {/* Action Button */}
                <div className="space-y-2">
                  <Button
                    className="w-full h-12"
                    onClick={handleRollDice}
                    disabled={!canRoll || isLoading || isDiceRolling || animatingPlayers.size > 0}
                  >
                    {isDiceRolling ? (
                      <span className="flex items-center gap-2">
                        <Dices className="w-5 h-5 animate-spin" />
                        Rolling...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Dices className="w-5 h-5" />
                        Roll Dice
                      </span>
                    )}
                  </Button>
                </div>

                {!isMyTurn && (
                  <p className="text-center text-sm text-muted-foreground">
                    Waiting for {boardState.current_turn_player}&apos;s turn...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Players List */}
            <Card className="border-2 border-border/50 bg-card/80">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Players</h3>
                <div className="space-y-2">
                  {boardState.players.map((player) => (
                    <PlayerInfo
                      key={player.pid}
                      player={player}
                      isCurrentTurn={player.pid === boardState.current_turn_pid}
                      isLocalPlayer={player.player_name === playerName}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TurnBannerProps {
  currentTurnPlayer: string;
  isMyTurn: boolean;
  playerName: string;
}

function TurnBanner({ currentTurnPlayer, isMyTurn, playerName }: TurnBannerProps) {
  return (
    <motion.div
      className={`mb-4 p-3 rounded-lg text-center font-semibold ${
        isMyTurn
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
      animate={isMyTurn ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5, repeat: isMyTurn ? Infinity : 0, repeatDelay: 2 }}
    >
      {isMyTurn ? (
        <span>Your Turn, {playerName}!</span>
      ) : (
        <span>{currentTurnPlayer}&apos;s Turn</span>
      )}
    </motion.div>
  );
}

interface DiceDisplayProps {
  isRolling: boolean;
  value: number;
  hasRolled: boolean;
}

function DiceDisplay({ isRolling, value, hasRolled }: DiceDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Roll</p>
      <div
        className={`w-16 h-16 rounded-xl bg-card border-2 border-border flex items-center justify-center shadow-lg ${
          isRolling ? "animate-bounce" : ""
        }`}
      >
        {isRolling ? (
          <Dices className="w-8 h-8 text-primary animate-spin" />
        ) : hasRolled ? (
          <span className="text-2xl font-bold text-primary">{value}</span>
        ) : (
          <span className="text-2xl text-muted-foreground">-</span>
        )}
      </div>
    </div>
  );
}

interface PlayerInfoProps {
  player: BoardPlayerState;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
}

const playerColors = [
  "text-chart-1 bg-chart-1/20",
  "text-chart-2 bg-chart-2/20",
  "text-chart-3 bg-chart-3/20",
  "text-chart-4 bg-chart-4/20",
];

function PlayerInfo({ player, isCurrentTurn, isLocalPlayer }: PlayerInfoProps) {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg ${
        playerColors[player.pid % playerColors.length]
      } ${isCurrentTurn ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center gap-2">
        <DwarfToken pid={player.pid} size="sm" />
        <span className="font-medium">
          {player.player_name}
          {isLocalPlayer && <span className="text-xs ml-1">(You)</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {player.position + 1}
        </Badge>
        <Badge variant={player.conseq_six_count > 0 ? "secondary" : "outline"} className="font-mono">
          6x {player.conseq_six_count}
        </Badge>
      </div>
    </div>
  );
}

interface BoardGridProps {
  players: BoardPlayerState[];
  snakes: { from: number; to: number }[];
  ladders: { from: number; to: number }[];
  animatingPlayers: Map<number, number[]>;
  currentTurnPid: number;
  localPlayerId: number | null;
}

// Convert board position to grid coordinates
function positionToCoords(position: number): { row: number; col: number } {
  const row = Math.floor(position / 10);
  const isReversed = row % 2 === 1;
  const colInRow = position % 10;
  const col = isReversed ? 9 - colInRow : colInRow;
  return { row: 9 - row, col }; // row 0 is at bottom, display row 9 at top
}

function BoardGrid({
  players,
  snakes,
  ladders,
  animatingPlayers,
  currentTurnPid,
  localPlayerId,
}: BoardGridProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(0);

  // Measure cell size for SVG overlays
  useEffect(() => {
    const updateSize = () => {
      if (boardRef.current) {
        const firstCell = boardRef.current.querySelector('[data-cell]');
        if (firstCell) {
          setCellSize(firstCell.getBoundingClientRect().width);
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Generate board cells (serpentine layout)
  const cells = useMemo(() => {
    const result = [];
    for (let displayRow = 0; displayRow < 10; displayRow++) {
      for (let displayCol = 0; displayCol < 10; displayCol++) {
        const boardRow = 9 - displayRow;
        const isReversed = boardRow % 2 === 1;
        const boardCol = isReversed ? 9 - displayCol : displayCol;
        const position = boardRow * 10 + boardCol;
        result.push({ position, displayRow, displayCol });
      }
    }
    return result;
  }, []);

  // Calculate current visual positions for all players (including animation)
  const playerVisualPositions = useMemo(() => {
    const positions = new Map<number, number>();
    players.forEach((player) => {
      positions.set(player.pid, player.position);
    });
    return positions;
  }, [players]);

  return (
    <div className="relative">
      {/* Board container */}
      <div className="bg-board p-2 md:p-3 rounded-xl shadow-xl border-4 border-primary/20">
        <div ref={boardRef} className="grid grid-cols-10 gap-0.5 md:gap-1 relative">
          {cells.map(({ position, displayRow, displayCol }) => {
            const isSnakeHead = snakes.some((s) => s.from === position);
            const isLadderBottom = ladders.some((l) => l.from === position);
            const isEvenCell = (displayRow + displayCol) % 2 === 0;

            return (
              <BoardCell
                key={position}
                position={position}
                isEvenCell={isEvenCell}
                isSnakeHead={isSnakeHead}
                isLadderBottom={isLadderBottom}
              />
            );
          })}

          {/* SVG Overlay for Snakes and Ladders */}
          {cellSize > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ 
                width: '100%', 
                height: '100%',
              }}
              viewBox={`0 0 ${cellSize * 10 + 4} ${cellSize * 10 + 4}`}
              preserveAspectRatio="none"
            >
              {/* Ladders */}
              {ladders.map((ladder, idx) => (
                <LadderSVG
                  key={`ladder-${idx}`}
                  from={ladder.from}
                  to={ladder.to}
                  cellSize={cellSize}
                />
              ))}
              {/* Snakes */}
              {snakes.map((snake, idx) => (
                <SnakeSVG
                  key={`snake-${idx}`}
                  from={snake.from}
                  to={snake.to}
                  cellSize={cellSize}
                />
              ))}
            </svg>
          )}

          {/* Player Tokens Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {players.map((player) => {
              const animPath = animatingPlayers.get(player.pid);
              return (
                <AnimatedDwarfToken
                  key={player.pid}
                  player={player}
                  animationPath={animPath}
                  cellSize={cellSize}
                  isCurrentTurn={player.pid === currentTurnPid}
                  isLocalPlayer={player.pid === localPlayerId}
                  totalPlayers={players.length}
                  playerIndex={players.findIndex(p => p.pid === player.pid)}
                  playersAtSamePosition={players.filter(p => p.position === player.position).length}
                  indexAtPosition={players.filter(p => p.position === player.position).findIndex(p => p.pid === player.pid)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AnimatedDwarfTokenProps {
  player: BoardPlayerState;
  animationPath?: number[];
  cellSize: number;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
  totalPlayers: number;
  playerIndex: number;
  playersAtSamePosition: number;
  indexAtPosition: number;
}

function AnimatedDwarfToken({
  player,
  animationPath,
  cellSize,
  isCurrentTurn,
  isLocalPlayer,
  playersAtSamePosition,
  indexAtPosition,
}: AnimatedDwarfTokenProps) {
  const [currentAnimStep, setCurrentAnimStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Reset animation when path changes
  useEffect(() => {
    if (animationPath && animationPath.length > 0) {
      setCurrentAnimStep(0);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [animationPath]);

  // Step through animation
  useEffect(() => {
    if (isAnimating && animationPath && currentAnimStep < animationPath.length) {
      const timeout = setTimeout(() => {
        setCurrentAnimStep(prev => prev + 1);
      }, 150);
      return () => clearTimeout(timeout);
    } else if (isAnimating && animationPath && currentAnimStep >= animationPath.length) {
      setIsAnimating(false);
    }
  }, [isAnimating, currentAnimStep, animationPath]);

  // Calculate current visual position
  let visualPosition = player.position;
  if (isAnimating && animationPath && animationPath.length > 0) {
    if (currentAnimStep === 0) {
      // Start from position before the path
      const firstStep = animationPath[0];
      visualPosition = firstStep > player.position 
        ? firstStep - 1 
        : firstStep + 1;
    } else if (currentAnimStep <= animationPath.length) {
      visualPosition = animationPath[currentAnimStep - 1];
    }
  }

  const coords = positionToCoords(visualPosition);
  const gap = 2; // gap in pixels (matching gap-0.5 md:gap-1)
  
  // Offset for multiple players on same cell
  const offsetX = playersAtSamePosition > 1 ? (indexAtPosition % 2) * 10 - 5 : 0;
  const offsetY = playersAtSamePosition > 1 ? Math.floor(indexAtPosition / 2) * 10 - 5 : 0;

  const x = coords.col * (cellSize + gap) + cellSize / 2 + offsetX;
  const y = coords.row * (cellSize + gap) + cellSize / 2 + offsetY;

  if (cellSize === 0) return null;

  return (
    <motion.div
      className="absolute"
      style={{
        width: cellSize * 0.6,
        height: cellSize * 0.6,
      }}
      animate={{
        x: x - (cellSize * 0.3),
        y: y - (cellSize * 0.3),
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        duration: 0.15,
      }}
    >
      <DwarfToken
        pid={player.pid}
        isCurrentTurn={isCurrentTurn}
        isLocalPlayer={isLocalPlayer}
        isWalking={isAnimating}
      />
    </motion.div>
  );
}

interface BoardCellProps {
  position: number;
  isEvenCell: boolean;
  isSnakeHead: boolean;
  isLadderBottom: boolean;
}

function BoardCell({
  position,
  isEvenCell,
  isSnakeHead,
  isLadderBottom,
}: BoardCellProps) {
  const isStart = position === 0;
  const isFinish = position === 99;

  let bgClass = isEvenCell ? "bg-board-cell" : "bg-board-cell-alt";
  if (isFinish) bgClass = "bg-gold";

  return (
    <div
      data-cell
      data-position={position}
      className={`relative aspect-square ${bgClass} rounded-sm md:rounded flex flex-col items-center justify-center text-[8px] md:text-xs transition-colors`}
    >
      {/* Cell number */}
      <span className={`font-mono ${isFinish ? "text-foreground font-bold" : "text-muted-foreground/70"}`}>
        {position + 1}
      </span>

      {/* Start/Finish labels */}
      {isStart && (
        <span className="absolute bottom-0 text-[6px] md:text-[8px] font-bold text-primary">
          START
        </span>
      )}
      {isFinish && (
        <span className="absolute bottom-0 text-[6px] md:text-[8px] font-bold text-foreground">
          WIN
        </span>
      )}
    </div>
  );
}

interface SnakeSVGProps {
  from: number;
  to: number;
  cellSize: number;
}

function SnakeSVG({ from, to, cellSize }: SnakeSVGProps) {
  const gap = 2;
  const fromCoords = positionToCoords(from);
  const toCoords = positionToCoords(to);
  
  const x1 = fromCoords.col * (cellSize + gap) + cellSize / 2;
  const y1 = fromCoords.row * (cellSize + gap) + cellSize / 2;
  const x2 = toCoords.col * (cellSize + gap) + cellSize / 2;
  const y2 = toCoords.row * (cellSize + gap) + cellSize / 2;

  // Create a wavy snake path
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len * cellSize * 0.4;
  const perpY = dx / len * cellSize * 0.4;

  // Control points for S-curve
  const cp1x = x1 + dx * 0.25 + perpX;
  const cp1y = y1 + dy * 0.25 + perpY;
  const cp2x = x1 + dx * 0.5 - perpX;
  const cp2y = y1 + dy * 0.5 - perpY;
  const cp3x = x1 + dx * 0.75 + perpX * 0.5;
  const cp3y = y1 + dy * 0.75 + perpY * 0.5;

  const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${midX} ${midY} S ${cp3x} ${cp3y}, ${x2} ${y2}`;

  return (
    <g>
      {/* Snake body */}
      <path
        d={path}
        fill="none"
        stroke="#059669"
        strokeWidth={cellSize * 0.15}
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* Snake pattern */}
      <path
        d={path}
        fill="none"
        stroke="#10b981"
        strokeWidth={cellSize * 0.08}
        strokeLinecap="round"
        strokeDasharray={`${cellSize * 0.1} ${cellSize * 0.15}`}
        opacity={0.9}
      />
      {/* Snake head */}
      <circle
        cx={x1}
        cy={y1}
        r={cellSize * 0.12}
        fill="#059669"
      />
      {/* Snake eyes */}
      <circle cx={x1 - 2} cy={y1 - 2} r={2} fill="white" />
      <circle cx={x1 + 2} cy={y1 - 2} r={2} fill="white" />
      <circle cx={x1 - 2} cy={y1 - 2} r={1} fill="black" />
      <circle cx={x1 + 2} cy={y1 - 2} r={1} fill="black" />
      {/* Snake tongue */}
      <path
        d={`M ${x1} ${y1 + 3} l -3 6 M ${x1} ${y1 + 3} l 3 6`}
        stroke="#dc2626"
        strokeWidth={1.5}
        fill="none"
      />
      {/* Snake tail */}
      <circle
        cx={x2}
        cy={y2}
        r={cellSize * 0.06}
        fill="#059669"
      />
    </g>
  );
}

interface LadderSVGProps {
  from: number;
  to: number;
  cellSize: number;
}

function LadderSVG({ from, to, cellSize }: LadderSVGProps) {
  const gap = 2;
  const fromCoords = positionToCoords(from);
  const toCoords = positionToCoords(to);
  
  const x1 = fromCoords.col * (cellSize + gap) + cellSize / 2;
  const y1 = fromCoords.row * (cellSize + gap) + cellSize / 2;
  const x2 = toCoords.col * (cellSize + gap) + cellSize / 2;
  const y2 = toCoords.row * (cellSize + gap) + cellSize / 2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len * cellSize * 0.2;
  const perpY = dx / len * cellSize * 0.2;

  // Ladder rails
  const rail1Start = { x: x1 + perpX, y: y1 + perpY };
  const rail1End = { x: x2 + perpX, y: y2 + perpY };
  const rail2Start = { x: x1 - perpX, y: y1 - perpY };
  const rail2End = { x: x2 - perpX, y: y2 - perpY };

  // Ladder rungs
  const numRungs = Math.max(3, Math.floor(len / (cellSize * 0.5)));
  const rungs = [];
  for (let i = 0; i <= numRungs; i++) {
    const t = i / numRungs;
    const rx1 = rail1Start.x + (rail1End.x - rail1Start.x) * t;
    const ry1 = rail1Start.y + (rail1End.y - rail1Start.y) * t;
    const rx2 = rail2Start.x + (rail2End.x - rail2Start.x) * t;
    const ry2 = rail2Start.y + (rail2End.y - rail2Start.y) * t;
    rungs.push({ x1: rx1, y1: ry1, x2: rx2, y2: ry2 });
  }

  return (
    <g>
      {/* Ladder shadow */}
      <line
        x1={rail1Start.x + 2}
        y1={rail1Start.y + 2}
        x2={rail1End.x + 2}
        y2={rail1End.y + 2}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={cellSize * 0.06}
        strokeLinecap="round"
      />
      <line
        x1={rail2Start.x + 2}
        y1={rail2Start.y + 2}
        x2={rail2End.x + 2}
        y2={rail2End.y + 2}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={cellSize * 0.06}
        strokeLinecap="round"
      />
      
      {/* Ladder rails */}
      <line
        x1={rail1Start.x}
        y1={rail1Start.y}
        x2={rail1End.x}
        y2={rail1End.y}
        stroke="#92400e"
        strokeWidth={cellSize * 0.06}
        strokeLinecap="round"
      />
      <line
        x1={rail2Start.x}
        y1={rail2Start.y}
        x2={rail2End.x}
        y2={rail2End.y}
        stroke="#92400e"
        strokeWidth={cellSize * 0.06}
        strokeLinecap="round"
      />
      
      {/* Ladder rungs */}
      {rungs.map((rung, i) => (
        <line
          key={i}
          x1={rung.x1}
          y1={rung.y1}
          x2={rung.x2}
          y2={rung.y2}
          stroke="#b45309"
          strokeWidth={cellSize * 0.04}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

interface DwarfTokenProps {
  pid: number;
  isCurrentTurn?: boolean;
  isLocalPlayer?: boolean;
  size?: "sm" | "md";
  isWalking?: boolean;
}

const tokenColors = [
  { bg: "#ef4444", border: "#dc2626" }, // red
  { bg: "#3b82f6", border: "#2563eb" }, // blue
  { bg: "#22c55e", border: "#16a34a" }, // green
  { bg: "#f59e0b", border: "#d97706" }, // amber
];

function DwarfToken({ pid, isCurrentTurn, isLocalPlayer, size = "md", isWalking }: DwarfTokenProps) {
  const colors = tokenColors[pid % tokenColors.length];
  const sizeClasses = size === "sm" ? "w-6 h-6" : "w-full h-full";

  return (
    <motion.div
      className={`${sizeClasses} rounded-full shadow-lg flex items-center justify-center relative`}
      style={{
        backgroundColor: colors.bg,
        border: `3px solid ${colors.border}`,
      }}
      animate={isWalking ? { y: [0, -3, 0] } : {}}
      transition={isWalking ? { duration: 0.15, repeat: Infinity } : {}}
    >
      {/* Dwarf character */}
      <svg
        viewBox="0 0 32 32"
        fill="white"
        className="w-3/4 h-3/4"
      >
        {/* Helmet */}
        <ellipse cx="16" cy="10" rx="8" ry="6" fill="#8B4513" />
        <ellipse cx="16" cy="8" rx="6" ry="4" fill="#A0522D" />
        {/* Helmet horns */}
        <path d="M8 10 L5 4 L9 8" fill="#8B4513" />
        <path d="M24 10 L27 4 L23 8" fill="#8B4513" />
        {/* Face */}
        <circle cx="16" cy="14" r="6" fill="#fcd9b6" />
        {/* Beard */}
        <ellipse cx="16" cy="20" rx="5" ry="6" fill="#8B4513" />
        <ellipse cx="16" cy="19" rx="4" ry="5" fill="#A0522D" />
        {/* Eyes */}
        <circle cx="14" cy="13" r="1.5" fill="white" />
        <circle cx="18" cy="13" r="1.5" fill="white" />
        <circle cx="14" cy="13" r="0.8" fill="black" />
        <circle cx="18" cy="13" r="0.8" fill="black" />
        {/* Nose */}
        <ellipse cx="16" cy="15" rx="1.5" ry="1" fill="#e5a88a" />
      </svg>
      
      {/* Current turn indicator */}
      {isCurrentTurn && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
      
      {/* Local player indicator */}
      {isLocalPlayer && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-white bg-black/50 px-1 rounded">
          YOU
        </div>
      )}
    </motion.div>
  );
}
