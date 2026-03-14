
import {
  MoveClassification,
  CoachingLevel,
  GamePhase,
  TacticalMotif,
  TACTICAL_MOTIF_DISPLAY,
  PVLine,
} from "@/lib/types";

import {
  MoveInfo,
  PIECE_NAMES,
  PIECE_VALUES,
  uciToSan,
  uciSequenceToSan,
  formatVariation,
  describeMaterialBalance,
  describeKingSafety,
  getSideToMove,
  getMoveNumber,
} from "@/lib/chess-utils";

import {
  describeEvaluation,
  formatEvaluation,
  centipawnsToWinProbability,
} from "@/engine/uci-parser";


export interface TemplateInput {
  moveInfo: MoveInfo;
  classification: MoveClassification;
  centipawnLoss: number;

  evalBeforeCp: number;          
  evalAfterCp: number;           
  mateBefore: number | null;     
  mateAfter: number | null;     
  bestMoveUci: string;           
  bestMoveSan: string;           
  bestMoveEvalCp: number;        
  topMoves: PVLine[];            
  fenBefore: string;            
  fenAfter: string;              
  gamePhase: GamePhase;
  moveNumber: number;
  playerColor: "white" | "black";
  isPlayerMove: boolean;        

  isBookMove: boolean;
  openingName: string | null;
  openingEco: string | null;

  tacticalMotifs: TacticalMotif[];
  threats: string[];

  coachingLevel: CoachingLevel;
}


export interface TemplateOutput {
  descriptive: string;    
  evaluative: string;     
  consequential: string;   
  corrective: string;      
  strategic: string;       
  coachingTip: string;    
}


export function generateAnalysis(input: TemplateInput): TemplateOutput {
  return {
    descriptive: generateDescriptiveLayer(input),
    evaluative: generateEvaluativeLayer(input),
    consequential: generateConsequentialLayer(input),
    corrective: generateCorrectiveLayer(input),
    strategic: generateStrategicLayer(input),
    coachingTip: generateCoachingTip(input),
  };
}



function generateDescriptiveLayer(input: TemplateInput): string {
  const { moveInfo, classification, isBookMove, openingName, coachingLevel } = input;
  const parts: string[] = [];

  if (isBookMove && openingName) {
    return generateBookMoveDescription(input);
  }

  if (moveInfo.isCheckmate) {
    return "Checkmate! The game is over. The king has no escape — " +
      `${moveInfo.pieceName} delivers the final blow on ${moveInfo.to}.`;
  }

  if (moveInfo.isCastling) {
    parts.push(generateCastlingDescription(moveInfo, coachingLevel));
  } else if (moveInfo.isPromotion) {
    parts.push(generatePromotionDescription(moveInfo, coachingLevel));
  } else if (moveInfo.isCapture) {
    parts.push(generateCaptureDescription(moveInfo, input));
  } else {
    parts.push(generateQuietMoveDescription(moveInfo, input));
  }

  if (moveInfo.isCheck && !moveInfo.isCheckmate) {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      parts.push("This also puts the opponent's king in check — they must deal with it immediately.");
    } else {
      parts.push("Check.");
    }
  }

  if (input.tacticalMotifs.length > 0) {
    parts.push(generateMotifDescription(input.tacticalMotifs, coachingLevel));
  }

  return parts.join(" ");
}

function generateBookMoveDescription(input: TemplateInput): string {
  const { openingName, openingEco, moveInfo, coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `This move (${moveInfo.san}) is a well-known opening move. ` +
      `You are playing the ${openingName || "a standard opening"}` +
      `${openingEco ? ` (code: ${openingEco})` : ""}. ` +
      `This means many strong players have played this exact same move in this position — you're on the right track!`;
  }

  return `Book move: ${moveInfo.san}. This is theory in the ${openingName || "current opening"}` +
    `${openingEco ? ` (${openingEco})` : ""}. ` +
    `This position has been reached thousands of times in master games.`;
}

