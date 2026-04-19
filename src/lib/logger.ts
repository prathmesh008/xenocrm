/**
 * Logger utility with configurable log levels
 * Controls output verbosity in different environments
 */

// Log levels in order of verbosity
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

// Configure log level based on environment
// Set to INFO for development and ERROR for production by default
const DEFAULT_LOG_LEVEL = process.env.NODE_ENV === 'development' 
  ? LogLevel.INFO 
  : LogLevel.ERROR;

// Get log level from env or use default
const LOG_LEVEL = process.env.LOG_LEVEL 
  ? parseInt(process.env.LOG_LEVEL, 10) 
  : DEFAULT_LOG_LEVEL;

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Helper to format messages consistently
const formatMessage = (type: string, message: string): string => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  
  // Handle multiline strings - add timestamp and type to each line
  if (message.includes('\n')) {
    const lines = message.split('\n');
    return lines.map((line, index) => {
      // Only add timestamp and type to the first line
      if (index === 0) {
        return `[${timestamp}] [${type}] ${line}`;
      } 
      // For visual block patterns, don't add timestamp
      else if (line.includes('━━━━') || line.includes('════') || 
               line.includes('┃') || line.includes('║')) {
        return line;
      } 
      // For other lines, add indentation
      else {
        return `              ${line}`;
      }
    }).join('\n');
  }
  
  return `[${timestamp}] [${type}] ${message}`;
};

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.DEBUG) {
      console.log(formatMessage('DEBUG', message), ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.INFO) {
      // Handle batch/campaign info messages with special formatting
      if (message.includes('BATCH') || message.includes('CAMPAIGN')) {
        // Use color for INFO batch messages to make them stand out
        console.info(colors.cyan + formatMessage('INFO', message) + colors.reset, ...args);
      } else {
        console.info(formatMessage('INFO', message), ...args);
      }
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.WARN) {
      console.warn(colors.yellow + formatMessage('WARN', message) + colors.reset, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.ERROR) {
      console.error(colors.red + formatMessage('ERROR', message) + colors.reset, ...args);
    }
  },
  
  // For critical infrastructure messages that should never be filtered
  system: (message: string) => {
    console.log(colors.magenta + formatMessage('SYSTEM', message) + colors.reset);
  }
}; 