import { createClient } from '@supabase/supabase-js'

// You would replace these with your actual Supabase URL and anon key
// These should be added to environment variables in production
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://msocknepcnzlrelwplkf.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language: string;
}

interface BulkInsertResult {
  success: boolean;
  count?: number;
  error?: string;
}

interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

class SupabaseService {
  /**
   * Authenticate an admin user
   * @param username Admin username
   * @param password Admin password
   * @returns Authentication result with token if successful
   */
  async authenticateAdmin(username: string, password: string): Promise<AuthResult> {
    try {
      // Query the admins table to check credentials
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Authentication error:', error);
        return { success: false, error: 'Authentication failed' };
      }

      if (!data) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Simple password verification
      // In a real application, passwords should be hashed and compared securely
      if (data.password !== password) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Generate a simple token (in a real app, use a proper JWT with secrets)
      const token = btoa(`${username}:${Date.now()}:admin`);

      return {
        success: true,
        token
      };
    } catch (err) {
      console.error('Authentication error:', err);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Verify an admin token
   * @param token The admin token to verify
   * @returns Boolean indicating if the token is valid
   */
  async verifyAdminToken(token: string): Promise<boolean> {
    try {
      // In a real application, you would verify JWT signature or session in database
      // For this example, we'll do a simple check
      const decoded = atob(token);
      const parts = decoded.split(':');
      
      if (parts.length !== 3 || parts[2] !== 'admin') {
        return false;
      }
      
      const timestamp = parseInt(parts[1], 10);
      const now = Date.now();
      
      // Check if token is not expired (24 hours validity)
      if (now - timestamp > 24 * 60 * 60 * 1000) {
        return false;
      }
      
      // Additional verification could check if the username exists in the admins table
      const username = parts[0];
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('username', username)
        .single();
        
      if (error || !data) {
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Token verification error:', err);
      return false;
    }
  }

  /**
   * Insert multiple questions into the database
   * @param questions Array of questions to insert
   * @param token Admin token for authorization
   * @returns Result of the bulk insert operation
   */
  async bulkInsertQuestions(questions: Omit<Question, 'id' | 'created_at'>[], token: string): Promise<BulkInsertResult> {
    try {
      // Verify admin token first
      const isAdmin = await this.verifyAdminToken(token);
      if (!isAdmin) {
        return { success: false, error: 'Unauthorized: Invalid admin token' };
      }
      
      // Insert questions in batches
      const { data, error } = await supabase
        .from('questions')
        .insert(questions)
        .select();
        
      if (error) {
        console.error('Error inserting questions:', error);
        return { success: false, error: error.message };
      }
      
      return {
        success: true,
        count: data?.length || 0
      };
    } catch (err) {
      console.error('Failed to insert questions:', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async getQuestions(options: {
    subject?: string;
    grade?: number;
    language?: string;
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

    const { data, error } = await query;
    if (error) throw error;
    return data as Question[];
  }

  async getSubjects() {
    const { data, error } = await supabase
      .from('questions')
      .select('subject')
      .order('subject');

    if (error) throw error;
    return [...new Set(data.map(q => q.subject))];
  }

  async getLanguages() {
    const { data, error } = await supabase
      .from('questions')
      .select('language')
      .order('language');

    if (error) throw error;
    return [...new Set(data.map(q => q.language))];
  }

  async updateQuestion(question: Question) {
    const { error } = await supabase
      .from('questions')
      .update({
        text: question.text,
        answer: question.answer,
        grade: question.grade,
        subject: question.subject,
        language: question.language
      })
      .eq('id', question.id);

    if (error) throw error;
  }

  async deleteQuestion(id: number) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

const supabaseService = new SupabaseService();
export default supabaseService; 