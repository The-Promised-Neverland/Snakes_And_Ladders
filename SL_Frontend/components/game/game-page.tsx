"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ChatPanel } from "@/components/game/chat-panel";
import { AlertTriangle, Dices, X, Loader2 } from "lucide-react";
import type { BoardState, BoardPlayerState, ChatMessage } from "@/types/game";

interface GamePageProps {
  boardState: BoardState;
  playerName: string;
  playerId: number | null;
  isConnected: boolean;
  onRollDice: () => void;
  isLoading: boolean;
  feedbackMessage: string | null;
  feedbackTone: "default" | "destructive";
  onClearFeedback: () => void;
  globalMessages: ChatMessage[];
  roomMessages: ChatMessage[];
  onSendGlobalMessage: (message: string) => string | null;
  onSendRoomMessage: (message: string) => string | null;
}

type AnimationMotion = "walk" | "snake" | "ladder";
type SpecialMoveSound = Extract<AnimationMotion, "snake" | "ladder">;

interface AnimationStep {
  position: number;
  durationMs: number;
  motion: AnimationMotion;
}

const INITIAL_ANIMATION_DELAY_MS = 80;
const WALK_STEP_MS = 160;
const LANDING_PAUSE_MS = 240;
const JUMP_STEP_MS = 650;
const PATH_SAMPLE_COUNT = 18;
const SOUND_EFFECT_VOLUME = 0.92;
const SNAKE_SOUND_PATHS = Array.from(
  { length: 6 },
  (_, index) => `/audio/snakes/effect${index + 1}.mp3`
);
const LADDER_SOUND_PATHS = Array.from(
  { length: 5 },
  (_, index) => `/audio/ladders/effect${index + 1}.mp3`
);

function pickRandomItem<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)];
}

function buildAnimationSteps(
  prevPlayer: BoardPlayerState,
  nextPlayer: BoardPlayerState,
  boardState: BoardState
): AnimationStep[] {
  const startPosition = prevPlayer.position;
  const finalPosition = nextPlayer.position;
  const moveDistance = prevPlayer.conseq_six_count * 6 + boardState.dice_value;

  if (moveDistance <= 0) {
    return [];
  }

  const landingPosition = startPosition + moveDistance;
  if (landingPosition > 99) {
    return [];
  }

  // A six keeps the turn alive without moving the pawn yet.
  if (boardState.dice_value === 6 && finalPosition === startPosition) {
    return [];
  }

  const steps: AnimationStep[] = [];
  for (let position = startPosition + 1; position <= landingPosition; position++) {
    steps.push({
      position,
      durationMs: WALK_STEP_MS,
      motion: "walk",
    });
  }

  if (steps.length === 0) {
    return [];
  }

  const snakeTarget = boardState.snakes[String(landingPosition)];
  const ladderTarget = boardState.ladders[String(landingPosition)];
  const jumpTarget = snakeTarget ?? ladderTarget;
  const jumpMotion: AnimationMotion | null =
    snakeTarget !== undefined
      ? "snake"
      : ladderTarget !== undefined
        ? "ladder"
        : null;

  if (jumpTarget !== undefined && jumpTarget === finalPosition && jumpMotion) {
    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      durationMs: LANDING_PAUSE_MS,
    };
    steps.push({
      position: finalPosition,
      durationMs: JUMP_STEP_MS,
      motion: jumpMotion,
    });
    return steps;
  }

  if (landingPosition !== finalPosition) {
    const direction = finalPosition > landingPosition ? 1 : -1;
    for (
      let position = landingPosition + direction;
      direction > 0 ? position <= finalPosition : position >= finalPosition;
      position += direction
    ) {
      steps.push({
        position,
        durationMs: WALK_STEP_MS,
        motion: "walk",
      });
    }
  }

  return steps;
}

