// ============================================================
// ChessMind Coach — Chess Utility Functions
// ============================================================
//
// This file wraps the chess.js library with helper functions
// tailored for our coaching application. It provides:
//
//   - Move format conversion (UCI ↔ SAN)
//   - Board state queries (what pieces are where)
//   - Move property detection (capture, check, sacrifice, etc.)
//   - Material counting and comparison
//   - Square analysis (is a square attacked? defended?)
//   - FEN manipulation utilities
//
// WHY WE NEED THIS:
//
// The engine speaks UCI notation ("e2e4", "g1f3").
// Humans read SAN notation ("e4", "Nf3").
// The classifier needs to know if a move is a capture,
// sacrifice, or check.
// The analysis text needs to name pieces and squares.
//
// This file bridges all those needs in one place.
//
// ============================================================

import { Chess, Square, Piece, Move, Color } from "chess.js";


// ============================================================
// PIECE VALUES
// ============================================================
// Standard piece values in centipawns. Used for material
// counting and sacrifice detection.
// ============================================================

export const PIECE_VALUES: Record<string, number> = {
  p: 100,   // Pawn
  n: 320,   // Knight
  b: 330,   // Bishop
  r: 500,   // Rook
  q: 900,   // Queen
  k: 0,     // King (infinite value, but 0 for material count)
};

// Full piece names for natural language generation
export const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

// Piece symbols for display
export const PIECE_SYMBOLS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
  P: "♙",
  N: "♘",
  B: "♗",
  R: "♖",
  Q: "♕",
  K: "♔",
};


// ============================================================
// MOVE CONVERSION — UCI ↔ SAN
// ============================================================

/**
 * Convert a UCI move to SAN (Standard Algebraic Notation).
 *
 * UCI: "e2e4", "g1f3", "e7e8q"
 * SAN: "e4",   "Nf3",  "e8=Q"
 *
 * @param fen     - The position BEFORE the move
 * @param uciMove - Move in UCI notation
 * @returns The move in SAN notation, or the UCI move if conversion fails
 */
export function uciToSan(fen: string, uciMove: string): string {
  try {
    const game = new Chess(fen);

    const from = uciMove.substring(0, 2) as Square;
    const to = uciMove.substring(2, 4) as Square;
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

    const move = game.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });

    return move ? move.san : uciMove;
  } catch {
    return uciMove;
  }
}

/**
 * Convert a SAN move to UCI notation.
 *
 * SAN: "e4",  "Nf3",  "e8=Q", "O-O"
 * UCI: "e2e4", "g1f3", "e7e8q", "e1g1"
 *
 * @param fen     - The position BEFORE the move
 * @param sanMove - Move in SAN notation
 * @returns The move in UCI notation, or the SAN move if conversion fails
 */
export function sanToUci(fen: string, sanMove: string): string {
  try {
    const game = new Chess(fen);
    const move = game.move(sanMove);

    if (!move) return sanMove;

    let uci = move.from + move.to;
    if (move.promotion) {
      uci += move.promotion;
    }

    return uci;
  } catch {
    return sanMove;
  }
}

/**
 * Convert a sequence of UCI moves to SAN notation.
 *
 * This is used to convert the engine's principal variation
 * (a list of UCI moves) into human-readable notation.
 *
 * @param fen      - Starting position (FEN)
 * @param uciMoves - Array of UCI moves
 * @returns Array of SAN moves
 */
export function uciSequenceToSan(
  fen: string,
  uciMoves: string[]
): string[] {
  const sanMoves: string[] = [];

  try {
    const game = new Chess(fen);

    for (const uciMove of uciMoves) {
      const from = uciMove.substring(0, 2) as Square;
      const to = uciMove.substring(2, 4) as Square;
      const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

      const move = game.move({
        from,
        to,
        promotion: promotion as "q" | "r" | "b" | "n" | undefined,
      });

      if (move) {
        sanMoves.push(move.san);
      } else {
        // If a move fails (shouldn't happen with valid engine output),
        // break and return what we have so far
        break;
      }
    }
  } catch {
    // Return whatever we managed to convert
  }

  return sanMoves;
}

