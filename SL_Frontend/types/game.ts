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
  player_id: number;
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
  leaderboard: number[];
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

export type WebSocketEventType =
  | "matchmaking"
  | "join_room"
  | "show_rooms"
  | "board_state"
  | "roll_dice"
  | "global_chat"
  | "room_chat"
  | "online_count"
  | "error";

export interface WebSocketBoardStateEvent {
  type: "board_state";
  state: BoardState;
  message?: string;
}

export interface WebSocketErrorEvent {
  type: "error";
  message: string;
  state?: BoardState;
}

export interface WebSocketRollDiceEvent {
  type: "roll_dice";
}

export interface WebSocketMatchmakingEvent {
  type: "matchmaking" | "join_room";
  result: MatchmakingResult;
  message?: string;
}

export interface WebSocketShowRoomsEvent {
  type: "show_rooms";
  rooms: RoomState[];
  message?: string;
}

export interface WebSocketChatEvent {
  type: "global_chat" | "room_chat";
  player_name: string;
  room_id?: string;
  message: string;
}

export interface WebSocketOnlineCountEvent {
  type: "online_count";
  count: number;
}

export interface WebSocketMatchmakingRequestEvent {
  type: "matchmaking";
  player_name?: string;
  room_size?: number;
}

export interface WebSocketJoinRoomRequestEvent {
  type: "join_room";
  player_name?: string;
  room_id: string;
}

export interface WebSocketShowRoomsRequestEvent {
  type: "show_rooms";
}

export interface WebSocketGlobalChatRequestEvent {
  type: "global_chat";
  message: string;
}

export interface WebSocketRoomChatRequestEvent {
  type: "room_chat";
  message: string;
}

export type ServerWebSocketEvent =
  | WebSocketBoardStateEvent
  | WebSocketErrorEvent
  | WebSocketMatchmakingEvent
  | WebSocketShowRoomsEvent
  | WebSocketChatEvent
  | WebSocketOnlineCountEvent;

export type ClientWebSocketEvent =
  | WebSocketRollDiceEvent
  | WebSocketMatchmakingRequestEvent
  | WebSocketJoinRoomRequestEvent
  | WebSocketShowRoomsRequestEvent
  | WebSocketGlobalChatRequestEvent
  | WebSocketRoomChatRequestEvent;

export interface ChatMessage {
  id: string;
  type: "global_chat" | "room_chat";
  playerName: string;
  roomId?: string;
  message: string;
  sentAt: number;
}

export interface SessionState {
  playerName: string;
  preferredRoomSize: number | null;
  roomId: string | null;
  gameId: string | null;
  playerId: number | null;
  requiredPlayers: number | null;
}

export type Screen = "home" | "rooms" | "waitingRoom" | "gameBoard" | "gameComplete";
