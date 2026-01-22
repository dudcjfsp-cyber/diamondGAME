// public/js/board.js
import { Hex } from './hex.js';

export class Board {
    constructor() {
        this.grid = new Map(); // key: "q,r", value: { hex, player, type }
        this.radius = 4; // Standard Chinese Checkers radius (4 hole triangle side?)
        // Actually, standard board: side of the star triangle is 4 points. 
        // Radius 4 from center implies 4 rings.
        this.initBoard();
    }

    initBoard() {
        // 1. Generate the central hexagon (radius 4)
        for (let q = -this.radius; q <= this.radius; q++) {
            let r1 = Math.max(-this.radius, -q - this.radius);
            let r2 = Math.min(this.radius, -q + this.radius);
            for (let r = r1; r <= r2; r++) {
                this.addHex(new Hex(q, r), null);
            }
        }

        // 2. Generate the 6 triangles (points of the star)
        // The triangles extend 4 more steps from the hex sides.
        // Actually, easiest way is to generate based on specific ranges.
        // Standard Sternhalma: 121 holes.
        // Center hex radius 4 + 6 triangles of side 4.

        // Let's verify geometry.
        // If center is 0,0.
        // Top triangle tip?
        // Another approach: The board is a large hexagon with corners cut out?
        // No, it's a hexagram.

        // Let's add triangles explicitly based on neighbor directions from the "corners" of the inner hex?
        // No, easier:
        // Everything with distance <= 4 from center is IN.
        // Plus 6 triangles.
        // Top triangle: q=0..4, r?

        // Let's use the property:
        // A standard board fits in a large hexagon of radius 8? NOT quite.
        // It's defined by constraints.
        // Let's implement the "Center Hexagon + 6 Triangles" logic.

        const centerParams = { q: 0, r: 0, radius: 4 };

        // But actually, the "Star" is formed by overlapping two large triangles?
        // Or one central hex radius 4, and 6 small triangles radius 4?
        // Wait, standard has 4 holes on the side of the triangle.
        // 10 holes per triangle (1+2+3+4).

        // Let's stick to: Create all hexes within distance 4 (The body).
        // Then add the tips.
        // Tip 1 (Top Right?): q > 0, r < 0, s < 0? 
        // It's tricky to guess without visualization.

        // Alternative: Hardcode or use a known algorithm "Star Shape".
        // Star shape can be defined as:
        // |q| <= 4 AND |r| <= 4 AND |s| <= 4  => This is the HEXAGON.

        // To get the STAR, we EXTEND.
        // One triangle tip starts at, say, top.
        // Let's iterate all hexes in a larger bounding box (radius 8).
        // And check if they belong to the star.
        // Star condition: 
        // Not implemented trivially by equation?
        // Actually, inverted logic:
        // It is the union of two large triangles.
        // Triangle 1 (pointing up): y <= 4 and ...
        // Triangle 2 (pointing down): y >= -4 ...

        // Let's use the "Union of two Hexagons" theory? No.
        // Union of two Triangles? Yes.
        // In Axial:
        // Triangle 1: r <= 4 AND s <= 4 AND q >= -8 ? Maybe.

        // Let's try the "Walking" Method or simply known ranges.
        // Directions: 0 to 5.
        // Center hex: radius 4.
        // 6 Tips: radius 4 triangles.
        // Position of tips:
        // Top-Right (Dir 0? No, Dir 5 & 0).
        // Let's assume standardized axial.

        // Tip 0 (Top, r negative):
        // Tip 1 (Top Right, q positive, r negative):

        // Let's look at a simpler constraint:
        // d(center) <= 4 OR (in specific sectors AND d(center) <= 8)?

        // Correct logic for Star of David radius 4 (standard):
        // It is the set of hexes such that:
        // Logic: if (logic for hex radius 4) return true;
        // Tip 1 (Top): q=0..4, r=-5..-8 ? No.

        // Let's use coordinate ranges for standard 121-point board.
        // Center (0,0).
        // Valid if:
        // (|q| <= 4 AND |r| <= 4 AND |s| <= 4) OR ... 6 tips.
        // Actually, the center hex is size 5 (radius 4).

        // Let's just create the "large" triangle and "inverted" triangle and intersect? 
        // No, it's Union.
        // Large Triangle 1 (Pointing Top-Right?): q from -4 to 8, r from -4 to 4?
        // This is guessing.

        // Tried and true method:
        // 1. Create a Set of hexes.
        // 2. Add Center Hexagon (radius 4).
        // 3. Add 6 Triangles based on "Corner" hexes of the center.
        // Center corners (radius 4):
        // (4, -4), (0, -4), (-4, 0), (-4, 4), (0, 4), (4, 0) -- wait, (4,-4) is corner?
        // In axial, corners are at distance 4.
        // e.g. (4, 0), (0, 4), (-4, 4), (-4, 0), (0, -4), (4, -4).
        // From each corner, execute a triangle generation.

        // Wait, standard board has 13 holes on the center line. 
        // 121 total.
        // My radius 4 center hex generates:
        // 1 + 6*1 + 6*2 + 6*3 + 6*4 = 1 + 60 = 61 holes.
        // We need 121. Difference = 60.
        // 60 / 6 = 10 holes per tip.
        // 10 holes is a triangle of side 4 (1+2+3+4).
        // So yes, Center Radius 4 + 6 Triangles of Size 4 attached to faces? No, attached to corners?
        // No, standard chinese checkers star:
        // The "waist" is wide.

        // Correct algorithm:
        // Generated by union of two large triangles.
        // Triangle A: q <= 4, r >= -4, s <= 4  (Maybe?)
        // Let's brute force scan a 13x13 grid and apply a "Star" filter.
        // Filter: 
        // (r >= -4 && r <= 4) || (q >= -4 && q <= 4) || (s >= -4 && s <= 4) // This creates a "Snowflake" or wide hex? 
        // No, this creates the union of 3 strips.
        // THIS IS EXACTLY THE BOARD SHAPE!
        // The board is formed by the intersection of NO, Union of 3 infinite strips?
        // Strip 1: -4 <= q <= 4
        // Strip 2: -4 <= r <= 4
        // Strip 3: -4 <= s <= 4
        // Intersection of these 3 is the center hexagon.
        // One of them? No.
        // The standard board is the Star.
        // It is actually:
        // ( |q| <= 4 ) AND ( |r| <= 4 ) AND ( |s| <= 4 )  <- Center
        // We want the tips too.

        // WAIT. 
        // The condition `(|r| <= 4)` keeps a horizontal strip.
        // The condition `(|q| <= 4)` keeps a diagonal strip.
        // The condition `(|s| <= 4)` keeps the other diagonal strip.
        // The Star Board is the INTERSECTION of pairs? NO.
        // It is the set where AT LEAST TWO coordinates are within range [-4, 4].
        // YES!
        // If q is huge (tip), then r and s must be small? 
        // Let's trace a tip: q=5. r must be -4? s= -1? 
        // If q=8 (tip point), r=-4, s=-4.
        // |-4| <= 4 (True), |-4| <= 4 (True). So 2 are true.
        // So the condition is: count(|c| <= 4 for c in [q,r,s]) >= 2.

        for (let q = -8; q <= 8; q++) {
            for (let r = -8; r <= 8; r++) {
                const s = -q - r;
                const coords = [q, r, s];
                const validCount = coords.filter(c => Math.abs(c) <= 4).length;

                if (validCount >= 2) {
                    this.addHex(new Hex(q, r), null);
                }
            }
        }

        this.resetPieces(6); // Default 6 players for test
    }

