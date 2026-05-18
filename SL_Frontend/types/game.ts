export type GameStatus = "queued" | "in_progress" | "completed";

export interface ErrorResponse {
  error: string;
}

export interface RoomState {
  room_id: string;
  room_name: string;
  status: string;
  required_players: number;
  joined_players: number;
  available_slots: number;
  players: string[];
}

export interface MatchmakingResult {
  room: RoomState;
  game_started: boolean;
  game_id?: string;
}

export interface BoardPlayerState {
  pid: number;
  player_name: string;
  position: number;
  conseq_six_count: number;
}

export interface BoardState {
  id: string;
  name: string;
  status: GameStatus;
  current_turn_pid: number;
  current_turn_player: string;
  players: BoardPlayerState[];
  snakes: Record<string, number>;
  ladders: Record<string, number>;
  dice_value: number;
  dice_rolled: boolean;
}

export interface RollDiceErrorResponse extends ErrorResponse {
  state: BoardState;
}

export interface RollDiceResult {
  game_over: boolean;
  message?: string;
  state: BoardState;
}

export interface SessionState {
  playerName: string;
  roomId: string | null;
  gameId: string | null;
  playerId: number | null;
  requiredPlayers: number | null;
}

export type Screen = "home" | "rooms" | "waitingRoom" | "gameBoard" | "gameComplete";
