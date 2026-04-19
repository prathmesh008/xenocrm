import { batchProcessor } from '../lib/batchProcessor';
import connectToDatabase from '../lib/mongoose';

async function testBatchProcessing() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    
    // Use the imported batchProcessor instance directly
    
    // Create a test message batch
    const testBatch = {
      segmentId: 'test-segment-id',
      messageContent: 'This is a test message',
      audienceFilter: {
        spend: { $gt: 50 }
      },
      campaignId: 'test-campaign-id'
    };

    console.log('Adding message batch to queue...');
    
    // Add message batch to queue
    await batchProcessor.addMessageBatch(testBatch);

    console.log('Message batch added to queue. It will be processed automatically.');
    console.log('Waiting for processing to complete...');
    
    // Wait for a while to see the processing
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Stop the batch processor
    await batchProcessor.stop();
    
    console.log('Test completed. Check your MongoDB database for the communication logs.');
    process.exit(0);
  } catch (error) {
    console.error('Error in test:', error);
    process.exit(1);
  }
}

testBatchProcessing();