    addHex(hex, player) {
        this.grid.set(hex.toString(), { hex, player, type: 'empty' });
    }

    resetPieces(playerCount) {
        // Clear pieces
        this.grid.forEach(cell => cell.player = null);

        // Define Home Zones (Tips)
        // 6 Tips.
        // Tip 1 (Top): r <= -5 ?
        // Based on our logic:
        // q=0, r=-8 (Point) -> s=8.
        // q=0..4, r.. ?

        // Let's identify the 6 zones by center direction.
        // Zone 0 (Top): q in?, r < -4
        // Zone 1 (Top Right): q > 4, r < -4? No, r is small.
        // Let's map coordinates to player IDs.

        this.grid.forEach(cell => {
            const { q, r, s } = cell.hex;
            let p = null;
            if (r < -4) p = 1; // Top
            else if (s < -4) p = 2; // Top Right
            else if (q > 4) p = 3; // Bottom Right
            else if (r > 4) p = 4; // Bottom
            else if (s > 4) p = 5; // Bottom Left
            else if (q < -4) p = 6; // Top Left

            if (p) {
                // Assign players based on playerCount
                // 2 Players: 1 vs 4
                // 3 Players: 1, 3, 5
                // 4 Players: 2, 3, 5, 6 (Example) or 1,2, 4,5?
                // 6 Players: All

                if (this.isPlayerActive(p, playerCount)) {
                    cell.player = p;
                }
                cell.zone = p; // Mark zone ownership
            }
        });
    }

