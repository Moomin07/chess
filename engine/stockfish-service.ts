// ============================================================
// ChessMind Coach — Stockfish Web Worker Service
// ============================================================
//
// This class manages a SINGLE Stockfish instance running as a
// Web Worker (a background thread in the browser). It handles:
//
//   1. Creating and initializing the worker
//   2. Sending UCI commands
//   3. Collecting and organizing responses
//   4. Providing clean async methods for analysis and bot play
//
// IMPORTANT: The application creates TWO of these:
//   - One for the ANALYSIS engine (full strength, MultiPV)
//   - One for the BOT engine (skill-limited, single best move)
//
// The EngineManager class (next file) coordinates both.
//
// ============================================================
//
// HOW WEB WORKERS WORK (for beginners):
//
// Normally, JavaScript runs on a single thread. If Stockfish
// was analyzing on that thread, the entire UI would freeze.
//
// A Web Worker runs code in a separate background thread.
// We communicate with it by sending messages back and forth:
//
//   Main Thread                    Web Worker (Stockfish)
//   ──────────                    ─────────────────────
//   postMessage("go depth 20")  ──►  Starts searching...
//                               ◄──  postMessage("info depth 5 ...")
//                               ◄──  postMessage("info depth 10 ...")
//                               ◄──  postMessage("info depth 20 ...")
//                               ◄──  postMessage("bestmove e2e4")
//
// This keeps the UI smooth while Stockfish thinks.
//
// ============================================================

import { parseUCIResponse } from "./uci-parser";
import type { EngineInfoLine, PVLine } from "@/lib/types";


// ============================================================
// TYPES — Results and options for search operations
// ============================================================

/**
 * The complete result of a search operation.
 * Contains the best move, all analyzed lines, and statistics.
 */
export interface SearchResult {
  /** The engine's recommended move in UCI notation (e.g., "e2e4") */
  bestMove: string;

  /** The move the engine expects as a reply (may be undefined) */
  ponderMove?: string;

  /**
   * All principal variation lines, sorted by rank.
   * In MultiPV mode, this contains multiple lines (top 3-5 moves).
   * In single-PV mode, this contains just one line.
   */
  lines: PVLine[];

  /** The maximum search depth reached */
  depth: number;

  /** Total positions examined during the search */
  totalNodes: number;

  /** Time spent searching in milliseconds */
  timeMs: number;
}

/**
 * Options for full position analysis (used by the analysis engine).
 */
export interface AnalyzeOptions {
  /** Search to this depth in half-moves. Default: 20 */
  depth?: number;

  /** Search for this many milliseconds instead of a fixed depth */
  moveTime?: number;

  /** Number of top moves to analyze simultaneously. Default: 3 */
  multiPV?: number;

  /**
   * Called as the engine finds deeper results.
   * Use this to update the UI progressively — show partial
   * results before the full search is complete.
   */
  onProgress?: (lines: PVLine[]) => void;
}

/**
 * Options for bot move generation (used by the bot engine).
 */
export interface BotSearchOptions {
  /** Maximum search depth. Lower = weaker play */
  depth?: number;

  /** Search for this many milliseconds */
  moveTime?: number;

  /** Stockfish Skill Level parameter (0-20). Lower = weaker */
  skillLevel?: number;
}


// ============================================================
// MAIN CLASS
// ============================================================

export class StockfishService {
  // ── Worker Management ──
  private worker: Worker | null = null;
  private isInitialized: boolean = false;

  // ── Ready State ──
  // When we send "isready" to the engine, we wait for "readyok".
  // This callback resolves the promise when "readyok" arrives.
  private readyResolve: (() => void) | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;

  // ── UCI Init State ──
  // During initialization, we wait for "uciok".
  private initResolve: (() => void) | null = null;

  // ── Search State ──
  // These track the current ongoing search operation.
  private resolveSearch: ((result: SearchResult) => void) | null = null;
  private currentPVLines: Map<number, PVLine> = new Map();
  private searchMaxDepth: number = 0;
  private searchNodes: number = 0;
  private searchTime: number = 0;
  private onSearchProgress: ((lines: PVLine[]) => void) | null = null;
  private searchSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Identity ──
  // A label for debugging — "analysis" or "bot"
  private label: string;

  /**
   * Create a new StockfishService instance.
   *
   * @param label - A name for this instance ("analysis" or "bot")
   *                Used in console logs for debugging.
   */
  constructor(label: string = "engine") {
    this.label = label;
  }


  // ============================================================
  // LIFECYCLE METHODS
  // ============================================================

