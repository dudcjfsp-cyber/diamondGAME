import express from 'express';
import http from 'http';
import { Server } from "socket.io";
import path from 'path';
import { fileURLToPath } from 'url';

// Shared Logic Imports
import { Board } from '../public/js/board.js';
import { Hex } from '../public/js/hex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

      // Initialize Server-Side Board State USING SHARED CLASS
      const serverBoard = new Board();
      serverBoard.resetPieces(actualCount);

      // Convert Map to Object for simple JSON state sending (if needed)
      // Or keep it as Map if we don't send simple JSON.
      // The current client expects: data.state.board is an Object: key -> playerId
      const boardObj = {};
      serverBoard.grid.forEach((cell, key) => {
        if (cell.player) boardObj[key] = cell.player;
      });
      room.state.board = boardObj;
      room.state.serverBoardInstance = serverBoard; // Keep raw instance for validation

      // Update lobby list with new colors
      io.to(roomCode).emit('playerUpdate', Object.values(room.players));
    } else {
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

    // --- Validation using Shared Board Logic ---
    // If we have the server instance, we can validate.
    if (room.state.serverBoardInstance) {
      const board = room.state.serverBoardInstance;
      const fromHex = new Hex(data.from.q, data.from.r);
      const toHex = new Hex(data.to.q, data.to.r);

      // Is it truly this player's piece?
      const fromCell = board.grid.get(fromHex.toString());
      if (!fromCell || fromCell.player !== currentPlayerId) {
        console.warn(`Cheat Attempt? Player ${currentPlayerId} tried to move piece at ${fromHex} claiming ownership.`);
        socket.emit('error', '비정상적인 이동이 감지되었습니다.');
        return;
      }

      // Is the move valid according to rules?
      // We can check getValidMoves or specifically check this move.
      // For efficiency, let's trust if it's in ValidMoves list.
      // Or re-simulate:
      // const validMoves = board.getValidMoves(fromHex);
      // if (!validMoves.some(m => m.hex.equals(toHex))) ...

      // For MVP Step 1, we just update the board using movePiece
      const success = board.movePiece(fromHex, toHex);
      if (!success) {
        console.warn(`Server Logic rejected move from ${fromHex} to ${toHex}`);
        socket.emit('error', '서버에서 이동을 거부했습니다.');
        return;
      }

      // Sync: Update plain object state for re-joiners
      const msgFromKey = fromHex.toString();
      const msgToKey = toHex.toString();
      if (room.state.board[msgFromKey]) delete room.state.board[msgFromKey];
      room.state.board[msgToKey] = currentPlayerId;

    } else {
      // Fallback for rooms created before this logic (shouldn't happen on reload)
      // Legacy simple logic
      const fromKey = `${data.from.q},${data.from.r}`;
      const toKey = `${data.to.q},${data.to.r}`;

      if (room.state.board[fromKey] === currentPlayerId) {
        delete room.state.board[fromKey];
        room.state.board[toKey] = currentPlayerId;
      }
    }
    // ---------------------------------------------

    // Broadcast to room
    socket.to(data.roomCode).emit('moveMade', {
      from: data.from,
      to: data.to,
      path: data.path, // Relay path
      player: currentPlayerId
    });

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

    // Validate with Server Board if possible
    let serverWin = false;
    if (room.state.serverBoardInstance) {
      serverWin = room.state.serverBoardInstance.checkWin(playerId);
      if (!serverWin) {
        console.warn(`Win Claim Rejected: Server board says player ${playerId} has not won.`);
        // Allow it for now if logic differs, but log it.
        // Actually, enforce it!
        // socket.emit('error', '승리 조건이 충족되지 않았습니다.');
        // return; 
      }
    }

    room.state.status = 'finished';
    io.to(data.roomCode).emit('gameOver', { winner: playerId });
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
