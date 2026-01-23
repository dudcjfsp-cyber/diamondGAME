import { Hex } from './hex.js';

export class AIPlayer {
    constructor(playerId, board) {
        this.id = playerId;
        this.board = board;
        this.targetPoint = this.getTargetPoint();
    }

    getTargetPoint() {
        // Dynamic target based on player ID
        // Player 1 (Top) -> Target Bottom (0, 8)
        // Player 4 (Bottom) -> Target Top (0, -8)
        // Others can be added as needed.
        if (this.id === 1) return new Hex(0, 8);
        if (this.id === 4) return new Hex(0, -8);

        // Fallback for other players (approximated based on board structure)
        if (this.id === 2) return new Hex(-8, 4); // Top-Right -> Bottom-Left?
        if (this.id === 5) return new Hex(8, -4); // Bottom-Left -> Top-Right?
        // ... simpler to default to center if unknown, but for 1v1 (P1 vs P4) this covers it.
        return new Hex(0, 0);
    }

    calculateMove() {
        // console.log('AI calculating move for ID:', this.id);
        const myPieces = [];
        for (const [key, cell] of this.board.grid.entries()) {
            if (cell.player === this.id) {
                myPieces.push(cell.hex);
            }
        }

        let bestMove = null;
        let bestScore = -Infinity;
        const allMoves = [];

        for (const pieceHex of myPieces) {
            const moves = this.board.getValidMoves(pieceHex);

            for (const move of moves) {
                const endHex = move.hex;
                // Store move for fallback
                allMoves.push({ from: pieceHex, to: endHex, path: move.path });

                // --- Scoring Heuristics ---

                // 1. Distance Score (Main Driver)
                // How much closer do we get to the target?
                const startDist = pieceHex.distance(this.targetPoint);
                const endDist = endHex.distance(this.targetPoint);

                // Diff: Positive means we got closer.
                const distDiff = startDist - endDist;
                const distScore = distDiff * 10;

                // 2. Jump Bonus (Efficiency)
                // Reward covering distance, but only if it's broadly in the right direction or neutral?
                // Actually, long jumps are good, but not if they go backwards.
                const moveDist = pieceHex.distance(endHex);
                let jumpBonus = 0;
                if (moveDist > 1) { // It's a jump (path length > 1 step)
                    // Only reward jump if it doesn't lose too much ground
                    if (distDiff >= -1) {
                        jumpBonus = moveDist * 2.0;
                    }
                }

                // 3. Center Bonus (Alignment)
                // penalize straying too far to the edges (high abs(q) or s depending on axis)
                // For P1/P4 (Vertical), q is the horizontal deviation.
                const centerBonus = (Math.abs(pieceHex.q) - Math.abs(endHex.q)) * 1.0;

                // 4. Trailing Piece Bonus (Lag Prevention)
                // CRITICAL FIX: Only apply this bonus if the move actually advances (distDiff > 0).
                // Previously, this was unconditional, causing back pieces to make useless lateral jumps 
                // just because they had high 'startDist'.
                let lagBonus = 0;
                if (distDiff > 0) {
                    // Give extra weight to moving pieces that are far behind
                    lagBonus = startDist * 2.5;
                }

                // 5. Target Zone Logic (Filling)
                let zoneBonus = 0;
                // Check if we are entering the deep target zone
                // Target for P1 is r > 4. Target for P4 is r < -4.
                const startInZone = (this.id === 1 && pieceHex.r > 4) || (this.id === 4 && pieceHex.r < -4);
                const endInZone = (this.id === 1 && endHex.r > 4) || (this.id === 4 && endHex.r < -4);

                // Only reward ENTERING the zone, not moving within it
                if (endInZone && !startInZone) {
                    zoneBonus += 50; // Entering the zone for the first time
                    // Provide extra incentive to reach the very tip
                    if (endHex.equals(this.targetPoint)) {
                        zoneBonus += 30;
                    }
                } else if (startInZone && endInZone) {
                    // Already in zone - only reward if getting closer to tip
                    const startTipDist = pieceHex.distance(this.targetPoint);
                    const endTipDist = endHex.distance(this.targetPoint);
                    if (endTipDist < startTipDist) {
                        zoneBonus += 10; // Small bonus for moving deeper into zone
                    } else {
                        // Penalty for moving around aimlessly in zone
                        zoneBonus -= 30;
                    }
                }

                let score = distScore + jumpBonus + centerBonus + lagBonus + zoneBonus;

                // Random tie-breaker
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

        // Fallback: Random move if no moves found (shouldn't happen often)
        if (!bestMove && allMoves.length > 0) {
            // console.warn('AI performing fallback random move.');
            bestMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        return bestMove;
    }
}
