
export enum MoveClassification {
  BRILLIANT   = "brilliant", 
  GREAT       = "great",       
  BEST        = "best",       
  EXCELLENT   = "excellent",   
  GOOD        = "good",        
  BOOK        = "book",        
  INACCURACY  = "inaccuracy", 
  MISTAKE     = "mistake",     
  BLUNDER     = "blunder",    
  MISS        = "miss",       
  FORCED      = "forced",     
}


export const CLASSIFICATION_DISPLAY: Record<MoveClassification, {
  symbol: string;
  label: string;
  color: string;        
  bgColor: string;     
  description: string; 
}> = {
  [MoveClassification.BRILLIANT]: {
    symbol: "!!",
    label: "Brilliant",
    color: "text-cyan-300",
    bgColor: "bg-cyan-500/20",
    description: "An exceptional move involving sacrifice or deep calculation",
  },
  [MoveClassification.GREAT]: {
    symbol: "!",
    label: "Great",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    description: "A strong move that demonstrates excellent understanding",
  },
  [MoveClassification.BEST]: {
    symbol: "✓",
    label: "Best",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    description: "The engine's top recommendation",
  },
  [MoveClassification.EXCELLENT]: {
    symbol: "○",
    label: "Excellent",
    color: "text-green-300",
    bgColor: "bg-green-400/20",
    description: "Very close to the best move",
  },
  [MoveClassification.GOOD]: {
    symbol: "●",
    label: "Good",
    color: "text-lime-400",
    bgColor: "bg-lime-500/20",
    description: "A reasonable move with minor imprecision",
  },
  [MoveClassification.BOOK]: {
    symbol: "⊘",
    label: "Book",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    description: "A known opening theory move",
  },
  [MoveClassification.INACCURACY]: {
    symbol: "?!",
    label: "Inaccuracy",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    description: "A noticeable error — a better move was available",
  },
  [MoveClassification.MISTAKE]: {
    symbol: "?",
    label: "Mistake",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    description: "A significant error that worsens your position",
  },
  [MoveClassification.BLUNDER]: {
    symbol: "??",
    label: "Blunder",
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    description: "A game-changing error",
  },
  [MoveClassification.MISS]: {
    symbol: "△",
    label: "Miss",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    description: "You missed a winning opportunity",
  },
  [MoveClassification.FORCED]: {
    symbol: "⊙",
    label: "Forced",
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    description: "The only legal move in the position",
  },
};




export enum CoachingLevel {
  BEGINNER     = "beginner",     
  INTERMEDIATE = "intermediate", 
  ADVANCED     = "advanced",     
}

export const COACHING_LEVEL_DISPLAY: Record<CoachingLevel, {
  label: string;
  description: string;
  maxVariationDepth: number;  
  maxWords: number;           
}> = {
  [CoachingLevel.BEGINNER]: {
    label: "Beginner",
    description: "Simple explanations with everyday language and helpful analogies",
    maxVariationDepth: 3,
    maxWords: 150,
  },
  [CoachingLevel.INTERMEDIATE]: {
    label: "Intermediate",
    description: "Standard chess terminology with moderate-depth analysis",
    maxVariationDepth: 6,
    maxWords: 200,
  },
  [CoachingLevel.ADVANCED]: {
    label: "Advanced",
    description: "Concise, technical analysis with deep variations",
    maxVariationDepth: 15,
    maxWords: 200,
  },
};



export enum GamePhase {
  OPENING    = "opening",
  MIDDLEGAME = "middlegame",
  ENDGAME    = "endgame",
}


export type PlayerColor = "white" | "black";



export interface EngineEvaluation {
 
  centipawns: number | null;

  mate: number | null;

  depth: number;

  selectiveDepth: number;

  winProbability: number;
  drawProbability: number;
  lossProbability: number;

  bestMove: string;

  ponderMove: string | null;

  principalVariation: string[];

  nodes: number;

  nodesPerSecond: number;

  timeMs: number;
}

export interface PVLine {
  rank: number;

  score: {
    centipawns?: number; 
    mate?: number;        
  };

