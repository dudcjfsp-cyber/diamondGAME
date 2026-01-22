// Client-side logic

// Imports
import { Board } from './board.js';
import { Renderer } from './renderer.js';
import { Hex } from './hex.js';

// DOM Elements
const views = {
    lobby: document.getElementById('lobby-view'),
    setup: document.getElementById('setup-view'),
    game: document.getElementById('game-view')
};

const btns = {
    create: document.getElementById('btn-create-room'),
    join: document.getElementById('btn-join-room'),
    solo: document.getElementById('btn-solo-play'),
    start: document.getElementById('btn-start-game'),
    back: document.getElementById('btn-back-lobby'),
    leave: document.getElementById('btn-leave-game'),
    sendChat: document.getElementById('btn-send-chat')
};

const inputs = {
    roomCode: document.getElementById('input-room-code'),
    chat: document.getElementById('chat-input')
};

const display = {
    roomCode: document.getElementById('display-room-code'),
    chatMessages: document.getElementById('chat-messages'),
    turn: document.getElementById('current-turn-display')
};

// Game State
let currentPage = 'lobby';
let playerCount = 6;
let socket = null;
let currentRoomCode = null;
let myPlayerId = null;
let currentTurn = null;
let isGameActive = false;
let amIReady = false;

// Initialize
function init() {
    socket = io();

    // Socket Events
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('roomCreated', (data) => {
        currentRoomCode = data.roomCode;
        myPlayerId = data.playerId;
        display.roomCode.innerText = currentRoomCode;
        document.getElementById('game-room-code').innerText = currentRoomCode;
        console.log('Room Created:', data);
        prepareLobbyUI(true); // Host
        updatePlayerCountUI(6); // Default
    });

    socket.on('roomJoined', (data) => {
        currentRoomCode = data.roomCode;
        myPlayerId = data.playerId;
        display.roomCode.innerText = currentRoomCode;
        document.getElementById('game-room-code').innerText = currentRoomCode;
        switchView('setup');
        console.log('Joined Room:', data);
        prepareLobbyUI(false); // Guest
        if (data.settings) updatePlayerCountUI(data.settings.playerCount);
    });

    socket.on('settingsUpdated', (settings) => {
        console.log('Settings updated:', settings);
        updatePlayerCountUI(settings.playerCount);
    });

    socket.on('playerUpdate', (players) => {
        console.log('Players updated:', players);
        updateLobbyControls(players);
    });

    socket.on('gameStarted', (data) => {
        console.log('Game Started!', data);
        isGameActive = true;

        if (data.assignments && socket.id in data.assignments) {
            myPlayerId = data.assignments[socket.id];
        }

        currentTurn = data.currentTurn;

        switchView('game');

        // Init game with correct player count settings derived from turnOrder length
        // (Active players count essentially)
        const activeCount = data.turnOrder.length;
        initGame(activeCount);

        updateTurnDisplay();
        showMyColorNotification(); // Show color

        document.getElementById('btn-host-start').classList.add('hidden');
        document.getElementById('btn-player-ready').classList.add('hidden');
    });

    socket.on('turnUpdate', (data) => {
        console.log('Turn changed:', data.currentTurn);
        currentTurn = data.currentTurn;
        updateTurnDisplay();
    });

    socket.on('gameOver', (data) => {
        isGameActive = false;
        alert(`게임 종료! 플레이어 ${data.winner} 승리!`);
        location.reload(); // Reset for now
    });

    socket.on('moveMade', (data) => {
        console.log('Opponent moved:', data);
        if (board) {
            const fromHex = new Hex(data.from.q, data.from.r);
            const toHex = new Hex(data.to.q, data.to.r);

            // Reconstruct path locally? Or simple animation
            // Remote move usually doesn't show complex path unless sent.
            // Let's just animate straight line for now or teleport.
            // Simple direct animation:
            renderer.animateMove([fromHex, toHex], () => {
                board.movePiece(fromHex, toHex);
                renderer.draw();
            });
        }
    });

    // UI Event Listeners
    btns.create.addEventListener('click', () => {
        switchView('setup');
        socket.emit('createRoom');
        display.roomCode.innerText = 'Creating...';
    });

    btns.start.addEventListener('click', () => {
        // "Game Start" button in Lobby is distinct from "Start Game" command
        // Actually, "Game Start" button logic was existing. Let's merge.
        // Wait, "btn-start-game" was the Lobby->Game transition.
        // Now we transition on 'gameStarted' event.
        // So btn-start-game is redundant or reused for Host.
    });

    document.getElementById('btn-host-start').addEventListener('click', () => {
        socket.emit('startGame', currentRoomCode);
    });

    document.getElementById('btn-player-ready').addEventListener('click', () => {
        socket.emit('playerReady', currentRoomCode);
    });

    btns.back.addEventListener('click', () => {
        switchView('lobby');
    });

    btns.leave.addEventListener('click', () => {
        // Disconnect/Leave room logic
        location.reload(); // Simple reload to reset
    });

    btns.join.addEventListener('click', () => {
        const code = inputs.roomCode.value;
        if (code) {
            console.log('Joining room:', code);
            socket.emit('joinRoom', code);
        }
    });

    // Player Count Selection
    document.querySelectorAll('.btn-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (myPlayerId !== 1) return; // Only Host

            const count = parseInt(e.target.dataset.value);
            socket.emit('updateSettings', { roomCode: currentRoomCode, playerCount: count });
        });
    });
}

