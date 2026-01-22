import { Hex } from './hex.js';

export class AIPlayer {
    constructor(playerId, board) {
        this.id = playerId;
        this.board = board;
        this.targetPoint = this.getTargetPoint(playerId);
    }

    getTargetPoint(id) {
        // Player 1 (Top) -> Target Bottom (0, 8)
        // Player 4 (Bottom) -> Target Top (0, -8)
        // Others can be calculated via rotation if needed, but we only support 1 vs 4 for now.
        // P1: r < -4. Target r > 4.
        // P4: r > 4. Target r < -4.

        // Axial distance logic: 
        // Hex(0, 8) is the tip of the bottom triangle.
        // Hex(0, -8) is the tip of the top triangle.

        if (id === 1) return new Hex(0, 8); // Red aims for Bottom
        if (id === 4) return new Hex(0, -8); // Green aims for Top

        // Fallback for other IDs (not fully supported yet, but standard mapping)
        // P2 (Top Right) -> Target Bottom Left
        // P3 (Bottom Right) -> Target Top Left
        // P5 (Bottom Left) -> Target Top Right
        // P6 (Top Left) -> Target Bottom Right
        return new Hex(0, 0);
    }

    calculateMove() {
        console.log('AI calculating move for ID:', this.id);
        // 1. Find all my pieces
        const myPieces = [];
        for (const [key, cell] of this.board.grid.entries()) {
            if (cell.player === this.id) {
                myPieces.push(cell.hex);
            }
        }

        let bestMove = null;
        let bestScore = -Infinity;

        // 2. Evaluate all valid moves for each piece
        for (const pieceHex of myPieces) {
            const startDist = pieceHex.distance(this.targetPoint);
            const moves = this.board.getValidMoves(pieceHex);

            for (const move of moves) {
                const endHex = move.hex;
                const endDist = endHex.distance(this.targetPoint);

                // Heuristic: Maximize distance reduction
                // Score = (Start Distance - End Distance)
                // Positive score means getting closer.

                // Add tiny random factor to break ties and avoid loops
                // But prefer moves that advance furthest.

                // Advanced Heuristic:
                // - Bonus for entering target zone?
                // - Penalty for leaving target zone?
                // - Prefer moves that hop (longer paths usually better)

                let score = startDist - endDist;

                // Tie breaker: prioritize moves that go further into target zone
                // or prioritize moves that move the furthest pieces (trailing pieces)
                // Let's add logic to move trailing pieces to prevent leaving them behind.
                // Score += startDist * 0.1; // Furthest pieces get a slight boost

                // Random tie-breaker (0 to 0.5)
                score += Math.random() * 0.5;

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = {
                        from: pieceHex,
                        to: endHex,
                        path: move.path
                    };
                }
            }
        }

        // If no beneficial move (e.g. all blocked or in target), pick any valid move preventing stagnation?
        // Greedy might get stuck if local optima. 
        // But for Chinese Checkers, simple greedy usually works to just "go forward".

        return bestMove;
    }
}