/**
 * Format a principal variation as a human-readable string.
 *
 * Input:  FEN + ["e2e4", "e7e5", "g1f3", "b8c6"]
 * Output: "1. e4 e5 2. Nf3 Nc6"
 *
 * @param fen          - Starting position (FEN)
 * @param uciMoves     - Array of UCI moves
 * @param startMoveNum - The move number to start from
 * @param isWhiteFirst - Whether White makes the first move in this sequence
 * @returns Formatted variation string
 */
export function formatVariation(
  fen: string,
  uciMoves: string[],
  startMoveNum: number = 1,
  isWhiteFirst: boolean = true
): string {
  const sanMoves = uciSequenceToSan(fen, uciMoves);
  if (sanMoves.length === 0) return "";

  let result = "";
  let moveNum = startMoveNum;
  let isWhiteTurn = isWhiteFirst;

  for (let i = 0; i < sanMoves.length; i++) {
    if (isWhiteTurn) {
      result += `${moveNum}. ${sanMoves[i]} `;
    } else {
      if (i === 0) {
        // If starting with Black's move, show "1... e5" format
        result += `${moveNum}... ${sanMoves[i]} `;
      } else {
        result += `${sanMoves[i]} `;
      }
      moveNum++;
    }
    isWhiteTurn = !isWhiteTurn;
  }

  return result.trim();
}


// ============================================================
// MOVE ANALYSIS — Properties of a specific move
// ============================================================

/**
 * Detailed information about a move, used by the classifier
 * and the analysis text generator.
 */
export interface MoveInfo {
  // Basic move data
  san: string;              // "Nxd5"
  uci: string;              // "c3d5"
  from: string;             // "c3"
  to: string;               // "d5"

  // Piece information
  piece: string;            // "n" (knight)
  pieceName: string;        // "knight"
  pieceColor: "w" | "b";    // "w"

  // Move properties
  isCapture: boolean;       // Did this move capture a piece?
  capturedPiece: string | null;     // "p" if captured a pawn
  capturedPieceName: string | null; // "pawn"
  isCheck: boolean;         // Does this move give check?
  isCheckmate: boolean;     // Does this move deliver checkmate?
  isCastling: boolean;      // Is this castling?
  castlingSide: "kingside" | "queenside" | null;
  isPromotion: boolean;     // Is this a pawn promotion?
  promotionPiece: string | null;  // "q" if promoting to queen
  isEnPassant: boolean;     // Is this an en passant capture?

  // Sacrifice detection
  isSacrifice: boolean;     // Is the moving piece going to an attacked square?
  materialDelta: number;    // Material change in centipawns (negative = gave up material)

  // Position effects
  givesDoubleCheck: boolean;
  isKingsideCastling: boolean;
  isQueensideCastling: boolean;
}


/**
 * Analyze a move and extract all its properties.
 *
 * This is the main function the classifier calls to understand
 * what a move does — is it a capture? A check? A sacrifice?
 *
 * @param fen     - Position BEFORE the move
 * @param uciMove - The move in UCI notation
 * @returns Detailed move information
 */
export function analyzeMoveProperties(
  fen: string,
  uciMove: string
): MoveInfo {
  const game = new Chess(fen);

  const from = uciMove.substring(0, 2) as Square;
  const to = uciMove.substring(2, 4) as Square;
  const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

  // Get the piece that's moving
  const movingPiece = game.get(from) ?? null;

  // Check if there's a piece on the destination square (capture)
  const targetPiece = game.get(to) ?? null;

  // Make the move to check for check/checkmate
  const move = game.move({
    from,
    to,
    promotion: promotion as "q" | "r" | "b" | "n" | undefined,
  });

  if (!move) {
    // Move is invalid — return defaults
    return createDefaultMoveInfo(uciMove);
  }

  // Determine if the move is a sacrifice
  const isSacrifice = detectSacrifice(fen, from, to, movingPiece, targetPiece);

  // Calculate material change
  const materialDelta = calculateMaterialDelta(
    movingPiece,
    targetPiece,
    move,
    fen
  );

  // Check for castling
  const isCastling = move.flags.includes("k") || move.flags.includes("q");
  const isKingsideCastling = move.flags.includes("k");
  const isQueensideCastling = move.flags.includes("q");

  return {
    san: move.san,
    uci: uciMove,
    from,
    to,
    piece: move.piece,
    pieceName: PIECE_NAMES[move.piece] || move.piece,
    pieceColor: move.color,
    isCapture: move.flags.includes("c") || move.flags.includes("e"),
    capturedPiece: move.captured || null,
    capturedPieceName: move.captured ? PIECE_NAMES[move.captured] || null : null,
    isCheck: move.san.includes("+") || move.san.includes("#"),
    isCheckmate: move.san.includes("#"),
    isCastling,
    castlingSide: isKingsideCastling
      ? "kingside"
      : isQueensideCastling
      ? "queenside"
      : null,
    isPromotion: !!move.promotion,
    promotionPiece: move.promotion || null,
    isEnPassant: move.flags.includes("e"),
    isSacrifice,
    materialDelta,
    givesDoubleCheck: false, // chess.js doesn't easily expose this
    isKingsideCastling,
    isQueensideCastling,
  };
}

