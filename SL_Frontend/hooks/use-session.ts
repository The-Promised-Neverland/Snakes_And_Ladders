"use client";

import { useState, useEffect, useCallback } from "react";
import type { SessionState, Screen, BoardState } from "@/types/game";

const STORAGE_KEY = "snakes-ladders-session";

const defaultSession: SessionState = {
  playerName: "",
  preferredRoomSize: null,
  roomId: null,
  gameId: null,
  playerId: null,
  requiredPlayers: null,
};

export function useSession() {
  const [session, setSessionState] = useState<SessionState>(defaultSession);
  const [screen, setScreen] = useState<Screen>("home");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SessionState;
        const restoredSession = {
          ...defaultSession,
          playerName: parsed.playerName || "",
          preferredRoomSize: parsed.preferredRoomSize ?? null,
        };
        setSessionState(restoredSession);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredSession));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoaded(true);
  }, []);

  const setSession = useCallback((updates: Partial<SessionState>) => {
    setSessionState((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearSession = useCallback(() => {
    const playerName = session.playerName;
    const preferredRoomSize = session.preferredRoomSize;
    setSessionState({ ...defaultSession, playerName, preferredRoomSize });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...defaultSession, playerName, preferredRoomSize })
    );
    setScreen("home");
  }, [session.playerName, session.preferredRoomSize]);

  const derivePlayerId = useCallback(
    (boardState: BoardState): number | null => {
      const player = boardState.players.find(
        (p) => p.player_name === session.playerName
      );
      return player ? player.pid : null;
    },
    [session.playerName]
  );

  const derivePlayerIdFromRoom = useCallback(
    (players: string[]): number | null => {
      const index = players.indexOf(session.playerName);
      return index >= 0 ? index : null;
    },
    [session.playerName]
  );

  return {
    session,
    setSession,
    clearSession,
    screen,
    setScreen,
    isLoaded,
    derivePlayerId,
    derivePlayerIdFromRoom,
  };
}
