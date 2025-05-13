import { createClient } from '@supabase/supabase-js';
import type { Question } from '../types/game';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
  created_at?: string;
}

export interface QuestionUpload {
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

export const supabaseService = {
  // Get all questions with optional filters
  async getQuestions(options?: {
    subject?: string;
    grade?: number;
    language?: string;
    sortByGrade?: boolean;
  }): Promise<Question[]> {
    let query = supabase.from('questions').select('*');

    if (options?.subject) {
      query = query.eq('subject', options.subject);
    }

    if (options?.grade) {
      query = query.eq('grade', options.grade);
    }

    if (options?.language) {
      query = query.eq('language', options.language);
    }

    if (options?.sortByGrade) {
      query = query.order('grade', { ascending: true });
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Add a new question to the database
  async addQuestion(question: QuestionUpload) {
    const { data, error } = await supabase
      .from('questions')
      .insert([question])
      .select()
      .single();

    if (error) {
      console.error('Error adding question:', error);
      throw error;
    }

    return data as Question;
  },

  // Update an existing question
  async updateQuestion(id: number, updates: Partial<Question>) {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating question:', error);
      throw error;
    }

    return data[0] as Question;
  },

  // Delete a question
  async deleteQuestion(id: number) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting question:', error);
      throw error;
    }

    return true;
  },

  // Get all subjects
  async getSubjects() {
    const { data, error } = await supabase
      .from('questions')
      .select('subject')
      .order('subject');

    if (error) {
      console.error('Error fetching subjects:', error);
      throw error;
    }

    return Array.from(new Set(data.map(q => q.subject)));
  },

  // Get all languages
  async getLanguages() {
    const { data, error } = await supabase
      .from('questions')
      .select('language')
      .order('language');

    if (error) {
      console.error('Error fetching languages:', error);
      throw error;
    }

    return Array.from(new Set(data.map(q => q.language)));
  },

  // Upload multiple questions from JSON
  async uploadQuestions(questions: Question[]) {
    const { error } = await supabase
      .from('questions')
      .insert(questions);

    if (error) throw error;
  },

  async createRoom(): Promise<string> {
    const { data, error } = await supabase
      .from('rooms')
      .insert([{ created_at: new Date() }])
      .select('id')
      .single();
      
    if (error) throw error;
    return data.id;
  },

  async checkRoomExists(roomCode: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomCode)
      .single();
      
    if (error) return false;
    return !!data;
  }
}; 