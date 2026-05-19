"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClientWebSocketEvent,
  ServerWebSocketEvent,
} from "@/types/game";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090";

function buildRoomWebSocketUrl(roomId: string): string {
  const url = new URL(BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/board-games/${roomId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function useRoomSocket(roomId: string | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const [lastEvent, setLastEvent] = useState<ServerWebSocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    setLastEvent(null);

    if (!roomId) {
      setIsConnected(false);
      setConnectionError(null);
      return;
    }

    const socket = new WebSocket(buildRoomWebSocketUrl(roomId));
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
        setLastEvent(JSON.parse(event.data) as ServerWebSocketEvent);
      } catch {
        setConnectionError("Received an invalid room update.");
      }
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) {
        return;
      }
      setConnectionError("Failed to connect to the room.");
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setIsConnected(false);
      if (!closedByClient) {
        setConnectionError("Room connection closed.");
      }
    };

    return () => {
      closedByClient = true;
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket.close();
    };
  }, [roomId]);

  const sendEvent = (event: ClientWebSocketEvent): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(event));
    return true;
  };

  return {
    lastEvent,
    isConnected,
    connectionError,
    sendEvent,
  };
}
