import type { Redis } from 'ioredis';
import redis from './redis';
import mongoose from 'mongoose';
import Customer from '@/models/Customer';
import CommunicationLog from '@/models/CommunicationLog';
import { logger } from './logger';
import { progressTracker } from './progressTracker';

// Explicitly declare module
declare global {
  var batchProcessorInstance: BatchProcessor | undefined;
}

interface CustomerRecord {
  _id: string;
  phone?: string;
  email?: string;
}

// Add field type definitions
// const fieldTypes = {
//   spend: 'number',
//   visits: 'number',
//   lastActive: 'date',
//   createdAt: 'date',
//   updatedAt: 'date'
// };

// Helper function to directly query MongoDB to bypass Mongoose schema validation
async function directMongoQuery(filter: any, projection: any = { _id: 1, phone: 1, email: 1 }): Promise<CustomerRecord[]> {
  try {
    // Process the filter to ensure numeric fields are properly handled
    const processedFilter = processNumericFields(filter);
    
    // Get the Customer collection directly from the MongoDB driver
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }
    
    const collection = db.collection('customers');
    
    // Execute the query directly
    const results = await collection.find(processedFilter).project(projection).toArray();
    
    // Convert MongoDB documents to CustomerRecord format
    return results.map(doc => ({
      _id: doc._id.toString(),
      phone: doc.phone,
      email: doc.email
    }));
  } catch (error) {
    logger.error('Error in direct MongoDB query', error);
    throw error;
  }
}

