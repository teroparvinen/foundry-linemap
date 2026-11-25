import { ObjectData, ObjectDrawLayers, ObjectIdMapping, ObjectType, PointMover } from "../classes/object.js";
import { ConstrainedPoint, ConstrainedPointData } from "../classes/constrained-point.js";
import { Vec2, SnapPoint, SnapType, AdjustmentPoint, PointType } from "../dto.js";
import { add2, distanceToLine, dotProduct, length2, lengthAndUnitVector, lineIntersectsBox, mult2, sub2 } from "../helpers/utils.js";

export interface LineData extends ObjectData {
    points: ConstrainedPointData[];
    style: string;
}

export class Line extends ObjectType {
    static type = "line"

    points: ConstrainedPoint[];
    style: string;

    static getType(data: { id?: string, style: string }): typeof ObjectType {
        const styles = CONFIG.linemap.lineStyles;
        return styles[data.style]?.lineClass ?? styles[Object.keys(styles)[0]].lineClass;
    }

    construct(points: ConstrainedPoint[], style: string) {
        this.points = points;
        this.style = style;
    }

    deserialize(data: LineData, objectMap: ObjectIdMapping) {
        super.deserialize(data, objectMap);
        this.construct(
            data.points.map(ptData => new ConstrainedPoint(PointType.line, ptData.point, objectMap[ptData.sourceId], ptData.sourceT)),
            data.style
        );
    }

    static moveData(data: LineData, move: PointMover): LineData {
        return { ...data, points: data.points?.map(pt => pt.point ? { ...pt, point: move(pt.point) } : pt) };
    }

    get constrainedPoints(): ConstrainedPoint[] {
        return this.points ?? [];
    }

    get serialized(): LineData {
        return { ...super.serialized, ...{
            points: this.points.map(pt => pt.serialized),
            style: this.style
        }};
    }

    /** Opacity of a hidden line, as the Gamemaster sees it. */
    get hiddenAlpha(): number {
        return 0.4;
    }

    /** This line's graphics, built from scratch (each style draws its own). */
    makeGraphics(): any {
        return new PIXI.Graphics();
    }

    /** What the line's graphics depend on: a change of any of it rebuilds them. */
    get _drawKey(): string {
        return JSON.stringify([this.style, this._currentColorHex, this.points.map(pt => pt.point)]);
    }

    draw(layers: ObjectDrawLayers) {
        if (!this.isVisible || !this.points) return;
        this._place(layers, canvas.linemap.cachedDisplay(this.id, this._drawKey, () => this.makeGraphics()));
    }

    /** Draw a line that is not on the map (the line tool's preview), outside the layer's cache. */
    drawPreview(layers: ObjectDrawLayers) {
        if (this.points) this._place(layers, this.makeGraphics());
    }

    _place(layers: ObjectDrawLayers, gfx: any) {
        gfx.alpha = this.isRevealed ? 1.0 : this.hiddenAlpha;
        layers.lines?.addChild(gfx);
    }

    get pointType(): PointType {
        return PointType.line;
    }

    get textAscent(): number {
        return 15;
    }

    getSnapPoints(pt: Vec2, types: SnapType[]) {
        const result: SnapPoint[] = [];
        const config = CONFIG.linemap.snap;

        const pt0 = this.points[0].point;
        const pt1 = this.points[1].point;

        if (types.includes(SnapType.lineEnd)) {
            const d0 = length2(sub2(pt, pt0));
            const d1 = length2(sub2(pt, pt1));
            if (d0 <= config.lineEnd) {
                result.push(new SnapPoint(pt0, this, 0, SnapType.lineEnd));
            }
            if (d1 <= config.lineEnd) {
                result.push(new SnapPoint(pt1, this, 1, SnapType.lineEnd));
            }
        }
        if (!result.length && (types.includes(SnapType.line) || types.includes(SnapType.lineContour))) {
            const dLine = distanceToLine(pt, pt0, pt1);
            if (dLine <= config.line) {
                const d = sub2(pt1, pt0);
                const [l, u] = lengthAndUnitVector(d);
                const s = dotProduct(u, sub2(pt, pt0));
                const ptLine = add2(pt0, mult2(u, s));
                const t = s / l;
                result.push(new SnapPoint(ptLine, this, t, SnapType.line))
            }
        }

        return result;
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        if (pt2) {
            return lineIntersectsBox(this.points.map(pt => pt.point), [pt1, pt2]);
        } else {
            const dist = distanceToLine(pt1, this.points[0].point, this.points[1].point, true);
            // A style this build does not know is drawn as the first style (getType), and selected like one.
            const threshold = CONFIG.linemap.lineStyles[this.style]?.selectTolerance ?? 5;
            return dist <= threshold;
        }
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return this.points.map((pt, i) => new AdjustmentPoint(PointType.line, this, i, pt.point, !!pt.sourceObject));
    }
    setAdjustmentPoint(index: number, point: ConstrainedPoint, isFinal: boolean): boolean {
        this.points[index].setFrom(point, this);
        return true;
    }

    getParametricPoint(t: number, type: PointType): Vec2 {
        const pt0 = this.points[0].point;
        const pt1 = this.points[1].point;
        const [l, u] = lengthAndUnitVector(sub2(pt1, pt0));
        return add2(pt0, mult2(u, l*t));
    }
    getParametricOrientation(t: number): number {
        const d = sub2(this.points[1].point, this.points[0].point);
        return Math.atan2(d[1], d[0]);
    }

    hasConstraintTo(object: ObjectType): boolean {
        return !!this.points.find(pt => pt.sourceObject === object || pt.sourceObject?.hasConstraintTo(object));
    }
}