/**
 * Create a default MoveInfo when move analysis fails.
 */
function createDefaultMoveInfo(uciMove: string): MoveInfo {
  return {
    san: uciMove,
    uci: uciMove,
    from: uciMove.substring(0, 2),
    to: uciMove.substring(2, 4),
    piece: "p",
    pieceName: "piece",
    pieceColor: "w",
    isCapture: false,
    capturedPiece: null,
    capturedPieceName: null,
    isCheck: false,
    isCheckmate: false,
    isCastling: false,
    castlingSide: null,
    isPromotion: false,
    promotionPiece: null,
    isEnPassant: false,
    isSacrifice: false,
    materialDelta: 0,
    givesDoubleCheck: false,
    isKingsideCastling: false,
    isQueensideCastling: false,
  };
}


// ============================================================
// SACRIFICE DETECTION
// ============================================================

/**
 * Determine if a move is a sacrifice.
 *
 * A sacrifice means the moving piece goes to a square where
 * it can be captured, and the material given up is NOT
 * immediately recaptured for equal or greater value.
 *
 * NOT a sacrifice:
 *   - A simple capture where you take a piece of equal/greater value
 *   - A trade (capture followed by recapture of equal value)
 *
 * IS a sacrifice:
 *   - Moving a piece to an attacked square without capturing
 *     anything of equal value
 *   - Capturing a piece of lesser value on an attacked square
 *     (e.g., taking a pawn with a queen on a defended square)
 */
function detectSacrifice(
  fen: string,
  from: Square,
  to: Square,
  movingPiece: Piece | null,
  targetPiece: Piece | null
): boolean {
  if (!movingPiece) return false;

  // Kings can't sacrifice
  if (movingPiece.type === "k") return false;

  // Pawns sacrificing is less notable (gambits are common)
  // Still detect it but it requires moving to an attacked square
  const movingPieceValue = PIECE_VALUES[movingPiece.type] || 0;
  const capturedValue = targetPiece ? PIECE_VALUES[targetPiece.type] || 0 : 0;

  // Check if the destination square is attacked by the opponent
  const game = new Chess(fen);
  const opponentColor: Color = movingPiece.color === "w" ? "b" : "w";
  const isAttacked = game.isAttacked(to, opponentColor);

  if (!isAttacked) {
    return false; // Not going to an attacked square — not a sacrifice
  }

  // The piece is moving to an attacked square.
  // If we're capturing something of equal or greater value, it's a trade, not a sacrifice.
  if (capturedValue >= movingPieceValue) {
    return false; // Trading or winning material — not a sacrifice
  }

  // Moving a piece worth more than what we're capturing to an attacked square
  // This IS a sacrifice if the piece we're risking is valuable enough
  const materialRisk = movingPieceValue - capturedValue;
  return materialRisk >= 100; // At least a pawn's worth of sacrifice
}


// ============================================================
// MATERIAL CALCULATION
// ============================================================

/**
 * Calculate the material change caused by a move.
 *
 * Returns a value in centipawns:
 *   - Positive: gained material (captured something)
 *   - Negative: lost material (sacrifice)
 *   - Zero: no material change (quiet move)
 *
 * For promotions, adds the value of the promotion piece
 * minus the pawn value.
 */
