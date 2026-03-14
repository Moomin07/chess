
import { Chess, Square, Piece, Move, Color } from "chess.js";

export const PIECE_VALUES: Record<string, number> = {
  p: 100,   
  n: 320,   
  b: 330,   
  r: 500,   
  q: 900,   
  k: 0,    
};

export const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

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



/**
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
        break;
      }
    }
  } catch {
  }

  return sanMoves;
}

/**
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


export interface MoveInfo {
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

  isSacrifice: boolean;    
  materialDelta: number; 

  givesDoubleCheck: boolean;
  isKingsideCastling: boolean;
  isQueensideCastling: boolean;
}


/**
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

  const movingPiece = game.get(from) ?? null;

  const targetPiece = game.get(to) ?? null;

  const move = game.move({
    from,
    to,
    promotion: promotion as "q" | "r" | "b" | "n" | undefined,
  });

  if (!move) {
    return createDefaultMoveInfo(uciMove);
  }

  const isSacrifice = detectSacrifice(fen, from, to, movingPiece, targetPiece);

  const materialDelta = calculateMaterialDelta(
    movingPiece,
    targetPiece,
    move,
    fen
  );

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
    givesDoubleCheck: false,
    isKingsideCastling,
    isQueensideCastling,
  };
}

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

  const movingPieceValue = PIECE_VALUES[movingPiece.type] || 0;
  const capturedValue = targetPiece ? PIECE_VALUES[targetPiece.type] || 0 : 0;

  const game = new Chess(fen);
  const opponentColor: Color = movingPiece.color === "w" ? "b" : "w";
  const isAttacked = game.isAttacked(to, opponentColor);

  if (!isAttacked) {
    return false;
  }
  if (capturedValue >= movingPieceValue) {
    return false; 
  }


  const materialRisk = movingPieceValue - capturedValue;
  return materialRisk >= 100;
}



function calculateMaterialDelta(
  movingPiece: Piece | null,
  targetPiece: Piece | null,
  move: Move,
  fen: string
): number {
  let delta = 0;

  if (targetPiece) {
    delta += PIECE_VALUES[targetPiece.type] || 0;
  }

  if (move.flags.includes("e")) {
    delta += PIECE_VALUES["p"]; 
  }

  if (move.promotion) {
    delta += (PIECE_VALUES[move.promotion] || 0) - PIECE_VALUES["p"];
  }

  
  if (movingPiece && movingPiece.type !== "k") {
    const game = new Chess(fen);
    const to = move.to as Square;
    game.move({
      from: move.from as Square,
      to,
      promotion: move.promotion as "q" | "r" | "b" | "n" | undefined,
    });

    const opponentColor: Color = movingPiece.color === "w" ? "b" : "w";
    const isNowAttacked = game.isAttacked(to, opponentColor);

    if (isNowAttacked && delta < (PIECE_VALUES[movingPiece.type] || 0)) {
      delta -= PIECE_VALUES[movingPiece.type] || 0;
    }
  }

  return delta;
}




/**@param fen - The position in FEN notation
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
    difference: white - black, 
  };
}

/**
  @param fen - The position in FEN notation
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
 @param fen - The position in FEN notation
 * @returns Number of legal moves
 */
export function countLegalMoves(fen: string): number {
  return getLegalMoves(fen).length;
}

/**
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
 * @param fen - The position in FEN notation
 * @returns "white" or "black"
 */
export function getSideToMove(fen: string): "white" | "black" {
  const parts = fen.split(" ");
  return parts[1] === "w" ? "white" : "black";
}

/**@param fen - The position in FEN notation
 * @returns The full move number (starts at 1)
 */
export function getMoveNumber(fen: string): number {
  const parts = fen.split(" ");
  return parseInt(parts[5]) || 1;
}

/**
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


export function describeSquare(square: string): string {
  return `the ${square} square`;
}

export function describePiece(pieceType: string, square: string): string {
  const name = PIECE_NAMES[pieceType.toLowerCase()] || "piece";
  return `the ${name} on ${square}`;
}


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



export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
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




/**
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


export function describeMaterialBalance(fen: string): string {
  const material = countMaterial(fen);
  const diff = material.difference; 

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
 * @param fen - The position
 * @returns A description of king safety for both sides
 */
export function describeKingSafety(fen: string): string {
  const piecePart = fen.split(" ")[0];


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