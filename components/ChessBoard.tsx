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
  const [boardWidth, setBoardWidth] = useState(480);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoveSquares([]);
  }, [fen]);

  useEffect(() => {
    const updateSize = () => {
      const maxW = Math.min(window.innerWidth - 80, 560);
      const maxH = window.innerHeight - 200;
      setBoardWidth(Math.min(maxW, maxH, 480));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
        className={`bg-zinc-800 rounded-lg flex items-center justify-center ${className}`}
        style={{ width: boardWidth, height: boardWidth }}
      >
        <div className="text-zinc-500 text-sm">Loading board...</div>
      </div>
    );
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
      console.log("=== PIECE DROPPED ===");
      console.log("From:", sourceSquare, "To:", targetSquare, "Piece:", piece);

      if (!interactive) return false;

      try {
        const chess = new Chess(fen);

        // Check for promotion
        const isPawn = piece[1] === "P";
        const isLastRank =
          (piece[0] === "w" && targetSquare[1] === "8") ||
          (piece[0] === "b" && targetSquare[1] === "1");
        const isPromotion = isPawn && isLastRank;

        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: isPromotion ? "q" : undefined,
        });

        if (move) {
          console.log("Valid move:", move.san);
          onMove(sourceSquare, targetSquare, isPromotion ? "q" : undefined);
          return true;
        }

        console.log("Invalid move — chess.js rejected");
        return false;
      } catch (err) {
        console.log("Move error:", err);
        return false;
      }
    },

    // Handle square click (click-to-move)
    onSquareClick: ({ piece, square }) => {
      console.log("=== SQUARE CLICKED ===", square, "piece:", piece);

      if (!interactive) return;

      // If a piece is selected and this is a legal destination
      if (selectedSquare && legalMoveSquares.includes(square)) {
        console.log("Moving:", selectedSquare, "→", square);
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        setLegalMoveSquares([]);
        return;
      }

      // Select this square and show legal moves
      const moves = getLegalMovesForSquare(square);
      console.log("Legal moves from", square, ":", moves);
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
    <div className={className} style={{ width: boardWidth }}>
      <Chessboard options={boardOptions} />
    </div>
  );
}