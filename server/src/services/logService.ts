import fs from 'fs';
import path from 'path';
import { LogEntry } from '../types';

// Simple logger function for debug and development
export const logger = {
  log: (message: string, data: any = {}): void => {
    console.log(`[Server] ${message}`, data);
  },
  
  error: (message: string, error: Error | any): void => {
    console.error(`[Server Error] ${message}`, error);
  },
  
  warn: (message: string, data: any = {}): void => {
    console.warn(`[Server Warning] ${message}`, data);
  },
  
  debug: (message: string, data: any = {}): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Server Debug] ${message}`, data);
    }
  }
};

// Function for logging critical events to file
export function logEvent(eventType: string, details: any): void {
  const timestamp = new Date().toISOString();
  const logEntry: LogEntry = {
    eventType,
    timestamp,
    details
  };
  
  console.log(`[SERVER-EVENT] ${eventType}: ${JSON.stringify(details)}`);
  
  // Optionally: Save critical events to a log file
  try {
    const logPath = path.join(__dirname, '../../critical-events.log');
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('[Server] Failed to write to event log:', error);
  }
} 