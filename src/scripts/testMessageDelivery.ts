import { batchProcessor } from '../lib/batchProcessor';
import connectToDatabase from '../lib/mongoose';
import Segment from '../models/Segment';
import CommunicationLog from '../models/CommunicationLog';

async function testMessageDelivery() {
  try {
    // Connect to database
    await connectToDatabase();

    // Create a test segment
    const segment = await Segment.create({
      name: 'Test Batch Processing Segment',
      description: 'A test segment for batch message processing',
      filter: { spend: { $gt: 0 } }
    });

    console.log('Created test segment:', segment._id);

    // Queue message batch
    await batchProcessor.addMessageBatch({
      segmentId: segment._id.toString(),
      messageContent: 'Thank you for being a valued customer! Here is your special offer.',
      audienceFilter: segment.filter
    });

    console.log('Added message batch to queue');

    // Wait for some time to let the batch processor work
    console.log('Waiting for batch processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check communication logs
    const logs = await CommunicationLog.find({ segmentId: segment._id })
      .populate('customerId', 'email phone')
      .lean();

    console.log(`Created ${logs.length} communication logs`);
    console.log('Sample log:', logs[0]);

    // Simulate some delivery receipts
    for (const log of logs.slice(0, 5)) {
      await batchProcessor.addReceipt({
        customerId: log.customerId.toString(),
        message: log.message,
        status: 'delivered',
        timestamp: new Date()
      });
    }

    console.log('Added sample delivery receipts');

    // Wait for receipt processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check updated logs
    const deliveredCount = await CommunicationLog.countDocuments({
      segmentId: segment._id,
      status: 'delivered'
    });

    console.log(`Successfully delivered messages: ${deliveredCount}`);

    // Cleanup
    await Segment.findByIdAndDelete(segment._id);
    await CommunicationLog.deleteMany({ segmentId: segment._id });

    console.log('Test completed and cleanup done');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMessageDelivery();