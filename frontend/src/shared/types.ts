/*
This file keeps the shared TypeScript types for users, wall notes, bets, links, slots, API results, and websocket messages.
Edit this file when backend JSON shapes or websocket message shapes change.
Copy a type pattern here when you add another shared API or websocket type.
*/

export type User = {
  id: number;
  username: string;
  is_admin: boolean;
  karma: number;
  created_at: string;
  updated_at: string;
};

export type PublicUser = {
  id: number;
  username: string;
  is_admin: boolean;
  karma: number;
  created_at: string;
};

export type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  email_confirmed: boolean;
  is_admin: boolean;
  is_banned: boolean;
  karma: number;
  created_at: string;
};

export type KarmaChange = {
  id: number;
  delta: number;
  karma_after: number;
  reason: string;
  ref_id: number | null;
  created_at: string;
};

export type NoteStyle = {
  color: string;
  text_color: string;
  tilt: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
};

export type WallNote = NoteStyle & {
  id: number;
  wall_user_id: number;
  author_id: number;
  author_username: string;
  text: string;
  has_image: boolean;
  created_at: string;
};

export type BetStatus = "open" | "resolved" | "cancelled" | "refunded";
export type BetSide = "yes" | "no";
/** New bets wait for an admin. Only approved bets are published. */
export type BetApproval = "pending" | "approved" | "declined";

export type Bet = {
  id: number;
  creator_id: number;
  creator_username: string;
  title: string;
  description: string;
  deadline_at: string;
  status: BetStatus;
  outcome: BetSide | null;
  resolved_at: string | null;
  approval: BetApproval;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  wager_count: number;
  yes_total: number;
  no_total: number;
  comment_count: number;
};

export type Wager = {
  id: number;
  bet_id: number;
  user_id: number;
  username: string;
  side: BetSide;
  amount: number;
  payout: number | null;
  created_at: string;
};

export type BetComment = {
  id: number;
  bet_id: number;
  author_id: number;
  author_username: string;
  text: string;
  created_at: string;
};

export type LinkItem = {
  id: number;
  author_id: number;
  author_username: string;
  url: string;
  title: string;
  description: string;
  score: number;
  my_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

export type PayLine = {
  name: string;
  label: string;
  multiplier: number;
};

export type SpinResult = {
  reels: string[];
  win: string | null;
  multiplier: number;
  payout: number;
  karma: number;
};

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiFail = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiOk<T> | ApiFail;

export type WsMessage =
  | { type: "ws.ready"; user_id: number; connections: number }
  | { type: "pong" }
  | { type: "karma.changed"; karma: number }
  | { type: "wall.changed"; wall_user_id: number }
  | { type: "bet.changed"; bet_id: number }
  | { type: "bet.comment"; bet_id: number }
  | { type: "links.changed" };