function generateCastlingDescription(
  moveInfo: MoveInfo,
  level: CoachingLevel
): string {
  const side = moveInfo.isKingsideCastling ? "kingside" : "queenside";

  if (level === CoachingLevel.BEGINNER) {
    if (moveInfo.isKingsideCastling) {
      return "Castling kingside! This is one of the most important moves in chess. " +
        "Your king moves to a safe spot behind your pawns on the right side of the board, " +
        "and your rook swings to the center where it can be more active. " +
        "Two benefits in one move — safety and activity.";
    }
    return "Castling queenside! Your king moves to the left side of the board " +
      "for safety, and your rook jumps over to help control the center. " +
      "Queenside castling is a bit more aggressive — your king is slightly less " +
      "sheltered, but your rook is already active.";
  }

  return `${side.charAt(0).toUpperCase() + side.slice(1)} castling — ` +
    `tucking the king away and connecting the rooks.`;
}

function generatePromotionDescription(
  moveInfo: MoveInfo,
  level: CoachingLevel
): string {
  const promoName = PIECE_NAMES[moveInfo.promotionPiece || "q"] || "queen";

  if (level === CoachingLevel.BEGINNER) {
    return `The pawn has reached the other end of the board and transforms into a ${promoName}! ` +
      `This is called promotion — your humble pawn just became one of the most powerful pieces.` +
      (moveInfo.isCapture ? ` It also captured a piece on the way!` : "");
  }

  return `Pawn promotes to ${promoName} on ${moveInfo.to}` +
    (moveInfo.isCapture ? " with capture" : "") + ".";
}

function generateCaptureDescription(
  moveInfo: MoveInfo,
  input: TemplateInput
): string {
  const { coachingLevel } = input;
  const capName = moveInfo.capturedPieceName || "piece";
  const pieceName = moveInfo.pieceName;
  const capValue = PIECE_VALUES[moveInfo.capturedPiece || "p"] || 0;
  const pieceValue = PIECE_VALUES[moveInfo.piece] || 0;

  if (moveInfo.isEnPassant) {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      return `This is a special move called "en passant" (French for "in passing"). ` +
        `Your pawn captures the opponent's pawn that just moved two squares past it. ` +
        `The captured pawn was on ${moveInfo.to}, but it gets taken as if it only moved one square.`;
    }
    return `En passant capture on ${moveInfo.to}.`;
  }

  if (coachingLevel === CoachingLevel.BEGINNER) {
    if (capValue > pieceValue) {
      return `Your ${pieceName} captures the ${capName} on ${moveInfo.to}. ` +
        `Great trade! A ${capName} is worth more than a ${pieceName}, ` +
        `so you come out ahead in this exchange.`;
    } else if (capValue < pieceValue) {
      return `Your ${pieceName} takes the ${capName} on ${moveInfo.to}. ` +
        `Be careful — a ${pieceName} is worth more than a ${capName}. ` +
        `Unless there's a good reason for this trade, you might be losing material.`;
    }
    return `Your ${pieceName} captures the ${capName} on ${moveInfo.to}. ` +
      `This is an even trade — both pieces are worth about the same.`;
  }

  if (moveInfo.isSacrifice) {
    return `${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} ` +
      `captures on ${moveInfo.to} — a sacrifice, giving up the ${pieceName} ` +
      `for the ${capName}.`;
  }

  return `${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} ` +
    `captures ${capName} on ${moveInfo.to}.`;
}

function generateQuietMoveDescription(
  moveInfo: MoveInfo,
  input: TemplateInput
): string {
  const { coachingLevel, gamePhase } = input;
  const pieceName = moveInfo.pieceName;
  const piece = moveInfo.piece;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    switch (piece) {
      case "p":
        return generateBeginnerPawnDescription(moveInfo, gamePhase);
      case "n":
        return `Your knight hops to ${moveInfo.to}. ` +
          `Knights are tricky — they can jump over other pieces and attack from unexpected angles.`;
      case "b":
        return `Your bishop slides to ${moveInfo.to}. ` +
          `Bishops are great at controlling long diagonals across the board.`;
      case "r":
        return `Your rook moves to ${moveInfo.to}. ` +
          `Rooks are powerful on open files (columns with no pawns blocking them).`;
      case "q":
        return `Your queen moves to ${moveInfo.to}. ` +
          `The queen is your strongest piece — she can move in any direction.`;
      case "k":
        return `Your king moves to ${moveInfo.to}. ` +
          `Keep your king safe — if it gets trapped, the game is over!`;
      default:
        return `${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} moves to ${moveInfo.to}.`;
    }
  }

  return `${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} ` +
    `to ${moveInfo.to}` +
    (moveInfo.isSacrifice ? " (sacrifice — moving to an attacked square)" : "") +
    ".";
}

