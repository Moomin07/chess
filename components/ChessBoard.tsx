// @ts-nocheck
// ============================================================
// ChessMind Coach — Chess Board (react-chessboard v5.10.0)
// ============================================================

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

  // ── Promotion State ──
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

  // Build square styles for highlights
  const squareStyles = useMemo(() => {
    const styles = {};

    // Last move highlighting
    if (lastMove) {
      styles[lastMove[0]] = { backgroundColor: "rgba(255, 255, 0, 0.3)" };
      styles[lastMove[1]] = { backgroundColor: "rgba(255, 255, 0, 0.4)" };
    }

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(59, 130, 246, 0.5)" };
    }

    // Legal move dots
    for (const sq of legalMoveSquares) {
      styles[sq] = {
        background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 25%)",
      };
    }

    return styles;
  }, [lastMove, selectedSquare, legalMoveSquares]);

  if (!mounted) {
    return (
      <div
        className={`bg-zinc-800 rounded-lg flex items-center justify-center w-full max-w-[480px] aspect-square ${className}`}
      >
        <div className="text-zinc-500 text-sm">Loading board...</div>
      </div>
    );
  }

  // ── Handle Promotion Selection ──
  function onPromotionPieceSelect(piece) {
    // piece comes in as "wQ", "bN", etc.
    // If the user clicks outside the dialog to cancel, piece will be undefined
    if (piece && moveFrom && moveTo) {
      const promotionPiece = piece[1].toLowerCase(); // "q", "r", "b", "n"
      onMove(moveFrom, moveTo, promotionPiece);
    }

    // Reset promotion state
    setMoveFrom(null);
    setMoveTo(null);
    setShowPromotionDialog(false);
    return true;
  }

  // ── Build the v5 options object ──
  const boardOptions = {
    // Position
    position: fen,

    // Orientation
    boardOrientation: orientation,

    // Styling
    boardStyle: {
      borderRadius: "4px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
    },
    darkSquareStyle: { backgroundColor: "#779952" },
    lightSquareStyle: { backgroundColor: "#edeed1" },
    squareStyles: squareStyles,

    // Animation
    animationDurationInMs: 200,
    showAnimations: true,

    // ── Promotion Properties ──
    promotionToSquare: moveTo,
    showPromotionDialog: showPromotionDialog,
    onPromotionPieceSelect: onPromotionPieceSelect,

    // Dragging
    allowDragging: interactive,

    // Can this piece be dragged?
    canDragPiece: ({ piece, square }) => {
      if (!interactive) return false;
      const pieceColor = piece[0] === "w" ? "white" : "black";
      const turnColor = fen.split(" ")[1] === "w" ? "white" : "black";
      return pieceColor === turnColor;
    },

    // Handle piece drop (drag and release)
    onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
      if (!interactive) return false;

      const isPawn = piece[1] === "P";
      const isLastRank =
        (piece[0] === "w" && targetSquare[1] === "8") ||
        (piece[0] === "b" && targetSquare[1] === "1");
      const isPromotion = isPawn && isLastRank;

      // FIXED: Intercept promotions to show the visual dialog
      if (isPromotion) {
        setMoveFrom(sourceSquare);
        setMoveTo(targetSquare);
        setShowPromotionDialog(true);
        return false; // Reject the drop temporarily until they select a piece
      }

      try {
        const chess = new Chess(fen);
        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
        });

        if (move) {
          onMove(sourceSquare, targetSquare);
          return true;
        }

        return false;
      } catch (err) {
        return false;
      }
    },

    // Handle square click (click-to-move)
    onSquareClick: ({ piece, square }) => {
      if (!interactive) return;

      // If a piece is selected and this is a legal destination
      if (selectedSquare && legalMoveSquares.includes(square)) {
        const chess = new Chess(fen);
        const selectedPiece = chess.get(selectedSquare);

        const isPawn = selectedPiece?.type === "p";
        const isLastRank = square[1] === "8" || square[1] === "1";
        const isPromotion = isPawn && isLastRank;

        // FIXED: Show the dialog for click-to-move promotions too
        if (isPromotion) {
          setMoveFrom(selectedSquare);
          setMoveTo(square);
          setShowPromotionDialog(true);

          setSelectedSquare(null);
          setLegalMoveSquares([]);
          return;
        }

        // Otherwise, make a normal move
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        return;
      }

      // Select this square and show legal moves
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
    <div className={`w-full max-w-[480px] aspect-square ${className}`}>
      <Chessboard options={boardOptions} />
    </div>
  );
}