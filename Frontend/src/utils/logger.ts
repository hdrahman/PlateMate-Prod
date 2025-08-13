// Production-safe logging utility
import { isDebug } from './config';

// Log levels
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

// Current log level - INFO in production, DEBUG in development
const CURRENT_LOG_LEVEL = isDebug ? LogLevel.DEBUG : LogLevel.INFO;

// Production-safe logger
export const logger = {
    error: (message: string, ...args: any[]) => {
        if (CURRENT_LOG_LEVEL >= LogLevel.ERROR) {
            console.error(message, ...args);
        }
    },
    
    warn: (message: string, ...args: any[]) => {
        if (CURRENT_LOG_LEVEL >= LogLevel.WARN) {
            console.warn(message, ...args);
        }
    },
    
    info: (message: string, ...args: any[]) => {
        if (CURRENT_LOG_LEVEL >= LogLevel.INFO) {
            console.log(message, ...args);
        }
    },
    
    debug: (message: string, ...args: any[]) => {
        if (CURRENT_LOG_LEVEL >= LogLevel.DEBUG) {
            console.log(message, ...args);
        }
    },
};

// Helper for database operations (minimal logging in production)
export const dbLogger = {
    error: logger.error,
    warn: logger.warn,
    // Only log database operations in development
    info: isDebug ? logger.info : () => {},
    debug: isDebug ? logger.debug : () => {},
};