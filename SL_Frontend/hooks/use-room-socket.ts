"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientWebSocketEvent,
  ServerWebSocketEvent,
} from "@/types/game";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090";

function buildRoomWebSocketUrl(playerName: string | null): string {
  const url = new URL(BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/ws/board-games";
  if (playerName) {
    url.searchParams.set("player_name", playerName);
  }
  url.hash = "";
  return url.toString();
}

export function useRoomSocket(
  playerName: string | null,
  connectionLabel = "room"
) {
  const socketRef = useRef<WebSocket | null>(null);
  const [eventQueue, setEventQueue] = useState<ServerWebSocketEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    setEventQueue([]);

    if (!playerName) {
      setIsConnected(false);
      setConnectionError(null);
      return;
    }

    const socket = new WebSocket(buildRoomWebSocketUrl(playerName));
    let closedByClient = false;

    socketRef.current = socket;
    setIsConnected(false);
    setConnectionError(null);

    socket.onopen = () => {
      if (socketRef.current !== socket) {
        return;
      }
      setIsConnected(true);
      setConnectionError(null);
    };

    socket.onmessage = (event) => {
      if (socketRef.current !== socket) {
        return;
      }

      try {
        setEventQueue((queue) => [
          ...queue,
          JSON.parse(event.data) as ServerWebSocketEvent,
        ]);
      } catch {
        setConnectionError(`Received an invalid ${connectionLabel} update.`);
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) {
        return;
      }
      // Let onclose provide the final reason so duplicate-name rejections
      // surface their server message instead of a generic browser error.
    };

    socket.onclose = (event) => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setIsConnected(false);
      if (!closedByClient) {
        setConnectionError(
          event.reason ||
            `${connectionLabel.charAt(0).toUpperCase()}${connectionLabel.slice(1)} connection closed.`
        );
      }
    };

    return () => {
      closedByClient = true;
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket.close();
    };
  }, [connectionLabel, playerName]);

  const sendEvent = (event: ClientWebSocketEvent): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(event));
    return true;
  };

  const consumeEvent = useCallback(() => {
    setEventQueue((queue) => queue.slice(1));
  }, []);

  return {
    eventQueue,
    consumeEvent,
    isConnected,
    connectionError,
    sendEvent,
  };
}
