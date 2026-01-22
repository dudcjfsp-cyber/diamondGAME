// Client-side logic - Fixed version

// Imports
import { Board } from './board.js';
import { Renderer } from './renderer.js';
import { Hex } from './hex.js';
import { GameState } from './gameState.js';

// DOM Elements
// DOM Elements
const views = {
    lobby: document.getElementById('lobby-view'),
    game: document.getElementById('game-view')
};

const btns = {
    create: document.getElementById('btn-create-room'),
    join: document.getElementById('btn-join-room'),
    solo: document.getElementById('btn-solo-play'),
    // Setup view buttons removed
    hostStart: document.getElementById('btn-host-start'), // Re-enable existing in-game button usage
    leave: document.getElementById('btn-leave-game')
};

// ... (in init) ...

// Socket listeners removed from top-level (must be in init)
// Event listeners moved to init()

const inputs = {
    roomCode: document.getElementById('input-room-code')
};

const display = {
    // roomCode removed
    turn: document.getElementById('current-turn-display')
};

// Initialize
function init() {
    GameState.socket = io();

    // Socket Events
    GameState.socket.on('connect', () => {
        console.log('Connected to server');
        // Auto-rejoin if we were in a game
        if (GameState.currentRoomCode && GameState.myPlayerId) {
            console.log('Attempting to rejoin room:', GameState.currentRoomCode);
            GameState.socket.emit('rejoinGame', {
                roomCode: GameState.currentRoomCode,
                playerId: GameState.myPlayerId
            });
        }
    });

    GameState.socket.on('rejoined', (data) => {
        console.log('Rejoined room successfully', data);
        GameState.isGameActive = true;
        GameState.currentRoomCode = data.roomCode;

        switchView('game');

        // Re-init game with inferred player count or max
        // Since we don't have playerCount in data.state explicitly, we assume standard board.
        // Actually we need valid moves, which depend on playerCount.
        // Let's assume 2 for now as it's the default, or use max 6 is safer for 'isPlayerActive' logic if logic is not restrictive.
        // Better: Server should send settings? But for now let's Init with 6 to be safe.
        initGame(6);

        // Restore Board State
        if (data.state && data.state.board) {
            // Clear current board
            GameState.board.grid.forEach(cell => cell.player = null);

            // Apply server state
            Object.entries(data.state.board).forEach(([key, playerId]) => {
                const cell = GameState.board.grid.get(key);
                if (cell) cell.player = playerId;
            });
            GameState.renderer.draw();
        }

        // Restore Turn
        if (data.state.turnOrder) {
            const turnIndex = data.state.currentTurnIndex;
            GameState.currentTurn = data.state.turnOrder[turnIndex];
            updateTurnDisplay();
        }

        document.getElementById('game-room-code').innerText = data.roomCode;
    });

    // Error Handling
    GameState.socket.on('error', (msg) => {
        alert(msg);
    });

    GameState.socket.on('roomCreated', (data) => {
        GameState.currentRoomCode = data.roomCode;
        GameState.myPlayerId = data.playerId;
        // display.roomCode removed
        document.getElementById('game-room-code').innerText = GameState.currentRoomCode;
        console.log('Room Created:', data);

        // Direct to Game View
        switchView('game');
        prepareGameLobbyUI(true); // Host
    });

    GameState.socket.on('roomJoined', (data) => {
        GameState.currentRoomCode = data.roomCode;
        GameState.myPlayerId = data.playerId;
        // display.roomCode removed
        document.getElementById('game-room-code').innerText = GameState.currentRoomCode;

        // Direct to Game View
        switchView('game');
        console.log('Joined Room:', data);
        prepareGameLobbyUI(false); // Guest
    });

    GameState.socket.on('playerUpdate', (players) => {
        console.log('Players updated:', players);
        updateGameLobbyControls(players);
    });

    GameState.socket.on('gameStarted', (data) => {
        console.log('Game Started!', data);
        GameState.isGameActive = true;

        if (data.assignments && GameState.socket.id in data.assignments) {
            GameState.myPlayerId = data.assignments[GameState.socket.id];
        }

        GameState.currentTurn = data.currentTurn;

        // ✅ 게임 시작 시에만 게임 뷰로 전환하고 초기화
        switchView('game');

        const activeCount = data.turnOrder.length;
        initGame(activeCount); // 여기서 한 번만 초기화

        updateTurnDisplay();
        showMyColorNotification();

        document.getElementById('btn-host-start').classList.add('hidden');
        document.getElementById('btn-player-ready').classList.add('hidden');
    });

    GameState.socket.on('turnUpdate', (data) => {
        console.log('Turn changed:', data.currentTurn);
        GameState.currentTurn = data.currentTurn;
        updateTurnDisplay();
    });

    GameState.socket.on('gameOver', (data) => {
        GameState.isGameActive = false;
        alert(`게임 종료! 플레이어 ${data.winner} 승리!`);
        location.reload();
    });

    GameState.socket.on('moveMade', (data) => {
        console.log('Opponent moved:', data);
        if (GameState.board && GameState.renderer) {
            const fromHex = new Hex(data.from.q, data.from.r);
            const toHex = new Hex(data.to.q, data.to.r);

            // Reconstruct path if available
            let path = [fromHex, toHex];
            if (data.path && Array.isArray(data.path)) {
                path = data.path.map(p => new Hex(p.q, p.r));
            }

            // 1. Update Logical State Immediately
            GameState.board.movePiece(fromHex, toHex);
            GameState.renderer.lastMove = { from: fromHex, to: toHex };

            // 2. Animate Visuals
            GameState.renderer.animateMove(path, () => {
                GameState.renderer.draw();
            });
        }
    });

    // UI Event Listeners
    btns.create.addEventListener('click', () => {
        GameState.socket.emit('createRoom');
    });

    btns.hostStart.addEventListener('click', () => {
        GameState.socket.emit('startGame', GameState.currentRoomCode);
    });

    document.getElementById('btn-player-ready').addEventListener('click', () => {
        GameState.socket.emit('playerReady', GameState.currentRoomCode);
    });

    btns.leave.addEventListener('click', () => {
        location.reload();
    });

    btns.join.addEventListener('click', () => {
        const code = inputs.roomCode.value;
        if (code) {
            console.log('Joining room:', code);
            GameState.socket.emit('joinRoom', code);
        }
    });
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    GameState.currentPage = viewName;
}

