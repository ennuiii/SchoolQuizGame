import { createClient } from '@supabase/supabase-js'

// You would replace these with your actual Supabase URL and anon key
// These should be added to environment variables in production
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://msocknepcnzlrelwplkf.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4';

// Debug info to console
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key is set:', !!supabaseKey);

// Ensure URL is properly formatted
let validSupabaseUrl = supabaseUrl;
try {
  // Test if the URL is valid by constructing a URL object
  new URL(validSupabaseUrl);
} catch (error) {
  console.error('Invalid Supabase URL:', error);
  // Fallback to a known valid URL format
  validSupabaseUrl = 'https://msocknepcnzlrelwplkf.supabase.co';
  console.log('Using fallback URL:', validSupabaseUrl);
}

// Initialize Supabase client
const supabase = createClient(validSupabaseUrl, supabaseKey);

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
  created_at?: string;
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
   * Get questions from the database with optional filters
   */
  async getQuestions(options?: {
    subject?: string;
    grade?: number;
    language?: string;
    limit?: number;
    sortByGrade?: boolean;
  }): Promise<Question[]> {
    try {
      let query = supabase.from('questions').select('*');

      // Apply filters if provided
      if (options?.subject) {
        query = query.eq('subject', options.subject);
      }

      if (options?.grade) {
        query = query.eq('grade', options.grade);
      }
      
      if (options?.language) {
        query = query.eq('language', options.language);
      }

      // Sort by grade if requested
      if (options?.sortByGrade) {
        query = query.order('grade', { ascending: true });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching questions:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      return [];
    }
  }

  /**
   * PRIVATE: Add a new question to the database - NOT AVAILABLE FOR CLIENT USE
   * This method is kept for administrative purposes only and should not be used
   * in the client application.
   * @private
   */
  private async _addQuestion(question: Omit<Question, 'id' | 'created_at'>): Promise<Question | null> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert([question])
        .select();

      if (error) {
        console.error('Error adding question:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (err) {
      console.error('Failed to add question:', err);
      return null;
    }
  }

  /**
   * Create a temporary question (not saved to database)
   * This allows creating questions for the current game session only
   */
  createTemporaryQuestion(question: Omit<Question, 'id' | 'created_at'>): Question {
    // Generate a temporary negative ID to avoid conflicts with database IDs
    // Database IDs are typically positive integers
    const tempId = -Math.floor(Math.random() * 10000) - 1;
    
    return {
      id: tempId,
      text: question.text,
      answer: question.answer,
      grade: question.grade,
      subject: question.subject,
      language: question.language
    };
  }

  /**
   * Get subjects for filtering
   */
  async getSubjects(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('subject')
        .order('subject');

      if (error) {
        console.error('Error fetching subjects:', error);
        return [];
      }

      // Extract unique subjects
      const subjects = Array.from(new Set(data.map((item: any) => item.subject)));
      return subjects as string[];
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
      return [];
    }
  }

  /**
   * Get available languages for filtering
   */
  async getLanguages(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('language')
        .order('language');

      if (error) {
        console.error('Error fetching languages:', error);
        return [];
      }

      // Extract unique languages
      const languages = Array.from(new Set(data.map((item: any) => item.language)));
      return languages as string[];
    } catch (err) {
      console.error('Failed to fetch languages:', err);
      return [];
    }
  }

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
      
      if (error || !data) {
        console.error('Error authenticating admin:', error);
        return { 
          success: false, 
          error: 'Authentication failed' 
        };
      }
      
      // In a real app, you would use proper password hashing
      // This is a simple implementation for demonstration
      if (data.password === password) {
        // Generate a simple token (in a real app, use JWT with proper signing)
        const token = btoa(`${username}:${Date.now()}`);
        
        return {
          success: true,
          token
        };
      } else {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }
    } catch (err) {
      console.error('Failed to authenticate:', err);
      return {
        success: false,
        error: 'Authentication error'
      };
    }
  }
  
  /**
   * Verify an admin token
   * @param token The authentication token to verify
   * @returns Whether the token is valid
   */
  async verifyAdminToken(token: string): Promise<boolean> {
    try {
      // In a real app, you would verify JWT signature
      // This is a simple implementation for demonstration
      const tokenData = atob(token);
      const [username, timestamp] = tokenData.split(':');
      
      // Check if token is expired (24 hour validity)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      const tokenAge = now - tokenTime;
      const tokenMaxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge > tokenMaxAge) {
        console.log('Token expired');
        return false;
      }
      
      // Check if username exists in admin table
      const { data, error } = await supabase
        .from('admins')
        .select('username')
        .eq('username', username)
        .single();
      
      if (error || !data) {
        console.error('Error verifying admin:', error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Failed to verify token:', err);
      return false;
    }
  }
  
  /**
   * Insert multiple questions into the database
   * @param questions Array of question objects to insert
   * @param token Admin authentication token
   * @returns Result of the bulk insert operation
   */
  async bulkInsertQuestions(questions: Omit<Question, 'id' | 'created_at'>[], token: string): Promise<BulkInsertResult> {
    try {
      // Verify admin token first
      const isAdmin = await this.verifyAdminToken(token);
      
      if (!isAdmin) {
        return {
          success: false,
          error: 'Not authorized'
        };
      }
      
      // Insert questions
      const { data, error } = await supabase
        .from('questions')
        .insert(questions)
        .select();
      
      if (error) {
        console.error('Error inserting questions:', error);
        return {
          success: false,
          error: error.message
        };
      }
      
      return {
        success: true,
        count: data.length
      };
    } catch (err) {
      console.error('Failed to insert questions:', err);
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
}

export default new SupabaseService(); 