// Helper function to process numeric fields in a filter
function processNumericFields(filter: any): any {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
  
  // Handle arrays (like in $and/$or operators)
  if (Array.isArray(filter)) {
    return filter.map(item => processNumericFields(item));
  }
  
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(filter)) {
    // Fix malformed operators - this is critical for MongoDB to recognize operators
    const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
    const value = filter[key];
    
    // Handle logical operators
    if (fixedKey === '$and' || fixedKey === '$or') {
      result[fixedKey] = Array.isArray(value) 
        ? value.map(item => processNumericFields(item))
        : [processNumericFields(value)];
      continue;
    }
    
    // Handle comparison operators
    if (fixedKey.startsWith('$') && typeof value === 'object' && value !== null) {
      result[fixedKey] = processNumericFields(value);
      continue;
    }
    
    // Handle field conditions
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (numericFields.includes(fixedKey)) {
        // For numeric fields with operators
        const fieldConditions: Record<string, any> = {};
        
        for (const op of Object.keys(value)) {
          // Fix any malformed operators in nested objects
          const fixedOp = op.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
          let opValue = value[op];
          
          if (typeof opValue === 'string') {
            const cleanValue = opValue.replace(/^["']|["']$/g, '');
            opValue = Number(cleanValue);
          }
          
          fieldConditions[fixedOp] = opValue;
        }
        
        result[fixedKey] = fieldConditions;
      } else {
        // For non-numeric fields
        result[fixedKey] = processNumericFields(value);
      }
      continue;
    }
    
    // Handle direct field equality
    if (numericFields.includes(fixedKey)) {
      if (typeof value === 'string') {
        const cleanValue = value.replace(/^["']|["']$/g, '');
        result[fixedKey] = Number(cleanValue);
      } else {
        result[fixedKey] = value;
      }
    } else {
      result[fixedKey] = value;
    }
  }
  
  return result;
}

// Helper function to convert filter values to proper types
// function convertFilterValues(filter: Record<string, any>): Record<string, any> {
//   // If filter is not an object or is null, return as is
//   if (!filter || typeof filter !== 'object') {
//     return filter;
//   }
  
//   // Define numeric fields that need special handling
//   const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
//   const dateFields = ['lastActive', 'createdAt', 'updatedAt', 'customer_since', 'last_order'];
  
//   // For arrays (like in $and/$or operators)
//   if (Array.isArray(filter)) {
//     return filter.map(item => convertFilterValues(item));
//   }
  
//   // Create a new object for the converted filter
//   const result: Record<string, any> = {};
  
//   // Process each key in the filter
//   for (const key of Object.keys(filter)) {
//     // Fix malformed operators
//     const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
//     const value = filter[key];
    
//     // Handle logical operators
//     if (fixedKey === '$and' || fixedKey === '$or') {
//       result[fixedKey] = Array.isArray(value) 
//         ? value.map(item => convertFilterValues(item))
//         : [convertFilterValues(value)];
//       continue;
//     }
    
//     // Handle comparison operators
//     if (fixedKey.startsWith('$') && typeof value === 'object' && value !== null) {
//       result[fixedKey] = convertFilterValues(value);
//       continue;
//     }
    
//     // Handle field conditions
//     if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
//       const fieldConditions: Record<string, any> = {};
      
//       for (const op of Object.keys(value)) {
//         // Fix malformed operators
//         const fixedOp = op.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
//         let opValue = value[op];
        
//         // Handle regex operator
//         if (fixedOp === '$regex' && typeof opValue === 'string') {
//           fieldConditions[fixedOp] = new RegExp(opValue, 'i');
//           if (value.$options) fieldConditions['$options'] = value.$options;
//           continue;
//         }
        
//         // Handle numeric field comparison operators
//         if (['$gt', '$gte', '$lt', '$lte', '$eq', '$ne'].includes(fixedOp) && numericFields.includes(fixedKey)) {
//           // Convert to number, handling string quotes
//           if (typeof opValue === 'string') {
//             opValue = opValue.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
//             opValue = Number(opValue);
//           } else if (typeof opValue !== 'number') {
//             opValue = Number(opValue);
//           }
          
//           if (isNaN(opValue)) {
//             logger.debug(`Invalid numeric value for ${fixedKey} ${fixedOp}: ${value[op]}, using 0 instead`);
//             opValue = 0;
//           }
          
//           fieldConditions[fixedOp] = opValue;
//           continue;
//         }

//         // Default case - use the value as is
//         fieldConditions[fixedOp] = opValue;
//       }
      
//       result[fixedKey] = fieldConditions;
//       continue;
//     }
    
//     // Handle direct field equality for numeric fields
//     if (numericFields.includes(fixedKey)) {
//       if (typeof value === 'string') {
//         const cleanValue = value.replace(/^["']|["']$/g, '');
//         result[fixedKey] = Number(cleanValue);
//         if (isNaN(result[fixedKey])) {
//           logger.debug(`Invalid numeric value for ${fixedKey}: ${value}, using 0 instead`);
//           result[fixedKey] = 0;
//         }
//       } else if (typeof value !== 'number') {
//         // Try to convert to number
//         result[fixedKey] = Number(value);
//         if (isNaN(result[fixedKey])) {
//           logger.debug(`Invalid numeric value for ${fixedKey}: ${value}, using 0 instead`);
//           result[fixedKey] = 0;
//         }
//       } else {
//         result[fixedKey] = value;
//       }
//       continue;
//     }
    
//     // Handle direct field equality for date fields
//     if (dateFields.includes(fixedKey)) {
//       let dateValue: Date;
      
//       if (value instanceof Date) {
//         dateValue = value;
//       } else {
//         try {
//           dateValue = new Date(value);
//           if (isNaN(dateValue.getTime())) {
//             logger.debug(`Invalid date value for ${fixedKey}: ${value}, using current date instead`);
//             dateValue = new Date();
//           }
//         } catch (e) {
//           logger.debug(`Invalid date value for ${fixedKey}: ${value}, using current date instead`);
//           dateValue = new Date();
//         }
//       }
      
//       result[fixedKey] = dateValue;
//       continue;
//     }
    
//     // Default: keep the value as is
//     result[fixedKey] = value;
//   }
  
//   return result;
// }

interface DeliveryReceipt {
  customerId: string;
  message: string;
  status: string;
  timestamp: Date;
  campaignId?: string;
}

interface MessageBatch {
  segmentId: string;
  messageContent: string;
  audienceFilter: Record<string, any>;
  campaignId?: string;
}

interface CustomerOperation {
  model: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
}

export class BatchProcessor {
  private static instance: BatchProcessor;
  private batchSize: number;
  private processingInterval: number;
  private isProcessing: boolean;
  private redis: Redis;
  private messageQueueKey = 'message:queue';
  private receiptQueueKey = 'receipt:queue';
  private customerQueueKey = 'customer:queue';

  private constructor() {
    this.batchSize = 50; // Process 50 messages at a time
    this.processingInterval = 5000; // Process every 5 seconds
    this.isProcessing = false;
    this.redis = redis;
    this.startProcessing();
  }

  public static getInstance(): BatchProcessor {
    if (!BatchProcessor.instance) {
      BatchProcessor.instance = new BatchProcessor();
    }
    return BatchProcessor.instance;
  }

  public async addMessageBatch(batch: MessageBatch): Promise<void> {
    try {
      await this.redis.rpush(this.messageQueueKey, JSON.stringify(batch));
      logger.info(`Added message batch for segment ${batch.segmentId}`);
    } catch (error) {
      logger.error('Error adding message batch to queue', error);
      throw error;
    }
  }

  public async addReceipt(receipt: DeliveryReceipt): Promise<void> {
    try {
      await this.redis.rpush(this.receiptQueueKey, JSON.stringify(receipt));
    } catch (error) {
      logger.error('Error adding receipt to queue', error);
      throw error;
    }
  }

  public async addBulkReceipts(receipts: DeliveryReceipt[]): Promise<void> {
    try {
      const batchId = progressTracker.startBatch('receipt-queue', receipts.length);
      
      // Add all receipts to the queue
      const pipeline = this.redis.pipeline();
      let processedCount = 0;
      
      for (const receipt of receipts) {
        pipeline.rpush(this.receiptQueueKey, JSON.stringify(receipt));
        processedCount++;
        
        // Update progress periodically
        if (processedCount % 10 === 0 || processedCount === receipts.length) {
          progressTracker.bulkUpdate(batchId, processedCount);
        }
      }
      
      await pipeline.exec();
      progressTracker.completeBatch(batchId, true);
      
      logger.info(`Added batch of ${receipts.length} receipts to processing queue`);
    } catch (error) {
      logger.error('Error adding bulk receipts to queue', error);
      throw error;
    }
  }

  public async addToBatch(operation: CustomerOperation): Promise<void> {
    try {
      await this.redis.rpush(this.customerQueueKey, JSON.stringify(operation));
      logger.debug(`Added ${operation.operation} operation for ${operation.model}`);
    } catch (error) {
      logger.error('Error adding operation to queue', error);
      throw error;
    }
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.isProcessing) {
      try {
        // Process message batches
        await this.processMessageQueue();
        // Process delivery receipts
        await this.processReceiptQueue();
        // Process customer operations
        await this.processCustomerQueue();
        // Wait for next processing interval
        await new Promise(resolve => setTimeout(resolve, this.processingInterval));
      } catch (error) {
        logger.error('Error in batch processing', error);
      }
    }
  }

  private async processMessageQueue(): Promise<void> {
    const queueSize = await this.redis.llen(this.messageQueueKey);
    if (queueSize === 0) return;

    const itemsToProcess = Math.min(queueSize, this.batchSize);
    const batch: MessageBatch[] = [];
    
    // Create a new batch with progress tracking
    const batchId = progressTracker.startBatch('messages', itemsToProcess);

    for (let i = 0; i < itemsToProcess; i++) {
      const item = await this.redis.rpop(this.messageQueueKey);
      if (item) {
        batch.push(JSON.parse(item));
        progressTracker.updateProgress(batchId);
      }
    }

    if (batch.length > 0) {
      try {
        await this.processMessages(batch);
        progressTracker.completeBatch(batchId, true);
      } catch (error) {
        progressTracker.completeBatch(batchId, false, error);
      }
    }
  }

  private async processReceiptQueue(): Promise<void> {
    const queueSize = await this.redis.llen(this.receiptQueueKey);
    if (queueSize === 0) return;

    const itemsToProcess = Math.min(queueSize, this.batchSize);
    const batch: DeliveryReceipt[] = [];
    
    // Create a new batch with progress tracking
    const batchId = progressTracker.startBatch('receipts', itemsToProcess);

    for (let i = 0; i < itemsToProcess; i++) {
      const item = await this.redis.rpop(this.receiptQueueKey);
      if (item) {
        batch.push(JSON.parse(item));
        progressTracker.updateProgress(batchId);
      }
    }

    if (batch.length > 0) {
      try {
        await this.processReceipts(batch);
        progressTracker.completeBatch(batchId, true);
      } catch (error) {
        progressTracker.completeBatch(batchId, false, error);
      }
    }
  }

  private async processCustomerQueue(): Promise<void> {
    const queueSize = await this.redis.llen(this.customerQueueKey);
    if (queueSize === 0) return;

    const itemsToProcess = Math.min(queueSize, this.batchSize);
    const batch: CustomerOperation[] = [];

    for (let i = 0; i < itemsToProcess; i++) {
      const item = await this.redis.rpop(this.customerQueueKey);
      if (item) {
        batch.push(JSON.parse(item));
      }
    }

    if (batch.length > 0) {
      await this.processCustomerOperations(batch);
    }
  }

  private async processMessages(batches: MessageBatch[]): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const batch of batches) {
          try {
            // Use the filter from the batch to find customers
            const audienceFilter = batch.audienceFilter;
            logger.debug(`Processing batch with filter`);
            
            let customers: CustomerRecord[] = [];
            try {
              // First, try to use the full filter
              customers = await directMongoQuery(audienceFilter);
              logger.info(`Found ${customers.length} customers for segment ${batch.segmentId}`);
            } catch (error) {
              logger.error('Error querying customers', error);
              
              // Fall back to simplified filter if original fails
              try {
                logger.debug('Trying simplified filter');
                const simplifiedFilter = simplifyFilter(audienceFilter);
                customers = await directMongoQuery(simplifiedFilter);
                logger.info(`Found ${customers.length} customers with simplified filter`);
              } catch (fallbackError) {
                logger.error('Error with simplified filter', fallbackError);
                continue; // Skip this batch
              }
            }
            
            if (customers.length === 0) {
              logger.warn(`No customers found for segment ${batch.segmentId}, skipping`);
              continue;
            }

            // Create communication logs in batches
            const logs = customers.map((customer: CustomerRecord) => ({
              customerId: customer._id,
              segmentId: batch.segmentId,
              campaignId: batch.campaignId,
              messageContent: batch.messageContent,
              status: 'pending',
              channel: customer.phone ? 'sms' : 'email',
              timestamp: new Date()
            }));

            // Save logs in smaller sub-batches for better performance
            const subBatchSize = 100;
            for (let i = 0; i < logs.length; i += subBatchSize) {
              const subBatch = logs.slice(i, i + subBatchSize);
              await CommunicationLog.insertMany(subBatch, { session });
            }

            logger.info(`Processed batch for segment ${batch.segmentId} with ${customers.length} recipients`);
          } catch (error) {
            logger.error(`Error processing batch for segment ${batch.segmentId}`, error);
            // Continue with next batch instead of failing the entire transaction
          }
        }
      });
    } catch (error) {
      console.error('Error processing message batch:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async processReceipts(receipts: DeliveryReceipt[]): Promise<void> {
    const session = await mongoose.startSession();
    try {
      // Group receipts by campaign for better logging
      const campaignGroups = new Map<string, number>();
      let sentCount = 0;
      let failedCount = 0;
      
      for (const receipt of receipts) {
        if (receipt.campaignId) {
          const count = campaignGroups.get(receipt.campaignId) || 0;
          campaignGroups.set(receipt.campaignId, count + 1);
        }
        
        if (receipt.status === 'SENT') {
          sentCount++;
        } else {
          failedCount++;
        }
      }
      
      // Create readable batch summary
      let batchSummary = "";
      if (campaignGroups.size > 0) {
        batchSummary = Array.from(campaignGroups.entries())
          .map(([id, count]) => `${id.substring(0, 8)}:${count}`)
          .join(', ');
      }
      
      // Log with prominent visual indicator
      logger.info(`
⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇
📊 BATCH PROCESSING [${receipts.length} receipts] 
   Status: ${sentCount} sent, ${failedCount} failed (${Math.round((sentCount/receipts.length)*100)}% success)
   ${batchSummary ? `Campaigns: ${batchSummary}` : ''}
⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆`);
      
      // Direct console log with colored background for high visibility
      console.log(`\x1b[46m\x1b[30m PROCESSING RECEIPTS \x1b[0m Processing ${receipts.length} receipts (${sentCount} sent, ${failedCount} failed)`);
      
      const batchId = progressTracker.startBatch('receipt-processing', receipts.length);
      
      await session.withTransaction(async () => {
        // Update communication logs in batches
        const updates = receipts.map((receipt, index) => {
          // Update progress every 10 items or on the last one
          if (index % 10 === 0 || index === receipts.length - 1) {
            progressTracker.bulkUpdate(batchId, index + 1);
          }
          
          return {
            updateOne: {
              filter: {
                customerId: receipt.customerId,
                // status: 'pending'
                status: receipt.status
              },
              update: {
                $set: {
                  status: receipt.status,
                  deliveryTimestamp: receipt.timestamp,
                  lastUpdated: new Date()
                }
              }
            }
          };
        });

        await CommunicationLog.bulkWrite(updates, { session });
        progressTracker.completeBatch(batchId, true);
        
        // Direct console log for completion
        console.log(`\x1b[46m\x1b[30m RECEIPTS COMPLETED \x1b[0m Successfully processed ${receipts.length} receipts`);
        
        // Final summary of completion
        logger.info(`✅ Completed processing ${receipts.length} delivery receipts`);
      });
    } catch (error) {
      logger.error('❌ Error processing delivery receipts', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async processCustomerOperations(operations: CustomerOperation[]): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const operation of operations) {
          if (operation.model === 'Customer') {
            switch (operation.operation) {
              case 'create':
                await Customer.create(operation.data);
                logger.debug(`Created customer: ${operation.data._id}`);
                break;
              case 'update':
                await Customer.findByIdAndUpdate(operation.data._id, operation.data);
                logger.debug(`Updated customer: ${operation.data._id}`);
                break;
              case 'delete':
                await Customer.findByIdAndDelete(operation.data._id);
                logger.debug(`Deleted customer: ${operation.data._id}`);
                break;
              default:
                logger.warn(`Unknown operation: ${operation.operation}`);
            }
          } else {
            logger.warn(`Unknown model: ${operation.model}`);
          }
        }
      });
    } catch (error) {
      logger.error('Error processing customer operations', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public stop(): void {
    this.isProcessing = false;
  }
}

// Create and export a singleton instance
const batchProcessor: BatchProcessor = (() => {
  if (!global.batchProcessorInstance) {
    global.batchProcessorInstance = BatchProcessor.getInstance();
  }
  return global.batchProcessorInstance;
})();

export { batchProcessor };

// Helper function to simplify a filter to basic equality conditions
function simplifyFilter(filter: any): any {
  if (!filter || typeof filter !== 'object') {
    return {};
  }
  
  // If it's an array (like in $and/$or), return an empty object
  if (Array.isArray(filter)) {
    return {};
  }
  
  const result: Record<string, any> = {};
  const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
  
  // Only keep direct equality conditions for non-numeric fields
  for (const key of Object.keys(filter)) {
    // Fix malformed operators
    const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
    
    // Skip operators and numeric fields
    if (fixedKey.startsWith('$') || numericFields.includes(fixedKey)) {
      continue;
    }
    
    const value = filter[key];
    
    // Only include simple string/boolean values
    if (typeof value === 'string' || typeof value === 'boolean') {
      result[fixedKey] = value;
    }
  }
  
  return result;
}