function generateBeginnerPawnDescription(
  moveInfo: MoveInfo,
  phase: GamePhase
): string {
  const from = moveInfo.from;
  const to = moveInfo.to;
  const fromRank = parseInt(from[1]);
  const toRank = parseInt(to[1]);

  if (Math.abs(toRank - fromRank) === 2) {
    return `Your pawn advances two squares to ${to}. ` +
      `This is a strong opening move — it stakes a claim in the center of the board.`;
  }

  if (to[0] === "d" || to[0] === "e") {
    return `Your pawn pushes to ${to}, helping you control the center. ` +
      `Controlling the center is one of the most important chess principles — ` +
      `pieces placed in the center control more squares.`;
  }

  if (phase === GamePhase.ENDGAME) {
    return `Your pawn advances to ${to}. In the endgame, pushing pawns ` +
      `toward promotion is often the key to winning — each step closer to ` +
      `becoming a queen!`;
  }

  return `Your pawn moves to ${to}.`;
}

function generateMotifDescription(
  motifs: TacticalMotif[],
  level: CoachingLevel
): string {
  if (motifs.length === 0) return "";

  const descriptions = motifs.map((motif) => {
    const display = TACTICAL_MOTIF_DISPLAY[motif];
    if (level === CoachingLevel.BEGINNER) {
      return display.beginnerExplanation;
    }
    return `This involves a ${display.label.toLowerCase()}: ${display.description.toLowerCase()}.`;
  });

  return descriptions.join(" ");
}


function generateEvaluativeLayer(input: TemplateInput): string {
  const {
    classification,
    centipawnLoss,
    evalBeforeCp,
    evalAfterCp,
    mateBefore,
    mateAfter,
    coachingLevel,
    isPlayerMove,
    moveInfo,
  } = input;

  const who = isPlayerMove ? "Your" : "The bot's";
  const evalDesc = describeEvaluation(evalAfterCp);

  switch (classification) {
    case MoveClassification.BRILLIANT:
      return generateBrilliantEvaluation(input);

    case MoveClassification.GREAT:
      if (coachingLevel === CoachingLevel.BEGINNER) {
        return `${who} move is excellent! This is a strong move that shows good chess understanding. ${evalDesc}.`;
      }
      return `Strong move. ${evalDesc}. This move demonstrates good positional and tactical awareness.`;

    case MoveClassification.BEST:
      if (coachingLevel === CoachingLevel.BEGINNER) {
        return `${who} move is the best one available — exactly what the computer recommends! ${evalDesc}.`;
      }
      return `Best move. ${evalDesc}.`;

    case MoveClassification.EXCELLENT:
      if (coachingLevel === CoachingLevel.BEGINNER) {
        return `${who} move is very close to perfect — only a tiny difference from the absolute best move. ${evalDesc}.`;
      }
      return `Excellent move, only ${centipawnLoss} centipawns from the top engine choice. ${evalDesc}.`;

    case MoveClassification.GOOD:
      if (coachingLevel === CoachingLevel.BEGINNER) {
        return `${who} move is reasonable, but there was a slightly better option available. ` +
          `Don't worry — the difference is small. ${evalDesc}.`;
      }
      return `Decent move, ${centipawnLoss}cp from the best option. ${evalDesc}.`;

    case MoveClassification.BOOK:
      return generateBookEvaluation(input);

    case MoveClassification.INACCURACY:
      return generateInaccuracyEvaluation(input);

    case MoveClassification.MISTAKE:
      return generateMistakeEvaluation(input);

    case MoveClassification.BLUNDER:
      return generateBlunderEvaluation(input);

    case MoveClassification.MISS:
      return generateMissEvaluation(input);

    case MoveClassification.FORCED:
      if (coachingLevel === CoachingLevel.BEGINNER) {
        return `This was the only legal move available — there was no choice to make. ${evalDesc}.`;
      }
      return `Forced — only legal move. ${evalDesc}.`;

    default:
      return evalDesc + ".";
  }
}

