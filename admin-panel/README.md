# School Quiz Admin Panel

A separate admin panel for managing questions in the School Quiz Game. This application allows you to add, edit, and delete questions in the Supabase database.

## Features

- View all questions with filtering and sorting options
- Add new questions with text, answer, grade level, subject, and language
- Edit existing questions
- Delete questions
- Responsive design for all devices

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Deployment to Render.com

1. Create a new Static Site on Render.com
2. Connect your GitHub repository
3. Configure the build settings:
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`
4. Add your environment variables in the Render.com dashboard:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
5. Deploy!

## Development

- Built with React and TypeScript
- Uses React Bootstrap for UI components
- Connects directly to Supabase for data management
- No server-side code required

## Security

- Uses Supabase Row Level Security (RLS) for data protection
- Environment variables for sensitive credentials
- No direct database access from the client

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 