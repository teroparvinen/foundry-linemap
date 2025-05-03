import { ObjectDrawLayers } from "../../classes/object.js";
import { Line } from "../line.js";

export class SolidLine extends Line {
    draw(layers: ObjectDrawLayers) {
        if (this.isVisible && this.points) {
            const poly = new PIXI.Polygon(...this.points.flatMap(pt => pt.point));
            poly.closeStroke = false;
            const gfx = new PIXI.Graphics()
                .lineStyle(4, this._currentColorHex)
                .drawPolygon(poly);
            gfx.alpha = this.isRevealed ? 1.0 : 0.2;
            layers.lines?.addChild(gfx);
        }
    }
}