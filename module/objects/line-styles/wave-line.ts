import { ObjectDrawLayers } from "../../classes/object.js";
import { SnapPoint, SnapType, Vec2 } from "../../dto.js";
import { add2, length2, lengthAndUnitVector, mult2, normal, sub2 } from "../../helpers/utils.js";
import { Line } from "../line.js";

export class WaveLine extends Line {
    draw(layers: ObjectDrawLayers) {
        if (this.isVisible && this.points) {
            const gfx = new PIXI.Graphics()
                .lineStyle(3, this.isSelected ? canvas.linemap._selectionColorHex : 0x0)
            
            for (let i = 0; i < this.points.length - 1; i++) {
                const pt1 = this.points[i];
                const pt2 = this.points[i+1];
                const d = sub2(pt2, pt1);
                const [l, u] = lengthAndUnitVector(d);
                let n = normal(u);

                const intermediateCount = Math.max(Math.floor((l - 16.0) / 32.0), 0);
                const pts = [
                    ...[...Array(intermediateCount).keys()].map(j => add2(pt1, mult2(u, 32.0 * (j+1)))),
                    pt2
                ];

                gfx.moveTo(...pt1);
                let prevPt = pt1;
                for (const nextPt of pts) {
                    const cp1 = add2(prevPt, mult2(add2(u, n), 8.0));
                    const cp2 = add2(nextPt, mult2(add2(mult2(u, -1), n), 8.0));
                    gfx.bezierCurveTo(...cp1, ...cp2, ...nextPt);

                    prevPt = nextPt;
                    n = mult2(n, -1);
                }
            }
    
            gfx.alpha = this.isRevealed ? 1.0 : 0.4;
            layers.lines?.addChild(gfx);
        }
    }

    getSnapPoints(pt: Vec2, types: SnapType[]) {
        const result: SnapPoint[] = [];
        const config = CONFIG.linemap.snap;

        if (types.includes(SnapType.lineEnd)) {
            const d0 = length2(sub2(pt, this.points[0]));
            const d1 = length2(sub2(pt, this.points[1]));
            if (d0 <= config.lineEnd) {
                result.push(new SnapPoint(this.points[0], this, 0, SnapType.lineEnd));
            }
            if (d1 <= config.lineEnd) {
                result.push(new SnapPoint(this.points[1], this, 1, SnapType.lineEnd));
            }
        }
        if (!result.length && types.includes(SnapType.line)) {
            for (let i = 0; i < this.points.length - 1; i++) {
                const pt1 = this.points[i];
                const pt2 = this.points[i+1];
                const d = sub2(pt2, pt1);
                const [l, u] = lengthAndUnitVector(d);

                const intermediateCount = Math.max(Math.floor((l - 16.0) / 32.0), 0);
                [...Array(intermediateCount).keys()].map(j => {
                    const pl = 32.0 * (j+1);
                    const pt0 = add2(pt1, mult2(u, pl));
                    const t = pl / l;
                    const dist = length2(sub2(pt, pt0));

                    if (dist <= config.line) {
                        result.push(new SnapPoint(pt0, this, t, SnapType.line));
                    }
                })
            }
        }

        return result;
    }
}