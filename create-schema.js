// Create database schema in Supabase
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function createSchema() {
  try {
    console.log('Reading SQL schema file...');
    // Read the SQL file
    const sqlQueries = fs.readFileSync('./supabase-schema.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlQueries.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute.`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(stmt.substring(0, 100) + (stmt.length > 100 ? '...' : ''));
      
      const { error } = await supabase.rpc('exec_sql', { sql_string: stmt });
      
      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
      } else {
        console.log(`Statement ${i + 1} executed successfully.`);
      }
    }
    
    // Verify the table was created
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .limit(5);
      
    if (error) {
      console.error('Error querying questions table:', error);
    } else {
      console.log('\nSuccessfully created and populated the questions table!');
      console.log(`Found ${data.length} records in the table.`);
      if (data.length > 0) {
        console.log('Sample record:', data[0]);
      }
    }
    
  } catch (error) {
    console.error('Exception during schema creation:', error);
  }
}

// Run the schema creation
createSchema(); 