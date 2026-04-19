import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone?: string;
  spend: number;
  visits: number;
  orders?: number;
  avg_order_value?: number;
  clv?: number;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // Add index signature for dynamic field access
}

// Helper function to handle numeric field conversion
// const numericGetter = (value: any) => {
//   if (typeof value === 'string') {
//     // Remove quotes and convert to number
//     return Number(value.replace(/^["']|["']$/g, ''));
//   }
//   return value;
// };

// Helper function to convert string to number
const stringToNumber = {
  type: mongoose.Schema.Types.Mixed, // Use Mixed type to bypass mongoose's type checking
  default: 0,
  get: function(value: any) {
    if (typeof value === 'string') {
      const cleanValue = value.replace(/^["']|["']$/g, '');
      return Number(cleanValue);
    }
    return value;
  },
  set: function(value: any) {
    if (typeof value === 'string') {
      const cleanValue = value.replace(/^["']|["']$/g, '');
      return Number(cleanValue);
    }
    return value;
  }
};

const CustomerSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  spend: stringToNumber,
  visits: stringToNumber,
  orders: stringToNumber,
  avg_order_value: stringToNumber,
  clv: stringToNumber,
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true },
  strict: false, // Allow fields not specified in the schema
  strictQuery: false // Disable strict mode for queries
});

// Create indexes
CustomerSchema.index({ lastActive: -1 });
CustomerSchema.index({ spend: -1 });
CustomerSchema.index({ visits: -1 });
CustomerSchema.index({ orders: -1 });
CustomerSchema.index({ avg_order_value: -1 });
CustomerSchema.index({ clv: -1 });

// Pre-save middleware to ensure numeric fields are properly converted
CustomerSchema.pre('save', function(next) {
  // Convert string values to numbers for numeric fields
  const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
  const doc = this as ICustomer;
  
  for (const field of numericFields) {
    if (doc.isModified(field) && typeof doc[field] === 'string') {
      const cleanValue = (doc[field] as string).replace(/^["']|["']$/g, '');
      doc[field] = Number(cleanValue);
    }
  }
  
  next();
});

// Add a static method to safely query numeric fields
CustomerSchema.statics.safeFind = function(filter: any) {
  // Process the filter to handle numeric fields
  const processedFilter = processFilter(filter);
  // Return the query object directly without awaiting
  return this.find(processedFilter);
};

// Create a direct interface to the MongoDB collection
export class CustomerCollection {
  private static collection: any;

  static async getCollection() {
    if (!this.collection) {
      if (!mongoose.connection.readyState) {
        throw new Error('MongoDB connection not established');
      }
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('MongoDB database not available');
      }
      this.collection = db.collection('customers');
    }
    return this.collection;
  }

  static async find(filter: any, projection: any = { _id: 1, phone: 1, email: 1 }) {
    try {
      // Process the filter to ensure numeric fields are properly handled
      const processedFilter = this.prepareFilter(filter);
      
      // Get the MongoDB collection
      const collection = await this.getCollection();
      
      // Execute the query directly with the MongoDB driver
      const results = await collection.find(processedFilter).project(projection).toArray();
      
      return results.map((doc: any) => ({
        _id: doc._id.toString(),
        phone: doc.phone,
        email: doc.email
      }));
    } catch (error) {
      console.error('Error in CustomerCollection.find:', error);
      throw error;
    }
  }
  
  // Helper method to prepare filter for direct MongoDB queries
  private static prepareFilter(filter: any): any {
    if (!filter || typeof filter !== 'object') {
      return filter;
    }
    
    // Handle arrays (like in $and/$or operators)
    if (Array.isArray(filter)) {
      return filter.map(item => this.prepareFilter(item));
    }
    
    const result: Record<string, any> = {};
    const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
    
    for (const key of Object.keys(filter)) {
      // Fix malformed operators
      const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=$', '$eq').replace('$>', '$gt');
      const value = filter[key];
      
      // Handle logical operators
      if (fixedKey === '$and' || fixedKey === '$or') {
        result[fixedKey] = Array.isArray(value) 
          ? value.map(item => this.prepareFilter(item))
          : [this.prepareFilter(value)];
        continue;
      }
      
      // Handle nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (numericFields.includes(fixedKey)) {
          // For numeric fields with operators
          const fieldConditions: Record<string, any> = {};
          
          for (const op of Object.keys(value)) {
            // Fix any malformed operators
            const fixedOp = op.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=$', '$eq').replace('$>', '$gt');
            let opValue = value[op];
            
            // Convert string values to numbers for numeric fields
            if (typeof opValue === 'string') {
              const cleanValue = opValue.replace(/^["']|["']$/g, '');
              opValue = Number(cleanValue);
            }
            
            fieldConditions[fixedOp] = opValue;
          }
          
          result[fixedKey] = fieldConditions;
        } else {
          result[fixedKey] = this.prepareFilter(value);
        }
        continue;
      }
      
      // Handle direct field equality for numeric fields
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
}

// Helper function to process filter and convert numeric strings to numbers
function processFilter(filter: any): any {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  const numericFields = ['spend', 'visits', 'orders', 'avg_order_value', 'clv'];
  
  // Handle arrays (like in $and/$or operators)
  if (Array.isArray(filter)) {
    return filter.map(item => processFilter(item));
  }
  
  const result: Record<string, any> = {};
  
  for (const key of Object.keys(filter)) {
    // Fix malformed operators - this is critical for MongoDB to recognize operators
    const fixedKey = key.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=$', '$eq').replace('$>', '$gt');
    const value = filter[key];
    
    // Handle logical operators
    if (fixedKey === '$and' || fixedKey === '$or') {
      result[fixedKey] = Array.isArray(value) 
        ? value.map(item => processFilter(item))
        : [processFilter(value)];
      continue;
    }
    
    // Handle comparison operators
    if (fixedKey.startsWith('$') && typeof value === 'object' && value !== null) {
      result[fixedKey] = processFilter(value);
      continue;
    }
    
    // Handle field conditions
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (numericFields.includes(fixedKey)) {
        // For numeric fields with operators
        const fieldConditions: Record<string, any> = {};
        
        for (const op of Object.keys(value)) {
          // Fix any malformed operators
          const fixedOp = op.replace('$<=', '$lte').replace('$>=', '$gte').replace('$=$', '$eq').replace('$>', '$gt');
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
        result[fixedKey] = processFilter(value);
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

interface CustomerModel extends mongoose.Model<ICustomer> {
  safeFind(filter: any): Promise<ICustomer[]>;
}

export const Customer = (mongoose.models.Customer || 
  mongoose.model<ICustomer, CustomerModel>('Customer', CustomerSchema)) as CustomerModel;
export default Customer;