function calculateMaterialDelta(
  movingPiece: Piece | null,
  targetPiece: Piece | null,
  move: Move,
  fen: string
): number {
  let delta = 0;

  // Material gained from capture
  if (targetPiece) {
    delta += PIECE_VALUES[targetPiece.type] || 0;
  }

  // En passant capture
  if (move.flags.includes("e")) {
    delta += PIECE_VALUES["p"]; // Captured a pawn via en passant
  }

  // Promotion: gain the new piece, lose the pawn
  if (move.promotion) {
    delta += (PIECE_VALUES[move.promotion] || 0) - PIECE_VALUES["p"];
  }

  // Check if the moving piece is now on an attacked square
  // (meaning we might lose it — this is a potential sacrifice)
  if (movingPiece && movingPiece.type !== "k") {
    const game = new Chess(fen);
    // Make the move to check the resulting position
    const to = move.to as Square;
    game.move({
      from: move.from as Square,
      to,
      promotion: move.promotion as "q" | "r" | "b" | "n" | undefined,
    });

    // After the move, check if our piece is attacked
    const opponentColor: Color = movingPiece.color === "w" ? "b" : "w";
    const isNowAttacked = game.isAttacked(to, opponentColor);

    if (isNowAttacked && delta < (PIECE_VALUES[movingPiece.type] || 0)) {
      // The piece might be captured, making the material delta worse
      // Only flag this if the capture would lose material
      delta -= PIECE_VALUES[movingPiece.type] || 0;
    }
  }

  return delta;
}


// ============================================================
// BOARD STATE QUERIES
// ============================================================

/**
 * Count all material on the board for both sides.
 *
 * @param fen - The position in FEN notation
 * @returns Material count for white and black in centipawns
 */
export function countMaterial(fen: string): {
  white: number;
  black: number;
  difference: number;
} {
  const game = new Chess(fen);
  let white = 0;
  let black = 0;

  const squares: Square[] = [];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];
  for (const f of files) {
    for (const r of ranks) {
      squares.push((f + r) as Square);
    }
  }

  for (const sq of squares) {
    const piece = game.get(sq);
    if (piece) {
      const value = PIECE_VALUES[piece.type] || 0;
      if (piece.color === "w") {
        white += value;
      } else {
        black += value;
      }
    }
  }

  return {
    white,
    black,
    difference: white - black, // Positive = White has more material
  };
}

/**
 * Get all legal moves in a position.
 *
 * @param fen - The position in FEN notation
 * @returns Array of legal moves with details
 */
export function getLegalMoves(fen: string): Move[] {
  try {
    const game = new Chess(fen);
    return game.moves({ verbose: true });
  } catch {
    return [];
  }
}

/**
 * Count the number of legal moves in a position.
 *
 * @param fen - The position in FEN notation
 * @returns Number of legal moves
 */
export function countLegalMoves(fen: string): number {
  return getLegalMoves(fen).length;
}

/**
 * Check if a position is check, checkmate, or stalemate.
 *
 * @param fen - The position in FEN notation
 */