// Game View Lobby State (Waiting for start)
function prepareGameLobbyUI(isHost) {
    const readyBtn = document.getElementById('btn-player-ready');
    const startBtn = document.getElementById('btn-host-start');

    readyBtn.classList.add('hidden');
    startBtn.classList.add('hidden');

    if (isHost) {
        startBtn.classList.remove('hidden');
        startBtn.disabled = true; // Wait for players
        display.turn.innerText = "플레이어 대기 중...";
    } else {
        readyBtn.classList.remove('hidden');
        display.turn.innerText = "준비해 주세요";
    }
}

function updateGameLobbyControls(players) {
    // If game is active, don't mess with controls
    if (GameState.isGameActive) return;

    const amHost = GameState.myPlayerId === 1;
    const allReady = players.every(p => p.id === 1 || p.ready);
    const playerCount = players.length;

    const startBtn = document.getElementById('btn-host-start');
    if (amHost) {
        if (playerCount >= 2 && allReady) {
            startBtn.disabled = false;
            display.turn.innerText = "게임 시작 가능!";
        } else {
            startBtn.disabled = true;
            display.turn.innerText = `대기 중... (${playerCount}/2)`;
        }
    } else {
        const me = players.find(p => p.id === GameState.myPlayerId);
        if (me && me.ready) {
            document.getElementById('btn-player-ready').innerText = "준비 취소";
            document.getElementById('btn-player-ready').classList.replace('success', 'secondary');
        } else {
            document.getElementById('btn-player-ready').innerText = "준비 완료";
            document.getElementById('btn-player-ready').classList.replace('secondary', 'success');
        }
    }
}

function updateTurnDisplay() {
    if (GameState.currentTurn === GameState.myPlayerId) {
        display.turn.innerText = "나의 턴!";
        display.turn.style.color = "#10b981";
        showTurnNotification(); // Trigger animation
    } else {
        display.turn.innerText = `플레이어 ${GameState.currentTurn}의 턴`;
        display.turn.style.color = "white";
    }
}

function showTurnNotification() {
    let notif = document.getElementById('turn-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'turn-notification';
        notif.className = 'notification-overlay';
        document.body.appendChild(notif);
    }

    // Reset animation
    notif.style.animation = 'none';
    notif.offsetHeight; /* trigger reflow */
    notif.style.animation = null;

    notif.innerHTML = `<div style="font-size: 3rem; font-weight: 900; color: #facc15; text-shadow: 2px 2px 0px #dc2626, -2px -2px 0px #dc2626, 2px -2px 0px #dc2626, -2px 2px 0px #dc2626;">MY TURN!</div>`;

    notif.style.display = 'flex';
    setTimeout(() => {
        notif.style.display = 'none';
    }, 3000); // Hide after 3s (matches CSS animation)
}