  /**
   * Initialize the Stockfish engine.
   *
   * This creates a Web Worker, loads the Stockfish WASM binary,
   * and performs the UCI handshake:
   *   1. Send "uci" → wait for "uciok"
   *   2. Send "isready" → wait for "readyok"
   *
   * After this resolves, the engine is ready to accept commands.
   *
   * @throws Error if we're not in a browser or if initialization fails
   */
  async initialize(): Promise<void> {
    // Web Workers only exist in browsers, not on the server
    if (typeof window === "undefined") {
      throw new Error("StockfishService can only run in the browser");
    }

    // Don't initialize twice
    if (this.isInitialized) {
      console.log(`[${this.label}] Already initialized`);
      return;
    }

    console.log(`[${this.label}] Initializing Stockfish...`);

    return new Promise<void>((resolve, reject) => {
      try {
        // ── Step 1: Create the Web Worker ──
        // The stockfish.js file in our public folder is a self-contained
        // Stockfish engine compiled to WebAssembly. Loading it as a
        // Worker runs it in a background thread.
        this.worker = new Worker("/stockfish/stockfish.js");

        // ── Step 2: Set up message handling ──
        // Every line of output from Stockfish arrives here
        this.worker.onmessage = (event: MessageEvent) => {
          this.handleMessage(event);
        };

        // ── Step 3: Handle fatal errors ──
        this.worker.onerror = (error: ErrorEvent) => {
          console.error(`[${this.label}] Worker error:`, error.message);
          if (!this.isInitialized) {
            reject(
              new Error(
                `Failed to load Stockfish. Make sure stockfish.js exists in public/stockfish/. Error: ${error.message}`
              )
            );
          }
        };

        // ── Step 4: Start UCI handshake ──
        // Save the resolve callback — it will be called when
        // we receive "uciok" from the engine
        this.initResolve = () => {
          // After uciok, send isready to confirm engine is ready
          this.waitForReady(5000)
            .then(() => {
              this.isInitialized = true;
              console.log(`[${this.label}] Stockfish ready!`);
              resolve();
            })
            .catch(reject);
        };

        // Send the "uci" command to start the handshake
        this.sendCommand("uci");

        // Safety timeout — if uciok never comes, reject after 10 seconds
        setTimeout(() => {
          if (!this.isInitialized) {
            reject(
              new Error(
                `[${this.label}] Stockfish initialization timed out. The engine did not respond with "uciok" within 10 seconds.`
              )
            );
          }
        }, 30000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cleanly shut down the engine and terminate the Web Worker.
   *
   * Always call this when you're done with the engine (e.g., when
   * leaving the game page) to free up resources.
   */
  destroy(): void {
    console.log(`[${this.label}] Shutting down...`);

    // Cancel any pending operations
    this.cancelPendingOperations();

    // Send quit command (graceful shutdown)
    if (this.worker) {
      try {
        this.sendCommand("quit");
      } catch {
        // Worker might already be terminated
      }

      // Terminate the worker thread
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    console.log(`[${this.label}] Shut down complete`);
  }


  // ============================================================
  // CONFIGURATION METHODS
  // ============================================================

  /**
   * Set a UCI option on the engine.
   *
   * Common options:
   *   - "MultiPV"          → Number of lines to analyze (1-5)
   *   - "Skill Level"      → Playing strength (0-20)
   *   - "UCI_LimitStrength" → Enable Elo-based limiting ("true"/"false")
   *   - "UCI_Elo"           → Target Elo when LimitStrength is on
   *   - "Threads"           → Number of search threads (1 for WASM)
   *   - "Hash"              → Hash table size in MB
   *
   * @param name  - The option name (case-sensitive)
   * @param value - The option value
   */
  async setOption(
    name: string,
    value: string | number | boolean
  ): Promise<void> {
    this.ensureInitialized();

    const valueStr =
      typeof value === "boolean" ? (value ? "true" : "false") : String(value);

    this.sendCommand(`setoption name ${name} value ${valueStr}`);

    // After setting an option, we send "isready" and wait for
    // "readyok" to confirm the option was applied
    await this.waitForReady(15000);
  }

  /**
   * Reset the engine's internal state for a new game.
   *
   * This clears the hash table and any learned patterns from
   * the previous game. Should be called at the start of each
   * new game.
   */
  async newGame(): Promise<void> {
    this.ensureInitialized();
    this.sendCommand("ucinewgame");
    await this.waitForReady(15000);
  }


  // ============================================================
  // SEARCH OPERATIONS
  // ============================================================

  /**
   * Analyze a position with full MultiPV analysis.
   *
   * This is what the ANALYSIS engine uses to evaluate every move.
   * It returns the top N moves with their evaluations, variations,
   * and win/draw/loss probabilities.
   *
   * Usage:
   *   const result = await analysisEngine.analyze(
   *     "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
   *     { depth: 22, multiPV: 3 }
   *   );
   *   console.log(result.lines[0].score);  // Best move's evaluation
   *   console.log(result.lines[0].moves);  // Best continuation
   *
   * @param fen     - The position to analyze (FEN string)
   * @param options - Search options (depth, multiPV, etc.)
   * @returns A SearchResult with all analyzed lines
   */
  async analyze(
    fen: string,
    options: AnalyzeOptions = {}
  ): Promise<SearchResult> {
    this.ensureInitialized();

    // Stop any ongoing search first
    await this.stopCurrentSearch();

    // Configure MultiPV (default: 3 lines)
    const multiPV = options.multiPV ?? 3;
    await this.setOption("MultiPV", multiPV);

    // Reset search tracking state
    this.resetSearchState();

    // Store the progress callback (for progressive UI updates)
    this.onSearchProgress = options.onProgress ?? null;

    // Set the position
    this.sendCommand(`position fen ${fen}`);

    // Start the search and return a promise that resolves
    // when the engine sends "bestmove"
    return new Promise<SearchResult>((resolve) => {
      this.resolveSearch = resolve;

      // Build the "go" command
      const depth = options.depth ?? 20;
      const moveTime = options.moveTime;

      let goCmd = "go";
      if (moveTime) {
        goCmd += ` movetime ${moveTime}`;
      } else {
        goCmd += ` depth ${depth}`;
      }

      this.sendCommand(goCmd);

      // Safety timeout: if the engine takes too long, force stop
      // This prevents the app from hanging if something goes wrong
      this.searchSafetyTimer = setTimeout(() => {
        console.warn(
          `[${this.label}] Search safety timeout reached (30s). Forcing stop.`
        );
        this.sendCommand("stop");
      }, 30000);
    });
  }

  /**
   * Get the bot's move for a position.
   *
   * This is what the BOT engine uses. It searches with the
   * configured skill level and returns a single best move.
   * Simpler and faster than full analysis.
   *
   * Usage:
   *   const result = await botEngine.getBotMove(currentFen, {
   *     depth: 10,
   *     moveTime: 1000,
   *     skillLevel: 5,
   *   });
   *   console.log(result.bestMove);  // "e2e4"
   *
   * @param fen     - The current position (FEN string)
   * @param options - Bot search options (skill level, depth, etc.)
   * @returns The bot's chosen move
   */
  async getBotMove(
    fen: string,
    options: BotSearchOptions = {}
  ): Promise<SearchResult> {
    this.ensureInitialized();

    // Stop any ongoing search first
    await this.stopCurrentSearch();

    // Set skill level if specified
    if (options.skillLevel !== undefined) {
      await this.setOption("Skill Level", options.skillLevel);
    }

    // Use single-PV for bot (we only need one move)
    await this.setOption("MultiPV", 1);

    // Reset search tracking state
    this.resetSearchState();
    this.onSearchProgress = null;

    // Set the position
    this.sendCommand(`position fen ${fen}`);

    // Start the search
    return new Promise<SearchResult>((resolve) => {
      this.resolveSearch = resolve;

      // Build the "go" command
      const depth = options.depth ?? 10;
      const moveTime = options.moveTime;

      let goCmd = "go";
      if (moveTime) {
        goCmd += ` movetime ${moveTime}`;
      } else {
        goCmd += ` depth ${depth}`;
      }

      this.sendCommand(goCmd);

      // Safety timeout for bot (shorter than analysis)
      this.searchSafetyTimer = setTimeout(() => {
        console.warn(`[${this.label}] Bot search timeout. Forcing stop.`);
        this.sendCommand("stop");
      }, 15000);
    });
  }

  /**
   * Stop the current search immediately.
   *
   * The engine will respond with "bestmove" containing its
   * best result so far, which resolves the pending promise.
   */
  stop(): void {
    if (this.worker && this.resolveSearch) {
      this.sendCommand("stop");
    }
  }


  // ============================================================
  // INTERNAL — Message Handling
  // ============================================================

  /**
   * Process a message received from the Stockfish Web Worker.
   *
   * This is the central routing function. Every piece of output
   * from Stockfish flows through here.
   */
  private handleMessage(event: MessageEvent): void {
    const data = event.data;

    // Handle different message formats from different WASM builds
    let line: string;
    if (typeof data === "string") {
      line = data;
    } else if (typeof data === "object" && data !== null) {
      // Some WASM wrappers send objects instead of strings
      line = data.data ? String(data.data) : String(data);
    } else {
      return;
    }

    // Skip empty lines
    if (line.trim().length === 0) return;

    // Parse the UCI response using our parser from Step 3
    const parsed = parseUCIResponse(line);
    if (!parsed) return;

    switch (parsed.type) {
      case "uciok":
        // Engine has finished initialization and listed its options
        if (this.initResolve) {
          this.initResolve();
          this.initResolve = null;
        }
        break;

      case "readyok":
        // Engine is ready for the next command
        if (this.readyResolve) {
          if (this.readyTimer) {
            clearTimeout(this.readyTimer);
            this.readyTimer = null;
          }
          this.readyResolve();
          this.readyResolve = null;
        }
        break;

      case "info":
        // Intermediate search data — collect it
        if (parsed.info) {
          this.handleInfoLine(parsed.info);
        }
        break;

      case "bestmove":
        // Search is complete — resolve the promise
        this.handleSearchComplete(
          parsed.bestMove ?? "(none)",
          parsed.ponderMove
        );
        break;
    }
  }

  /**
   * Process an "info" line from the engine during search.
   *
   * During a search, the engine sends many info lines as it
   * explores deeper. Each line reports the evaluation and
   * principal variation at a specific depth for a specific
   * MultiPV rank.
   *
   * We keep only the DEEPEST result for each PV rank, since
   * deeper = more accurate.
   *
   * Example flow for MultiPV 3, depth 20 search:
   *   info depth 1 multipv 1 ... → stored as PV rank 1
   *   info depth 1 multipv 2 ... → stored as PV rank 2
   *   info depth 1 multipv 3 ... → stored as PV rank 3
   *   info depth 2 multipv 1 ... → REPLACES PV rank 1 (deeper)
   *   info depth 2 multipv 2 ... → REPLACES PV rank 2
   *   ...
   *   info depth 20 multipv 1 ... → Final result for rank 1
   *   info depth 20 multipv 2 ... → Final result for rank 2
   *   info depth 20 multipv 3 ... → Final result for rank 3
   *   bestmove e2e4 ponder e7e5  → Search complete
   */
  private handleInfoLine(info: EngineInfoLine): void {
    // We only care about lines that have a score and a PV
    // Lines without these are progress indicators (currmove, etc.)
    if (!info.score || !info.pv || info.pv.length === 0) {
      // Still update node count and time from any info line
      if (info.nodes) this.searchNodes = info.nodes;
      if (info.timeMs) this.searchTime = info.timeMs;
      return;
    }

    // Skip upper/lower bound scores — these are preliminary
    // estimates that will be refined. We want exact scores only.
    if (info.score.upperBound || info.score.lowerBound) return;

    const pvRank = info.multiPV ?? 1;
    const depth = info.depth ?? 0;

    // Only keep the deepest result for each PV rank
    const existing = this.currentPVLines.get(pvRank);
    if (existing && existing.depth > depth) return;

    // Build the PVLine object
    const pvLine: PVLine = {
      rank: pvRank,
      score: {
        centipawns: info.score.centipawns,
        mate: info.score.mate,
      },
      wdl: info.wdl
        ? {
            win: info.wdl.win,
            draw: info.wdl.draw,
            loss: info.wdl.loss,
          }
        : undefined,
      moves: info.pv,
      depth: depth,
    };

    // Store it (replaces any shallower result for this rank)
    this.currentPVLines.set(pvRank, pvLine);

    // Update search statistics
    if (depth > this.searchMaxDepth) this.searchMaxDepth = depth;
    if (info.nodes) this.searchNodes = info.nodes;
    if (info.timeMs) this.searchTime = info.timeMs;

    // Call the progress callback so the UI can show intermediate results
    if (this.onSearchProgress) {
      const currentLines = Array.from(this.currentPVLines.values()).sort(
        (a, b) => a.rank - b.rank
      );
      this.onSearchProgress(currentLines);
    }
  }

  /**
   * Handle the "bestmove" response — search is complete.
   *
   * This collects all accumulated PV lines, packages them into
   * a SearchResult, and resolves the promise that analyze() or
   * getBotMove() returned.
   */
  private handleSearchComplete(
    bestMove: string,
    ponderMove?: string
  ): void {
    // Clear the safety timeout
    if (this.searchSafetyTimer) {
      clearTimeout(this.searchSafetyTimer);
      this.searchSafetyTimer = null;
    }

    // If there's a pending search promise, resolve it
    if (this.resolveSearch) {
      // Sort lines by rank (1 = best, 2 = second best, etc.)
      const lines = Array.from(this.currentPVLines.values()).sort(
        (a, b) => a.rank - b.rank
      );

      // If we somehow have no lines (very rare), create a minimal one
      if (lines.length === 0 && bestMove !== "(none)") {
        lines.push({
          rank: 1,
          score: { centipawns: 0 },
          moves: [bestMove],
          depth: this.searchMaxDepth,
        });
      }

      const result: SearchResult = {
        bestMove,
        ponderMove,
        lines,
        depth: this.searchMaxDepth,
        totalNodes: this.searchNodes,
        timeMs: this.searchTime,
      };

      // Resolve the promise — this returns the result to whoever
      // called analyze() or getBotMove()
      this.resolveSearch(result);
      this.resolveSearch = null;
      this.onSearchProgress = null;
    }
  }


  // ============================================================
  // INTERNAL — Helper Methods
  // ============================================================

  /**
   * Send a raw UCI command to the engine.
   *
   * @param command - The UCI command string (e.g., "go depth 20")
   */
  private sendCommand(command: string): void {
    if (!this.worker) {
      console.error(`[${this.label}] Cannot send command — no worker`);
      return;
    }
    this.worker.postMessage(command);
  }

  /**
   * Send "isready" and wait for "readyok".
   *
   * This is the standard UCI synchronization mechanism. After
   * sending configuration commands, we send "isready" and wait
   * for the engine to confirm it's processed everything with
   * "readyok".
   *
   * @param timeoutMs - Maximum time to wait (default: 5000ms)
   * @throws Error if the engine doesn't respond in time
   */
  private waitForReady(timeoutMs: number = 5000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Set up timeout
      this.readyTimer = setTimeout(() => {
        this.readyResolve = null;
        reject(
          new Error(
            `[${this.label}] Engine did not respond with "readyok" within ${timeoutMs}ms`
          )
        );
      }, timeoutMs);

      // Store the resolve callback — will be called when
      // handleMessage receives "readyok"
      this.readyResolve = resolve;

      // Send the command
      this.sendCommand("isready");
    });
  }

  /**
   * Stop any currently running search and wait for it to finish.
   *
   * When we send "stop", the engine immediately finishes and
   * sends "bestmove" with its best result so far. We wait for
   * that bestmove to arrive so the previous search promise
   * resolves properly before we start a new search.
   */
  private async stopCurrentSearch(): Promise<void> {
    if (!this.resolveSearch) return; // No search in progress

    // Tell the engine to stop
    this.sendCommand("stop");

    // Wait for the search to resolve (the bestmove handler
    // will be called, which resolves the search promise)
    // Maximum wait: 2 seconds
    return new Promise<void>((resolve) => {
      let elapsed = 0;
      const checkInterval = setInterval(() => {
        elapsed += 20;
        if (!this.resolveSearch || elapsed >= 2000) {
          clearInterval(checkInterval);

          // If the search still hasn't resolved after 2 seconds,
          // force-resolve it with whatever we have
          if (this.resolveSearch) {
            this.handleSearchComplete("(none)");
          }

          resolve();
        }
      }, 20);
    });
  }

  /**
   * Reset all search tracking state.
   * Called before starting each new search.
   */
  private resetSearchState(): void {
    this.currentPVLines.clear();
    this.searchMaxDepth = 0;
    this.searchNodes = 0;
    this.searchTime = 0;
  }

  /**
   * Cancel all pending operations (used during shutdown).
   */
  private cancelPendingOperations(): void {
    // Clear ready waiter
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.readyResolve = null;
    this.initResolve = null;

    // Clear search
    if (this.searchSafetyTimer) {
      clearTimeout(this.searchSafetyTimer);
      this.searchSafetyTimer = null;
    }

    if (this.resolveSearch) {
      // Resolve with empty result rather than leaving the promise hanging
      this.resolveSearch({
        bestMove: "(none)",
        lines: [],
        depth: 0,
        totalNodes: 0,
        timeMs: 0,
      });
      this.resolveSearch = null;
    }

    this.onSearchProgress = null;
    this.resetSearchState();
  }

  /**
   * Throw an error if the engine hasn't been initialized.
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        `[${this.label}] Engine not initialized. Call initialize() first.`
      );
    }
  }

  /**
   * Check if the engine is ready to accept commands.
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}