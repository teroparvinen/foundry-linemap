import { ObjectData, ObjectType } from "../classes/object.js";
import { Vec2, SnapPoint, SnapType, AdjustmentPoint } from "../dto.js";
import { add2, distanceToLine, dotProduct, length2, lengthAndUnitVector, lineIntersectsBox, mult2, sub2 } from "../helpers/utils.js";

export interface LineData extends ObjectData {
    points: Vec2[];
}

export class Line extends ObjectType {
    static type = "line"

    points: Vec2[];
    style: string;

    constructor({ points, style }: { points: Vec2[], style: string }) {
        super();

        this.points = points.map(pt => [...pt]);
        this.style = style;
    }

    static deserialize(data: { points: Vec2[], style: string }): ObjectType {
        const styles = CONFIG.linemap.lineStyles;
        const lineClass = styles[data.style]?.lineClass ?? styles[Object.keys(styles)[0]].lineClass;
        return new lineClass(data);
    }

    get serialized(): LineData {
        return { ...super.serialized, ...{
            points: this.points,
            style: this.style
        }};
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
            const dLine = distanceToLine(pt, this.points[0], this.points[1]);
            if (dLine <= config.line) {
                const d = sub2(this.points[1], this.points[0]);
                const [l, u] = lengthAndUnitVector(d);
                const s = dotProduct(u, sub2(pt, this.points[0]));
                const ptLine = add2(this.points[0], mult2(u, s));
                const t = l / s;
                result.push(new SnapPoint(ptLine, this, t, SnapType.line))
            }
        }

        return result;
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        if (pt2) {
            return lineIntersectsBox(this.points, [pt1, pt2]);
        } else {
            const dist = distanceToLine(pt1, this.points[0], this.points[1], true);
            const threshold = CONFIG.linemap.lineStyles[this.style].selectTolerance;
            return dist <= threshold;
        }
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return this.points.map((pt, i) => new AdjustmentPoint(this, i, pt));
    }
    setAdjustmentPoint(index: number, point: Vec2) {
        this.points[index] = point;
    }
}
