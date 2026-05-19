"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BoardState, GameStatus } from "@/types/game";
import { useSession } from "@/hooks/use-session";
import { useRoomSocket } from "@/hooks/use-room-socket";
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

const FEEDBACK_AUTO_DISMISS_MS = 5000;

function getFeedbackPresentation(message: string): {
  message: string;
  tone: FeedbackTone;
} {
  if (message.includes("Three conseq sixes found")) {
    return {
      message: "Three sixes in a row. Move cancelled.",
      tone: "destructive",
    };
  }

  if (message.includes("last roll is six")) {
    return {
      message: "Rolled a 6. Extra turn awarded.",
      tone: "default",
    };
  }

  if (message.includes("Position overshooting")) {
    return {
      message: "Move skipped. That roll would overshoot the finish.",
      tone: "default",
    };
  }

  return {
    message,
    tone: "default",
  };
}

export function GameApp() {
  const {
    session,
    setSession,
    clearSession,
    screen,
    setScreen,
    isLoaded,
  } = useSession();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [finalBoardState, setFinalBoardState] = useState<BoardState | null>(null);
  const previousBoardStatusRef = useRef<GameStatus | null>(null);
  const currentScreenRef = useRef(screen);

  const {
    lastEvent,
    isConnected,
    connectionError,
    sendEvent,
  } = useRoomSocket(activeRoomId);

  useEffect(() => {
    currentScreenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedbackMessage(null);
    }, FEEDBACK_AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [feedbackMessage]);

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    setIsLoading(false);

    if (lastEvent.type === "error") {
      if (lastEvent.state) {
        setBoardState(lastEvent.state);
      }
      setFeedbackMessage(lastEvent.message);
      setFeedbackTone("destructive");
      return;
    }

    const previousBoardStatus = previousBoardStatusRef.current;
    const isFreshMatchFound =
      lastEvent.state.status === "in_progress" &&
      (previousBoardStatus === "queued" ||
        (previousBoardStatus === null &&
          currentScreenRef.current === "waitingRoom"));

    setBoardState(lastEvent.state);
    previousBoardStatusRef.current = lastEvent.state.status;

    if (lastEvent.message) {
      const feedback = getFeedbackPresentation(lastEvent.message);
      setFeedbackMessage(feedback.message);
      setFeedbackTone(feedback.tone);
    }

    if (lastEvent.state.status === "completed") {
      setFinalBoardState(lastEvent.state);
      setScreen("gameComplete");
      return;
    }

    if (lastEvent.state.status === "in_progress") {
      if (isFreshMatchFound) {
        setFeedbackMessage("Starting game");
        setFeedbackTone("default");
      }
      setScreen("gameBoard");
      return;
    }

    setScreen("waitingRoom");
  }, [lastEvent, setScreen]);

  useEffect(() => {
    if (!connectionError || !activeRoomId) {
      return;
    }

    setIsLoading(false);
    setFeedbackMessage(connectionError);
    setFeedbackTone("destructive");
  }, [activeRoomId, connectionError]);

  const resetLiveState = () => {
    previousBoardStatusRef.current = null;
    setActiveRoomId(null);
    setBoardState(null);
    setFinalBoardState(null);
    setFeedbackMessage(null);
    setFeedbackTone("default");
    setIsLoading(false);
  };

  const handleLeaveRoom = () => {
    resetLiveState();
    clearSession();
  };

  const handleStartMatchmaking = async (playerName: string) => {
    setIsLoading(true);
    setFeedbackMessage(null);
    setFeedbackTone("default");

    try {
      const result = await api.startMatchmaking(playerName);

      resetLiveState();
      setSession({
        playerName,
        roomId: result.room.room_id,
        gameId: result.game_id || result.room.room_id,
        playerId: result.player_id,
        requiredPlayers: result.room.required_players,
      });
      if (result.game_started) {
        setFeedbackMessage("Starting game");
        setFeedbackTone("default");
      } else if (result.room.joined_players > 1) {
        setFeedbackMessage("Match found");
        setFeedbackTone("default");
      }
      setActiveRoomId(result.room.room_id);
      setScreen("waitingRoom");
    } catch (err) {
      const errorMsg = (err as { error?: string }).error || "Failed to start matchmaking";
      setFeedbackMessage(errorMsg);
      setFeedbackTone("destructive");
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    setIsLoading(true);
    setFeedbackMessage(null);
    setFeedbackTone("default");

    try {
      const result = await api.joinRoom(roomId, session.playerName);

      resetLiveState();
      setSession({
        roomId: result.room.room_id,
        gameId: result.game_id || result.room.room_id,
        playerId: result.player_id,
        requiredPlayers: result.room.required_players,
      });
      if (result.game_started) {
        setFeedbackMessage("Starting game");
        setFeedbackTone("default");
      } else if (result.room.joined_players > 1) {
        setFeedbackMessage("Match found");
        setFeedbackTone("default");
      }
      setActiveRoomId(result.room.room_id);
      setScreen("waitingRoom");
    } catch (err) {
      const errorMsg = (err as { error?: string }).error || "Failed to join room";
      setFeedbackMessage(errorMsg);
      setFeedbackTone("destructive");
      setIsLoading(false);
    }
  };

  const handleRollDice = () => {
    if (session.playerId === null) {
      return;
    }

    setFeedbackMessage(null);
    setFeedbackTone("default");
    setIsLoading(true);

    const didSend = sendEvent({ type: "roll_dice" });
    if (!didSend) {
      setIsLoading(false);
      setFeedbackMessage("Room connection is not ready yet.");
      setFeedbackTone("destructive");
    }
  };

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

        {screen === "waitingRoom" && session.roomId && (
          <motion.div
            key="waitingRoom"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <WaitingRoomPage
              roomId={session.roomId}
              playerName={session.playerName}
              requiredPlayers={session.requiredPlayers}
              boardState={boardState}
              isConnected={isConnected}
              onBack={handleLeaveRoom}
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
              isConnected={isConnected}
              onRollDice={handleRollDice}
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
              onReturnToLobby={handleLeaveRoom}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