  wdl?: {
    win: number;
    draw: number;  
    loss: number;   
  };

  moves: string[];

  depth: number;
}
export interface MultiPVAnalysis {
  lines: PVLine[];
  depth: number;
  totalNodes: number;
  timeMs: number;
}

export enum TacticalMotif {
  FORK              = "fork",
  PIN               = "pin",
  SKEWER            = "skewer",
  DISCOVERED_ATTACK = "discovered_attack",
  DISCOVERED_CHECK  = "discovered_check",
  DOUBLE_CHECK      = "double_check",
  BACK_RANK_MATE    = "back_rank_mate",
  OVERLOADED_PIECE  = "overloaded_piece",
  DEFLECTION        = "deflection",
  DECOY             = "decoy",
  INTERFERENCE      = "interference",
  HANGING_PIECE     = "hanging_piece",
  TRAPPED_PIECE     = "trapped_piece",
  GREEK_GIFT        = "greek_gift",
  SMOTHERED_MATE    = "smothered_mate",
  REMOVAL_OF_GUARD  = "removal_of_guard",
  ZWISCHENZUG       = "zwischenzug",
  SACRIFICE         = "sacrifice",
  PROMOTION_THREAT  = "promotion_threat",
  CHECKMATE_THREAT  = "checkmate_threat",
}

export const TACTICAL_MOTIF_DISPLAY: Record<TacticalMotif, {
  label: string;
  description: string;
  beginnerExplanation: string;
}> = {
  [TacticalMotif.FORK]: {
    label: "Fork",
    description: "One piece attacks two or more enemy pieces simultaneously",
    beginnerExplanation: "Your piece is attacking two of their pieces at once — they can only save one!",
  },
  [TacticalMotif.PIN]: {
    label: "Pin",
    description: "A piece cannot move because it would expose a more valuable piece behind it",
    beginnerExplanation: "Their piece is stuck — if it moves, you capture the more valuable piece hiding behind it",
  },
  [TacticalMotif.SKEWER]: {
    label: "Skewer",
    description: "An attack on a valuable piece that forces it to move, exposing a piece behind it",
    beginnerExplanation: "You're attacking their valuable piece, and when it runs away, you grab the piece behind it",
  },
  [TacticalMotif.DISCOVERED_ATTACK]: {
    label: "Discovered Attack",
    description: "Moving one piece reveals an attack from another piece behind it",
    beginnerExplanation: "By moving one piece out of the way, another piece behind it suddenly attacks something",
  },
  [TacticalMotif.DISCOVERED_CHECK]: {
    label: "Discovered Check",
    description: "Moving one piece reveals a check from another piece behind it",
    beginnerExplanation: "You move a piece and surprise — the piece behind it is now checking the king!",
  },
  [TacticalMotif.DOUBLE_CHECK]: {
    label: "Double Check",
    description: "Two pieces give check simultaneously — the king must move",
    beginnerExplanation: "Two of your pieces are checking the king at once — they MUST move their king, they can't block both",
  },
  [TacticalMotif.BACK_RANK_MATE]: {
    label: "Back Rank Mate",
    description: "Checkmate delivered on the back rank, where the king is trapped by its own pawns",
    beginnerExplanation: "The king is trapped by its own pawns on the back row, and a rook or queen delivers checkmate",
  },
  [TacticalMotif.OVERLOADED_PIECE]: {
    label: "Overloaded Piece",
    description: "A piece that is defending two things at once and cannot handle both duties",
    beginnerExplanation: "Their piece is trying to guard two things at once — attack one, and the other falls",
  },
  [TacticalMotif.DEFLECTION]: {
    label: "Deflection",
    description: "Forcing a defensive piece away from its critical duty",
    beginnerExplanation: "You force their defender to move away, leaving what it was guarding unprotected",
  },
  [TacticalMotif.DECOY]: {
    label: "Decoy",
    description: "Luring a piece to a specific square where it becomes vulnerable",
    beginnerExplanation: "You trick their piece into moving to a bad square where you can take advantage",
  },
  [TacticalMotif.INTERFERENCE]: {
    label: "Interference",
    description: "Placing a piece between an enemy piece and the square it controls",
    beginnerExplanation: "You block the connection between their piece and what it was protecting",
  },
  [TacticalMotif.HANGING_PIECE]: {
    label: "Hanging Piece",
    description: "An undefended piece that can be captured for free",
    beginnerExplanation: "A piece is left unprotected — it can be taken for free!",
  },
  [TacticalMotif.TRAPPED_PIECE]: {
    label: "Trapped Piece",
    description: "A piece that has no safe squares to move to",
    beginnerExplanation: "Their piece has nowhere safe to go — it's stuck and can be captured",
  },
  [TacticalMotif.GREEK_GIFT]: {
    label: "Greek Gift Sacrifice",
    description: "A bishop sacrifice on h7 (or h2) to expose the castled king",
    beginnerExplanation: "A classic bishop sacrifice that rips open the king's defenses for a devastating attack",
  },
  [TacticalMotif.SMOTHERED_MATE]: {
    label: "Smothered Mate",
    description: "A knight delivers checkmate while the king is surrounded by its own pieces",
    beginnerExplanation: "The king is boxed in by its own pieces, and a knight delivers the final blow",
  },
  [TacticalMotif.REMOVAL_OF_GUARD]: {
    label: "Removal of the Guard",
    description: "Capturing or chasing away a key defensive piece",
    beginnerExplanation: "You take out the bodyguard, leaving the important piece it was protecting defenseless",
  },
  [TacticalMotif.ZWISCHENZUG]: {
    label: "Zwischenzug (In-Between Move)",
    description: "An unexpected intermediate move inserted before the expected recapture",
    beginnerExplanation: "Instead of taking back right away, you throw in a sneaky move first that improves your position",
  },
  [TacticalMotif.SACRIFICE]: {
    label: "Sacrifice",
    description: "Deliberately giving up material for positional or tactical compensation",
    beginnerExplanation: "You give up a piece on purpose because you'll get something even better in return",
  },
  [TacticalMotif.PROMOTION_THREAT]: {
    label: "Promotion Threat",
    description: "A pawn is threatening to reach the other end of the board and become a queen",
    beginnerExplanation: "A pawn is about to become a queen — this is a huge threat that must be dealt with!",
  },
  [TacticalMotif.CHECKMATE_THREAT]: {
    label: "Checkmate Threat",
    description: "A move threatens to deliver checkmate on the next move",
    beginnerExplanation: "Watch out — this move threatens to end the game with checkmate next turn!",
  },
};



