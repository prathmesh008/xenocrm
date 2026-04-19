import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoose";
import { CustomerCollection } from "@/models/Customer";
import { z } from "zod";
import { logger } from "@/lib/logger";

const ruleSchema = z.object({
  field: z.enum([
    "spend",
    "visits",
    "orders",
    "avg_order_value",
    "clv",
    "customer_since",
    "lastActive",
    "last_order",
    "preferred_category",
    "source",
  ]),
  operator: z.enum([
    ">",
    "<",
    "=",
    ">=",
    "<=",
    "contains",
    "startsWith",
    "endsWith",
  ]),
  value: z.any(), // Allow any type for value initially
  connector: z.enum(["AND", "OR"]).optional(),
});

// Custom refinement to handle numeric conversion
const refinedRuleSchema = ruleSchema.refine(
  (data) => {
    const numericFields = [
      "spend",
      "visits",
      "orders",
      "avg_order_value",
      "clv",
    ];
    if (numericFields.includes(data.field)) {
      if (typeof data.value === "string") {
        return !isNaN(parseFloat(data.value));
      }
      if (typeof data.value === "number") {
        return true;
      }
      return false;
    }
    return true;
  },
  {
    message: "Value must be a number for numeric fields",
    path: ["value"],
  }
);

const rulesSchema = z.array(refinedRuleSchema);

// Helper function to process numeric fields in a filter
function processNumericFields(filter: any): any {
  if (!filter || typeof filter !== "object") {
    return filter;
  }

  const numericFields = ["spend", "visits", "orders", "avg_order_value", "clv"];

  // Handle arrays (like in $and/$or operators)
  if (Array.isArray(filter)) {
    return filter.map((item) => processNumericFields(item));
  }

  const result: Record<string, any> = {};

  for (const key of Object.keys(filter)) {
    const value = filter[key];

    // Handle logical operators
    if (key === "$and" || key === "$or") {
      result[key] = Array.isArray(value)
        ? value.map((item) => processNumericFields(item))
        : [processNumericFields(value)];
      continue;
    }

    // Handle comparison operators
    if (key.startsWith("$") && typeof value === "object" && value !== null) {
      result[key] = processNumericFields(value);
      continue;
    }

    // Handle field conditions
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (numericFields.includes(key)) {
        // For numeric fields with operators
        const fieldConditions: Record<string, any> = {};

        for (const op of Object.keys(value)) {
          let opValue = value[op];

          if (typeof opValue === "string") {
            const cleanValue = opValue.replace(/^["']|["']$/g, "");
            opValue = Number(cleanValue);
            if (isNaN(opValue)) {
              // Skip if conversion results in NaN
              continue;
            }
          }

          fieldConditions[op] = opValue;
        }

        result[key] = fieldConditions;
      } else {
        // For non-numeric fields
        result[key] = processNumericFields(value);
      }
      continue;
    }

    // Handle direct field equality
    if (numericFields.includes(key)) {
      if (typeof value === "string") {
        const cleanValue = value.replace(/^["']|["']$/g, "");
        const numValue = Number(cleanValue);
        if (!isNaN(numValue)) {
          result[key] = numValue;
        }
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const { rules } = await request.json();
    const validatedRules = z.array(ruleSchema).parse(rules);

    const query: any = {};
    validatedRules.forEach((rule, index) => {
      const { field, operator, value } = rule;
      let condition: any;

      // Handle different field types
      switch (field) {
        // Numeric fields
        case "spend":
        case "avg_order_value":
        case "clv":
          condition = {
            [field]: { [`$${operatorMap(operator)}`]: parseFloat(value) },
          };
          break;

        // Integer fields
        case "visits":
        case "orders":
          condition = {
            [field]: { [`$${operatorMap(operator)}`]: parseInt(value) },
          };
          break;

        // Date fields
        case "customer_since":
        case "lastActive":
        case "last_order":
          
          condition = {
            [field]: { [`$${operatorMap(operator)}`]: new Date(value) },
          };
          break;

        // String fields
        case "preferred_category":
        case "source":
          if (operator === "contains") {
            condition = { [field]: { $regex: value, $options: "i" } };
          } else if (operator === "startsWith") {
            condition = { [field]: { $regex: `^${value}`, $options: "i" } };
          } else if (operator === "endsWith") {
            condition = { [field]: { $regex: `${value}$`, $options: "i" } };
          } else {
            condition = { [field]: { [`$${operatorMap(operator)}`]: value } };
          }
          break;
      }

      // Handle query connectors
      if (index === 0) {
        query.$and = [condition];
      } else {
        const connector = validatedRules[index - 1].connector || "AND";
        if (connector === "AND") {
          query.$and.push(condition);
        } else {
          query.$or = query.$or || [];
          query.$or.push(condition);
        }
      }
    });

    // Process the query to ensure numeric values are handled correctly
    const processedQuery = processNumericFields(query);
    logger.debug(`Preview query: ${JSON.stringify(processedQuery)}`);

    // Use the direct MongoDB collection interface to count customers
    try {
      const collection = await CustomerCollection.getCollection();

      try {
        // First attempt with the processed query
        const count = await collection.countDocuments(processedQuery);
        logger.info(`Found ${count} matching customers`);
        return NextResponse.json({ count });
      } catch (queryError) {
        logger.error("Error with processed query", queryError);

        // Fallback to a simplified query
        try {
          // Create a simplified query that only keeps basic conditions
          const simplifiedQuery = {};
          const count = await collection.countDocuments(simplifiedQuery);
          logger.info(`Fallback count: ${count} total customers`);
          return NextResponse.json({
            count,
            warning: "Query failed, showing total customer count",
          });
        } catch (fallbackError) {
          logger.error("Fallback query failed", fallbackError);
          return NextResponse.json({
            count: 0,
            error: "Could not count customers",
          });
        }
      }
    } catch (directError) {
      logger.error("Error accessing MongoDB collection", directError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    logger.error("Error previewing audience", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function operatorMap(operator: string) {
  const map: { [key: string]: string } = {
    ">": "gt",
    "<": "lt",
    "=": "eq",
    ">=": "gte",
    "<=": "lte",
    contains: "regex",
    startsWith: "regex",
    endsWith: "regex",
  };
  return map[operator] || "eq";
}
