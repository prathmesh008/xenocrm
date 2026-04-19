import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

/**
 * API key validation for webhook endpoints
 */
export const validateApiKey = (request: NextRequest, allowLocalhost: boolean = true) => {
  try {
    // If local development and localhost is allowed, bypass validation
    if (allowLocalhost && process.env.NODE_ENV === 'development') {
      const referer = request.headers.get('referer') || '';
      const host = request.headers.get('host') || '';
      
      if (referer.includes('localhost') || host.includes('localhost') || host.includes('127.0.0.1')) {
        return true;
      }
    }
    
    // Validate API key from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;

    const apiKey = authHeader.replace('Bearer ', '');
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      logger.warn('API_KEY environment variable is not set');
      return false;
    }
    
    // Validate key
    return apiKey === validApiKey;
  } catch (error) {
    logger.error('Error validating API key', error);
    return false;
  }
};

/**
 * Create an unauthorized response with JSON message
 */
export const unauthorizedResponse = () => {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}; 