    isPlayerActive(p, count) {
        if (count === 2) return p === 1 || p === 4;
        if (count === 3) return p === 1 || p === 3 || p === 5;
        if (count === 4) return p === 2 || p === 3 || p === 5 || p === 6; // Standard 4P: skip 1 and 4 (heads)
        if (count === 6) return true;
        if (count === 5) return p !== 4; // Arbitrary 5P setup
        return false;
    }

    // Movement Logic
    getValidMoves(startHex) {
        const moves = new Map(); // key: hex.toString(), value: { hex, path: [hex] }
        const visited = new Set();

        // 1. Single Step (Walk)
        const directions = [0, 1, 2, 3, 4, 5];

        directions.forEach(dir => {
            const neighbor = startHex.neighbor(dir);
            const key = neighbor.toString();
            if (this.grid.has(key) && !this.grid.get(key).player) {
                // Empty spot, valid step
                moves.set(key, {
                    hex: neighbor,
                    path: [startHex, neighbor]
                });
            }
        });

        // 2. Chain Jumps
        // Path starts with just the startHex
        this.findJumps(startHex, visited, moves, [startHex]);

        // Convert Map to array of objects for easier consumption
        return Array.from(moves.values());
    }

    findJumps(currentHex, visited, moves, currentPath) {
        if (visited.has(currentHex.toString())) return;
        visited.add(currentHex.toString());

        const directions = [0, 1, 2, 3, 4, 5];

        directions.forEach(dir => {
            const neighbor = currentHex.neighbor(dir);
            const neighborKey = neighbor.toString();

            // Check if there is a piece to jump over
            if (this.grid.has(neighborKey) && this.grid.get(neighborKey).player) {
                const landing = neighbor.neighbor(dir);
                const landingKey = landing.toString();

                if (this.grid.has(landingKey) && !this.grid.get(landingKey).player) {
                    if (!visited.has(landingKey)) {
                        // Valid jump found
                        const newPath = [...currentPath, landing];

                        // Store logic: if multiple paths to same node, keep first/shortest? 
                        // Using Map ensures one entry per destination.
                        if (!moves.has(landingKey)) {
                            moves.set(landingKey, {
                                hex: landing,
                                path: newPath
                            });
                        }

                        this.findJumps(landing, visited, moves, newPath);
                    }
                }
            }
        });
    }

    movePiece(startHex, endHex) {
        const startKey = startHex.toString();
        const endKey = endHex.toString();

        const startCell = this.grid.get(startKey);
        const endCell = this.grid.get(endKey);

        if (startCell && endCell && !endCell.player) {
            endCell.player = startCell.player;
            startCell.player = null;
            return true;
        }
        return false;
    }

    getTargetZone(playerId) {
        // Map 1->4, 2->5, 3->6, 4->1, 5->2, 6->3
        return (parseInt(playerId) + 2) % 6 + 1;
    }

    checkWin(playerId) {
        let totalPieces = 0;
        let inTargetZone = 0;
        const targetZone = this.getTargetZone(playerId);

        for (const cell of this.grid.values()) {
            if (cell.player === playerId) {
                totalPieces++;
                if (cell.zone === targetZone) {
                    inTargetZone++;
                }
            }
        }
        // Win if pieces exist and all are in target zone
        return totalPieces > 0 && totalPieces === inTargetZone;
    }
}
