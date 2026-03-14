//manages two stockfish interfaces

import {
  StockfishService,
  SearchResult,
  AnalyzeOptions,
  BotSearchOptions,
} from "./stockfish-service";
import type { BotLevel, PVLine } from "@/lib/types";

export type EngineStatus =
  | "not_initialized"  
  | "initializing"    
  | "ready"         
  | "error";           

export type AnalysisProgressCallback = (lines: PVLine[]) => void;


let instance: EngineManager | null = null;



export class EngineManager {
  private analysisEngine: StockfishService;
  private botEngine: StockfishService;

  private status: EngineStatus = "not_initialized";
  private currentBotLevel: BotLevel | null = null;
  private initPromise: Promise<void> | null = null;

  private lastError: string | null = null;

  private constructor() {
    this.analysisEngine = new StockfishService("analysis");
    this.botEngine = new StockfishService("bot");
  }

 
  static getInstance(): EngineManager {
    if (!instance) {
      instance = new EngineManager();
    }
    return instance;
  }

  
  static destroyInstance(): void {
    if (instance) {
      instance.destroy();
      instance = null;
    }
  }


 
  async initialize(): Promise<void> {
    if (this.status === "ready") {
      console.log("[EngineManager] Already initialized");
      return;
    }

    if (this.status === "initializing" && this.initPromise) {
      console.log("[EngineManager] Already initializing, waiting...");
      return this.initPromise;
    }

    this.status = "initializing";
    console.log("[EngineManager] Starting initialization...");

    // Create the initialization promise
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } catch (error) {
      // Re-throw so callers know it failed
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Internal initialization logic.
   */
    private async doInitialize(): Promise<void> {
    try {
      // Initialize engines ONE AT A TIME (not in parallel)
      // WASM engines are heavy — loading two simultaneously
      // can cause timeouts on slower devices
      console.log("[EngineManager] Loading analysis engine...");
      await this.analysisEngine.initialize();
      console.log("[EngineManager] Analysis engine loaded!");

      // Small delay to let the first engine settle
      await this.delay(500);

      console.log("[EngineManager] Loading bot engine...");
      await this.botEngine.initialize();
      console.log("[EngineManager] Bot engine loaded!");

      // Small delay before configuring
      await this.delay(500);

      // ── Configure the analysis engine ──
      console.log("[EngineManager] Configuring analysis engine...");
      await this.analysisEngine.setOption("MultiPV", 3);
      await this.delay(200);

      // ── Configure the bot engine ──
      console.log("[EngineManager] Configuring bot engine...");
      // Bot engine gets configured per-game in configureBotLevel()
      // No extra options needed here

      this.status = "ready";
      this.lastError = null;
      console.log("[EngineManager] ✅ Both engines ready!");
    } catch (error) {
      this.status = "error";
      this.lastError =
        error instanceof Error ? error.message : "Unknown initialization error";
      console.error("[EngineManager] ❌ Initialization failed:", this.lastError);
      throw error;
    }
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Shut down both engines and free all resources.
   */
  destroy(): void {
    console.log("[EngineManager] Destroying both engines...");
    this.analysisEngine.destroy();
    this.botEngine.destroy();
    this.status = "not_initialized";
    this.currentBotLevel = null;
    this.lastError = null;
  }


  // ============================================================
  // BOT CONFIGURATION
  // ============================================================

  /**
   * Configure the bot engine for a specific difficulty level.
   *
   * This sets the Stockfish Skill Level parameter and prepares
   * the engine for a new game. Must be called before getBotMove().
   *
   * @param botLevel - The bot configuration from BOT_LEVELS
   */
  async configureBotLevel(botLevel: BotLevel): Promise<void> {
    this.ensureReady();

    console.log(
      `[EngineManager] Configuring bot: Level ${botLevel.level} ` +
        `(${botLevel.name}, ~${botLevel.elo} Elo, Skill ${botLevel.skillLevel})`
    );

    // Set Stockfish's internal skill level (0-20)
    // This controls the engine's playing strength by introducing
    // deliberate inaccuracies at lower levels
    await this.botEngine.setOption("Skill Level", botLevel.skillLevel);

    // For very low levels, also enable UCI_LimitStrength
    // This provides an additional layer of Elo-based weakening
    if (botLevel.elo <= 2000) {
      await this.botEngine.setOption("UCI_LimitStrength", true);
      await this.botEngine.setOption("UCI_Elo", botLevel.elo);
    } else {
      await this.botEngine.setOption("UCI_LimitStrength", false);
    }

    // Start a new game in the bot engine
    await this.botEngine.newGame();

    // Store the current level for reference
    this.currentBotLevel = botLevel;
  }


  // ============================================================
  // ANALYSIS OPERATIONS
  // ============================================================

  /**
   * Analyze a position at full strength with MultiPV.
   *
   * This is the main method used by the analysis pipeline.
   * It runs the analysis engine at full strength and returns
   * the top N moves with evaluations and variations.
   *
   * @param fen       - The position to analyze (FEN string)
   * @param options   - Analysis options (depth, multiPV, etc.)
   * @returns Complete search result with all analyzed lines
   *
   * Usage:
   *   const result = await manager.analyzePosition(
   *     "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
   *     { depth: 22, multiPV: 3, onProgress: updateUI }
   *   );
   */
  async analyzePosition(
    fen: string,
    options: AnalyzeOptions = {}
  ): Promise<SearchResult> {
    this.ensureReady();

    // Default to depth 20 if not specified
    const analysisOptions: AnalyzeOptions = {
      depth: options.depth ?? 20,
      multiPV: options.multiPV ?? 3,
      onProgress: options.onProgress,
      ...options,
    };

    return this.analysisEngine.analyze(fen, analysisOptions);
  }

  /**
   * Get the bot's move for the current position.
   *
   * Uses the bot engine with its pre-configured skill level.
   * The bot "thinks" for a realistic amount of time based on
   * its difficulty level.
   *
   * @param fen - The current board position (FEN string)
   * @returns The bot's chosen move and evaluation
   *
   * Usage:
   *   const result = await manager.getBotMove(currentFen);
   *   const botMove = result.bestMove;  // "e2e4"
   */
  async getBotMove(fen: string): Promise<SearchResult> {
    this.ensureReady();

    if (!this.currentBotLevel) {
      throw new Error(
        "Bot not configured. Call configureBotLevel() before getBotMove()."
      );
    }

    const botOptions: BotSearchOptions = {
      depth: this.currentBotLevel.depth,
      moveTime: this.currentBotLevel.thinkTimeMs,
      skillLevel: this.currentBotLevel.skillLevel,
    };

    return this.botEngine.getBotMove(fen, botOptions);
  }

  /**
   * Quick evaluation of a position.
   *
   * A faster, shallower analysis for situations where we need
   * a rough evaluation quickly (e.g., for the evaluation bar
   * during move navigation in review mode).
   *
   * @param fen   - Position to evaluate
   * @param depth - How deep to search (default: 12)
   * @returns Search result with evaluation
   */
  async quickEval(fen: string, depth: number = 12): Promise<SearchResult> {
    this.ensureReady();
    return this.analysisEngine.analyze(fen, { depth, multiPV: 1 });
  }

  /**
   * Start a new game in the analysis engine.
   *
   * Clears the analysis engine's hash table and internal state.
   * Call this at the start of each new game alongside
   * configureBotLevel() for the bot engine.
   */
  async newAnalysisGame(): Promise<void> {
    this.ensureReady();
    await this.analysisEngine.newGame();
  }

  /**
   * Stop any currently running analysis.
   *
   * Useful when the user makes a new move before the previous
   * analysis has completed — we stop the old analysis and start
   * a new one for the new position.
   */
  stopAnalysis(): void {
    this.analysisEngine.stop();
  }


  // ============================================================
  // STATUS AND DIAGNOSTICS
  // ============================================================

  /**
   * Get the current status of the engine manager.
   */
  getStatus(): EngineStatus {
    return this.status;
  }

  /**
   * Check if both engines are initialized and ready.
   */
  isReady(): boolean {
    return this.status === "ready";
  }

  /**
   * Get the last error message, if any.
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Get the currently configured bot level.
   */
  getCurrentBotLevel(): BotLevel | null {
    return this.currentBotLevel;
  }

  /**
   * Internal check — throws if engines aren't ready.
   */
  private ensureReady(): void {
    if (this.status !== "ready") {
      throw new Error(
        `EngineManager is not ready (status: ${this.status}). ` +
          `Call initialize() first and wait for it to complete. ` +
          (this.lastError ? `Last error: ${this.lastError}` : "")
      );
    }
  }
}