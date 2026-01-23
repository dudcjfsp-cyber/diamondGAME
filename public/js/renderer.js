// public/js/renderer.js
import { pixelToHex } from './hex.js';
import { GameState } from './gameState.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hexSize = 25; // Radius of hex
        this.board = null;
        this.playerColors = GameState.PLAYER_COLORS;

        this.resize();

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Interaction state
        this.selectedHex = null;
        this.validMoves = []; // Array of stringified hex coordinates
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;

        // Center the board
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        if (this.board) this.draw();
    }

    setBoard(board) {
        this.board = board;
        this.draw();
    }

    hexToPixel(hex) {
        const x = this.hexSize * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
        const y = this.hexSize * (3 / 2 * hex.r);
        return { x: x + this.centerX, y: y + this.centerY };
    }

    draw() {
        if (!this.board) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all cells
        this.board.grid.forEach((cell, key) => {
            const { x, y } = this.hexToPixel(cell.hex);
            this.drawCell(x, y, cell);
        });
    }

    drawCell(x, y, cell) {
        // Draw Hole (Background)
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.hexSize * 0.4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fill();

        // Highlight Selection
        if (this.selectedHex && this.selectedHex.equals(cell.hex)) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.hexSize * 0.8, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }

        // Suggestion/Valid Move Highlight
        if (this.validMoves && this.validMoves.length > 0) {
            this.validMoves.forEach(moveObj => {
                // validMoves now contains { hex, path } objects
                const { x, y } = this.hexToPixel(moveObj.hex);
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.hexSize * 0.3, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                this.ctx.fill();
            });
        }

        // Last Move Highlight
        if (this.lastMove) {
            const startP = this.hexToPixel(this.lastMove.from);
            const endP = this.hexToPixel(this.lastMove.to);

            // Draw ghost circle at start position
            this.ctx.beginPath();
            this.ctx.arc(startP.x, startP.y, this.hexSize * 0.5, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw ring at end position
            this.ctx.beginPath();
            this.ctx.arc(endP.x, endP.y, this.hexSize * 0.7, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#facc15'; // Yellow highlight
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }

        // Draw Piece
        if (cell.player) {
            // Skip drawing the piece if it is currently animating (we draw it in animate loop)
            if (this.animatingPiece && this.animatingPiece.hex.equals(cell.hex)) {
                return;
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, this.hexSize * 0.65, 0, Math.PI * 2);

            // Add gradient/shadow for 3D effect
            const grad = this.ctx.createRadialGradient(x - 5, y - 5, 2, x, y, this.hexSize * 0.65);
            grad.addColorStop(0, 'white'); // Highlight
            grad.addColorStop(0.3, this.playerColors[cell.player]);
            grad.addColorStop(1, 'black'); // Shadow

            // Actually simple flat color with shadow is cleaner for now
            this.ctx.fillStyle = this.playerColors[cell.player];
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetY = 3;
            this.ctx.fill();
            this.ctx.shadowColor = 'transparent';
        }
    }

    handleClick(x, y) {
        if (this.isAnimating) return null; // Block click during animation
        // Correct mouse pos relative to canvas center
        const hex = pixelToHex(x - this.centerX, y - this.centerY, this.hexSize);
        return hex;
    }

    animateMove(path, callback) {
        if (path.length < 2) {
            if (callback) callback();
            return;
        }

        // Cancel existing animation if any
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.isAnimating = false;
            this.animatingPiece = null;
        }

        this.isAnimating = true;
        const startHex = path[0];

        // Find player color
        // Note: board state is not updated yet, so startHex describes the piece
        // Find player color
        // Robust check: Is the piece at start (Animation First) or ends (State First)?
        const startKey = startHex.toString();
        const endKey = path[path.length - 1].toString();

        const startCell = this.board.grid.get(startKey);
        const endCell = this.board.grid.get(endKey);

        let player = null;
        let hexToHide = startHex;

        if (startCell && startCell.player) {
            player = startCell.player;
            hexToHide = startHex;
        } else if (endCell && endCell.player) {
            player = endCell.player;
            hexToHide = path[path.length - 1];
        }

        this.animatingPiece = { hex: hexToHide, player: player }; // Hide static piece

        let pointIndex = 0;
        let progress = 0;
        const speed = 0.15; // Speed of animation per segment

        const animate = () => {
            progress += speed;
            if (progress >= 1) {
                progress = 0;
                pointIndex++;
            }

            if (pointIndex >= path.length - 1) {
                // Done
                this.isAnimating = false;
                this.animatingPiece = null;
                if (callback) callback();
                return;
            }

            // Interpolate between pointIndex and pointIndex+1
            const p1 = this.hexToPixel(path[pointIndex]);
            const p2 = this.hexToPixel(path[pointIndex + 1]);

            const curX = p1.x + (p2.x - p1.x) * progress;
            const curY = p1.y + (p2.y - p1.y) * progress;

            // Height for Jump effect? 
            // Parabola: 4 * h * x * (1-x)
            // Let's add a "hop" effect in Y axis
            // Only if it is a jump (dist > 1). 
            // Neighbors are distance 1.
            // Check hex distance?
            // neighbor() is dist 1. So simple walk is dist 1.
            // Chain jump hops: dist 2 usually.

            // Simple visual hop
            const hopHeight = 15 * Math.sin(progress * Math.PI);

            this.draw(); // Draw board (static pieces)

            // Draw animating piece manually on top
            this.ctx.beginPath();
            this.ctx.arc(curX, curY - hopHeight, this.hexSize * 0.65, 0, Math.PI * 2);
            this.ctx.fillStyle = this.playerColors[player] || 'white';
            this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowOffsetY = 10; // Higher shadow when jumping
            this.ctx.fill();
            this.ctx.shadowColor = 'transparent';

            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }
}