export function GamePage({
  boardState,
  playerName,
  playerId,
  isConnected,
  onRollDice,
  isLoading,
  feedbackMessage,
  feedbackTone,
  onClearFeedback,
  globalMessages,
  roomMessages,
  onSendGlobalMessage,
  onSendRoomMessage,
}: GamePageProps) {
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [animatingPlayers, setAnimatingPlayers] = useState<Map<string, AnimationStep[]>>(new Map());
  const prevBoardStateRef = useRef<BoardState | null>(null);
  const snakeSoundsRef = useRef<HTMLAudioElement[]>([]);
  const ladderSoundsRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    const preloadSounds = (sources: string[]) =>
      sources.map((source) => {
        const audio = new Audio(source);
        audio.preload = "auto";
        audio.load();
        return audio;
      });

    snakeSoundsRef.current = preloadSounds(SNAKE_SOUND_PATHS);
    ladderSoundsRef.current = preloadSounds(LADDER_SOUND_PATHS);

    return () => {
      snakeSoundsRef.current = [];
      ladderSoundsRef.current = [];
    };
  }, []);

  const playSpecialMoveEffect = useCallback((motion: SpecialMoveSound) => {
    const sourcePool =
      motion === "snake" ? snakeSoundsRef.current : ladderSoundsRef.current;
    const selectedAudio = pickRandomItem(sourcePool);
    if (!selectedAudio) {
      return;
    }

    const effect = selectedAudio.cloneNode(true) as HTMLAudioElement;
    effect.volume = SOUND_EFFECT_VOLUME;
    void effect.play().catch(() => {
      // Ignore autoplay failures and keep gameplay smooth.
    });
  }, []);

  // Generate step-by-step path for animation
  useEffect(() => {
    if (prevBoardStateRef.current) {
      const newAnimations = new Map<string, AnimationStep[]>();
      let pendingSpecialMove: SpecialMoveSound | null = null;
      
      boardState.players.forEach((player) => {
        const prevPlayer = prevBoardStateRef.current?.players.find(
          (candidate) => candidate.player_name === player.player_name
        );
        if (!prevPlayer) {
          return;
        }

        if (prevPlayer.position === player.position) {
          return;
        }

        const animationSteps = buildAnimationSteps(prevPlayer, player, boardState);
        if (animationSteps.length > 0) {
          newAnimations.set(player.player_name, animationSteps);
          if (player.player_name === playerName) {
            const specialStep = animationSteps.find(
              (step): step is AnimationStep & { motion: SpecialMoveSound } =>
                step.motion === "snake" || step.motion === "ladder"
            );
            if (specialStep) {
              pendingSpecialMove = specialStep.motion;
            }
          }
        }
      });
      
      if (newAnimations.size > 0) {
        setAnimatingPlayers(newAnimations);
      }
      if (pendingSpecialMove) {
        playSpecialMoveEffect(pendingSpecialMove);
      }
    }
    prevBoardStateRef.current = boardState;
  }, [boardState, playSpecialMoveEffect, playerName]);

  // Clear animations after they complete
  useEffect(() => {
    if (animatingPlayers.size > 0) {
      const maxDuration = Math.max(
        ...Array.from(animatingPlayers.values()).map((steps) =>
          steps.reduce(
            (total, step) => total + step.durationMs,
            INITIAL_ANIMATION_DELAY_MS
          )
        )
      );
      const timeout = setTimeout(() => {
        setAnimatingPlayers(new Map());
      }, maxDuration + 120);
      return () => clearTimeout(timeout);
    }
  }, [animatingPlayers]);

  const isMyTurn = playerId === boardState.current_turn_pid;
  const canRoll = isMyTurn && isConnected;
  const isMoveCancelled = feedbackMessage === "Three sixes in a row. Move cancelled.";

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
            {!isConnected && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Reconnecting...
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

        {feedbackMessage && isMoveCancelled && (
          <motion.div
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 shadow-lg"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: [0, -6, 6, -4, 4, 0],
            }}
            transition={{
              duration: 0.55,
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
            }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-destructive/15 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-destructive">Move Cancelled</p>
                <p className="text-sm text-destructive/90">
                  Three sixes in a row forfeits the turn and passes play onward.
                </p>
              </div>
              <button
                type="button"
                onClick={onClearFeedback}
                className="rounded-md p-1 text-destructive/80 transition-colors hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {feedbackMessage && !isMoveCancelled && (
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

        <div className="grid gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
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
            <Card className={`border-2 bg-card/80 ${isMoveCancelled ? "border-destructive/50 shadow-[0_0_0_1px_rgba(220,38,38,0.15)]" : "border-border/50"}`}>
              <CardContent className="p-4 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Your Player</p>
                  <p className="font-bold text-lg">{playerName}</p>
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
                      key={player.player_name}
                      player={player}
                      isCurrentTurn={player.pid === boardState.current_turn_pid}
                      isLocalPlayer={player.player_name === playerName}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <ChatPanel
              playerName={playerName}
              isConnected={isConnected}
              globalMessages={globalMessages}
              roomMessages={roomMessages}
              allowRoomChat
              roomName={boardState.name}
              onSendGlobalMessage={onSendGlobalMessage}
              onSendRoomMessage={onSendRoomMessage}
            />
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

function getStableIndex(seed: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

function PlayerInfo({ player, isCurrentTurn, isLocalPlayer }: PlayerInfoProps) {
  const playerColor = playerColors[getStableIndex(player.player_name, playerColors.length)];

  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg ${
        playerColor
      } ${isCurrentTurn ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center gap-2">
        <DwarfToken playerName={player.player_name} size="sm" />
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
  animatingPlayers: Map<string, AnimationStep[]>;
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

interface BoardPoint {
  x: number;
  y: number;
}

function getCellCenter(position: number, cellSize: number, gap = 2): BoardPoint {
  const coords = positionToCoords(position);
  return {
    x: coords.col * (cellSize + gap) + cellSize / 2,
    y: coords.row * (cellSize + gap) + cellSize / 2,
  };
}

function getSnakePathData(from: number, to: number, cellSize: number, gap = 2) {
  const start = getCellCenter(from, cellSize, gap);
  const end = getCellCenter(to, cellSize, gap);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len * cellSize * 0.4;
  const perpY = dx / len * cellSize * 0.4;

  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  const cp1 = {
    x: start.x + dx * 0.25 + perpX,
    y: start.y + dy * 0.25 + perpY,
  };
  const cp2 = {
    x: start.x + dx * 0.5 - perpX,
    y: start.y + dy * 0.5 - perpY,
  };
  const cp3 = {
    x: start.x + dx * 0.75 + perpX * 0.5,
    y: start.y + dy * 0.75 + perpY * 0.5,
  };

  return { start, end, mid, cp1, cp2, cp3 };
}

function cubicBezierPoint(
  t: number,
  p0: BoardPoint,
  p1: BoardPoint,
  p2: BoardPoint,
  p3: BoardPoint
): BoardPoint {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;

  return {
    x:
      oneMinusTSquared * oneMinusT * p0.x +
      3 * oneMinusTSquared * t * p1.x +
      3 * oneMinusT * tSquared * p2.x +
      tSquared * t * p3.x,
    y:
      oneMinusTSquared * oneMinusT * p0.y +
      3 * oneMinusTSquared * t * p1.y +
      3 * oneMinusT * tSquared * p2.y +
      tSquared * t * p3.y,
  };
}

function buildSnakeMotionFrames(from: number, to: number, cellSize: number): BoardPoint[] {
  const { start, end, mid, cp1, cp2, cp3 } = getSnakePathData(from, to, cellSize);
  const secondSegmentControl1 = {
    x: 2 * mid.x - cp2.x,
    y: 2 * mid.y - cp2.y,
  };

  const points: BoardPoint[] = [];
  for (let i = 0; i <= PATH_SAMPLE_COUNT; i++) {
    const progress = i / PATH_SAMPLE_COUNT;
    if (progress <= 0.5) {
      points.push(
        cubicBezierPoint(progress * 2, start, cp1, cp2, mid)
      );
    } else {
      points.push(
        cubicBezierPoint((progress - 0.5) * 2, mid, secondSegmentControl1, cp3, end)
      );
    }
  }

  return points;
}

function buildLadderMotionFrames(from: number, to: number, cellSize: number): BoardPoint[] {
  const start = getCellCenter(from, cellSize);
  const end = getCellCenter(to, cellSize);
  const points: BoardPoint[] = [];

  for (let i = 0; i <= PATH_SAMPLE_COUNT; i++) {
    const progress = i / PATH_SAMPLE_COUNT;
    points.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    });
  }

  return points;
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
              const animPath = animatingPlayers.get(player.player_name);
              return (
                <AnimatedDwarfToken
                  key={player.player_name}
                  player={player}
                  animationPath={animPath}
                  cellSize={cellSize}
                  isCurrentTurn={player.pid === currentTurnPid}
                  isLocalPlayer={player.pid === localPlayerId}
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
  animationPath?: AnimationStep[];
  cellSize: number;
  isCurrentTurn: boolean;
  isLocalPlayer: boolean;
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
    if (isAnimating && animationPath && animationPath.length > 0) {
      const delayMs =
        currentAnimStep === 0
          ? INITIAL_ANIMATION_DELAY_MS
          : animationPath[currentAnimStep - 1]?.durationMs ?? WALK_STEP_MS;

      const timeout = setTimeout(() => {
        if (currentAnimStep < animationPath.length) {
          setCurrentAnimStep((prev) => prev + 1);
          return;
        }

        setIsAnimating(false);
      }, delayMs);

      return () => clearTimeout(timeout);
    }
  }, [isAnimating, currentAnimStep, animationPath]);

  // Calculate current visual position
  let visualPosition = player.position;
  if (isAnimating && animationPath && animationPath.length > 0) {
    if (currentAnimStep === 0) {
      // The first step is always the square immediately after the previous position.
      visualPosition = animationPath[0].position - 1;
    } else if (currentAnimStep <= animationPath.length) {
      visualPosition = animationPath[currentAnimStep - 1].position;
    }
  }

  const activeStep =
    isAnimating && animationPath && currentAnimStep > 0
      ? animationPath[currentAnimStep - 1]
      : null;

  const gap = 2; // gap in pixels (matching gap-0.5 md:gap-1)

  if (cellSize === 0) return null;

  // Offset for multiple players on same cell
  const offsetX = playersAtSamePosition > 1 ? (indexAtPosition % 2) * 10 - 5 : 0;
  const offsetY = playersAtSamePosition > 1 ? Math.floor(indexAtPosition / 2) * 10 - 5 : 0;

  const visualCenter = getCellCenter(visualPosition, cellSize, gap);
  const x = visualCenter.x + offsetX;
  const y = visualCenter.y + offsetY;

  const jumpFromPosition =
    activeStep && animationPath && currentAnimStep > 1
      ? animationPath[currentAnimStep - 2].position
      : null;

  const motionFrames =
    activeStep?.motion === "snake" && jumpFromPosition !== null
      ? buildSnakeMotionFrames(jumpFromPosition, activeStep.position, cellSize)
      : activeStep?.motion === "ladder" && jumpFromPosition !== null
        ? buildLadderMotionFrames(jumpFromPosition, activeStep.position, cellSize)
        : null;

  const motionAnimate =
    motionFrames && motionFrames.length > 0
      ? {
          x: motionFrames.map((point) => point.x + offsetX - cellSize * 0.3),
          y: motionFrames.map((point) => point.y + offsetY - cellSize * 0.3),
        }
      : {
          x: x - (cellSize * 0.3),
          y: y - (cellSize * 0.3),
        };

  return (
    <motion.div
      className="absolute"
      style={{
        width: cellSize * 0.6,
        height: cellSize * 0.6,
      }}
      animate={motionAnimate}
      transition={
        activeStep?.motion === "snake" || activeStep?.motion === "ladder"
          ? {
              type: "tween",
              ease: "easeInOut",
              duration: activeStep.durationMs / 1000,
              times: motionFrames
                ? motionFrames.map((_, index) =>
                    motionFrames.length === 1 ? 1 : index / (motionFrames.length - 1)
                  )
                : undefined,
            }
          : {
              type: "spring",
              stiffness: 300,
              damping: 25,
              duration: (activeStep?.durationMs ?? WALK_STEP_MS) / 1000,
            }
      }
    >
      <DwarfToken
        playerName={player.player_name}
        isCurrentTurn={isCurrentTurn}
        isLocalPlayer={isLocalPlayer}
        isWalking={activeStep?.motion === "walk"}
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
  const { start, end, mid, cp1, cp2, cp3 } = getSnakePathData(from, to, cellSize);
  const path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${mid.x} ${mid.y} S ${cp3.x} ${cp3.y}, ${end.x} ${end.y}`;

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
        cx={start.x}
        cy={start.y}
        r={cellSize * 0.12}
        fill="#059669"
      />
      {/* Snake eyes */}
      <circle cx={start.x - 2} cy={start.y - 2} r={2} fill="white" />
      <circle cx={start.x + 2} cy={start.y - 2} r={2} fill="white" />
      <circle cx={start.x - 2} cy={start.y - 2} r={1} fill="black" />
      <circle cx={start.x + 2} cy={start.y - 2} r={1} fill="black" />
      {/* Snake tongue */}
      <path
        d={`M ${start.x} ${start.y + 3} l -3 6 M ${start.x} ${start.y + 3} l 3 6`}
        stroke="#dc2626"
        strokeWidth={1.5}
        fill="none"
      />
      {/* Snake tail */}
      <circle
        cx={end.x}
        cy={end.y}
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
  const start = getCellCenter(from, cellSize);
  const end = getCellCenter(to, cellSize);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len * cellSize * 0.2;
  const perpY = dx / len * cellSize * 0.2;

  // Ladder rails
  const rail1Start = { x: start.x + perpX, y: start.y + perpY };
  const rail1End = { x: end.x + perpX, y: end.y + perpY };
  const rail2Start = { x: start.x - perpX, y: start.y - perpY };
  const rail2End = { x: end.x - perpX, y: end.y - perpY };

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
  playerName: string;
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

function DwarfToken({ playerName, isCurrentTurn, isLocalPlayer, size = "md", isWalking }: DwarfTokenProps) {
  const colors = tokenColors[getStableIndex(playerName, tokenColors.length)];
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
