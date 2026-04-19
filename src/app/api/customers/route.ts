import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoose";
import Customer from "@/models/Customer";
import { batchProcessor } from "@/lib/batchProcessor";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const data = await req.json();
    
    // Add the customer creation to the batch queue
    await batchProcessor.addToBatch({
      model: "Customer",
      operation: "create",
      data: data
    });

    return NextResponse.json({ 
      message: "Customer creation queued successfully",
      status: "pending"
    });
  } catch (error) {
    logger.error("Error in customer creation", error);
    return NextResponse.json(
      { error: "Failed to queue customer creation" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const data = await req.json();
    
    await batchProcessor.addToBatch({
      model: "Customer",
      operation: "update",
      data: data
    });

    return NextResponse.json({ 
      message: "Customer update queued successfully",
      status: "pending"
    });
  } catch (error) {
    logger.error("Error in customer update", error);
    return NextResponse.json(
      { error: "Failed to queue customer update" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    await batchProcessor.addToBatch({
      model: "Customer",
      operation: "delete",
      data: { _id: id }
    });

    return NextResponse.json({ 
      message: "Customer deletion queued successfully",
      status: "pending"
    });
  } catch (error) {
    logger.error("Error in customer deletion", error);
    return NextResponse.json(
      { error: "Failed to queue customer deletion" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectToDatabase();
    const customers = await Customer.find().select("name email spend visits lastActive");
    return NextResponse.json(customers);
  } catch (error) {
    logger.error("Error fetching customers", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}