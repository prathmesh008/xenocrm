import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongoose';
import { batchProcessor } from '@/lib/batchProcessor';
import Segment from '@/models/Segment';
import { generateMessageContent } from '@/lib/ai';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const data = await req.json();

    // Ensure filter is present and properly formatted
    if (!data.rules || !Array.isArray(data.rules) || data.rules.length === 0) {
      return NextResponse.json(
        { error: 'Filter criteria is required and must be a non-empty array of rules' },
        { status: 400 }
      );
    }

    // Define field types for type conversion
    const fieldTypes = {
      spend: 'number',
      visits: 'number',
      orders: 'number',
      avg_order_value: 'number',
      clv: 'number',
      lastActive: 'date',
      createdAt: 'date',
      updatedAt: 'date',
      customer_since: 'date',
      last_order: 'date',
      preferred_category: 'string',
      source: 'string'
    };

    // Convert rules array to filter object
    const conditions = [];

    // Process each rule
    for (const rule of data.rules) {
      if (rule.field && rule.operator && rule.value) {
        let convertedValue = rule.value;
        
        // Convert value based on field type
        if (fieldTypes[rule.field as keyof typeof fieldTypes] === 'number') {          
          // Handle numeric values
          let numValue: number;
          
          if (typeof rule.value === 'string') {
            // Remove quotes if present and convert to number
            const cleanValue = rule.value.replace(/^["']|["']$/g, '');
            numValue = Number(cleanValue);
          } else if (typeof rule.value === 'number') {
            numValue = rule.value;
          } else {
            numValue = Number(rule.value);
          }
          
          if (isNaN(numValue)) {
            throw new Error(`Invalid number value for field ${rule.field}: ${rule.value}`);
          }
          
          convertedValue = numValue;
          
          // For visits and orders fields, ensure they're integers
          if (rule.field === 'visits' || rule.field === 'orders') {
            convertedValue = Math.floor(convertedValue);
          }
          
          // Ensure we're storing a number, not a string representation of a number
          if (rule.operator === '=') {
            conditions.push({ [rule.field]: convertedValue });
          } else {
            const mongoOperator = `$${rule.operator}`;
            conditions.push({ [rule.field]: { [mongoOperator]: convertedValue } });
          }
          continue; // Skip the default condition handling below
        } else if (fieldTypes[rule.field as keyof typeof fieldTypes] === 'date') {
          convertedValue = new Date(rule.value);
          if (isNaN(convertedValue.getTime())) {
            throw new Error(`Invalid date value for field ${rule.field}: ${rule.value}`);
          }
          
          // Store date objects directly
          if (rule.operator === '=') {
            conditions.push({ [rule.field]: convertedValue });
          } else {
            const mongoOperator = `$${rule.operator}`;
            conditions.push({ [rule.field]: { [mongoOperator]: convertedValue } });
          }
          continue; // Skip the default condition handling below
        }

        // Build the condition based on operator for string fields
        if (rule.operator === 'contains') {
          conditions.push({ [rule.field]: { $regex: convertedValue, $options: 'i' } });
        } else if (rule.operator === 'startsWith') {
          conditions.push({ [rule.field]: { $regex: `^${convertedValue}`, $options: 'i' } });
        } else if (rule.operator === 'endsWith') {
          conditions.push({ [rule.field]: { $regex: `${convertedValue}$`, $options: 'i' } });
        } else if (rule.operator === '=') {
          conditions.push({ [rule.field]: convertedValue });
        } else {
          const mongoOperator = `$${rule.operator}`;
          conditions.push({ [rule.field]: { [mongoOperator]: convertedValue } });
        }
      }
    }

    // Create the final filter with $and
    const filter = conditions.length > 0 ? { $and: conditions } : {};

    // Log the filter at debug level instead of always showing
    logger.debug(`Creating segment with filter: ${JSON.stringify(filter)}`);

    // Ensure all numeric values are properly converted
    const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
    const processedFilter = processNumericFields(filter, numericFields);
    logger.debug(`Processed filter: ${JSON.stringify(processedFilter)}`);

    // Create the segment with the processed filter
    const segment = await Segment.create({
      name: data.name,
      description: data.description,
      filter: processedFilter,
      messageContent: data.messageContent,
      campaignId: data.campaignId
    });
    
    // Log successful creation at info level
    logger.info(`Created segment: ${data.name} with ID: ${segment._id}`);

    // Generate AI message content if not provided
    const messageContent = data.messageContent || await generateMessageContent(segment);

    // Queue the message batch for processing
    await batchProcessor.addMessageBatch({
      segmentId: segment._id.toString(),
      messageContent,
      audienceFilter: processedFilter, // Use the processed filter here
      campaignId: data.campaignId
    });

    return NextResponse.json({ 
      message: 'Segment created and messages queued',
      segment,
      messageContent
    });
  } catch (error) {
    logger.error('Error in segment creation:', error);
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create segment' },
      { status: 500 }
    );
  }
}

// Helper function to process numeric fields in a filter
function processNumericFields(filter: any, numericFields: string[]): any {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  // For arrays (like in $and/$or operators)
  if (Array.isArray(filter)) {
    return filter.map(item => processNumericFields(item, numericFields));
  }
  
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(filter)) {
    // Fix malformed operators
    const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt');
    const value = filter[key];
    
    // Handle logical operators
    if (fixedKey === '$and' || fixedKey === '$or') {
      result[fixedKey] = Array.isArray(value) 
        ? value.map(item => processNumericFields(item, numericFields))
        : [processNumericFields(value, numericFields)];
      continue;
    }
    
    // Handle field conditions
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (numericFields.includes(fixedKey)) {
        // For numeric fields with operators
        const fieldConditions: Record<string, any> = {};
        
        for (const op of Object.keys(value)) {
          // Fix malformed operators
          const fixedOp = op.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=', '$eq').replace('$>', '$gt').replace('$<', '$lt');
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
        result[fixedKey] = processNumericFields(value, numericFields);
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

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const data = await req.json();
    const { id, messageContent, ...updateData } = data;

    // Process any filter in the update data
    if (updateData.filter) {
      const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
      const processedFilter = processNumericFields(updateData.filter, numericFields);
      logger.debug(`Processed update filter: ${JSON.stringify(processedFilter)}`);
      updateData.filter = processedFilter;
    }

    const segment = await Segment.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Queue new messages if messageContent is provided
    if (messageContent) {
      // Ensure the filter is properly processed
      const processedFilter = segment.filter ? 
        processNumericFields(segment.filter, ['spend', 'visits', 'orders', 'avg_order_value', 'clv']) : 
        segment.filter;

      await batchProcessor.addMessageBatch({
        segmentId: segment._id.toString(),
        messageContent,
        audienceFilter: processedFilter,
        campaignId: data.campaignId
      });

      return NextResponse.json({ 
        message: 'Segment updated and messages queued',
        segment,
        messageContent
      });
    }

    return NextResponse.json({
      message: 'Segment updated successfully',
      segment
    });
  } catch (error) {
    logger.error('Error in segment update', error);
    return NextResponse.json(
      { error: 'Failed to update segment' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    const segments = await Segment.find().sort({ createdAt: -1 });
    return NextResponse.json(segments);
  } catch (error) {
    logger.error('Error fetching segments', error);
    return NextResponse.json(
      { error: 'Failed to fetch segments' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      );
    }

    const segment = await Segment.findByIdAndDelete(id);
    
    if (!segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Segment deleted successfully'
    });
  } catch (error) {
    logger.error('Error in segment deletion', error);
    return NextResponse.json(
      { error: 'Failed to delete segment' },
      { status: 500 }
    );
  }
}