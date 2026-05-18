"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BoardState } from "@/types/game";
import { useSession } from "@/hooks/use-session";
import * as api from "@/lib/api";
import { HomePage } from "@/components/game/home-page";
import { RoomsPage } from "@/components/game/rooms-page";
import { WaitingRoomPage } from "@/components/game/waiting-room-page";
import { GamePage } from "@/components/game/game-page";
import { GameCompletePage } from "@/components/game/game-complete-page";

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

type FeedbackTone = "default" | "destructive";

export function GameApp() {
  const {
    session,
    setSession,
    clearSession,
    screen,
    setScreen,
    isLoaded,
    derivePlayerId,
  } = useSession();

  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [finalBoardState, setFinalBoardState] = useState<BoardState | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!session.gameId) return;
    if (screen !== "home") return;

    const restoreSession = async () => {
      try {
        const state = await api.getBoardGameState(session.gameId!);
        setBoardState(state);

        const playerId = derivePlayerId(state);
        if (playerId !== null) {
          setSession({ playerId });
        }

        if (state.status === "in_progress") {
          setScreen("gameBoard");
        } else if (state.status === "queued") {
          if (!session.requiredPlayers) {
            try {
              const rooms = await api.showRooms();
              const matchingRoom = rooms.find(
                (r) => r.room_id === session.roomId || r.room_id === session.gameId
              );
              if (matchingRoom) {
                setSession({ requiredPlayers: matchingRoom.required_players });
              }
            } catch {
              // Ignore, proceed without requiredPlayers
            }
          }
          setScreen("waitingRoom");
        } else if (state.status === "completed") {
          setFinalBoardState(state);
          setScreen("gameComplete");
        }
      } catch {
        clearSession();
      }
    };

    restoreSession();
  }, [
    isLoaded,
    session.gameId,
    session.roomId,
    session.requiredPlayers,
    derivePlayerId,
    setSession,
    setScreen,
    clearSession,
    screen,
  ]);

  const handleStartMatchmaking = async (playerName: string) => {
    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const result = await api.startMatchmaking(playerName);

      setSession({
        playerName,
        roomId: result.room.room_id,
        gameId: result.game_id || result.room.room_id,
        requiredPlayers: result.room.required_players,
      });

      if (result.game_started && result.game_id) {
        const state = await api.getBoardGameState(result.game_id);
        setBoardState(state);
        const playerId = derivePlayerId(state);
        setSession({ playerId });
        setScreen("gameBoard");
      } else {
        setScreen("waitingRoom");
      }
    } catch (err) {
      const errorMsg = (err as { error?: string }).error || "Failed to start matchmaking";
      setFeedbackMessage(errorMsg);
      setFeedbackTone("destructive");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const result = await api.joinRoom(roomId, session.playerName);

      setSession({
        roomId: result.room.room_id,
        gameId: result.game_id || result.room.room_id,
        requiredPlayers: result.room.required_players,
      });

      if (result.game_started && result.game_id) {
        const state = await api.getBoardGameState(result.game_id);
        setBoardState(state);
        const playerId = derivePlayerId(state);
        setSession({ playerId });
        setScreen("gameBoard");
      } else {
        setScreen("waitingRoom");
      }
    } catch (err) {
      const errorMsg = (err as { error?: string }).error || "Failed to join room";
      setFeedbackMessage(errorMsg);
      setFeedbackTone("destructive");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollDice = async () => {
    if (!session.gameId || session.playerId === null) return;

    setIsLoading(true);
    setFeedbackMessage(null);

    try {
      const result = await api.rollDice(session.gameId, session.playerId);
      setBoardState(result.state);

      if (result.message) {
        setFeedbackMessage(result.message);
        setFeedbackTone("default");
      }

      if (result.game_over || result.state.status === "completed") {
        setFinalBoardState(result.state);
        setScreen("gameComplete");
      }
    } catch (err) {
      if (api.isRollDiceError(err)) {
        setBoardState(err.state);
        setFeedbackMessage(err.error);
        setFeedbackTone("destructive");
      } else {
        const errorMsg = (err as { error?: string }).error || "Failed to roll dice";
        setFeedbackMessage(errorMsg);
        setFeedbackTone("destructive");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaitingRoomPoll = useCallback((state: BoardState) => {
    setBoardState(state);
    if (state.status === "in_progress") {
      const playerId = derivePlayerId(state);
      setSession({ playerId });
      setScreen("gameBoard");
    }
  }, [derivePlayerId, setSession, setScreen]);

  const handleGamePoll = useCallback((state: BoardState) => {
    setBoardState(state);

    if (state.status === "completed") {
      setFinalBoardState(state);
      setScreen("gameComplete");
    }
  }, [setScreen]);

  const handlePollError = useCallback((err: unknown) => {
    const errorData = err as { error?: string };
    if (errorData.error === "game not found") {
      if (screen === "gameComplete" && finalBoardState) {
        return;
      }
      clearSession();
    }
  }, [screen, finalBoardState, clearSession]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {screen === "home" && (
          <motion.div
            key="home"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <HomePage
              playerName={session.playerName}
              onPlayerNameChange={(name) => setSession({ playerName: name })}
              onStartMatchmaking={handleStartMatchmaking}
              onShowRooms={() => setScreen("rooms")}
              isLoading={isLoading}
              error={feedbackTone === "destructive" ? feedbackMessage : null}
              onClearError={() => setFeedbackMessage(null)}
            />
          </motion.div>
        )}

        {screen === "rooms" && (
          <motion.div
            key="rooms"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <RoomsPage
              playerName={session.playerName}
              onJoinRoom={handleJoinRoom}
              onBack={() => setScreen("home")}
              isLoading={isLoading}
              error={feedbackTone === "destructive" ? feedbackMessage : null}
              onClearError={() => setFeedbackMessage(null)}
            />
          </motion.div>
        )}

        {screen === "waitingRoom" && (
          <motion.div
            key="waitingRoom"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <WaitingRoomPage
              gameId={session.gameId!}
              playerName={session.playerName}
              requiredPlayers={session.requiredPlayers}
              onGameStart={handleWaitingRoomPoll}
              onError={handlePollError}
              onBack={() => {
                clearSession();
              }}
            />
          </motion.div>
        )}

        {screen === "gameBoard" && boardState && (
          <motion.div
            key="gameBoard"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <GamePage
              boardState={boardState}
              playerName={session.playerName}
              playerId={session.playerId}
              gameId={session.gameId!}
              onRollDice={handleRollDice}
              onPollUpdate={handleGamePoll}
              onPollError={handlePollError}
              isLoading={isLoading}
              feedbackMessage={feedbackMessage}
              feedbackTone={feedbackTone}
              onClearFeedback={() => setFeedbackMessage(null)}
            />
          </motion.div>
        )}

        {screen === "gameComplete" && finalBoardState && (
          <motion.div
            key="gameComplete"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <GameCompletePage
              boardState={finalBoardState}
              playerName={session.playerName}
              onReturnToLobby={clearSession}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