function generateBrilliantEvaluation(input: TemplateInput): string {
  const { coachingLevel, evalAfterCp, moveInfo } = input;
  const evalDesc = describeEvaluation(evalAfterCp);

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `Brilliant move!! This is an exceptional move — the kind that chess masters play. ` +
      `${moveInfo.isSacrifice ? "You gave up material on purpose because you saw something deeper. " : ""}` +
      `${evalDesc}. Amazing find!`;
  }

  return `Brilliant!! ${moveInfo.isSacrifice ? "A deep sacrifice that the engine confirms as best. " : ""}` +
    `${evalDesc}. This move required exceptional calculation or intuition.`;
}

function generateBookEvaluation(input: TemplateInput): string {
  const { coachingLevel, openingName } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `This is a well-known opening move that has been played by thousands of chess players. ` +
      `${openingName ? `You are in the "${openingName}" opening. ` : ""}` +
      `Book moves are neither good nor bad to evaluate — they are established theory.`;
  }

  return `Theory move${openingName ? ` in the ${openingName}` : ""}. ` +
    `This line has been extensively analyzed and tested in practice.`;
}

function generateInaccuracyEvaluation(input: TemplateInput): string {
  const { centipawnLoss, coachingLevel, evalBeforeCp, evalAfterCp, isPlayerMove } = input;
  const who = isPlayerMove ? "Your" : "The bot's";
  const evalDesc = describeEvaluation(evalAfterCp);

  const beforeWin = centipawnsToWinProbability(evalBeforeCp);
  const afterWin = centipawnsToWinProbability(evalAfterCp);
  const winDrop = Math.abs(beforeWin - afterWin);

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `${who} move is okay, but there was a noticeably better option. ` +
      `You lost about ${(centipawnLoss / 100).toFixed(1)} pawns worth of advantage. ` +
      `Think of it like this: your win chances dropped by about ${winDrop.toFixed(0)}%. ` +
      `${evalDesc}.`;
  }

  return `Inaccuracy — ${centipawnLoss}cp loss. ${evalDesc}. ` +
    `Win probability shifted by ${winDrop.toFixed(1)}%.`;
}

function generateMistakeEvaluation(input: TemplateInput): string {
  const { centipawnLoss, coachingLevel, evalBeforeCp, evalAfterCp, isPlayerMove } = input;
  const who = isPlayerMove ? "Your" : "The bot's";
  const evalDesc = describeEvaluation(evalAfterCp);

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `${who} move is a significant mistake. ` +
      `You lost about ${(centipawnLoss / 100).toFixed(1)} pawns worth of advantage — ` +
      `that's like giving away a free piece! ` +
      `Before this move, ${describeEvaluation(evalBeforeCp)}. ` +
      `After this move, ${evalDesc.toLowerCase()}. ` +
      `There was a much better move available.`;
  }

  return `Mistake — ${centipawnLoss}cp loss. The position went from ` +
    `${formatEvaluation(evalBeforeCp, null)} to ${formatEvaluation(evalAfterCp, null)}. ` +
    `${evalDesc}.`;
}

function generateBlunderEvaluation(input: TemplateInput): string {
  const { centipawnLoss, coachingLevel, evalBeforeCp, evalAfterCp, mateAfter, isPlayerMove } = input;
  const who = isPlayerMove ? "Your" : "The bot's";

  if (mateAfter !== null && mateAfter < 0) {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      return `${who} move is a serious blunder! It allows your opponent to force checkmate ` +
        `in ${Math.abs(mateAfter)} moves. Before this move, the game was still playable. ` +
        `Always check if your move leaves your king in danger!`;
    }
    return `Blunder — allows forced mate in ${Math.abs(mateAfter)}. ` +
      `Position collapsed from ${formatEvaluation(evalBeforeCp, null)} to M${mateAfter}.`;
  }

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `${who} move is a blunder — a game-changing mistake! ` +
      `You lost ${(centipawnLoss / 100).toFixed(1)} pawns worth of advantage. ` +
      `Before: ${describeEvaluation(evalBeforeCp).toLowerCase()}. ` +
      `After: ${describeEvaluation(evalAfterCp).toLowerCase()}. ` +
      `This is the kind of move that can turn a winning game into a losing one.`;
  }

  return `Blunder — ${centipawnLoss}cp loss. Evaluation swung from ` +
    `${formatEvaluation(evalBeforeCp, null)} to ${formatEvaluation(evalAfterCp, null)}. ` +
    `${describeEvaluation(evalAfterCp)}.`;
}