export interface AnalysisResult {
  classification: MoveClassification;
  centipawnLoss: number;

  evalBefore: EngineEvaluation;   
  evalAfter: EngineEvaluation;    
  bestMove: string;              
  bestMoveSan: string;            
  playedMove: string;           
  playedMoveSan: string;

  topMoves: PVLine[];            

  layers: {
    descriptive: string;   
    evaluative: string;    
    consequential: string; 
    corrective: string;     
    strategic: string;      
    coachingTip: string;  
  };

  isBookMove: boolean;
  openingName: string | null;
  openingEco: string | null;
  tacticalMotifs: TacticalMotif[];
  gamePhase: GamePhase;
  threats: string[];             

  analysisTimeMs: number;      
}



export interface MoveRecord {
  moveNumber: number;           
  color: PlayerColor;          
  san: string;                   
  uci: string;                    

  fenBefore: string;            
  fenAfter: string;            

  analysis: AnalysisResult | null;

  isAnalyzing: boolean;

  timestamp: number;
}




export interface BotLevel {
  level: number;         
  name: string;          
  elo: number;           
  description: string;   
  skillLevel: number;    
  depth: number;         
  thinkTimeMs: number;   
  randomness: number;     
}

export const BOT_LEVELS: BotLevel[] = [
  {
    level: 1, name: "Absolute Beginner", elo: 400,
    description: "Just learned how the pieces move. Makes many random-looking moves.",
    skillLevel: 0, depth: 1, thinkTimeMs: 200, randomness: 0.7,
  },
  {
    level: 2, name: "Beginner", elo: 600,
    description: "Knows basic rules but has no strategy. Hangs pieces often.",
    skillLevel: 1, depth: 2, thinkTimeMs: 300, randomness: 0.6,
  },
  {
    level: 3, name: "Novice", elo: 800,
    description: "Can spot simple one-move captures but misses most tactics.",
    skillLevel: 3, depth: 3, thinkTimeMs: 400, randomness: 0.5,
  },
  {
    level: 4, name: "Casual Player", elo: 1000,
    description: "Understands basic opening principles. Occasionally finds tactics.",
    skillLevel: 5, depth: 4, thinkTimeMs: 500, randomness: 0.4,
  },
  {
    level: 5, name: "Improving Beginner", elo: 1100,
    description: "Developing pattern recognition. Sometimes makes good moves, sometimes blunders.",
    skillLevel: 6, depth: 5, thinkTimeMs: 600, randomness: 0.35,
  },
  {
    level: 6, name: "Intermediate", elo: 1200,
    description: "Solid grasp of basics. Can see 2-move tactics. Still makes positional errors.",
    skillLevel: 7, depth: 6, thinkTimeMs: 800, randomness: 0.3,
  },
  {
    level: 7, name: "Club Beginner", elo: 1300,
    description: "Would hold their own at a casual chess club. Decent opening knowledge.",
    skillLevel: 8, depth: 7, thinkTimeMs: 1000, randomness: 0.25,
  },
  {
    level: 8, name: "Club Player", elo: 1400,
    description: "Understands chess strategy. Finds most 2-3 move combinations.",
    skillLevel: 9, depth: 8, thinkTimeMs: 1200, randomness: 0.2,
  },
  {
    level: 9, name: "Experienced Club", elo: 1500,
    description: "Good tactical awareness and reasonable positional play.",
    skillLevel: 10, depth: 9, thinkTimeMs: 1500, randomness: 0.18,
  },
  {
    level: 10, name: "Strong Club", elo: 1600,
    description: "Rarely blunders. Has a repertoire of openings. Solid endgame basics.",
    skillLevel: 11, depth: 10, thinkTimeMs: 1800, randomness: 0.15,
  },
  {
    level: 11, name: "Tournament Player", elo: 1700,
    description: "Competitive tournament player. Good all-around chess understanding.",
    skillLevel: 12, depth: 11, thinkTimeMs: 2000, randomness: 0.12,
  },
  {
    level: 12, name: "Strong Tournament", elo: 1800,
    description: "Deep tactical calculation and solid positional instincts.",
    skillLevel: 13, depth: 12, thinkTimeMs: 2200, randomness: 0.1,
  },
  {
    level: 13, name: "Expert", elo: 1900,
    description: "Near-expert level play. Strong opening preparation and endgame technique.",
    skillLevel: 14, depth: 13, thinkTimeMs: 2500, randomness: 0.08,
  },
  {
    level: 14, name: "Candidate Master", elo: 2000,
    description: "Candidate Master strength. Very few tactical oversights.",
    skillLevel: 15, depth: 14, thinkTimeMs: 2800, randomness: 0.06,
  },
  {
    level: 15, name: "Strong Expert", elo: 2100,
    description: "Very strong player with deep strategic understanding.",
    skillLevel: 16, depth: 15, thinkTimeMs: 3000, randomness: 0.05,
  },
  {
    level: 16, name: "FIDE Master", elo: 2300,
    description: "FIDE Master level. Exceptional calculation and positional judgment.",
    skillLevel: 17, depth: 16, thinkTimeMs: 3200, randomness: 0.03,
  },
  {
    level: 17, name: "International Master", elo: 2450,
    description: "International Master level. World-class tactical vision.",
    skillLevel: 18, depth: 18, thinkTimeMs: 3500, randomness: 0.02,
  },
  {
    level: 18, name: "Grandmaster", elo: 2600,
    description: "Grandmaster level. Near-perfect play in most positions.",
    skillLevel: 19, depth: 20, thinkTimeMs: 4000, randomness: 0.01,
  },
  {
    level: 19, name: "Super Grandmaster", elo: 2800,
    description: "Super Grandmaster. Makes world-championship-level moves.",
    skillLevel: 20, depth: 24, thinkTimeMs: 4500, randomness: 0.005,
  },
  {
    level: 20, name: "Full Engine", elo: 3500,
    description: "Unrestricted Stockfish. The strongest chess entity on Earth.",
    skillLevel: 20, depth: 30, thinkTimeMs: 5000, randomness: 0,
  },
];