export function getPositionStatus(fen: string): {
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  turn: "w" | "b";
} {
  try {
    const game = new Chess(fen);
    return {
      isCheck: game.isCheck(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw(),
      isGameOver: game.isGameOver(),
      turn: game.turn(),
    };
  } catch {
    return {
      isCheck: false,
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      isGameOver: false,
      turn: "w",
    };
  }
}

/**
 * Get which side is to move from a FEN string.
 *
 * @param fen - The position in FEN notation
 * @returns "white" or "black"
 */
export function getSideToMove(fen: string): "white" | "black" {
  const parts = fen.split(" ");
  return parts[1] === "w" ? "white" : "black";
}

/**
 * Get the full move number from a FEN string.
 *
 * @param fen - The position in FEN notation
 * @returns The full move number (starts at 1)
 */
export function getMoveNumber(fen: string): number {
  const parts = fen.split(" ");
  return parseInt(parts[5]) || 1;
}

/**
 * Check if a square is attacked by a given color.
 *
 * @param fen    - The position in FEN notation
 * @param square - The square to check (e.g., "e4")
 * @param byColor - Which color is attacking ("w" or "b")
 * @returns true if the square is attacked
 */
export function isSquareAttacked(
  fen: string,
  square: string,
  byColor: "w" | "b"
): boolean {
  try {
    const game = new Chess(fen);
    return game.isAttacked(square as Square, byColor as Color);
  } catch {
    return false;
  }
}

/**
 * Get the piece on a specific square.
 *
 * @param fen    - The position in FEN notation
 * @param square - The square to check (e.g., "e4")
 * @returns The piece, or null if the square is empty
 */
export function getPieceAt(
  fen: string,
  square: string
): { type: string; color: "w" | "b"; name: string } | null {
  try {
    const game = new Chess(fen);
    const piece = game.get(square as Square);
    if (piece) {
      return {
        type: piece.type,
        color: piece.color,
        name: PIECE_NAMES[piece.type] || piece.type,
      };
    }
    return null;
  } catch {
    return null;
  }
}


// ============================================================
// SQUARE NAMING UTILITIES
// ============================================================

/**
 * Get a human-readable description of a square.
 *
 * "e4" → "the e4 square"
 * "d1" → "the d1 square"
 */
export function describeSquare(square: string): string {
  return `the ${square} square`;
}

/**
 * Get a human-readable description of a piece on a square.
 *
 * ("n", "f3") → "the knight on f3"
 * ("q", "d1") → "the queen on d1"
 */
export function describePiece(pieceType: string, square: string): string {
  const name = PIECE_NAMES[pieceType.toLowerCase()] || "piece";
  return `the ${name} on ${square}`;
}

/**
 * Get a human-readable description of a move.
 *
 * This creates a plain-English description of what a move does.
 *
 * Examples:
 *   "Knight moves from g1 to f3"
 *   "Pawn captures on d5"
 *   "Kingside castling"
 *   "Pawn promotes to queen on e8"
 */
export function describeMove(moveInfo: MoveInfo): string {
  const pieceName =
    moveInfo.pieceName.charAt(0).toUpperCase() + moveInfo.pieceName.slice(1);

  if (moveInfo.isCastling) {
    return moveInfo.isKingsideCastling
      ? "Kingside castling — bringing the king to safety and connecting the rooks"
      : "Queenside castling — bringing the king toward the center and activating the rook";
  }

  if (moveInfo.isPromotion) {
    const promoName = PIECE_NAMES[moveInfo.promotionPiece || "q"] || "queen";
    if (moveInfo.isCapture) {
      return `Pawn captures on ${moveInfo.to} and promotes to a ${promoName}`;
    }
    return `Pawn promotes to a ${promoName} on ${moveInfo.to}`;
  }

  if (moveInfo.isEnPassant) {
    return `Pawn captures en passant on ${moveInfo.to}`;
  }

  if (moveInfo.isCapture) {
    const capturedName = moveInfo.capturedPieceName || "piece";
    return `${pieceName} captures the ${capturedName} on ${moveInfo.to}`;
  }

  return `${pieceName} moves from ${moveInfo.from} to ${moveInfo.to}`;
}


// ============================================================
// FEN UTILITIES
// ============================================================

/** The starting position in FEN notation */
export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Validate that a FEN string is well-formed.
 *
 * @param fen - The FEN string to validate
 * @returns true if the FEN is valid
 */
export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply a UCI move to a FEN position and return the new FEN.
 *
 * @param fen     - The position before the move
 * @param uciMove - The move in UCI notation
 * @returns The new FEN after the move, or null if the move is illegal
 */
export function applyMove(fen: string, uciMove: string): string | null {
  try {
    const game = new Chess(fen);

    const from = uciMove.substring(0, 2) as Square;
    const to = uciMove.substring(2, 4) as Square;
    const promotion = uciMove.length === 5 ? uciMove[4] : undefined;

    const move = game.move({
      from,
      to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });

    return move ? game.fen() : null;
  } catch {
    return null;
  }
}

/**
 * Check if a UCI move is legal in a given position.
 *
 * @param fen     - The position
 * @param uciMove - The move to check
 * @returns true if the move is legal
 */
export function isLegalMove(fen: string, uciMove: string): boolean {
  return applyMove(fen, uciMove) !== null;
}

/**
 * Get all legal UCI moves from a position.
 *
 * @param fen - The position
 * @returns Array of legal moves in UCI notation
 */
export function getLegalMovesUci(fen: string): string[] {
  const moves = getLegalMoves(fen);
  return moves.map((m) => {
    let uci = m.from + m.to;
    if (m.promotion) uci += m.promotion;
    return uci;
  });
}


// ============================================================
// GAME RESULT DETECTION
// ============================================================

/**
 * Check if the game is over and why.
 *
 * @param fen - The current position
 * @returns Game result information, or null if the game continues
 */
export function checkGameEnd(fen: string): {
  isOver: boolean;
  result: "white" | "black" | "draw" | null;
  reason: string | null;
} {
  try {
    const game = new Chess(fen);

    if (game.isCheckmate()) {
      // The side to move is in checkmate — the OTHER side wins
      const winner = game.turn() === "w" ? "black" : "white";
      return {
        isOver: true,
        result: winner,
        reason: "Checkmate",
      };
    }

    if (game.isStalemate()) {
      return {
        isOver: true,
        result: "draw",
        reason: "Stalemate — the player to move has no legal moves but is not in check",
      };
    }

    if (game.isThreefoldRepetition()) {
      return {
        isOver: true,
        result: "draw",
        reason: "Draw by threefold repetition — the same position has occurred three times",
      };
    }

    if (game.isInsufficientMaterial()) {
      return {
        isOver: true,
        result: "draw",
        reason: "Draw by insufficient material — neither side has enough pieces to deliver checkmate",
      };
    }

    if (game.isDraw()) {
      return {
        isOver: true,
        result: "draw",
        reason: "Draw by the fifty-move rule — 50 moves have been made without a capture or pawn move",
      };
    }

    return { isOver: false, result: null, reason: null };
  } catch {
    return { isOver: false, result: null, reason: null };
  }
}


// ============================================================
// POSITION DESCRIPTION HELPERS
// ============================================================
// These functions generate descriptive text about positions,
// used by the natural language generation module.
// ============================================================

/**
 * Describe the material balance in plain English.
 *
 * Examples:
 *   "Material is equal"
 *   "White is up a knight (3.2 pawns)"
 *   "Black has the bishop pair and an extra pawn"
 */
export function describeMaterialBalance(fen: string): string {
  const material = countMaterial(fen);
  const diff = material.difference; // Positive = White has more

  if (Math.abs(diff) < 50) {
    return "Material is equal";
  }

  const side = diff > 0 ? "White" : "Black";
  const absDiff = Math.abs(diff);

  if (absDiff < 150) {
    return `${side} is up a pawn`;
  } else if (absDiff < 350) {
    return `${side} is up a minor piece (about ${(absDiff / 100).toFixed(1)} pawns worth)`;
  } else if (absDiff < 550) {
    return `${side} has the exchange (rook for minor piece)`;
  } else if (absDiff < 950) {
    return `${side} is up a rook`;
  } else {
    return `${side} has a massive material advantage (${(absDiff / 100).toFixed(1)} pawns worth)`;
  }
}

/**
 * Describe the king safety situation briefly.
 *
 * @param fen - The position
 * @returns A description of king safety for both sides
 */
export function describeKingSafety(fen: string): string {
  const piecePart = fen.split(" ")[0];

  // Very basic king safety heuristic:
  // Check if kings have castled (king on g1/c1 or g8/c8)
  const descriptions: string[] = [];

  // Find king positions
  const game = new Chess(fen);
  const squares: Square[] = [];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];
  for (const f of files) {
    for (const r of ranks) {
      squares.push((f + r) as Square);
    }
  }

  let whiteKingSquare = "";
  let blackKingSquare = "";

  for (const sq of squares) {
    const piece = game.get(sq);
    if (piece && piece.type === "k") {
      if (piece.color === "w") whiteKingSquare = sq;
      else blackKingSquare = sq;
    }
  }

  // Check if castled
  if (whiteKingSquare === "g1" || whiteKingSquare === "h1") {
    descriptions.push("White has castled kingside");
  } else if (whiteKingSquare === "c1" || whiteKingSquare === "b1") {
    descriptions.push("White has castled queenside");
  } else if (whiteKingSquare === "e1") {
    descriptions.push("White has not yet castled");
  }

  if (blackKingSquare === "g8" || blackKingSquare === "h8") {
    descriptions.push("Black has castled kingside");
  } else if (blackKingSquare === "c8" || blackKingSquare === "b8") {
    descriptions.push("Black has castled queenside");
  } else if (blackKingSquare === "e8") {
    descriptions.push("Black has not yet castled");
  }

  return descriptions.join(". ") || "King positions are standard";
}