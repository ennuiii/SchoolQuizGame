"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameAnalytics = void 0;
const logService_1 = require("./logService");
// Game Analytics class implementation
class GameAnalyticsService {
    constructor() {
        this.games = {};
    }
    addGame(roomCode) {
        logService_1.logger.log(`Creating analytics for new game in room ${roomCode}`);
        this.games[roomCode] = {
            startTime: new Date(),
            players: [],
            rounds: [],
            totalQuestions: 0,
            averageResponseTime: 0,
            correctAnswers: 0,
            totalAnswers: 0
        };
    }
    addPlayer(roomCode, player) {
        if (!this.games[roomCode]) {
            logService_1.logger.warn(`Tried to add player to non-existent game analytics for room ${roomCode}`);
            return;
        }
        logService_1.logger.log(`Adding player ${player.name} to game analytics for room ${roomCode}`);
        this.games[roomCode].players.push({
            id: player.id,
            name: player.name,
            joinTime: new Date(),
            answers: [],
            correctAnswers: 0,
            averageResponseTime: 0
        });
    }
    recordAnswer(roomCode, playerId, answer, isCorrect, responseTime) {
        const game = this.games[roomCode];
        if (!game) {
            logService_1.logger.warn(`Tried to record answer for non-existent game analytics in room ${roomCode}`);
            return;
        }
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            logService_1.logger.warn(`Player ${playerId} not found in game analytics for room ${roomCode}`);
            return;
        }
        // Add answer to player's history
        player.answers.push({
            answer,
            isCorrect: isCorrect === true, // Convert null to false for statistics
            responseTime
        });
        // Update player stats
        if (isCorrect === true) {
            player.correctAnswers++;
        }
        // Update player average response time
        const totalTime = player.answers.reduce((sum, a) => sum + a.responseTime, 0);
        player.averageResponseTime = totalTime / player.answers.length;
        // Update game stats
        game.totalAnswers++;
        if (isCorrect === true) {
            game.correctAnswers++;
        }
        // Update game average response time 
        game.averageResponseTime = (game.averageResponseTime * (game.totalAnswers - 1) + responseTime) / game.totalAnswers;
        logService_1.logger.log(`Recorded answer for player ${playerId} in room ${roomCode}`, {
            isCorrect,
            responseTime
        });
    }
    endGame(roomCode) {
        const game = this.games[roomCode];
        if (!game) {
            logService_1.logger.warn(`Tried to end non-existent game analytics for room ${roomCode}`);
            return;
        }
        game.endTime = new Date();
        game.duration = (game.endTime.getTime() - game.startTime.getTime()) / 1000; // in seconds
        // Calculate final statistics
        const totalPlayers = game.players.length;
        if (totalPlayers === 0 || game.totalQuestions === 0) {
            logService_1.logger.warn(`Cannot calculate final stats for room ${roomCode}: no players or questions`);
            return;
        }
        // Find fastest player
        const fastestPlayer = this.findFastestPlayer(game.players);
        // Find most accurate player
        const mostAccuratePlayer = this.findMostAccuratePlayer(game.players, game.totalQuestions);
        // Calculate average score across all players
        const averageScore = game.players.reduce((sum, p) => sum + (p.correctAnswers / Math.max(1, game.totalQuestions)), 0) / totalPlayers;
        const finalStats = {
            totalPlayers,
            averageScore,
            fastestPlayer,
            mostAccuratePlayer
        };
        game.finalStats = finalStats;
        logService_1.logger.log(`Game ended in room ${roomCode}, final stats calculated`);
        return finalStats;
    }
    getGameStats(roomCode) {
        return this.games[roomCode];
    }
    findFastestPlayer(players) {
        if (players.length === 0)
            return null;
        return players.reduce((fastest, player) => {
            // Only consider players with at least one answer
            if (player.answers.length === 0)
                return fastest;
            if (!fastest || player.averageResponseTime < fastest.averageResponseTime) {
                return player;
            }
            return fastest;
        }, null);
    }
    findMostAccuratePlayer(players, totalQuestions) {
        if (players.length === 0 || totalQuestions === 0)
            return null;
        let mostAccurate = null;
        let highestAccuracy = -1;
        players.forEach(player => {
            // Calculate accuracy as correct answers divided by total questions
            const accuracy = player.correctAnswers / Math.max(1, totalQuestions);
            if (accuracy > highestAccuracy) {
                highestAccuracy = accuracy;
                mostAccurate = { ...player, accuracy };
            }
        });
        return mostAccurate;
    }
}
// Export a singleton instance
exports.gameAnalytics = new GameAnalyticsService();
