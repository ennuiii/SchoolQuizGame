import { Question } from '../types';

export interface PointsBreakdown {
  base: number;
  time: number;
  position: number;
  streakMultiplier: number;
  total: number;
}

export class PointsCalculator {
  private static readonly POSITION_BONUSES = [300, 200, 100, 50, 25]; // For positions 0-4
  private static readonly STREAK_MULTIPLIERS = [1, 1.2, 1.5, 2, 2.5, 3]; // For streaks 0-5+

  /**
   * Calculate points for a correct answer based on various factors
   * @param question The question that was answered
   * @param answerTimeSeconds Time taken to answer in seconds
   * @param position Position in which the answer was submitted (0-based)
   * @param streak Current streak of correct answers
   * @param totalTimeAllowed Total time allowed for the question in seconds
   * @returns Object containing point breakdown and total
   */
  public static calculatePoints(
    question: Question,
    answerTimeSeconds: number,
    position: number,
    streak: number,
    totalTimeAllowed: number
  ): PointsBreakdown {
    console.log(`[POINTS CALC DEBUG] Starting calculation with inputs:`, {
      questionGrade: question.grade,
      answerTimeSeconds,
      position,
      streak,
      totalTimeAllowed
    });
    
    // Base points = question grade * 100
    const basePoints = question.grade * 100;
    console.log(`[POINTS CALC DEBUG] Base points: ${question.grade} * 100 = ${basePoints}`);
    
    // Time bonus: Up to 50% of base points for faster answers
    // Formula: basePoints * 0.5 * ((totalTimeAllowed - answerTimeSeconds) / totalTimeAllowed) ** 1.5
    // The exponent makes the bonus more significant for very fast answers
    const timeRatio = Math.max(0, (totalTimeAllowed - answerTimeSeconds) / totalTimeAllowed);
    const timeBonus = Math.max(0, basePoints * 0.5 * Math.pow(timeRatio, 1.5));
    console.log(`[POINTS CALC DEBUG] Time bonus: timeRatio=${timeRatio.toFixed(3)}, bonus=${timeBonus.toFixed(2)}`);
    
    // Position bonus: Fixed bonuses for first few submissions
    const positionBonus = position < this.POSITION_BONUSES.length ? this.POSITION_BONUSES[position] : 0;
    console.log(`[POINTS CALC DEBUG] Position bonus: position=${position}, bonus=${positionBonus}`);
    
    // Streak multiplier: Bonus for consecutive correct answers
    const streakIndex = Math.min(streak, this.STREAK_MULTIPLIERS.length - 1);
    const streakMultiplier = this.STREAK_MULTIPLIERS[streakIndex];
    console.log(`[POINTS CALC DEBUG] Streak multiplier: streak=${streak}, index=${streakIndex}, multiplier=${streakMultiplier}`);
    
    // Calculate total: (base + timeBonus + positionBonus) * streakMultiplier
    const subtotal = basePoints + timeBonus + positionBonus;
    const total = Math.round(subtotal * streakMultiplier);
    
    console.log(`[POINTS CALC DEBUG] Final calculation: (${basePoints} + ${timeBonus.toFixed(2)} + ${positionBonus}) * ${streakMultiplier} = ${total}`);
    
    const result = {
      base: Math.round(basePoints),
      time: Math.round(timeBonus),
      position: Math.round(positionBonus),
      streakMultiplier: streakMultiplier,
      total: total
    };
    
    console.log(`[POINTS CALC DEBUG] Final result:`, result);
    return result;
  }

  /**
   * Calculate points for incorrect answers (always 0 but maintains structure)
   */
  public static calculateIncorrectAnswerPoints(): PointsBreakdown {
    return {
      base: 0,
      time: 0,
      position: 0,
      streakMultiplier: 0,
      total: 0
    };
  }

  /**
   * Utility method to format time in seconds to a readable format
   */
  public static formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  /**
   * Get position bonus for a given position
   */
  public static getPositionBonus(position: number): number {
    return position < this.POSITION_BONUSES.length ? this.POSITION_BONUSES[position] : 0;
  }

  /**
   * Get streak multiplier for a given streak
   */
  public static getStreakMultiplier(streak: number): number {
    const streakIndex = Math.min(streak, this.STREAK_MULTIPLIERS.length - 1);
    return this.STREAK_MULTIPLIERS[streakIndex];
  }
} 