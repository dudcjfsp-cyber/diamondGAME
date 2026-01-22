// public/js/hex.js

export class Hex {
    constructor(q, r) {
        this.q = q;
        this.r = r;
        this.s = -q - r;
    }

    add(other) {
        return new Hex(this.q + other.q, this.r + other.r);
    }

    scale(factor) {
        return new Hex(this.q * factor, this.r * factor);
    }

    neighbor(direction) {
        const directions = [
            new Hex(1, 0), new Hex(1, -1), new Hex(0, -1),
            new Hex(-1, 0), new Hex(-1, 1), new Hex(0, 1)
        ];
        return this.add(directions[direction]);
    }

    equals(other) {
        return this.q === other.q && this.r === other.r;
    }

    toString() {
        return `${this.q},${this.r}`;
    }
}

export function pixelToHex(x, y, size) {
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
    const r = (2 / 3 * y) / size;
    return roundHex(q, r);
}

function roundHex(q, r) {
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const q_diff = Math.abs(rq - q);
    const r_diff = Math.abs(rr - r);
    const s_diff = Math.abs(rs - s);

    if (q_diff > r_diff && q_diff > s_diff) {
        rq = -rr - rs;
    } else if (r_diff > s_diff) {
        rr = -rq - rs;
    } else {
        rs = -rq - rr;
    }
    return new Hex(rq, rr);
}
