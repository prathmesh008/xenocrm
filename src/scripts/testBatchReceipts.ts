/**
 * This script tests batch sending of delivery receipts
 * Run it to see the batch processing in action
 */

async function testBatchReceipts() {
  console.log('Testing batch delivery receipts...');
  
  // Create a batch of 20 receipts
  const batchSize = 10;
  const receipts = [];
  
  for (let i = 0; i < batchSize; i++) {
    receipts.push({
      customerId: `customer-${i+1}`,
      message: `Test message ${i+1}`,
      status: i % 2 === 0 ? 'delivered' : 'failed',
      timestamp: new Date().toISOString()
    });
  }
  
  const apiUrl = 'http://localhost:3000/api/delivery-receipt';
  
  try {
    console.log(`Sending batch of ${batchSize} delivery receipts...`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer development-api-key-xenocrm`
      },
      body: JSON.stringify(receipts)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`Success! ${result.message}`);
    } else {
      console.error('Failed to send receipts:', await response.text());
    }
  } catch (error) {
    console.error('Error sending batch receipts:', error);
  }
}

// Run the test
testBatchReceipts(); 