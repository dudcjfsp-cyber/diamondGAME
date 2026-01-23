import { Hex } from './hex.js';

export class AIPlayer {
    constructor(playerId, board) {
        this.id = playerId;
        this.board = board;
        // Player 1 (Red/Top) targets Zone 4 (Green/Bottom)
        this.targetZone = this.getTargetZoneHexes();
    }

    getTargetZoneHexes() {
        // Hardcoded for Player 1 aiming at Player 4's starting zone (Bottom)
        // Zone 4 is defined by r > 4. Max r is 8.
        // The tip is (0,8). The base is row r=5.
        // Coordinates for Zone 4 (Bottom Triangle):
        // r=5: (-4,5), (-3,5), (-2,5), (-1,5) ... wait, q+r+s=0.
        // Let's use the property: Standard board radius 4.
        // Zone 4: r > 4.
        // List of Hexes in Zone 4 (The Goal):
        // r=5: q=0..-? No.
        // Let's use the loop to find them.
        // Actually, let's just use a target CENTER point for general direction,
        // and a specific logic to fill the zone.

        // For efficiency, we'll generate them once.
        return [
            new Hex(0, 8), // Tip
            new Hex(-1, 7), new Hex(0, 7), // Row 7
            new Hex(-2, 6), new Hex(-1, 6), new Hex(0, 6), // Row 6
            new Hex(-3, 5), new Hex(-2, 5), new Hex(-1, 5), new Hex(0, 5) // Row 5
            // Note: The exact q coordinates depend on the board system.
            // In typical axial (pointy top):
            // Bottom triangle: x (q) is centered?
            // If (0,0) is center. (0,8) is bottom.
            // (1,7) and (0,7)? No.
            // Let's stick to the heuristic: maximize 'r'.
        ];
    }

    calculateMove() {
        console.log('AI calculating move for ID:', this.id);
        const myPieces = [];
        for (const [key, cell] of this.board.grid.entries()) {
            if (cell.player === this.id) {
                myPieces.push(cell.hex);
            }
        }

        let bestMove = null;
        let bestScore = -Infinity;
        const allMoves = [];

        // Target Point (Deepest point of target zone)
        const targetPoint = new Hex(0, 8);

        for (const pieceHex of myPieces) {
            const moves = this.board.getValidMoves(pieceHex);

            for (const move of moves) {
                const endHex = move.hex;
                allMoves.push({ from: pieceHex, to: endHex, path: move.path });

                // --- Scoring Heuristics ---

                // 1. Distance Score (Main Driver)
                // How much closer do we get to the absolute bottom?
                const startDist = pieceHex.distance(targetPoint);
                const endDist = endHex.distance(targetPoint);
                const distScore = (startDist - endDist) * 10; // Base weight

                // 2. Jump Bonus (Efficiency)
                // Reward moving further in one turn.
                // Path length 2 = 1 step. Path length 3 = jump over 1.
                // Hop distance: dist(from, to).
                const lookaheadDist = pieceHex.distance(endHex);
                let jumpBonus = 0;
                if (lookaheadDist > 1) {
                    jumpBonus = lookaheadDist * 5; // +5 points per hex jumped
                }

                // 3. Center Bonus (Alignment)
                // Keep 'q' close to 0 to avoid straying to sides.
                const centerBonus = (Math.abs(pieceHex.q) - Math.abs(endHex.q)) * 2;

                // 4. Trailing Piece Bonus (Lag Prevention)
                // If this piece is far from target (startDist is high), give it priority.
                // Normalize roughly: if distance is 10, bonus is small.
                // We want to move pieces that are 'behind'.
                // Compare to average distance of all pieces?
                // Simple version: prioritize pieces with larger startDist.
                const lagBonus = startDist * 0.5;

                // 5. Target Zone Logic (Filling)
                // If destination is IN target zone (r > 4), it's very good.
                // If destination is the TIP (0,8), it's excellent.
                let zoneBonus = 0;
                if (endHex.r > 4) {
                    zoneBonus += 20;
                    // Verify if we are blocking?
                    // Simple greedy: just get in.
                }

                let score = distScore + jumpBonus + centerBonus + lagBonus + zoneBonus;

                // Random tie-breaker
                score += Math.random();

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

        // Fallback: Random move if no positive score found (or trapped)
        if (!bestMove && allMoves.length > 0) {
            console.warn('AI stuck! Searching for fallback move...');
            // Try to find ANY move that doesn't retreat too much?
            // Or just random.
            bestMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }

        return bestMove;
    }
}
