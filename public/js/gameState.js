// public/js/gameState.js

export const GameState = {
    // UI State
    currentPage: 'lobby',

    // Session State
    socket: null,
    currentRoomCode: null,
    myPlayerId: null,
    playerCount: 2,

    // Gameplay State
    currentTurn: null,
    isGameActive: false,
    amIReady: false,

    // Game Objects
    board: null,
    renderer: null,
    isGameInitialized: false,

    // Solo Mode State
    isSoloMode: false,
    aiPlayer: null,

    // Methods
    resetForNewGame() {
        this.isGameActive = false;
        this.currentTurn = null;
        this.amIReady = false;
        // Note: board and renderer are typically reused or explicitly re-initialized
        // assignments are handled in client.js for now
    },

    setSocket(socketInstance) {
        this.socket = socketInstance;
    },

    // Constants
    PLAYER_COLORS: {
        1: '#ef4444', // Red (Top)
        2: '#f97316', // Orange (Top Right)
        3: '#eab308', // Yellow (Bottom Right)
        4: '#22c55e', // Green (Bottom)
        5: '#06b6d4', // Cyan (Bottom Left)
        6: '#3b82f6'  // Blue (Top Left)
    },
    PLAYER_NAMES: {
        1: '빨강 (Red)', 2: '주황 (Orange)', 3: '노랑 (Yellow)',
        4: '초록 (Green)', 5: '청록 (Cyan)', 6: '파랑 (Blue)'
    }
};
