import { createClient } from '@supabase/supabase-js';

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
  async getQuestions(options: {
    subject?: string;
    grade?: number;
    language?: string;
    sortByGrade?: boolean;
  } = {}) {
    let query = supabase
      .from('questions')
      .select('*');

    if (options.subject) {
      query = query.eq('subject', options.subject);
    }

    if (options.grade) {
      query = query.eq('grade', options.grade);
    }

    if (options.language) {
      query = query.eq('language', options.language);
    }

    if (options.sortByGrade) {
      query = query.order('grade', { ascending: true });
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching questions:', error);
      throw error;
    }

    return data as Question[];
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

  // Get subjects filtered by language
  async getSubjectsByLanguage(language?: string) {
    let query = supabase
      .from('questions')
      .select('subject')
      .order('subject');

    if (language) {
      query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching subjects by language:', error);
      throw error;
    }

    return Array.from(new Set(data.map(q => q.subject)));
  },

  // Get grades filtered by language
  async getGradesByLanguage(language?: string) {
    let query = supabase
      .from('questions')
      .select('grade')
      .order('grade');

    if (language) {
      query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching grades by language:', error);
      throw error;
    }

    return Array.from(new Set(data.map(q => q.grade))).sort((a, b) => a - b);
  },

  // Upload multiple questions from JSON
  async uploadQuestions(questions: QuestionUpload[]) {
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select();

    if (error) {
      console.error('Error uploading questions:', error);
      throw error;
    }

    return data as Question[];
  }
}; 