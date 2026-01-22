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
    }
};