function switchView(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    currentPage = viewName;
}

function prepareLobbyUI(isHost) {
    // Show buttons based on role
    // NOTE: These buttons are in 'header-controls' which is in 'game-view' (or 'setup-view'?)
    // Wait, the buttons I added are in 'game-view'.
    // BUT 'setup-view' is where we wait for players.
    // The user said "Game Start button at top right".
    // Usually this implies we are IN the room/lobby waiting area.
    // My previous design had 'setup-view' as the waiting room.
    // Let's move the actual GAME VIEW to be the waiting area too?
    // OR add these buttons to 'setup-view'.

    // User Requirement: "Start Game button in top right... Frozen until start"
    // This implies we enter the Game Board view, but it's frozen.
    // So:
    switchView('game');
    initGame(); // Show board

    // GUARANTEE: Update Room Code Display
    if (currentRoomCode) {
        document.getElementById('game-room-code').innerText = currentRoomCode;
        display.roomCode.innerText = currentRoomCode;
    } else {
        console.warn("prepareLobbyUI called but currentRoomCode is missing!");
    }

    const readyBtn = document.getElementById('btn-player-ready');
    const startBtn = document.getElementById('btn-host-start');

    // Reset classes
    readyBtn.classList.add('hidden');
    startBtn.classList.add('hidden');

    if (isHost) {
        startBtn.classList.remove('hidden');
        startBtn.disabled = true; // Disabled until others ready
        display.turn.innerText = "플레이어 대기 중...";
    } else {
        readyBtn.classList.remove('hidden');
        display.turn.innerText = "준비해 주세요";
    }
}

