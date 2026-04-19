// Define receipt interface
interface DeliveryReceipt {
  customerId: string;
  message: string;
  status: string;
  timestamp: string;
  campaignId?: string;
}

import { logger } from './logger';
import { progressTracker } from './progressTracker';

export const vendorApi = {
  // Store for collecting receipts in batches
  _receiptBatch: [] as DeliveryReceipt[],
  _batchSize: 50,
  _batchTimeoutId: null as NodeJS.Timeout | null,
  _campaignStats: new Map<string, { total: number, batches: number, sent: number, failed: number }>(),
  
  // Process the collected batch of receipts
  _processBatch: async function() {
    if (this._receiptBatch.length === 0) return;

    const batch = [...this._receiptBatch];
    this._receiptBatch = []; // Clear the batch
    this._batchTimeoutId = null;

    // Track batch metrics by campaign
    const campaignGroups = new Map<string, number>();
    let unassignedCount = 0;
    
    batch.forEach(receipt => {
      if (receipt.campaignId) {
        const count = campaignGroups.get(receipt.campaignId) || 0;
        campaignGroups.set(receipt.campaignId, count + 1);
        
        // Update campaign statistics
        if (!this._campaignStats.has(receipt.campaignId)) {
          this._campaignStats.set(receipt.campaignId, { total: 0, batches: 0, sent: 0, failed: 0 });
        }
        const stats = this._campaignStats.get(receipt.campaignId)!;
        stats.total++;
        if (receipt.status === 'SENT') stats.sent++;
        else stats.failed++;
      } else {
        unassignedCount++;
      }
    });
    
    // Create a batch ID for tracking
    const batchId = progressTracker.startBatch('delivery-receipts', batch.length);

    // Create campaign info string
    let campaignInfo = '';
    if (campaignGroups.size > 0) {
      campaignInfo = Array.from(campaignGroups.entries())
        .map(([id, count]) => `${id.substring(0, 8)}:${count}`)
        .join(', ');
      
      if (unassignedCount > 0) {
        campaignInfo += `, unassigned:${unassignedCount}`;
      }
    }
    
    // Direct console log with highlight colors to ensure visibility
    console.log(`\x1b[44m\x1b[37m VENDOR API BATCH \x1b[0m Sending ${batch.length} receipts to API ${campaignInfo ? `(${campaignInfo})` : ''}`);
    
    // Log with more visible formatting
    logger.info(`
╔════════════════════════════════════════════════════════════╗
║                 DELIVERY RECEIPT BATCH                     ║
╠════════════════════════════════════════════════════════════╣
║ Size: ${batch.length.toString().padEnd(15)} │ Batch #${batchId.toString().padEnd(20)} ║
${campaignInfo ? `║ Campaigns: ${campaignInfo.padEnd(45)} ║\n` : ''}╚════════════════════════════════════════════════════════════╝`);

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

    try {
      const response = await fetch(`${baseUrl}/api/delivery-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new Error(`Failed to log batch of ${batch.length} delivery receipts`);
      }
      
      // Update campaign batch counts
      campaignGroups.forEach((count, campaignId) => {
        const stats = this._campaignStats.get(campaignId)!;
        stats.batches++;
      });

      // Log completion
      progressTracker.completeBatch(batchId, true);
      logger.info(`✓ Successfully sent batch of ${batch.length} receipts to queue`);
      
      // Log campaign statistics for completed campaigns
      this._logCampaignStats();

      return batch.map(receipt => ({ status: receipt.status, customerId: receipt.customerId }));
    } catch (error) {
      progressTracker.completeBatch(batchId, false, error);
      logger.error(`✗ Failed to send batch of ${batch.length} receipts to queue`, error);
      return batch.map(receipt => ({ status: 'FAILED', customerId: receipt.customerId }));
    }
  },
  
  // Log campaign statistics when all receipts have been processed
  _logCampaignStats: function() {
    // Only log if we have stats to show
    if (this._campaignStats.size === 0) return;
    
    // Get campaigns with completed batches
    // const completedCampaigns = Array.from(this._campaignStats.entries())
    //   .filter(([_, stats]) => stats.batches > 0);
    const completedCampaigns = Array.from(this._campaignStats.entries())
      .filter(([, stats]) => stats.batches > 0);
    
    if (completedCampaigns.length === 0) return;
    
    // Create a formatted table-like output
    let statsOutput = `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    CAMPAIGN STATISTICS                     ┃
┣━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━┫
┃ Campaign           ┃ Sent/Total  ┃ Success %   ┃ Batches    ┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━╋━━━━━━━━━━━━╋━━━━━━━━━━━━┫`;
    
    completedCampaigns.forEach(([campaignId, stats]) => {
      const shortId = campaignId.substring(0, 12);
      const sentTotal = `${stats.sent}/${stats.total}`;
      const successRate = `${Math.round((stats.sent/stats.total)*100)}%`;
      const batches = stats.batches.toString();
      
      statsOutput += `
┃ ${shortId.padEnd(16)} ┃ ${sentTotal.padEnd(10)} ┃ ${successRate.padEnd(10)} ┃ ${batches.padEnd(10)} ┃`;
    });
    
    statsOutput += `
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━┻━━━━━━━━━━━━┻━━━━━━━━━━━━┛`;
    
    logger.info(statsOutput);
  },

  // Main function for sending messages
  sendMessage: async function(
    customer: { id: string; name: string; email: string }, 
    message: string,
    campaignId?: string
  ) {
    // Simulate real-world delivery success/failure (~90% SENT, ~10% FAILED)
    const success = Math.random() < 0.9;
    const status = success ? 'SENT' : 'FAILED';

    // Simulate API delay (but don't block processing)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Create receipt object
    const receipt: DeliveryReceipt = {
      customerId: customer.id,
      message,
      status,
      timestamp: new Date().toISOString(),
      campaignId
    };

    // Add to batch
    this._receiptBatch.push(receipt);
    
    // Process immediately if batch is full
    if (this._receiptBatch.length >= this._batchSize) {
      await this._processBatch();
    } 
    // Set a timeout to process if not already set
    else if (!this._batchTimeoutId) {
      this._batchTimeoutId = setTimeout(() => this._processBatch(), 1000);
    }

    // Return status immediately
    return { status, customerId: customer.id };
  },
  
  // Reset statistics for a new campaign run
  resetStats: function() {
    this._campaignStats.clear();
    
    // Process any remaining receipts
    if (this._receiptBatch.length > 0) {
      this._processBatch();
    }
  }
};

// Clear any existing batches when module is reloaded (for development)
if (process.env.NODE_ENV === 'development') {
  if (vendorApi._batchTimeoutId) {
    clearTimeout(vendorApi._batchTimeoutId);
    vendorApi._batchTimeoutId = null;
  }
}

// import { ICampaign } from '@/models/Campaign';
// import Customer from '@/models/Customer';
// import connectDB from './mongoose';

// async function sendDeliveryReceipt(campaignId: string, customerId: string, status: 'SENT' | 'FAILED') {
//   try {
//     const response = await fetch(`${process.env.NEXTAUTH_URL}/api/delivery-receipt`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ campaignId, customerId, status }),
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to send delivery receipt: ${response.statusText}`);
//     }

//     console.log(`Delivery receipt sent: campaign=${campaignId}, customer=${customerId}, status=${status}`);
//   } catch (error) {
//     console.error('Error sending delivery receipt:', error);
//   }
// }

// export async function simulateVendorApi(campaign: ICampaign) {
//   try {
//     await connectDB();

//     // Fetch customers in the segment
//     const customers = await Customer.find(); // Simplified; in practice, query based on segment rules
//     const audienceSize = Math.min(campaign.audienceSize, customers.length);

//     // Simulate sending messages to customers
//     for (let i = 0; i < audienceSize; i++) {
//       const customer = customers[i];
//       const status = Math.random() < 0.9 ? 'SENT' : 'FAILED'; // 90% SENT, 10% FAILED
//       await sendDeliveryReceipt(campaign._id.toString(), customer._id.toString(), status);

//       // Simulate delay (e.g., vendor processing time)
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     }

//     console.log(`Completed vendor simulation for campaign: ${campaign.name}`);
//   } catch (error) {
//     console.error('Error in vendor simulation:', error);
//   }
// }