import { ObjectDrawLayers } from "../../classes/object.js";
import { add2, mult2, normal, normalize, sub2 } from "../../helpers/utils.js";
import { Line } from "../line.js";

export class BarrierLine extends Line {
    draw(layers: ObjectDrawLayers) {
        if (this.isVisible && this.points) {
            const poly = new PIXI.Polygon(...this.points.flatMap(pt => pt.point));
            poly.closeStroke = false;
            const gfx = new PIXI.Graphics()
                .lineStyle(12, this._currentColorHex)
                .drawPolygon(poly);
            gfx.alpha = this.isRevealed ? 1.0 : 0.2;
            layers.lines?.addChild(gfx);

            const pt1b = this.points[0].point;
            const pt2b = this.points[1].point;
            const db = sub2(pt2b, pt1b);
            const nb = normalize(normal(db));
            gfx
                .lineStyle(4, this._currentColorHex)
                .moveTo(...add2(pt1b, mult2(nb, 20)))
                .lineTo(...add2(pt1b, mult2(nb, -20)));

            const pt1e = this.points.at(-2).point;
            const pt2e = this.points.at(-1).point;
            const de = sub2(pt2e, pt1e);
            const ne = normalize(normal(de));
            gfx
                .lineStyle(4, this._currentColorHex)
                .moveTo(...add2(pt2e, mult2(ne, 20)))
                .lineTo(...add2(pt2e, mult2(ne, -20)));
        }
    }
}