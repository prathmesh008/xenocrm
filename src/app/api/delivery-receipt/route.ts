import { NextRequest, NextResponse } from 'next/server';
import { batchProcessor } from '@/lib/batchProcessor';
import { logger } from '@/lib/logger';
import { validateApiKey, unauthorizedResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  // Skip authentication in development mode
  
  
  try {
    const body = await request.json();
    
    // Check if this is a single receipt or a batch
    if (Array.isArray(body)) {
      // Handle batch of receipts
      const receipts = body.map(item => ({
        customerId: item.customerId,
        message: item.message,
        status: item.status,
        timestamp: item.timestamp,
        campaignId: item.campaignId
      }));
      
      // Early validation - make sure all required fields are present
      const invalidReceipts = receipts.filter(receipt => 
        !receipt.customerId || !receipt.message || !receipt.status || !receipt.timestamp
      );
      
      if (invalidReceipts.length > 0) {
        return NextResponse.json(
          { error: 'Missing required fields in receipts', invalidCount: invalidReceipts.length },
          { status: 400 }
        );
      }
      
      // Group receipts by campaign for better logging
      const campaignGroups = new Map<string, number>();
      for (const receipt of receipts) {
        if (receipt.campaignId) {
          const count = campaignGroups.get(receipt.campaignId) || 0;
          campaignGroups.set(receipt.campaignId, count + 1);
        }
      }
      
      // Create readable campaign summary
      let campaignSummary = '';
      if (campaignGroups.size > 0) {
        campaignSummary = Array.from(campaignGroups.entries())
          .map(([id, count]) => `${id.substring(0, 8)}:${count}`)
          .join(', ');
        
        // Log with prominent visual indicator
        const message = `▶▶▶ BATCH RECEIVED [${receipts.length} receipts] ◀◀◀ (${campaignSummary})`;
        logger.info(message);
        
        // Direct console log to ensure visibility
        console.log(`\x1b[42m\x1b[30m BATCH API CALL \x1b[0m ${receipts.length} receipts received (${campaignSummary})`);
      } else {
        logger.info(`▶▶▶ BATCH RECEIVED [${receipts.length} receipts] ◀◀◀`);
        
        // Direct console log to ensure visibility
        console.log(`\x1b[42m\x1b[30m BATCH API CALL \x1b[0m ${receipts.length} receipts received`);
      }
      
      // Process as a batch
      await batchProcessor.addBulkReceipts(receipts);
      
      return NextResponse.json(
        { message: `${receipts.length} receipts queued for processing` }, 
        { status: 200 }
      );
    } else {
      // Handle single receipt
      const { customerId, message, status, timestamp, campaignId } = body;

      // Make sure all required fields are present
      if (!customerId || !message || !status || !timestamp) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      if (campaignId) {
        logger.info(`⚠️ Single receipt received (campaign: ${campaignId.substring(0, 8)}) - Consider using batch endpoint`);
      } else {
        logger.info(`⚠️ Single receipt received - Consider using batch endpoint`);
      }
      
      // Direct console log to ensure visibility
      console.log(`\x1b[43m\x1b[30m SINGLE RECEIPT \x1b[0m received for customer ${customerId.substring(0, 8)}`);

      await batchProcessor.addReceipt({
        customerId,
        message,
        status,
        timestamp,
        campaignId
      });

      return NextResponse.json({ message: 'Receipt queued for processing' }, { status: 200 });
    }
  } catch (error) {
    logger.error('Error queuing delivery receipt', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}