"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  BoardState,
  ChatMessage,
  ClientWebSocketEvent,
  GameStatus,
  RoomState,
} from "@/types/game";
import { useSession } from "@/hooks/use-session";
import { useRoomSocket } from "@/hooks/use-room-socket";
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
const MAX_CHAT_MESSAGES = 80;

function appendChatMessage(messages: ChatMessage[], nextMessage: ChatMessage): ChatMessage[] {
  const nextMessages = [...messages, nextMessage];
  if (nextMessages.length <= MAX_CHAT_MESSAGES) {
    return nextMessages;
  }
  return nextMessages.slice(nextMessages.length - MAX_CHAT_MESSAGES);
}

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
    derivePlayerId,
  } = useSession();

  const [activeSocketPlayerName, setActiveSocketPlayerName] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [availableRooms, setAvailableRooms] = useState<RoomState[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingRooms, setIsSyncingRooms] = useState(false);
  const [pendingSocketEvent, setPendingSocketEvent] =
    useState<ClientWebSocketEvent | null>(null);
  const [finalBoardState, setFinalBoardState] = useState<BoardState | null>(null);
  const [globalChatMessages, setGlobalChatMessages] = useState<ChatMessage[]>([]);
  const [roomChatMessages, setRoomChatMessages] = useState<ChatMessage[]>([]);
  const previousBoardStatusRef = useRef<GameStatus | null>(null);
  const currentScreenRef = useRef(screen);

  const {
    lastEvent,
    isConnected,
    connectionError,
    sendEvent,
  } = useRoomSocket(activeSocketPlayerName, "game");

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

    if (lastEvent.type === "global_chat" || lastEvent.type === "room_chat") {
      const nextMessage: ChatMessage = {
        id: `${lastEvent.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: lastEvent.type,
        playerName: lastEvent.player_name,
        roomId: lastEvent.room_id,
        message: lastEvent.message,
        sentAt: Date.now(),
      };

      if (lastEvent.type === "global_chat") {
        setGlobalChatMessages((messages) => appendChatMessage(messages, nextMessage));
        return;
      }

      setRoomChatMessages((messages) => appendChatMessage(messages, nextMessage));
      return;
    }

    setIsLoading(false);

    if (lastEvent.type === "error") {
      if (lastEvent.state) {
        setBoardState(lastEvent.state);
      }
      setIsSyncingRooms(false);
      setFeedbackMessage(lastEvent.message);
      setFeedbackTone("destructive");
      return;
    }

    if (lastEvent.type === "show_rooms") {
      setAvailableRooms(lastEvent.rooms);
      setIsSyncingRooms(false);
      return;
    }

    if (lastEvent.type === "matchmaking" || lastEvent.type === "join_room") {
      const result = lastEvent.result;

      resetLiveState(true);
      setSession({
        playerName: session.playerName,
        preferredRoomSize: session.preferredRoomSize,
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
      setScreen("waitingRoom");
      return;
    }

    if (lastEvent.type !== "board_state") {
      return;
    }

    const previousBoardStatus = previousBoardStatusRef.current;
    const isFreshMatchFound =
      lastEvent.state.status === "in_progress" &&
      (previousBoardStatus === "queued" ||
        (previousBoardStatus === null &&
          currentScreenRef.current === "waitingRoom"));

    const livePlayerId = derivePlayerId(lastEvent.state);
    if (livePlayerId !== null && livePlayerId !== session.playerId) {
      setSession({ playerId: livePlayerId });
    }

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
  }, [
    derivePlayerId,
    lastEvent,
    session.playerId,
    session.playerName,
    session.preferredRoomSize,
    setScreen,
    setSession,
  ]);

  useEffect(() => {
    if (!connectionError || !activeSocketPlayerName) {
      return;
    }

    setIsLoading(false);
    setIsSyncingRooms(false);
    setFeedbackMessage(connectionError);
    setFeedbackTone("destructive");
  }, [activeSocketPlayerName, connectionError]);

  useEffect(() => {
    if (!pendingSocketEvent || !isConnected) {
      return;
    }

    const didSend = sendEvent(pendingSocketEvent);
    if (!didSend) {
      return;
    }

    setPendingSocketEvent(null);
  }, [isConnected, pendingSocketEvent, sendEvent]);

  useEffect(() => {
    if (screen !== "rooms" || !activeSocketPlayerName) {
      return;
    }

    const requestRooms = () => {
      setIsSyncingRooms(true);
      setPendingSocketEvent({ type: "show_rooms" });
    };

    requestRooms();
    const interval = window.setInterval(requestRooms, 3000);

    return () => window.clearInterval(interval);
  }, [activeSocketPlayerName, screen]);

  const resetLiveState = (preserveSocket = false) => {
    previousBoardStatusRef.current = null;
    if (!preserveSocket) {
      setActiveSocketPlayerName(null);
    }
    setBoardState(null);
    setAvailableRooms([]);
    setFinalBoardState(null);
    setRoomChatMessages([]);
    setFeedbackMessage(null);
    setFeedbackTone("default");
    setIsLoading(false);
    setIsSyncingRooms(false);
    setPendingSocketEvent(null);
  };

  const handleLeaveRoom = () => {
    resetLiveState();
    clearSession();
  };

  const handleStartMatchmaking = (
    playerName: string,
    preferredRoomSize: number | null
  ) => {
    setIsLoading(true);
    setFeedbackMessage(null);
    setFeedbackTone("default");

    setSession({
      playerName,
      preferredRoomSize,
      roomId: null,
      gameId: null,
      playerId: null,
      requiredPlayers: null,
    });
    setActiveSocketPlayerName(playerName);

    const event: ClientWebSocketEvent =
      preferredRoomSize === null
        ? { type: "matchmaking" }
        : { type: "matchmaking", room_size: preferredRoomSize };

    setPendingSocketEvent(event);
  };

  const handleJoinRoom = (roomId: string) => {
    if (!session.playerName) {
      setFeedbackMessage("Enter a player name before joining a room.");
      setFeedbackTone("destructive");
      return;
    }

    setIsLoading(true);
    setFeedbackMessage(null);
    setFeedbackTone("default");
    setActiveSocketPlayerName(session.playerName);

    setPendingSocketEvent({ type: "join_room", room_id: roomId });
  };

  const handleShowRooms = (playerName: string, preferredRoomSize: number | null) => {
    setFeedbackMessage(null);
    setFeedbackTone("default");
    setSession({
      playerName,
      preferredRoomSize,
      roomId: null,
      gameId: null,
      playerId: null,
      requiredPlayers: null,
    });
    setActiveSocketPlayerName(playerName);
    setAvailableRooms([]);
    setIsSyncingRooms(true);
    setPendingSocketEvent({ type: "show_rooms" });
    setScreen("rooms");
  };

  const handleRollDice = () => {
    if (session.playerId === null || !session.roomId) {
      return;
    }

    setFeedbackMessage(null);
    setFeedbackTone("default");
    setIsLoading(true);

    const didSend = sendEvent({ type: "roll_dice" });
    if (!didSend) {
      setIsLoading(false);
      setFeedbackMessage("Socket connection is not ready yet.");
      setFeedbackTone("destructive");
    }
  };

  const handleSendGlobalMessage = (message: string): string | null => {
    if (!session.playerName) {
      return "Choose a player name before sending chat.";
    }

    const didSend = sendEvent({ type: "global_chat", message });
    if (!didSend) {
      return "Socket connection is not ready yet.";
    }
    return null;
  };

  const handleSendRoomMessage = (message: string): string | null => {
    if (!session.roomId) {
      return "Join a room before using room chat.";
    }

    const didSend = sendEvent({ type: "room_chat", message });
    if (!didSend) {
      return "Socket connection is not ready yet.";
    }
    return null;
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
              preferredRoomSize={session.preferredRoomSize}
              onPlayerNameChange={(name) => setSession({ playerName: name })}
              onPreferredRoomSizeChange={(roomSize) =>
                setSession({ preferredRoomSize: roomSize })
              }
              onStartMatchmaking={handleStartMatchmaking}
              onShowRooms={handleShowRooms}
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
              rooms={availableRooms}
              isSyncing={isSyncingRooms}
              isConnected={isConnected}
              globalMessages={globalChatMessages}
              onSendGlobalMessage={handleSendGlobalMessage}
              onRefresh={() => {
                setIsSyncingRooms(true);
                setPendingSocketEvent({ type: "show_rooms" });
              }}
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
              globalMessages={globalChatMessages}
              roomMessages={roomChatMessages}
              onSendGlobalMessage={handleSendGlobalMessage}
              onSendRoomMessage={handleSendRoomMessage}
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
              globalMessages={globalChatMessages}
              roomMessages={roomChatMessages}
              onSendGlobalMessage={handleSendGlobalMessage}
              onSendRoomMessage={handleSendRoomMessage}
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