export interface GameState {
  id: string;

  fen: string;

  moves: MoveRecord[];

  playerColor: PlayerColor;
  botLevel: BotLevel;
  coachingLevel: CoachingLevel;

  gamePhase: GamePhase;
  isGameOver: boolean;
  isPlayerTurn: boolean;
  result: GameResult | null;

  startTime: number;

  currentMoveIndex: number;

  currentOpening: string | null;
  currentEco: string | null;
  isInBook: boolean;

  evalHistory: EvalHistoryEntry[];
}



export interface GameResult {
  winner: PlayerColor | "draw";
  reason: GameEndReason;
  description: string;
}

export enum GameEndReason {
  CHECKMATE          = "checkmate",
  RESIGNATION        = "resignation",
  TIMEOUT            = "timeout",
  STALEMATE          = "stalemate",
  THREEFOLD_REP      = "threefold_repetition",
  FIVEFOLD_REP       = "fivefold_repetition",
  FIFTY_MOVE         = "fifty_move_rule",
  INSUFFICIENT       = "insufficient_material",
  AGREEMENT          = "draw_agreement",
}


export interface EvalHistoryEntry {
  moveNumber: number;
  color: PlayerColor;
  san: string;
  evaluation: number;      
  winProbability: number;   
  classification: MoveClassification;
}


