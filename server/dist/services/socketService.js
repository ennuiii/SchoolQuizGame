"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
exports.createSocketService = createSocketService;
const socket_io_1 = require("socket.io");
const logService_1 = require("./logService");
/**
 * SocketService class to manage all socket.io interactions
 */
class SocketService {
    /**
     * Create a new SocketService instance
     */
    constructor(server, allowedOrigins = ['http://localhost:3000']) {
        this.disconnectTimers = new Map();
        // Initialize Socket.IO
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: allowedOrigins,
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            maxHttpBufferSize: 5e6, // 5MB
            pingTimeout: 60000,
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: true
            }
        });
        // Setup socket event handlers
        this.setupSocketHandlers();
        logService_1.logger.log('SocketService initialized', {});
    }
    /**
     * Set up all socket event handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logService_1.logger.log(`User connected to socket: ${socket.id}`, {});
            // Handle disconnect
            socket.on('disconnect', (reason) => {
                logService_1.logger.log(`User disconnected: ${socket.id}, reason: ${reason}`, {});
            });
        });
    }
}
exports.SocketService = SocketService;
/**
 * Create a SocketService instance
 */
function createSocketService(server, allowedOrigins = ['http://localhost:3000']) {
    return new SocketService(server, allowedOrigins);
}