function updateLobbyControls(players) {
    // Determine readiness
    // Host (ID 1)
    const amHost = myPlayerId === 1;
    const allReady = players.every(p => p.id === 1 || p.ready);
    const playerCount = players.length;

    const startBtn = document.getElementById('btn-host-start');
    if (amHost) {
        if (playerCount >= 2 && allReady) {
            startBtn.disabled = false;
            display.turn.innerText = "게임 시작 가능!";
        } else {
            startBtn.disabled = true;
            display.turn.innerText = `대기 중... (${playerCount}/6)`;
        }
    } else {
        const me = players.find(p => p.id === myPlayerId);
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
    if (currentTurn === myPlayerId) {
        display.turn.innerText = "나의 턴!";
        display.turn.style.color = "#10b981"; // Success color
    } else {
        // Find player color hex?
        display.turn.innerText = `플레이어 ${currentTurn}의 턴`;
        display.turn.style.color = "white";
    }
}

// Game State


let board = null;
let renderer = null;

function initGame(count = 6) {
    console.log('Initializing game canvas with players:', count);

    // Initialize Board
    board = new Board();
    board.resetPieces(count); // Apply Player Count settings

    // Initialize Renderer
    const canvas = document.getElementById('game-canvas');
    renderer = new Renderer(canvas);
    renderer.setBoard(board);

    // Handle Clicks
    // Remove existing event listeners to avoid duplicates if init is called multiple times?
    // For now simple reload handles it. But if we re-init:
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    renderer.canvas = newCanvas; // Update renderer ref
    renderer.ctx = newCanvas.getContext('2d');
    renderer.resize();

    newCanvas.addEventListener('mousedown', (e) => {
        const rect = newCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedHex = renderer.handleClick(x, y);
        handleHexClick(clickedHex);
    });
}

// Refined handleHexClick for strict Turn enforcement and correct logic
function handleHexClick(hex) {
    if (!isGameActive) {
        console.warn('Game not active. Ignoring click.');
        return;
    }

    // Loose comparison in case of string/number mismatch
    if (currentTurn != myPlayerId) {
        console.warn(`Not my turn. Current: ${currentTurn}, Mine: ${myPlayerId}`);
        return;
    }

    const key = hex.toString();
    const cell = board.grid.get(key);

    console.log(`Click at ${key}. Cell Owner: ${cell ? cell.player : 'None'}, My ID: ${myPlayerId}, Turn: ${currentTurn}`);

    if (!cell) {
        renderer.selectedHex = null;
        renderer.validMoves = [];
        renderer.draw();
        return;
    }

    // Attempt Move
    if (renderer.selectedHex && !cell.player) {
        const moveObj = renderer.validMoves.find(m => m.hex.equals(hex));
        if (moveObj) {
            const fromHex = renderer.selectedHex;

            // Animate
            renderer.animateMove(moveObj.path, () => {
                board.movePiece(fromHex, hex);
                renderer.selectedHex = null;
                renderer.validMoves = [];
                renderer.draw();

                // Check Win Condition
                if (board.checkWin(myPlayerId)) {
                    console.log('YOU WON!');
                    socket.emit('claimWin', { roomCode: currentRoomCode });
                }

                if (currentRoomCode) {
                    socket.emit('makeMove', {
                        roomCode: currentRoomCode,
                        from: fromHex,
                        to: hex
                    });
                }
            });
            return;
        }
    }

    // Select own piece
    if (cell.player) {
        if (cell.player != myPlayerId) {
            console.log(`Cannot select: Owner ${cell.player} != MyID ${myPlayerId}`);
            return;
        }

        renderer.selectedHex = hex;
        const moves = board.getValidMoves(hex);
        renderer.validMoves = moves;
        renderer.draw();
    } else {
        renderer.selectedHex = null;
        renderer.validMoves = [];
        renderer.draw();
    }
}


// Start
init();

function updatePlayerCountUI(count) {
    playerCount = count;
    document.querySelectorAll('.btn-option').forEach(b => {
        b.classList.remove('selected');
        if (parseInt(b.dataset.value) === count) b.classList.add('selected');
    });
}

function showMyColorNotification() {
    const colorNames = {
        1: '빨강 (Red)', 2: '주황 (Orange)', 3: '노랑 (Yellow)',
        4: '초록 (Green)', 5: '청록 (Cyan)', 6: '파랑 (Blue)'
    };
    const myColorName = colorNames[myPlayerId] || 'Unknown';

    // Create or update a notification element
    let notif = document.getElementById('color-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'color-notification';
        notif.className = 'notification-overlay';
        document.body.appendChild(notif);
    }

    notif.innerHTML = `<div>당신은 <span style="color: ${getColorHex(myPlayerId)}; font-weight:bold;">${myColorName}</span> 플레이어입니다.</div>`;

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
