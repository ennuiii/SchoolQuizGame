import React, { useEffect, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import adminSocketService from '../services/socketService'; // Corrected import path
import { Socket } from 'socket.io-client'; // Import Socket type for explicit typing

// Define interfaces for the expected data structure from the server
interface Player {
  id: string;
  name: string;
  lives: number;
  isActive: boolean;
  isSpectator: boolean;
  // Add other relevant player fields if available
}

interface PlayerBoard {
  boardData: string;
  roundIndex: number;
  timestamp: number;
}

interface GameRoom {
  roomCode: string;
  gamemaster: string;
  players: Player[];
  started: boolean;
  startTime: string | null;
  questions: any[]; // Consider defining a Question interface if needed
  currentQuestionIndex: number;
  currentQuestion: any | null; // Consider defining a Question interface
  timeLimit: number | null;
  playerBoards: Record<string, PlayerBoard>;
  roundAnswers: Record<string, any>; // Define if structure is known
  evaluatedAnswers: Record<string, boolean | null>;
  submissionPhaseOver: boolean;
  isConcluded: boolean;
}

// This interface is for the initial fetch from /debug/rooms
interface DebugRoomsData {
  rooms: string[]; // Array of room codes
  details: Record<string, GameRoom>; // Details for each room, keyed by roomCode
}

// This interface could be for real-time updates via WebSocket for a single room or all rooms
interface RealtimeServerStats {
  activeRooms: GameRoom[]; // Or a map like Record<string, GameRoom>
  totalPlayers: number;
  // other global stats
}

const ServerStats: React.FC = () => {
  // State for data fetched via HTTP
  const [httpStats, setHttpStats] = useState<DebugRoomsData | null>(null);
  // State for real-time data via WebSocket (can augment or replace httpStats)
  const [liveRoomDetails, setLiveRoomDetails] = useState<Record<string, GameRoom>>({});
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const fetchInitialStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/debug/rooms'); // Ensure this proxy is set up in admin/package.json or use full URL
        if (!response.ok) {
          throw new Error(`Failed to fetch server stats: ${response.status} ${response.statusText}`);
        }
        const data: DebugRoomsData = await response.json();
        setHttpStats(data);
        setLiveRoomDetails(data.details); // Initialize with fetched data
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred fetching stats');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialStats();

    // Connect to WebSocket
    adminSocketService.connect()
      .then((socket: Socket | null) => {
        if (socket) {
          setSocketConnected(true);
          console.log('[ServerStats] Admin Socket connected');

          // TODO: Server needs to emit this event with relevant data structure
          adminSocketService.on('server_stats_update', (updatedStats: RealtimeServerStats | Record<string, GameRoom>) => {
            console.log('[ServerStats] Received server_stats_update:', updatedStats);
            // Assuming updatedStats is Record<string, GameRoom> for simplicity matching DebugRoomsData.details
            // Adjust based on actual server emission
            if ((updatedStats as RealtimeServerStats).activeRooms) {
                const roomsMap: Record<string, GameRoom> = {};
                (updatedStats as RealtimeServerStats).activeRooms.forEach(room => {
                    roomsMap[room.roomCode] = room;
                });
                setLiveRoomDetails(roomsMap);
            } else {
                setLiveRoomDetails(prevDetails => ({ ...prevDetails, ...(updatedStats as Record<string, GameRoom>) }));
            }
          });

          // Optional: Request initial stats via socket if preferred over HTTP
          // adminSocketService.emit('request_all_room_stats'); 

        } else {
          setError('Failed to connect admin socket for real-time updates.');
        }
      })
      .catch((err: Error) => {
        console.error('[ServerStats] Admin Socket connection error:', err);
        setError('Admin Socket connection failed.');
      });

    return () => {
      adminSocketService.off('server_stats_update');
      adminSocketService.disconnect();
      console.log('[ServerStats] Admin Socket disconnected');
    };
  }, []);

  if (loading && !httpStats) { // Show loading only if no initial data yet
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading server stats...</Typography>
      </Container>
    );
  }

  if (error && !httpStats) { // Show error prominently if initial load failed
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Error loading server stats: {error}</Alert>
      </Container>
    );
  }

  const displayableRoomCodes = httpStats?.rooms || Object.keys(liveRoomDetails);
  const currentRoomDetails = Object.keys(liveRoomDetails).length > 0 ? liveRoomDetails : httpStats?.details;

  if (displayableRoomCodes.length === 0 && !loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info">No active game rooms found.</Alert>
        {error && <Alert severity="warning" sx={{mt:1}}>Connection issue: {error}</Alert>} 
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" gutterBottom component="h1">
          Server & Game Room Stats
        </Typography>
        <Chip 
            label={socketConnected ? 'Socket Connected' : 'Socket Disconnected'} 
            color={socketConnected ? 'success' : 'error'}
            size="small"
        />
      </Box>
      {error && (!socketConnected || !httpStats) && <Alert severity="warning" sx={{mb:1}}>Stats might be stale: {error}</Alert>} 
      <Typography variant="subtitle1" gutterBottom>
        Currently active rooms: {displayableRoomCodes.length}
      </Typography>

      {displayableRoomCodes.map((roomCode) => {
        const room = currentRoomDetails?.[roomCode];
        if (!room) return <Alert severity="warning" key={roomCode}>Data for room {roomCode} is missing or stale.</Alert>;

        return (
          <Accordion key={roomCode} sx={{ mb: 2 }} TransitionProps={{ unmountOnExit: true }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`panel-${roomCode}-content`}
              id={`panel-${roomCode}-header`}
            >
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Room: {roomCode}
              </Typography>
              <Chip label={room.started ? 'Game Started' : 'Game Not Started'} color={room.started ? 'success' : 'default'} size="small" sx={{ mr: 1 }} />
              <Chip label={room.isConcluded ? 'Concluded' : 'Active'} color={room.isConcluded ? 'error' : 'primary'} size="small" />
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Room Details</Typography>
                    <Typography><strong>Gamemaster ID:</strong> {room.gamemaster?.substring(0,8)}...</Typography>
                    <Typography><strong>Status:</strong> {room.started ? 'Started' : 'Waiting'}{room.isConcluded ? ' (Concluded)' : ''}</Typography>
                    {room.startTime && <Typography><strong>Start Time:</strong> {new Date(room.startTime).toLocaleString()}</Typography>}
                    <Typography><strong>Questions Loaded:</strong> {room.questions?.length || 0}</Typography>
                    {room.started && room.currentQuestion && (
                      <>
                        <Typography><strong>Current Question Index:</strong> {room.currentQuestionIndex}</Typography>
                        <Typography><strong>Current Question Text:</strong> {room.currentQuestion.text?.substring(0, 100)}{room.currentQuestion.text?.length > 100 ? '...' : ''}</Typography>
                      </>
                    )}
                    <Typography><strong>Time Limit per Question:</strong> {room.timeLimit ? `${room.timeLimit}s` : 'None'}</Typography>
                     <Typography><strong>Submission Phase Over:</strong> {room.submissionPhaseOver ? 'Yes' : 'No'}</Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Players ({room.players?.length || 0})</Typography>
                    {room.players && room.players.length > 0 ? (
                      <List dense>
                        {room.players.map((player) => (
                          <ListItem key={player.id} disablePadding>
                            <ListItemText
                              primary={`${player.name} (ID: ${player.id.substring(0,6)}...)`}
                              secondary={`Lives: ${player.lives}, Active: ${player.isActive}, Spectator: ${player.isSpectator}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography>No players in this room.</Typography>
                    )}
                  </Paper>
                </Grid>
                
                <Grid item xs={12}>
                    <Paper elevation={2} sx={{ p: 2, mt: 1 }}>
                        <Typography variant="subtitle2">Player Boards Submitted: {Object.keys(room.playerBoards || {}).length}</Typography>
                        <Typography variant="subtitle2">Answers This Round: {Object.keys(room.roundAnswers || {}).length}</Typography>
                        <Typography variant="subtitle2">Evaluated Answers: {Object.keys(room.evaluatedAnswers || {}).length}</Typography>
                    </Paper>
                </Grid>

              </Grid>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Container>
  );
};

export default ServerStats; 