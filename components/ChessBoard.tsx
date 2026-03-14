// @ts-nocheck

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

interface ChessBoardProps {
  fen: string;
  orientation: "white" | "black";
  interactive: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
  getLegalMoves: (square: string) => string[];
  lastMove?: [string, string] | null;
  className?: string;
}

export default function ChessBoard({
  fen,
  orientation,
  interactive,
  onMove,
  getLegalMoves: getLegalMovesForSquare,
  lastMove,
  className = "",
}: ChessBoardProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoveSquares, setLegalMoveSquares] = useState([]);

  const [moveFrom, setMoveFrom] = useState(null);
  const [moveTo, setMoveTo] = useState(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
  }, [fen]);

  const squareStyles = useMemo(() => {
    const styles = {};
    if (lastMove) {
      styles[lastMove[0]] = { backgroundColor: "rgba(255, 255, 0, 0.3)" };
      styles[lastMove[1]] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
    }
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(255, 255, 255, 0.2)" };
    }
    for (const sq of legalMoveSquares) {
      styles[sq] = {
        background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
      };
    }
    return styles;
  }, [lastMove, selectedSquare, legalMoveSquares]);

  if (!mounted) {
    return (
      <div className={`bg-[#262421] rounded-sm flex items-center justify-center w-full aspect-square ${className}`}>
        <div className="text-zinc-500 text-sm font-bold">Loading board...</div>
      </div>
    );
  }

  function onPromotionPieceSelect(piece) {
    if (piece && moveFrom && moveTo) {
      const promotionPiece = piece[1].toLowerCase(); 
      onMove(moveFrom, moveTo, promotionPiece);
    }
    setMoveFrom(null);
    setMoveTo(null);
    setShowPromotionDialog(false);
    return true;
  }

  const boardOptions = {
    position: fen,
    boardOrientation: orientation,
    boardStyle: {
      borderRadius: "4px",
    },
    darkSquareStyle: { backgroundColor: "#779952" },
    lightSquareStyle: { backgroundColor: "#edeed1" },
    squareStyles: squareStyles,
    animationDurationInMs: 200,
    showAnimations: true,
    promotionToSquare: moveTo,
    showPromotionDialog: showPromotionDialog,
    onPromotionPieceSelect: onPromotionPieceSelect,
    allowDragging: interactive,
    canDragPiece: ({ piece, square }) => {
      if (!interactive) return false;
      const pieceColor = piece[0] === "w" ? "white" : "black";
      const turnColor = fen.split(" ")[1] === "w" ? "white" : "black";
      return pieceColor === turnColor;
    },
    onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
      if (!interactive) return false;
      const isPawn = piece[1] === "P";
      const isLastRank =
        (piece[0] === "w" && targetSquare[1] === "8") ||
        (piece[0] === "b" && targetSquare[1] === "1");
      const isPromotion = isPawn && isLastRank;

      if (isPromotion) {
        setMoveFrom(sourceSquare);
        setMoveTo(targetSquare);
        setShowPromotionDialog(true);
        return false; 
      }

      try {
        const chess = new Chess(fen);
        const move = chess.move({ from: sourceSquare, to: targetSquare });
        if (move) {
          onMove(sourceSquare, targetSquare);
          return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    },
    onSquareClick: ({ piece, square }) => {
      if (!interactive) return;
      if (selectedSquare && legalMoveSquares.includes(square)) {
        const chess = new Chess(fen);
        const selectedPiece = chess.get(selectedSquare);
        const isPawn = selectedPiece?.type === "p";
        const isLastRank = square[1] === "8" || square[1] === "1";
        const isPromotion = isPawn && isLastRank;

        if (isPromotion) {
          setMoveFrom(selectedSquare);
          setMoveTo(square);
          setShowPromotionDialog(true);
          setSelectedSquare(null);
          setLegalMoveSquares([]);
          return;
        }

        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        return;
      }
      const moves = getLegalMovesForSquare(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoveSquares(moves);
      } else {
        setSelectedSquare(null);
        setLegalMoveSquares([]);
      }
    },
  };

  return (
    <div className={`w-full aspect-square ${className}`}>
      <Chessboard options={boardOptions} />
    </div>
  );
}