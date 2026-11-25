import { Line } from "../line.js";

export class SolidLine extends Line {
    get hiddenAlpha(): number {
        return 0.2;
    }

    makeGraphics(): any {
        const poly = new PIXI.Polygon(...this.points.flatMap(pt => pt.point));
        poly.closeStroke = false;
        return new PIXI.Graphics()
            .lineStyle(4, this._currentColorHex)
            .drawPolygon(poly);
    }
}