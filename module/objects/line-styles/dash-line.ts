import { ObjectDrawLayers } from "../../classes/object.js";
import { Vec2 } from "../../dto.js";
import { add2, lengthAndUnitVector, mult2, sub2 } from "../../helpers/utils.js";
import { Line } from "../line.js";

export class DashLine extends Line {
    draw(layers: ObjectDrawLayers) {
        if (this.isVisible && this.points) {
            let coverage = 0;
            const gfx = new PIXI.Graphics()
                .lineStyle(4, this.isSelected ? canvas.linemap._selectionColorHex : 0x0);

            const drawSegment = (pt: Vec2, u: Vec2, l: number, coverage: number) => {
                let first = true;
                let c = 0;
                while (c < l) {
                    const phase = first ? (coverage + c) % 20.0 : 0;

                    if (phase < 12.0) {
                        const lineLength = Math.min(12.0 - phase, l - c);
                        gfx
                            .moveTo(...add2(pt, mult2(u, c)))
                            .lineTo(...add2(pt, mult2(u, c + lineLength)));
                    }

                    c += 20.0 - phase;
                    first = false;
                }
            }

            for (let i = 0; i < this.points.length - 1; i++) {
                const pt1 = this.points[i];
                const pt2 = this.points[i+1];
                const d = sub2(pt2, pt1);
                const [l, u] = lengthAndUnitVector(d);

                drawSegment(pt1, u, l, coverage);

                coverage += l;
            }

            gfx.alpha = this.isRevealed ? 1.0 : 0.4;
            layers.lines?.addChild(gfx);
        }
    }
}