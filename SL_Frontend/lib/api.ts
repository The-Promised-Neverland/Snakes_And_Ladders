import type {
  MatchmakingResult,
  RoomState,
  BoardState,
  RollDiceResult,
  RollDiceErrorResponse,
} from "@/types/game";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export async function startMatchmaking(
  playerName: string,
  roomSize?: number | null
): Promise<MatchmakingResult> {
  const body: Record<string, unknown> = { player_name: playerName };
  if (roomSize != null) {
    body.room_size = roomSize;
  }

  return fetchApi<MatchmakingResult>("/api/matchmaking/start-matchmaking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function showRooms(): Promise<RoomState[]> {
  return fetchApi<RoomState[]>("/api/matchmaking/show-rooms");
}

export async function joinRoom(
  roomId: string,
  playerName: string
): Promise<MatchmakingResult> {
  return fetchApi<MatchmakingResult>(`/api/matchmaking/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify({ player_name: playerName }),
  });
}

export async function getBoardGameState(gameId: string): Promise<BoardState> {
  return fetchApi<BoardState>(`/api/board-games/${gameId}/state`);
}

export async function rollDice(
  gameId: string,
  playerId: number
): Promise<RollDiceResult> {
  return fetchApi<RollDiceResult>(
    `/api/board-games/${gameId}/${playerId}/roll-dice`,
    {
      method: "POST",
    }
  );
}

export function isRollDiceError(error: unknown): error is RollDiceErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "state" in error
  );
}
