const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Game State Storage (In-memory for MVP)
const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle disconnection logic (remove from room, etc.)
  });

  // Room Management
  // Room Management
  socket.on('joinRoom', (roomCode) => {
    if (!rooms[roomCode]) {
      socket.emit('error', 'Room does not exist');
      return;
    }
    const room = rooms[roomCode];
    if (Object.keys(room.players).length >= 6) {
      socket.emit('error', 'Room is full');
      return;
    }

    // Assign rough player ID (1-6) just to have a slot.
    // We will RE-ASSIGN at game start.
    let playerId = 1;
    while (Object.values(room.players).some(p => p.id === playerId)) {
      playerId++;
    }

    room.players[socket.id] = { id: playerId, socket: socket.id, ready: false };
    socket.join(roomCode);

    // Send current settings too
    socket.emit('roomJoined', {
      roomCode,
      playerId,
      players: Object.values(room.players),
      settings: room.settings
    });
    io.to(roomCode).emit('playerUpdate', Object.values(room.players));

    console.log(`User ${socket.id} joined room ${roomCode} with Temp ID ${playerId}`);
  });

  socket.on('createRoom', () => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    rooms[roomCode] = {
      players: {},
      state: {},
      settings: { playerCount: 2 } // Default
    };

    const playerId = 1;
    rooms[roomCode].players[socket.id] = { id: playerId, socket: socket.id, ready: false };
    socket.join(roomCode);

    socket.emit('roomCreated', { roomCode, playerId, settings: rooms[roomCode].settings });
    console.log(`Room ${roomCode} created by ${socket.id}`);
  });



  socket.on('playerReady', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players[socket.id]) {
      room.players[socket.id].ready = !room.players[socket.id].ready; // Toggle ready
      io.to(roomCode).emit('playerUpdate', Object.values(room.players));
    }
  });

  socket.on('startGame', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;

    // Verify Host (Player 1)
    if (room.players[socket.id].id !== 1) return;

    const players = Object.values(room.players);
    const allReady = players.every(p => p.id === 1 || p.ready);
    // Allow start if >= 2 players and everyone is ready (ignoring setting count strict match)

    if (allReady && players.length >= 2) {
      room.state.status = 'playing';

      const actualCount = players.length; // Use actual count for smart balancing

      // RE-ASSIGN IDs for Balance
      let targetIds = [];
      if (actualCount === 2) targetIds = [1, 4]; // Red vs Green (Opposite)
      else if (actualCount === 3) targetIds = [1, 3, 5]; // Triangle
      else if (actualCount === 4) targetIds = [2, 3, 5, 6];
      else if (actualCount === 5) targetIds = [1, 2, 3, 4, 5]; // Edge case
      else targetIds = [1, 2, 3, 4, 5, 6];

      // Shuffle players for random color assignment
      const shuffledPlayers = [...players];
      for (let i = shuffledPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
      }

      // Assign IDs
      const newAssignments = {};
      shuffledPlayers.forEach((p, index) => {
        if (index < targetIds.length) {
          p.id = targetIds[index];
          newAssignments[p.socket] = p.id;
        }
      });

      const activeIds = shuffledPlayers.map(p => p.id).sort((a, b) => a - b);

      room.state.turnOrder = activeIds;
      room.state.currentTurnIndex = 0;

      io.to(roomCode).emit('gameStarted', {
        turnOrder: activeIds,
        currentTurn: activeIds[0],
        assignments: newAssignments
      });

      // Initialize Server-Side Board State
      room.state.board = initializeBoardState(room.state.turnOrder, actualCount);


      // Update lobby list with new colors
      io.to(roomCode).emit('playerUpdate', Object.values(room.players));
    } else {
      // Debug/Feedback: Why didn't it start?
      if (players.length < 2) {
        socket.emit('error', '게임을 시작하려면 최소 2명의 플레이어가 필요합니다.');
      } else if (!allReady) {
        socket.emit('error', '모든 플레이어가 준비(Ready) 상태여야 합니다.');
      }
    }
  });

  socket.on('rejoinGame', (data) => {
    const room = rooms[data.roomCode];
    if (room) {
      // Find player by ID
      const player = Object.values(room.players).find(p => p.id === data.playerId);
      if (player) {
        // Remove old socket key if different
        if (player.socket !== socket.id) {
          delete room.players[player.socket];
        }
        // Update with new socket
        player.socket = socket.id;
        room.players[socket.id] = player;
        socket.join(data.roomCode);

        socket.emit('rejoined', {
          roomCode: data.roomCode,
          state: room.state, // Now contains .board
          playerId: player.id // Send back ID just in case
        });
        console.log(`Player ${data.playerId} (ID: ${player.id}) rejoined room ${data.roomCode}`);
      }
    }
  });

  socket.on('makeMove', (data) => {
    const room = rooms[data.roomCode];
    if (!room) return;

    // Validate Turn
    const playerRecord = room.players[socket.id];
    if (!playerRecord) {
      // Socket not found in room (likely reconnected without rejoining)
      socket.emit('error', '세션이 만료되었습니다. 새로고침 해주세요.');
      return;
    }

    const currentPlayerId = playerRecord.id;
    const currentTurnId = room.state.turnOrder[room.state.currentTurnIndex];

    if (room.state.status !== 'playing' || currentPlayerId !== currentTurnId) {
      console.log(`Invalid move attempt by ${currentPlayerId}. Turn: ${currentTurnId}`);
      return; // Ignore invalid move
    }

    // Validate Path Security
    if (!data.path || !Array.isArray(data.path)) {
      console.warn(`Invalid path data from ${socket.id}`);
      return;
    }

    // Broadcast to room
    socket.to(data.roomCode).emit('moveMade', {
      from: data.from,
      to: data.to,
      path: data.path, // Relay path
      player: currentPlayerId
    });

    // Update Server-Side Board State
    const fromKey = `${data.from.q},${data.from.r}`;
    const toKey = `${data.to.q},${data.to.r}`;

    if (room.state.board[fromKey] === currentPlayerId) {
      delete room.state.board[fromKey];
      room.state.board[toKey] = currentPlayerId;
    } else {
      console.warn(`Sync Warn: Player ${currentPlayerId} moved from ${fromKey} but server thought it was ${room.state.board[fromKey]}`);
      // For MVP, trust the move but log warning. Self-correction.
      room.state.board[toKey] = currentPlayerId;
    }

    // Update Turn
    room.state.currentTurnIndex = (room.state.currentTurnIndex + 1) % room.state.turnOrder.length;
    const nextTurnId = room.state.turnOrder[room.state.currentTurnIndex];

    io.to(data.roomCode).emit('turnUpdate', { currentTurn: nextTurnId });
  });

  socket.on('claimWin', (data) => {
    const room = rooms[data.roomCode];
    if (!room) return;

    // Ideally verify server-side, but trust client for MVP
    const playerId = room.players[socket.id].id;
    room.state.status = 'finished';

    io.to(data.roomCode).emit('gameOver', { winner: playerId });
  });


  // TODO: Add room join/create logic here
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Helper: Initialize Board State (Simplified Hex Logic)
function initializeBoardState(turnOrder, playerCount) {
  const grid = {}; // key: "q,r", value: playerId

  // Helper to add hex
  const add = (q, r, pid) => {
    if (isPlayerActive(pid, playerCount)) {
      grid[`${q},${r}`] = pid;
    }
  };

  // Generate Board (Radius 4 + Tips)
  for (let q = -8; q <= 8; q++) {
    for (let r = -8; r <= 8; r++) {
      const s = -q - r;
      // Check board validity (Star shape)
      const coords = [q, r, s];
      const validCount = coords.filter(c => Math.abs(c) <= 4).length;

      if (validCount >= 2) {
        // Determine Zone
        let p = null;
        if (r < -4) p = 1;
        else if (s < -4) p = 2;
        else if (q > 4) p = 3;
        else if (r > 4) p = 4;
        else if (s > 4) p = 5;
        else if (q < -4) p = 6;

        if (p) {
          add(q, r, p);
        }
      }
    }
  }
  return grid;
}

function isPlayerActive(p, count) {
  if (count === 2) return p === 1 || p === 4;
  if (count === 3) return p === 1 || p === 3 || p === 5;
  if (count === 4) return p === 2 || p === 3 || p === 5 || p === 6;
  if (count === 6) return true;
  if (count === 5) return p !== 4;
  return false;
}