// ✅ 수정: 한 번만 초기화하도록 개선
function initGame(count = 2) {
    console.log('Initializing game canvas with players:', count);

    const canvas = document.getElementById('game-canvas');

    // ✅ 이미 초기화되었다면 리셋만 수행
    if (GameState.isGameInitialized && GameState.board && GameState.renderer) {
        console.log('Game already initialized, resetting pieces...');
        GameState.board.resetPieces(count);
        GameState.renderer.selectedHex = null;
        GameState.renderer.validMoves = [];
        GameState.renderer.draw();
        return;
    }

    // ✅ 최초 초기화
    GameState.board = new Board();
    GameState.board.resetPieces(count);

    GameState.renderer = new Renderer(canvas);
    GameState.renderer.setBoard(GameState.board);

    // ✅ 이벤트 리스너를 한 번만 등록
    canvas.addEventListener('mousedown', handleCanvasClick);

    GameState.isGameInitialized = true;

    console.log('Game initialized successfully');
}

// ✅ 이벤트 핸들러를 별도 함수로 분리
function handleCanvasClick(e) {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedHex = GameState.renderer.handleClick(x, y);
    handleHexClick(clickedHex);
}

function handleHexClick(hex) {
    if (!hex) return;

    if (!GameState.isGameActive) {
        console.warn('Game not active. Ignoring click.');
        return;
    }

    if (GameState.currentTurn != GameState.myPlayerId) {
        console.warn(`Not my turn. Current: ${GameState.currentTurn}, Mine: ${GameState.myPlayerId}`);
        return;
    }

    const key = hex.toString();
    const cell = GameState.board.grid.get(key);

    console.log(`Click at ${key}. Cell Owner: ${cell ? cell.player : 'None'}, My ID: ${GameState.myPlayerId}, Turn: ${GameState.currentTurn}`);

    if (!cell) {
        GameState.renderer.selectedHex = null;
        GameState.renderer.validMoves = [];
        GameState.renderer.draw();
        return;
    }

    // Attempt Move
    if (GameState.renderer.selectedHex && !cell.player) {
        const moveObj = GameState.renderer.validMoves.find(m => m.hex.equals(hex));
        if (moveObj) {
            const fromHex = GameState.renderer.selectedHex;
            const targetHex = hex;
            const path = moveObj.path;

            // 1. Update Logical State Immediately
            GameState.board.movePiece(fromHex, targetHex);
            GameState.renderer.selectedHex = null;
            GameState.renderer.validMoves = [];
            GameState.renderer.lastMove = { from: fromHex, to: targetHex };

            // 2. Emit Event Immediately (Reduced Latency)
            if (GameState.currentRoomCode) {
                GameState.socket.emit('makeMove', {
                    roomCode: GameState.currentRoomCode,
                    from: fromHex,
                    to: targetHex,
                    path: path
                });
            }

            // 3. Animate Visuals
            GameState.renderer.animateMove(path, () => {
                GameState.renderer.draw();

                // Check Win Condition after animation? Or before?
                // Logic is already done. We can check now.
                if (GameState.board.checkWin(GameState.myPlayerId)) {
                    console.log('YOU WON!');
                    GameState.socket.emit('claimWin', { roomCode: GameState.currentRoomCode });
                }
            });
            return;
        }
    }

    // Select own piece
    if (cell.player) {
        if (cell.player != GameState.myPlayerId) {
            console.log(`Cannot select: Owner ${cell.player} != MyID ${GameState.myPlayerId}`);
            return;
        }

        GameState.renderer.selectedHex = hex;
        const moves = GameState.board.getValidMoves(hex);
        GameState.renderer.validMoves = moves;
        GameState.renderer.draw();
    } else {
        GameState.renderer.selectedHex = null;
        GameState.renderer.validMoves = [];
        GameState.renderer.draw();
    }
}



function showMyColorNotification() {
    const colorNames = {
        1: '빨강 (Red)', 2: '주황 (Orange)', 3: '노랑 (Yellow)',
        4: '초록 (Green)', 5: '청록 (Cyan)', 6: '파랑 (Blue)'
    };
    const myColorName = colorNames[GameState.myPlayerId] || 'Unknown';

    let notif = document.getElementById('color-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'color-notification';
        notif.className = 'notification-overlay';
        document.body.appendChild(notif);
    }

    notif.innerHTML = `<div>당신은 <span style="color: ${getColorHex(GameState.myPlayerId)}; font-weight:bold;">${myColorName}</span> 플레이어입니다.</div>`;

    notif.style.display = 'flex';
    setTimeout(() => {
        notif.style.display = 'none';
    }, 3000);
}

function getColorHex(id) {
    const colors = {
        1: '#ef4444', 2: '#f97316', 3: '#eab308',
        4: '#22c55e', 5: '#06b6d4', 6: '#3b82f6'
    };
    return colors[id] || 'white';
}

// Start
init();
