"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logEvent = logEvent;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Simple logger function for debug and development
exports.logger = {
    log: (message, data = {}) => {
        console.log(`[Server] ${message}`, data);
    },
    error: (message, error) => {
        console.error(`[Server Error] ${message}`, error);
    },
    warn: (message, data = {}) => {
        console.warn(`[Server Warning] ${message}`, data);
    },
    debug: (message, data = {}) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Server Debug] ${message}`, data);
        }
    }
};
// Function for logging critical events to file
function logEvent(eventType, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        eventType,
        timestamp,
        details
    };
    console.log(`[SERVER-EVENT] ${eventType}: ${JSON.stringify(details)}`);
    // Optionally: Save critical events to a log file
    try {
        const logPath = path_1.default.join(__dirname, '../../critical-events.log');
        fs_1.default.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    }
    catch (error) {
        console.error('[Server] Failed to write to event log:', error);
    }
}
