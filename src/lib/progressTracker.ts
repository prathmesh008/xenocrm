import { logger } from './logger';

/**
 * Tracks processing progress for different operations
 * Provides visual progress indicators and batch updates
 */
interface BatchState {
  type: string;
  total: number;
  processed: number;
  lastUpdateTime: number;
  inProgress: boolean;
}

class ProgressTracker {
  private static instance: ProgressTracker;
  private batchStates: Map<string, BatchState>;
  private updateIntervalMs: number = 1000; // Update terminal at most once per second
  
  private constructor() {
    this.batchStates = new Map();
  }

  public static getInstance(): ProgressTracker {
    if (!ProgressTracker.instance) {
      ProgressTracker.instance = new ProgressTracker();
    }
    return ProgressTracker.instance;
  }

  /**
   * Starts tracking a new batch operation
   * @param type Operation type (receipts, messages, etc)
   * @param total Total number of items to process
   * @param id Optional identifier for the batch
   * @returns Batch identifier
   */
  public startBatch(type: string, total: number, id?: string): string {
    const batchId = id || `${type}-${Date.now()}`;
    
    this.batchStates.set(batchId, {
      type,
      total,
      processed: 0,
      lastUpdateTime: Date.now(),
      inProgress: true
    });
    
    // Initial progress message
    logger.info(`Started processing ${total} ${type} items - Batch #${batchId}`);
    return batchId;
  }

  /**
   * Updates progress for a batch operation
   * @param batchId Batch identifier
   * @param increment Number of items processed
   */
  public updateProgress(batchId: string, increment: number = 1): void {
    const state = this.batchStates.get(batchId);
    if (!state) return;
    
    state.processed += increment;
    const now = Date.now();
    
    // Only update UI if it's been long enough since last update or if we're done
    const isDone = state.processed >= state.total;
    const shouldUpdate = 
      isDone || 
      (now - state.lastUpdateTime > this.updateIntervalMs);
      
    if (shouldUpdate) {
      state.lastUpdateTime = now;
      const percentage = Math.round((state.processed / state.total) * 100);
      
      // Generate progress bar
      const barLength = 20;
      const progressChars = Math.round((percentage / 100) * barLength);
      const progressBar = '[' + 
        '='.repeat(progressChars) + 
        ' '.repeat(barLength - progressChars) + 
        ']';
      
      if (isDone) {
        logger.info(`Completed ${state.type} batch: ${state.processed}/${state.total} items processed ${progressBar} 100%`);
        state.inProgress = false;
      } else {
        logger.info(`Processing ${state.type}: ${state.processed}/${state.total} items ${progressBar} ${percentage}%`);
      }
    }
  }
  
  /**
   * Completes a batch operation
   * @param batchId Batch identifier
   * @param success Whether the operation was successful
   * @param error Optional error object
   */
  public completeBatch(batchId: string, success: boolean = true, error?: any): void {
    const state = this.batchStates.get(batchId);
    if (!state || !state.inProgress) return;
    
    state.inProgress = false;
    
    if (success) {
      logger.info(`Successfully completed ${state.type} batch: ${state.processed}/${state.total} items processed`);
    } else {
      logger.error(`Error processing ${state.type} batch after ${state.processed}/${state.total} items`, error);
    }
  }
  
  /**
   * Gets batch current state
   * @param batchId Batch identifier
   * @returns Current batch state or undefined
   */
  public getBatchState(batchId: string): BatchState | undefined {
    return this.batchStates.get(batchId);
  }

  /**
   * Bulk update for processing multiple items at once
   * @param batchId Batch identifier  
   * @param processedCount Number of items processed
   */
  public bulkUpdate(batchId: string, processedCount: number): void {
    const state = this.batchStates.get(batchId);
    if (!state) return;
    
    state.processed = processedCount;
    const now = Date.now();
    
    // Always update for bulk operations
    state.lastUpdateTime = now;
    const percentage = Math.round((state.processed / state.total) * 100);
    
    // Generate progress bar
    const barLength = 20;
    const progressChars = Math.round((percentage / 100) * barLength);
    const progressBar = '[' + 
      '='.repeat(progressChars) + 
      ' '.repeat(barLength - progressChars) + 
      ']';
    
    logger.info(`Batch ${state.type}: ${state.processed}/${state.total} processed ${progressBar} ${percentage}%`);
    
    if (state.processed >= state.total) {
      state.inProgress = false;
      logger.info(`Completed ${state.type} batch processing`);
    }
  }
}

// Export singleton instance
export const progressTracker = ProgressTracker.getInstance(); 