import { GameAnalytics, GameAnalyticsData, Player } from '../types';

// Game Analytics implementation
class GameAnalyticsService implements GameAnalytics {
  games: Record<string, GameAnalyticsData> = {};
  
  addGame(roomCode: string): void {
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
  
  addPlayer(roomCode: string, player: Player): void {
    if (this.games[roomCode]) {
      this.games[roomCode].players.push({
        id: player.id,
        name: player.name,
        joinTime: new Date(),
        answers: [],
        correctAnswers: 0,
        averageResponseTime: 0
      });
    }
  }
  
  recordAnswer(roomCode: string, playerId: string, answer: string, isCorrect: boolean | null, responseTime: number): void {
    const game = this.games[roomCode];
    if (!game) return;
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) return;
    
    player.answers.push({ 
      answer, 
      isCorrect: isCorrect === true, 
      responseTime 
    });
    
    if (isCorrect === true) player.correctAnswers++;
    
    // Update player average response time
    const totalTime = player.answers.reduce((sum, a) => sum + a.responseTime, 0);
    player.averageResponseTime = totalTime / player.answers.length;
    
    // Update game stats
    game.totalAnswers++;
    if (isCorrect === true) game.correctAnswers++;
    game.averageResponseTime = (game.averageResponseTime * (game.totalAnswers - 1) + responseTime) / game.totalAnswers;
  }
  
  endGame(roomCode: string): any {
    const game = this.games[roomCode];
    if (!game) return;
    
    game.endTime = new Date();
    game.duration = (game.endTime.getTime() - game.startTime.getTime()) / 1000; // in seconds
    
    // Calculate final statistics
    const stats = {
      totalPlayers: game.players.length,
      averageScore: game.players.length > 0 ? 
        game.players.reduce((sum, p) => sum + (p.correctAnswers / (game.totalQuestions || 1)), 0) / game.players.length : 0,
      fastestPlayer: game.players.reduce((fastest, p) => 
        p.averageResponseTime < (fastest?.averageResponseTime ?? Infinity) ? p : fastest, null as any),
      mostAccuratePlayer: game.players.reduce((most, p) => 
        (p.correctAnswers / (game.totalQuestions || 1)) > (most?.accuracy ?? 0) ? 
          { ...p, accuracy: p.correctAnswers / (game.totalQuestions || 1) } : most, null as any)
    };
    
    game.finalStats = stats;
    return stats;
  }
  
  getGameStats(roomCode: string): GameAnalyticsData | undefined {
    return this.games[roomCode];
  }
}

// Create and export a singleton instance
export const gameAnalytics = new GameAnalyticsService(); 