function generateMissEvaluation(input: TemplateInput): string {
  const { centipawnLoss, coachingLevel, bestMoveSan, isPlayerMove } = input;
  const who = isPlayerMove ? "You" : "The bot";

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `${who} missed an important opportunity! The move ${bestMoveSan} ` +
      `would have been much stronger — it was worth ${(centipawnLoss / 100).toFixed(1)} ` +
      `pawns more than what was played. Always look for tactical shots before making quiet moves!`;
  }

  return `Missed opportunity — ${bestMoveSan} was ${centipawnLoss}cp better. ` +
    `A significant tactic was available in this position.`;
}



function generateConsequentialLayer(input: TemplateInput): string {
  const { topMoves, fenBefore, coachingLevel, moveInfo, classification, mateAfter } = input;

  if (mateAfter !== null) {
    return generateMateSequence(input);
  }

  const bestLine = topMoves[0];
  if (!bestLine || bestLine.moves.length <= 1) {
    return "The position is complex and requires careful play from both sides.";
  }

  const continuationMoves = bestLine.moves.slice(1); 
  if (continuationMoves.length === 0) {
    return "The engine expects this position to simplify quickly.";
  }

  const maxDepth =
    coachingLevel === CoachingLevel.BEGINNER
      ? 3
      : coachingLevel === CoachingLevel.INTERMEDIATE
      ? 6
      : 12;

  const limitedMoves = continuationMoves.slice(0, maxDepth);

  const isWhiteToMove = getSideToMove(fenBefore) === "white";
  const moveNum = getMoveNumber(fenBefore);

  const variation = formatVariation(
    fenBefore,
    [moveInfo.uci, ...limitedMoves],
    moveNum,
    isWhiteToMove
  );

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `After your move, the most likely continuation is: ${variation}. ` +
      `Don't worry about memorizing this — just be aware that your opponent ` +
      `will probably respond in a logical way.`;
  }

  if (coachingLevel === CoachingLevel.INTERMEDIATE) {
    return `The expected continuation is: ${variation}. ` +
      `Both sides should follow this general plan for the next few moves.`;
  }

  return `Principal variation: ${variation}`;
}

function generateMateSequence(input: TemplateInput): string {
  const { mateAfter, topMoves, fenBefore, moveInfo, coachingLevel } = input;

  if (mateAfter === null) return "";

  const bestLine = topMoves[0];
  if (!bestLine) return `Forced mate in ${Math.abs(mateAfter)} moves.`;

  const isWhiteToMove = getSideToMove(fenBefore) === "white";
  const moveNum = getMoveNumber(fenBefore);

  const variation = formatVariation(
    fenBefore,
    [moveInfo.uci, ...bestLine.moves.slice(1)],
    moveNum,
    isWhiteToMove
  );

  if (mateAfter > 0) {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      return `From here, there is a forced checkmate in ${mateAfter} moves! ` +
        `The winning sequence is: ${variation}. The opponent cannot escape.`;
    }
    return `Forced mate in ${mateAfter}: ${variation}`;
  } else {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      return `Unfortunately, this allows your opponent to force checkmate in ` +
        `${Math.abs(mateAfter)} moves. The sequence would be: ${variation}.`;
    }
    return `Allows mate in ${Math.abs(mateAfter)}: ${variation}`;
  }
}



