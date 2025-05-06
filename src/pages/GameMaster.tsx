import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import supabaseService from '../services/supabaseService';

interface Player {
  id: string;
  name: string;
  lives: number;
  answers: string[];
  isActive: boolean;
}

interface PlayerBoard {
  playerId: string;
  playerName: string;
  boardData: string;
}

interface Question {
  id: number;
  text: string;
  answer?: string;
  grade: number;
  subject: string;
  language?: string;
}

interface AnswerSubmission {
  playerId: string;
  playerName: string;
  answer: string;
}

const GameMaster: React.FC = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [playerBoards, setPlayerBoards] = useState<PlayerBoard[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<AnswerSubmission[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de'); // Default to German
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [sortByGrade, setSortByGrade] = useState<boolean>(true);
  const [saveQuestionsToDatabase, setSaveQuestionsToDatabase] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to clear any existing timer
  const clearExistingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Helper function to start a new timer
  const startTimer = (duration: number) => {
    clearExistingTimer();
    setTimeRemaining(duration);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev !== null && prev > 0) {
          return prev - 1;
        } else {
          clearExistingTimer();
          return 0;
        }
      });
    }, 1000);
  };

  useEffect(() => {
    // Connect to socket server
    socketService.connect();

    // Set up event listeners
    socketService.on('room_created', (data) => {
      console.log('Room created:', data);
      setIsLoading(false);
      
      // Set room code received from server
      if (data && data.roomCode) {
        setRoomCode(data.roomCode);
        sessionStorage.setItem('roomCode', data.roomCode);
        sessionStorage.setItem('isGameMaster', 'true');
      }
      
      // Only start the game immediately if questions are already selected
      if (questions.length > 0) {
        setCurrentQuestion(questions[0]);
        
        // Start the game with sorted questions
        socketService.startGame(data.roomCode, questions, timeLimit || undefined);
        setGameStarted(true);
        
        // Initialize timer if timeLimit is set
        if (timeLimit) {
          startTimer(timeLimit);
        }
      }
    });
    
    // Add game_started event listener
    socketService.on('game_started', (data) => {
      console.log('Game started event received:', data);
      if (data && data.question) {
        // Ensure the question object has the expected structure
        const questionObj: Question = {
          id: data.question.id || 0,
          text: data.question.text || '',
          answer: data.question.answer,
          grade: data.question.grade || 0,
          subject: data.question.subject || '',
          language: data.question.language || 'de'
        };
        
        console.log('Setting current question:', questionObj);
        setCurrentQuestion(questionObj);
        setGameStarted(true);
        setCurrentQuestionIndex(0);
        
        // Initialize timer if timeLimit is set
        if (data.timeLimit) {
          setTimeLimit(data.timeLimit);
          startTimer(data.timeLimit);
        }
      }
    });
    
    // Add event handler for new_question event
    socketService.on('new_question', (data) => {
      console.log('New question event received:', data);
      if (data && data.question) {
        // Ensure the question object has the expected structure
        const questionObj: Question = {
          id: data.question.id || 0,
          text: data.question.text || '',
          answer: data.question.answer,
          grade: data.question.grade || 0,
          subject: data.question.subject || '',
          language: data.question.language || 'de'
        };
        
        console.log('Setting next question:', questionObj);
        setCurrentQuestion(questionObj);
        setCurrentQuestionIndex(prev => prev + 1);
        setPendingAnswers([]);
        
        // Reset timer for new question if time limit is set
        if (data.timeLimit) {
          setTimeLimit(data.timeLimit);
          startTimer(data.timeLimit);
        }
      }
    });
    
    socketService.on('player_joined', (player: Player) => {
      console.log('Player joined:', player);
      // Update players list when a player joins
      setPlayers(prevPlayers => {
        // Check if player already exists
        const existingIndex = prevPlayers.findIndex(p => p.id === player.id);
        if (existingIndex >= 0) {
          // Replace the existing player
          const updatedPlayers = [...prevPlayers];
          updatedPlayers[existingIndex] = player;
          return updatedPlayers;
        } else {
          // Add new player
          return [...prevPlayers, player];
        }
      });
    });

    socketService.on('players_update', (updatedPlayers: Player[]) => {
      console.log('Players updated:', updatedPlayers);
      setPlayers(updatedPlayers);
    });

    socketService.on('player_board_update', (data: PlayerBoard) => {
      console.log(`Received board update from ${data.playerName}`);
      setPlayerBoards(prevBoards => {
        const existingIndex = prevBoards.findIndex(b => b.playerId === data.playerId);
        if (existingIndex >= 0) {
          const updatedBoards = [...prevBoards];
          updatedBoards[existingIndex] = data;
          return updatedBoards;
        } else {
          return [...prevBoards, data];
        }
      });

      // If this player is currently selected, ensure the DOM is updated
      if (selectedPlayerId === data.playerId) {
        setTimeout(() => {
          const boardElement = document.querySelector('.drawing-board');
          if (boardElement) {
            boardElement.innerHTML = data.boardData;
          }
        }, 10);
      }
    });

    socketService.on('answer_submitted', (submission: AnswerSubmission) => {
      console.log(`Answer received from ${submission.playerName}:`, submission.answer);
      
      // Make sure we're not adding duplicate answers
      setPendingAnswers(prev => {
        // Check if we already have an answer from this player
        const existingIndex = prev.findIndex(a => a.playerId === submission.playerId);
        
        if (existingIndex >= 0) {
          // Replace the existing answer
          console.log(`Replacing existing answer for ${submission.playerName}`);
          const updatedAnswers = [...prev];
          updatedAnswers[existingIndex] = submission;
          return updatedAnswers;
        } else {
          // Add as new answer
          console.log(`Adding new answer from ${submission.playerName}`);
          return [...prev, submission];
        }
      });
    });

    socketService.on('error', (msg: string) => {
      setErrorMsg(msg);
      setIsLoading(false);
    });
    
    socketService.on('game_restarted', () => {
      // Reset game state on restart
      setGameStarted(false);
      setCurrentQuestion(null);
      setCurrentQuestionIndex(0);
      setPlayerBoards([]);
      setPendingAnswers([]);
      setTimeRemaining(null);
      setIsRestarting(false);
    });
    
    socketService.on('time_up', () => {
      setTimeRemaining(0);
    });

    // Check if returning from a refresh (restore state)
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const isGameMaster = sessionStorage.getItem('isGameMaster') === 'true';
    
    if (savedRoomCode && isGameMaster) {
      console.log('Rejoining as gamemaster for room:', savedRoomCode);
      setRoomCode(savedRoomCode);
      // Re-join as gamemaster to ensure we get the current state
      socketService.emit('rejoin_gamemaster', { roomCode: savedRoomCode });
    }

    // Clean up timers on component unmount
    return () => {
      clearExistingTimer();
      // Clean up listeners
      socketService.off('room_created');
      socketService.off('game_started');
      socketService.off('new_question');
      socketService.off('player_joined');
      socketService.off('players_update');
      socketService.off('player_board_update');
      socketService.off('answer_submitted');
      socketService.off('error');
      socketService.off('game_restarted');
      socketService.off('time_up');
    };
  }, [questions, timeLimit]); // Add dependencies

  // Fetch available subjects and languages from Supabase when component mounts
  useEffect(() => {
    const fetchData = async () => {
      const subjectList = await supabaseService.getSubjects();
      setSubjects(subjectList);
      
      const languageList = await supabaseService.getLanguages();
      setLanguages(languageList);
    };

    fetchData();
  }, []);

  const createRoom = () => {
    console.log('Creating new room...');
    setIsLoading(true);
    socketService.createRoom(roomCode);
  };

  const startGame = () => {
    if (!roomCode) {
      setErrorMsg('Please enter a room code!');
      return;
    }
    
    if (selectedQuestions.length === 0) {
      setErrorMsg('Please select at least one question!');
      return;
    }
    
    // Sort questions by grade before starting the game
    const gradeSortedQuestions = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    setSelectedQuestions(gradeSortedQuestions);
    setQuestions(gradeSortedQuestions);
    
    // Set the first question as the current question
    setCurrentQuestion(gradeSortedQuestions[0]);
    setCurrentQuestionIndex(0);
    
    // Start the game with the existing room
    setIsLoading(true);
    socketService.startGame(roomCode, gradeSortedQuestions, timeLimit || undefined);
    setGameStarted(true);
    
    // Initialize timer if timeLimit is set
    if (timeLimit) {
      startTimer(timeLimit);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);
      setPendingAnswers([]);
      socketService.nextQuestion(roomCode);
      
      // Reset timer for new question if time limit is set
      if (timeLimit) {
        startTimer(timeLimit);
      }
    } else {
      // End game logic
      alert('No more questions available!');
    }
  };

  const evaluateAnswer = (playerId: string, isCorrect: boolean) => {
    socketService.evaluateAnswer(roomCode, playerId, isCorrect);
    setPendingAnswers(prev => prev.filter(a => a.playerId !== playerId));
  };

  const addCustomQuestion = async () => {
    const text = prompt('Enter the question:');
    if (text) {
      const answerInput = prompt('Enter the answer:');
      const answer = answerInput || undefined;
      const subject = prompt('Enter the subject:') || 'General';
      const grade = parseInt(prompt('Enter the grade level (1-13):') || '5', 10);
      const language = prompt('Enter the language (e.g., de, en):') || 'de';
      
      const questionData = {
        text,
        answer,
        subject,
        grade: Math.min(13, Math.max(1, grade)), // Ensure between 1-13
        language
      };
      
      let newQuestion: Question;
      
      // Only save to database if the flag is enabled
      if (saveQuestionsToDatabase) {
        try {
          setErrorMsg('Saving question to database...');
          const savedQuestion = await supabaseService.addQuestion(questionData);
          
          if (savedQuestion) {
            newQuestion = savedQuestion;
            setErrorMsg('Question saved to database successfully!');
            
            // Update subjects and languages lists if new values were added
            if (!subjects.includes(subject)) {
              setSubjects(prev => [...prev, subject].sort());
            }
            
            if (language && !languages.includes(language)) {
              setLanguages(prev => [...prev, language].sort());
            }
            
            setTimeout(() => setErrorMsg(''), 3000);
          } else {
            setErrorMsg('Failed to save question to database. Using temporary question instead.');
            newQuestion = supabaseService.createTemporaryQuestion(questionData);
          }
        } catch (error) {
          console.error('Error saving question:', error);
          setErrorMsg('Error saving question to database. Using temporary question instead.');
          newQuestion = supabaseService.createTemporaryQuestion(questionData);
        }
      } else {
        // Create a temporary question (not saved to database)
        newQuestion = supabaseService.createTemporaryQuestion(questionData);
        setErrorMsg('Question added to current game session only.');
        setTimeout(() => setErrorMsg(''), 3000);
      }
      
      // Add to questions array for current game
      setQuestions(prev => [...prev, newQuestion]);
    }
  };

  const restartGame = () => {
    setIsRestarting(true);
    socketService.restartGame(roomCode);
  };

  const loadQuestionsFromSupabase = async () => {
    setIsLoadingQuestions(true);
    
    try {
      const options: {
        subject?: string;
        grade?: number;
        language?: string;
        limit?: number;
        sortByGrade?: boolean;
      } = {}; // No limit to get all available questions
      
      if (selectedSubject) {
        options.subject = selectedSubject;
      }
      
      if (selectedGrade !== '') {
        options.grade = Number(selectedGrade);
      }
      
      if (selectedLanguage) {
        options.language = selectedLanguage;
      }
      
      // Always sort by grade to ensure progression from lowest to highest
      options.sortByGrade = sortByGrade;
      
      const loadedQuestions = await supabaseService.getQuestions(options);
      
      if (loadedQuestions && loadedQuestions.length > 0) {
        setAvailableQuestions(loadedQuestions);
        setErrorMsg('');
      } else {
        setErrorMsg('No questions found with the selected filters');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      setErrorMsg('Failed to load questions. Please try again.');
    } finally {
      setIsLoadingQuestions(false);
    }
  };
  
  const addQuestionToSelected = (question: Question) => {
    setSelectedQuestions(prev => [...prev, question]);
    setAvailableQuestions(prev => prev.filter(q => q.id !== question.id));
  };
  
  const removeSelectedQuestion = (questionId: number) => {
    const questionToRemove = selectedQuestions.find(q => q.id === questionId);
    if (questionToRemove) {
      setSelectedQuestions(prev => prev.filter(q => q.id !== questionId));
      setAvailableQuestions(prev => [...prev, questionToRemove].sort((a, b) => a.grade - b.grade));
    }
  };
  
  const organizeSelectedQuestions = () => {
    // Sort selected questions by grade (ascending)
    const organized = [...selectedQuestions].sort((a, b) => a.grade - b.grade);
    setSelectedQuestions(organized);
    setQuestions(organized);
  };

  return (
    <div className="container">
      <h1 className="text-center mb-4">Game Master Dashboard</h1>
      
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          {errorMsg}
          <button 
            type="button" 
            className="btn-close float-end" 
            onClick={() => setErrorMsg('')}
            aria-label="Close"
          ></button>
        </div>
      )}
      
      {!roomCode ? (
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card p-4 text-center">
              <h3>Create a New Game Room</h3>
              <p>As the Game Master, you'll manage questions and evaluate answers.</p>
              <div className="form-group mb-3">
                <label htmlFor="roomCodeInput" className="form-label">Room Code (optional):</label>
                <input
                  type="text"
                  id="roomCodeInput"
                  className="form-control"
                  placeholder="Leave blank for random code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                />
                <small className="text-muted">You can specify a custom room code or leave it blank for a random one.</small>
              </div>
              <button 
                className="btn btn-primary btn-lg mt-3"
                onClick={createRoom}
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
              <button 
                className="btn btn-outline-secondary mt-3"
                onClick={() => navigate('/')}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="game-master-container" style={{ 
          backgroundImage: 'linear-gradient(to bottom right, #8B4513, #A0522D)', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="row">
            <div className="col-md-4">
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="mb-0">Room Information</h3>
                </div>
                <div className="card-body text-center">
                  <h5>Room Code:</h5>
                  <div className="room-code">{roomCode}</div>
                  <p className="mb-3">Share this code with players to join</p>
                  
                  {!gameStarted && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="timeLimit" className="form-label">Time Limit (seconds):</label>
                        <input 
                          type="number"
                          id="timeLimit"
                          className="form-control mb-2"
                          min="0"
                          value={timeLimit || ''}
                          onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value, 10) : null)}
                          placeholder="No time limit"
                        />
                        <small className="text-muted">Leave empty for no time limit</small>
                      </div>
                      
                      <div className="form-check mb-3">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="saveQuestionsCheckbox"
                          checked={saveQuestionsToDatabase}
                          onChange={(e) => setSaveQuestionsToDatabase(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="saveQuestionsCheckbox">
                          Save custom questions to database
                        </label>
                        <small className="form-text text-muted d-block">
                          If unchecked, custom questions will only be available for this game session
                        </small>
                      </div>
                      
                      <button 
                        className="btn btn-success btn-lg w-100"
                        onClick={startGame}
                        disabled={players.length < 2}
                      >
                        Start Game ({players.length}/2 players)
                      </button>
                    </>
                  )}
                  
                  {gameStarted && (
                    <button 
                      className="btn btn-warning btn-lg w-100"
                      onClick={restartGame}
                      disabled={isRestarting}
                    >
                      {isRestarting ? 'Restarting...' : 'Restart Game'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h3 className="mb-0">Players</h3>
                  <span className="badge bg-primary">{players.length}</span>
                </div>
                <div className="card-body p-0">
                  <ul className="list-group list-group-flush player-list">
                    {players.map(player => (
                      <li 
                        key={player.id} 
                        className={`list-group-item d-flex justify-content-between align-items-center ${!player.isActive ? 'text-muted' : ''}`}
                        onClick={() => setSelectedPlayerId(player.id)}
                      >
                        <span>{player.name} {!player.isActive && '(Eliminated)'}</span>
                        <div>
                          {Array.from({length: player.lives}, (_, i) => (
                            <span key={i} className="text-danger me-1">❤</span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {gameStarted && (
                <div className="card mb-4">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h3 className="mb-0">Questions</h3>
                    <button 
                      className="btn btn-sm btn-outline-primary"
                      onClick={addCustomQuestion}
                    >
                      Add Question
                    </button>
                  </div>
                  <div className="card-body">
                    {timeLimit !== null && (
                      <div className="mb-3 text-center">
                        <h5>Time Remaining:</h5>
                        <div className={`timer ${(timeRemaining !== null && timeRemaining < 10) ? 'text-danger' : ''}`}>
                          {timeRemaining !== null ? timeRemaining : timeLimit} seconds
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-3">
                      <h5>Current Question ({currentQuestionIndex + 1}/{questions.length}):</h5>
                      <div className="question-container">
                        <p className="mb-1">{currentQuestion?.text}</p>
                        <small>Grade: {currentQuestion?.grade} | Subject: {currentQuestion?.subject} | Language: {currentQuestion?.language || 'de'}</small>
                        {currentQuestion?.answer && (
                          <div className="mt-2 correct-answer">
                            <strong>Correct Answer:</strong> {currentQuestion.answer}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button 
                      className="btn btn-primary w-100"
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex >= questions.length - 1}
                    >
                      Next Question
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="col-md-8">
              {gameStarted ? (
                <>
                  <div className="card mb-4">
                    <div className="card-header">
                      <h3 className="mb-0">Pending Answers</h3>
                    </div>
                    <div className="card-body">
                      {pendingAnswers.length === 0 ? (
                        <p className="text-center">No pending answers</p>
                      ) : (
                        <ul className="list-group">
                          {pendingAnswers.map((submission, index) => (
                            <li key={index} className="list-group-item">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <h5 className="mb-0">{submission.playerName}</h5>
                                <div>
                                  <button 
                                    className="btn btn-success me-2"
                                    onClick={() => evaluateAnswer(submission.playerId, true)}
                                  >
                                    Correct
                                  </button>
                                  <button 
                                    className="btn btn-danger"
                                    onClick={() => evaluateAnswer(submission.playerId, false)}
                                  >
                                    Incorrect
                                  </button>
                                </div>
                              </div>
                              <div className="answer-container">
                                <p className="mb-1"><strong>Player's Answer:</strong> {submission.answer}</p>
                                {currentQuestion?.answer && (
                                  <p className="mb-0 text-success small">
                                    <strong>Correct Answer:</strong> {currentQuestion.answer}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  
                  <div className="card">
                    <div className="card-header">
                      <h3 className="mb-0">Player Boards</h3>
                    </div>
                    <div className="card-body">
                      {playerBoards.length === 0 ? (
                        <p className="text-center">No player boards available</p>
                      ) : (
                        <div className="row">
                          {playerBoards.map((board) => {
                            const player = players.find(p => p.id === board.playerId);
                            return (
                              <div key={board.playerId} className="col-md-6 mb-4">
                                <div className="card h-100">
                                  <div className="card-header bg-success text-white">
                                    <h5 className="mb-0">{board.playerName || 'Unknown Player'} {!player?.isActive && '(Eliminated)'}</h5>
                                  </div>
                                  <div className="card-body p-0">
                                    <div 
                                      className="drawing-board"
                                      style={{ 
                                        backgroundColor: '#0C6A35', // School green board color 
                                        border: '12px solid #8B4513', // Brown wooden frame
                                        borderRadius: '4px',
                                        minHeight: '400px',
                                        width: '100%',
                                        boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.5)',
                                        overflow: 'hidden',
                                        position: 'relative'
                                      }}
                                    >
                                      <div 
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          transformOrigin: 'top left',
                                          transform: 'scale(1)',
                                        }}
                                        dangerouslySetInnerHTML={{ 
                                          __html: board.boardData || '' 
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="card-footer d-flex justify-content-between align-items-center">
                                    <span>
                                      {Array.from({length: player?.lives || 0}, (_, i) => (
                                        <span key={i} className="text-danger me-1" role="img" aria-label="heart">❤</span>
                                      ))}
                                    </span>
                                    {pendingAnswers.find(a => a.playerId === board.playerId) && (
                                      <div>
                                        <button 
                                          className="btn btn-sm btn-success me-2"
                                          onClick={() => evaluateAnswer(board.playerId, true)}
                                        >
                                          Correct
                                        </button>
                                        <button 
                                          className="btn btn-sm btn-danger"
                                          onClick={() => evaluateAnswer(board.playerId, false)}
                                        >
                                          Incorrect
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <h3 className="mb-0">Getting Started</h3>
                  </div>
                  <div className="card-body">
                    <p className="mb-4">
                      Welcome to the Game Master dashboard! Share the room code with your players and prepare your questions. When everyone is ready, start the game!
                    </p>
                    
                    <div className="mb-4">
                      <h5>Current Players:</h5>
                      {players.length === 0 ? (
                        <p className="text-center text-muted">No players have joined yet</p>
                      ) : (
                        <ul className="list-group">
                          {players.map(player => (
                            <li key={player.id} className="list-group-item">
                              {player.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <h5>Room Settings:</h5>
                      <div className="mb-3">
                        <label htmlFor="timeLimitInput" className="form-label">Time Limit per Question (seconds):</label>
                        <input
                          type="number"
                          id="timeLimitInput"
                          className="form-control"
                          placeholder="No time limit"
                          min="5"
                          max="300"
                          value={timeLimit === null ? '' : timeLimit}
                          onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h5>Load Questions from Database:</h5>
                      <div className="row g-3 mb-3">
                        <div className="col-md-3">
                          <label htmlFor="languageSelect" className="form-label">Language</label>
                          <select 
                            id="languageSelect" 
                            className="form-select"
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                          >
                            {languages.length > 0 ? (
                              languages.map((language, index) => (
                                <option key={index} value={language}>{language}</option>
                              ))
                            ) : (
                              <option value="de">de</option>
                            )}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="subjectSelect" className="form-label">Subject</label>
                          <select 
                            id="subjectSelect" 
                            className="form-select"
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                          >
                            <option value="">All Subjects</option>
                            {subjects.map((subject, index) => (
                              <option key={index} value={subject}>{subject}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="gradeSelect" className="form-label">Grade</label>
                          <select 
                            id="gradeSelect" 
                            className="form-select"
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value ? Number(e.target.value) : '')}
                          >
                            <option value="">All Grades</option>
                            {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(grade => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">&nbsp;</label>
                          <button 
                            className="btn btn-primary d-block w-100"
                            onClick={loadQuestionsFromSupabase}
                            disabled={isLoadingQuestions}
                          >
                            {isLoadingQuestions ? 'Loading...' : 'Search Questions'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="sortByGradeCheckbox"
                            checked={sortByGrade}
                            onChange={(e) => setSortByGrade(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="sortByGradeCheckbox">
                            Sort questions by grade (lowest to highest)
                          </label>
                        </div>
                      </div>
                      
                      <div className="row">
                        <div className="col-md-6">
                          <div className="card mb-3">
                            <div className="card-header bg-light">
                              <h6 className="mb-0">Available Questions ({availableQuestions.length})</h6>
                            </div>
                            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
                              {availableQuestions.length === 0 ? (
                                <p className="text-center text-muted">No questions available. Use the filters above to search for questions.</p>
                              ) : (
                                <div className="list-group">
                                  {availableQuestions.map((question) => (
                                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                      <div>
                                        <p className="mb-1 fw-bold">{question.text}</p>
                                        <small>
                                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                                          {question.answer && <span> | Answer: {question.answer}</span>}
                                        </small>
                                      </div>
                                      <button 
                                        className="btn btn-sm btn-success" 
                                        onClick={() => addQuestionToSelected(question)}
                                        title="Add to selected questions"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="col-md-6">
                          <div className="card mb-3">
                            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">Selected Questions ({selectedQuestions.length})</h6>
                              <button 
                                className="btn btn-sm btn-outline-primary" 
                                onClick={organizeSelectedQuestions}
                                disabled={selectedQuestions.length < 2}
                                title="Sort by grade (lowest to highest)"
                              >
                                Sort by Grade
                              </button>
                            </div>
                            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
                              {selectedQuestions.length === 0 ? (
                                <p className="text-center text-muted">No questions selected yet. Add questions from the left panel.</p>
                              ) : (
                                <div className="list-group">
                                  {selectedQuestions.map((question, index) => (
                                    <div key={question.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                                      <div>
                                        <div className="d-flex align-items-center mb-1">
                                          <span className="badge bg-primary me-2">{index + 1}</span>
                                          <span className="fw-bold">{question.text}</span>
                                        </div>
                                        <small>
                                          Grade: {question.grade} | {question.subject} | {question.language || 'de'}
                                          {question.answer && <span> | Answer: {question.answer}</span>}
                                        </small>
                                      </div>
                                      <button 
                                        className="btn btn-sm btn-danger" 
                                        onClick={() => removeSelectedQuestion(question.id)}
                                        title="Remove from selected questions"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <h6>Selected Question Summary:</h6>
                        {selectedQuestions.length > 0 ? (
                          <>
                            <p>Total questions: {selectedQuestions.length}</p>
                            <p>Grade range: {Math.min(...selectedQuestions.map(q => q.grade))} - {Math.max(...selectedQuestions.map(q => q.grade))}</p>
                            <p>Subjects: {Array.from(new Set(selectedQuestions.map(q => q.subject))).join(', ')}</p>
                          </>
                        ) : (
                          <p className="text-muted">No questions selected yet</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <button 
                        className="btn btn-success btn-lg w-100"
                        onClick={addCustomQuestion}
                      >
                        Add Custom Question
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameMaster; 