export interface OpeningInfo {
  name: string;               
  eco: string;                
  moves: string;               
  description: string;          
  whitePlan: string;           
  blackPlan: string;           
  keyThemes: string[];         
}



export interface EngineCommand {
  type: "uci" | "isready" | "position" | "go" | "stop" | "quit" | "setoption";
  fen?: string;
  moves?: string[];
  depth?: number;
  moveTime?: number;
  multiPV?: number;
  optionName?: string;
  optionValue?: string | number;
}

export interface EngineResponse {
  type: "uciok" | "readyok" | "bestmove" | "info" | "error";
  bestMove?: string;
  ponderMove?: string;
  info?: EngineInfoLine;
  error?: string;
}

export interface EngineInfoLine {
  depth?: number;
  selectiveDepth?: number;
  multiPV?: number;
  score?: {
    centipawns?: number;
    mate?: number;
    upperBound?: boolean;
    lowerBound?: boolean;
  };
  nodes?: number;
  nodesPerSecond?: number;
  timeMs?: number;
  pv?: string[];
  wdl?: {
    win: number;
    draw: number;
    loss: number;
  };
}


export interface BoardHighlight {
  square: string;                
  color: string;               
}

export interface BoardArrow {
  from: string;                 
  to: string;                  
  color: string;              
}

export interface AppSettings {
  coachingLevel: CoachingLevel;
  boardTheme: "default" | "brown" | "blue" | "green";
  pieceTheme: "default" | "neo" | "classic";
  showEvalBar: boolean;
  showAnalysis: boolean;
  showArrows: boolean;
  showHints: boolean;
  autoAnalysis: boolean;      
  soundEnabled: boolean;
  animationSpeed: "slow" | "normal" | "fast";
}

export const DEFAULT_SETTINGS: AppSettings = {
  coachingLevel: CoachingLevel.INTERMEDIATE,
  boardTheme: "default",
  pieceTheme: "default",
  showEvalBar: true,
  showAnalysis: true,
  showArrows: true,
  showHints: true,
  autoAnalysis: true,
  soundEnabled: true,
  animationSpeed: "normal",
};