function generateCorrectiveLayer(input: TemplateInput): string {
  const {
    classification,
    centipawnLoss,
    bestMoveUci,
    bestMoveSan,
    bestMoveEvalCp,
    evalAfterCp,
    topMoves,
    fenBefore,
    coachingLevel,
    moveInfo,
    isPlayerMove,
  } = input;

  if (
    classification === MoveClassification.BEST ||
    classification === MoveClassification.BRILLIANT ||
    classification === MoveClassification.GREAT ||
    classification === MoveClassification.BOOK ||
    classification === MoveClassification.FORCED ||
    centipawnLoss === 0
  ) {
    if (classification === MoveClassification.BEST ||
        classification === MoveClassification.BRILLIANT ||
        classification === MoveClassification.GREAT) {
      return "You found the best move — no improvement needed!";
    }
    return "";
  }

  if (classification === MoveClassification.EXCELLENT) {
    return `The engine slightly prefers ${bestMoveSan}, but your move is almost equally good.`;
  }

  if (classification === MoveClassification.GOOD) {
    if (coachingLevel === CoachingLevel.BEGINNER) {
      return `The best move was ${bestMoveSan}. It was slightly better than your move, ` +
        `but the difference is small — don't worry too much about this one.`;
    }
    return `Best was ${bestMoveSan} (${formatEvaluation(bestMoveEvalCp, null)} vs ` +
      `${formatEvaluation(evalAfterCp, null)}).`;
  }

  const bestLine = topMoves[0];
  const bestPV = bestLine ? bestLine.moves : [];

  const bestMoveExplanation = explainBestMove(
    bestMoveSan,
    bestMoveUci,
    bestPV,
    fenBefore,
    coachingLevel
  );

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return `Instead of ${moveInfo.san}, you should have played ${bestMoveSan}. ` +
      `${bestMoveExplanation} ` +
      `This would have kept your advantage at ${(bestMoveEvalCp / 100).toFixed(1)} pawns ` +
      `instead of dropping to ${(evalAfterCp / 100).toFixed(1)}.`;
  }

  if (coachingLevel === CoachingLevel.INTERMEDIATE) {
    const isWhiteToMove = getSideToMove(fenBefore) === "white";
    const moveNum = getMoveNumber(fenBefore);
    const variation = formatVariation(fenBefore, bestPV.slice(0, 6), moveNum, isWhiteToMove);

    return `The best move was ${bestMoveSan}. ${bestMoveExplanation} ` +
      `Continuation: ${variation}. ` +
      `Eval: ${formatEvaluation(bestMoveEvalCp, null)} vs your ` +
      `${formatEvaluation(evalAfterCp, null)}.`;
  }

  // Advanced
  const isWhiteToMove = getSideToMove(fenBefore) === "white";
  const moveNum = getMoveNumber(fenBefore);
  const variation = formatVariation(fenBefore, bestPV.slice(0, 12), moveNum, isWhiteToMove);

  return `Best: ${bestMoveSan} (${formatEvaluation(bestMoveEvalCp, null)}). ` +
    `Line: ${variation}. ` +
    `Played: ${moveInfo.san} (${formatEvaluation(evalAfterCp, null)}, -${centipawnLoss}cp).`;
}

function explainBestMove(
  bestMoveSan: string,
  bestMoveUci: string,
  bestPV: string[],
  fenBefore: string,
  level: CoachingLevel
): string {

  const from = bestMoveUci.substring(0, 2);
  const to = bestMoveUci.substring(2, 4);

  if (bestMoveUci.length === 5) {
    return "This promotes a pawn, gaining a powerful new piece.";
  }

  if (level === CoachingLevel.BEGINNER) {
    return `This move improves your position by placing your piece more actively on ${to}.`;
  }

  return `${bestMoveSan} is more accurate, improving piece placement and position control.`;
}



function generateStrategicLayer(input: TemplateInput): string {
  const { gamePhase, fenBefore, fenAfter, coachingLevel, openingName, isBookMove, moveNumber } = input;

  const parts: string[] = [];

  parts.push(generatePhaseDescription(gamePhase, moveNumber, coachingLevel));

  if (gamePhase === GamePhase.OPENING && openingName) {
    parts.push(generateOpeningContext(openingName, coachingLevel));
  }

  const materialDesc = describeMaterialBalance(fenAfter);
  if (materialDesc !== "Material is equal") {
    parts.push(materialDesc + ".");
  }

  if (gamePhase !== GamePhase.ENDGAME) {
    const kingSafety = describeKingSafety(fenAfter);
    if (kingSafety && coachingLevel !== CoachingLevel.ADVANCED) {
      parts.push(kingSafety + ".");
    }
  }

  return parts.join(" ");
}

function generatePhaseDescription(
  phase: GamePhase,
  moveNumber: number,
  level: CoachingLevel
): string {
  if (level === CoachingLevel.BEGINNER) {
    switch (phase) {
      case GamePhase.OPENING:
        return `We are in the opening (move ${moveNumber}). The main goals right now are: ` +
          `control the center, develop your pieces (bring them out from the back row), ` +
          `and castle your king to safety.`;
      case GamePhase.MIDDLEGAME:
        return `We are in the middlegame (move ${moveNumber}). The opening is over — ` +
          `now it's time to create a plan. Look for tactics (forks, pins, skewers), ` +
          `try to improve your worst-placed piece, and think about attacking your opponent's king.`;
      case GamePhase.ENDGAME:
        return `We are in the endgame (move ${moveNumber}). With fewer pieces on the board, ` +
          `kings become active fighters and pawns become crucial — every pawn could become a queen! ` +
          `Focus on promoting your pawns and activating your king.`;
    }
  }

  switch (phase) {
    case GamePhase.OPENING:
      return `Opening phase, move ${moveNumber}.`;
    case GamePhase.MIDDLEGAME:
      return `Middlegame, move ${moveNumber}.`;
    case GamePhase.ENDGAME:
      return `Endgame, move ${moveNumber}.`;
  }
}

function generateOpeningContext(
  openingName: string,
  level: CoachingLevel
): string {
  if (level === CoachingLevel.BEGINNER) {
    return `You are playing the ${openingName}. Every opening has a plan — ` +
      `try to follow the natural development of your pieces and don't move the same piece twice ` +
      `unless there's a good reason.`;
  }

  return `Opening: ${openingName}.`;
}

function generateCoachingTip(input: TemplateInput): string {
  const { classification, coachingLevel, moveInfo, gamePhase, tacticalMotifs } = input;

  switch (classification) {
    case MoveClassification.BRILLIANT:
    case MoveClassification.GREAT:
      return selectPositiveTip(input);

    case MoveClassification.BEST:
      return selectBestMoveTip(input);

    case MoveClassification.EXCELLENT:
    case MoveClassification.GOOD:
      return selectSmallImprovementTip(input);

    case MoveClassification.INACCURACY:
      return selectInaccuracyTip(input);

    case MoveClassification.MISTAKE:
      return selectMistakeTip(input);

    case MoveClassification.BLUNDER:
      return selectBlunderTip(input);

    case MoveClassification.MISS:
      return selectMissTip(input);

    case MoveClassification.BOOK:
      return selectBookTip(input);

    case MoveClassification.FORCED:
      return "When only one move is legal, use the time to plan ahead — think about what you'll do after your opponent responds.";

    default:
      return selectGeneralTip(gamePhase, coachingLevel);
  }
}

function selectPositiveTip(input: TemplateInput): string {
  const tips = [
    "Great job finding this move! Trust your instincts — when a move feels right AND you've verified it with calculation, play it confidently.",
    "You spotted a deep idea here. Keep training your pattern recognition by solving tactical puzzles daily.",
    "This kind of move wins games. The ability to see beyond the obvious separates strong players from average ones.",
    "Excellent calculation! Remember this pattern — similar positions may arise in future games.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectBestMoveTip(input: TemplateInput): string {
  const { gamePhase, coachingLevel } = input;

  if (gamePhase === GamePhase.OPENING) {
    return "You found the best move in the opening. Good opening preparation saves time and builds strong positions.";
  }
  if (gamePhase === GamePhase.ENDGAME) {
    return "Precise endgame play! In endgames, accuracy matters more than creativity. Each move should have a clear purpose.";
  }

  const tips = [
    "Perfect move. Consistency like this is what builds a high accuracy percentage over time.",
    "You matched the engine's top choice. Focus on maintaining this level of precision throughout the game.",
    "Strong move selection. Remember: the best move isn't always the flashiest — sometimes it's the quiet move that improves your position.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectSmallImprovementTip(input: TemplateInput): string {
  const tips = [
    "Your move was good, but look for ways to make it great. Before playing, ask yourself: 'Is there anything even better?'",
    "Try the 'candidate moves' technique: identify your top 3 options, then compare them before deciding. You might find the best one.",
    "Small imprecisions add up over a game. Aim for the best move, not just a good move.",
    "Before each move, take 10 seconds to scan the board for tactics. This habit catches opportunities you might otherwise miss.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectInaccuracyTip(input: TemplateInput): string {
  const { gamePhase, coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    const tips = [
      "Before making your move, always ask yourself: 'What is my opponent threatening?' Checking for danger first prevents many mistakes.",
      "Try to look at the whole board, not just the area where the action is. Opportunities can be anywhere.",
      "A good habit: after thinking of a move, imagine making it and then look at the board from your opponent's eyes. What would THEY do?",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  const tips = [
    "Inaccuracies often come from autopilot play. Take an extra moment on every move to verify your choice.",
    "Consider your opponent's best response before committing to your move. This 'response check' catches many inaccuracies.",
    "When several moves look similar, calculate one move deeper for each option. The difference often reveals itself in the opponent's reply.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectMistakeTip(input: TemplateInput): string {
  const { moveInfo, coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return "After every move your opponent makes, do a quick 'safety check': Are any of my pieces attacked? " +
      "Are any of my pieces undefended? Is my king safe? This simple habit prevents most mistakes.";
  }

  if (moveInfo.isCapture) {
    return "Before capturing, always check: is the recapture favorable? Does it open lines against you? " +
      "Don't capture automatically — each trade changes the character of the position.";
  }

  const tips = [
    "Mistakes often happen when we stop calculating too early. Try to see at least one move deeper before deciding.",
    "If you feel uncertain about a move, that's your chess instinct telling you to look harder. Trust that feeling and search for alternatives.",
    "Use the 'Blunder Check': before pressing the clock, spend 5 seconds asking 'Does my move hang a piece or allow a tactic?'",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectBlunderTip(input: TemplateInput): string {
  const { coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return "Everyone blunders — even grandmasters! The key is to learn from each one. " +
      "The number one way to avoid blunders is to ALWAYS check if your move leaves a piece undefended " +
      "or allows a fork, pin, or skewer. Make this a habit before every single move.";
  }

  const tips = [
    "Blunders usually happen when we play too quickly or get tunnel vision on our own plan. " +
      "Always consider your opponent's threats before executing your idea.",
    "The most common cause of blunders is not checking for 'in-between moves' (zwischenzugs). " +
      "Before assuming a sequence will play out as planned, check if your opponent has a surprising intermediate move.",
    "When your position is tense, slow down. The critical moments are exactly when you need to invest the most time thinking.",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}

function selectMissTip(input: TemplateInput): string {
  const { coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return "You missed a winning opportunity here. Before making a quiet move, always scan for checks, captures, " +
      "and threats — in that order. This 'Checks-Captures-Threats' routine helps you spot winning moves.";
  }

  return "Train your tactical vision: before making a positional move, spend 10 seconds looking for " +
    "forcing moves (checks, captures, threats). The most common missed opportunities are tactical shots " +
    "that were available but overlooked because we were focused on strategic plans.";
}

function selectBookTip(input: TemplateInput): string {
  const { coachingLevel } = input;

  if (coachingLevel === CoachingLevel.BEGINNER) {
    return "You're following known opening theory — that's great! As you improve, try to understand WHY each " +
      "opening move is played, not just memorize the moves. Understanding the ideas behind the moves will help " +
      "you find good moves even when you're out of your preparation.";
  }

  return "Good opening preparation. Remember that the goal of the opening is not just to follow theory, " +
    "but to reach a middlegame position you understand and are comfortable playing.";
}

function selectGeneralTip(phase: GamePhase, level: CoachingLevel): string {
  if (level === CoachingLevel.BEGINNER) {
    switch (phase) {
      case GamePhase.OPENING:
        return "Opening tip: Develop all your pieces before attacking. Knights and bishops should come out before you start pushing pawns aggressively.";
      case GamePhase.MIDDLEGAME:
        return "Middlegame tip: Ask yourself 'What is the worst-placed piece on my side?' Then find a way to improve it. This is called 'improving your worst piece.'";
      case GamePhase.ENDGAME:
        return "Endgame tip: In the endgame, your king becomes a fighter! Bring it to the center where it can support your pawns and attack your opponent's.";
    }
  }

  switch (phase) {
    case GamePhase.OPENING:
      return "Remember the opening principles: control the center, develop pieces, castle early, connect rooks.";
    case GamePhase.MIDDLEGAME:
      return "In the middlegame, create a concrete plan before making moves. Random moves without a plan lead to drifting and gradual deterioration.";
    case GamePhase.ENDGAME:
      return "Endgame technique: king activity, pawn structure, and piece coordination become paramount. Every tempo matters.";
  }
}