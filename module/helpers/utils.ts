import { Vec2 } from "../dto.js";

export function compareDistance(pt1: Vec2, pt2: Vec2, ref: number): number {
    return (pt1[0] - pt2[0]) * (pt1[0] - pt2[0]) + (pt1[1] - pt2[1]) * (pt1[1] - pt2[1]) - ref * ref;
}

export function absAngle(pt1: Vec2, pt2: Vec2, pt3: Vec2): number {
    const dAx = pt2[0] - pt1[0];
    const dAy = pt2[1] - pt1[1];
    const dBx = pt3[0] - pt2[0];
    const dBy = pt3[1] - pt2[1];
    let angle = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
    if (angle < 0) { angle = angle * -1; }
    return angle;
}

export function lineIntersection(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 {
    const det = d1[0] * d2[1] - d2[0] * d1[1];
    if (det === 0) {
        return null;
    }

    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det;

    return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
}

export function distanceToLine(testPt: Vec2, linePt1: Vec2, linePt2: Vec2, allowNonparallel = false): number {
    const d = sub2(linePt2, linePt1);
    const [l, u] = lengthAndUnitVector(d);
    const n = normal(u);

    const cmp = sub2(testPt, linePt1);
    const parallel = dotProduct(u, cmp);
    const perpendicular = dotProduct(n, cmp);

    if (parallel >= 0 && parallel <= l) {
        return Math.abs(perpendicular);
    } else if (allowNonparallel) {
        if (parallel < 0) {
            return length2(cmp);
        } else {
            return length2(sub2(testPt, linePt2));
        }
    }
}

export function length2(v: Vec2): number {
    return Math.sqrt(v[0]*v[0]+v[1]*v[1]);
}

export function normalize(v: Vec2): Vec2 {
    const l = length2(v);
    return [v[0]/l, v[1]/l];
}

export function lengthAndUnitVector(v: Vec2): [number, Vec2] {
    const l = length2(v);
    return [l, [v[0]/l, v[1]/l]];
}

export function normal(v: Vec2): Vec2 {
    return [-v[1], v[0]];
}

export function dotProduct(a: Vec2, b: Vec2): number {
    return a[0] * b[0] + a[1] * b[1]
}

export function add2(...v: Vec2[]): Vec2 {
    return [v.reduce((a, b) => a + b[0], 0), v.reduce((a, b) => a + b[1], 0)];
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
    return [a[0] - b[0], a[1] - b[1]];
}

export function mult2(a: Vec2, c: number): Vec2 {
    return [a[0] * c, a[1] * c];
}

export function div2(a: Vec2, c: number): Vec2 {
    return [a[0] / c, a[1] / c];
}

export function eq2(a: Vec2, b: Vec2): boolean {
    return a && b && a[0] == b[0] && a[1] == b[1];
}

export function vec2fromXY({ x, y }: { x: number, y: number }): Vec2 {
    return [x, y];
}

export function intersectAabb(box1: Vec2[], box2: Vec2[]): boolean {
    const [x1min, y1min] = box1[0];
    const [x1max, y1max] = box1[1];
    const [x2min, y2min] = box2[0];
    const [x2max, y2max] = box2[1];

    const intersectX = (x1min <= x2max && x1max >= x2min);
    const intersectY = (y1min <= y2max && y1max >= y2min);

    return intersectX && intersectY;
}

export function containsAabb(point: Vec2, box: Vec2[]): boolean {
    const [x1min, y1min] = box[0];
    const [x1max, y1max] = box[1];

    const intersectX = (x1min <= point[0] && x1max >= point[0]);
    const intersectY = (y1min <= point[1] && y1max >= point[1]);

    return intersectX && intersectY;
}

export function lineIntersectsBox(points: Vec2[], box: Vec2[]): boolean {
    const [p1, p2] = points;
    const [ [xMin, yMin], [xMax, yMax] ] = box;

    function onSegment(p, q, r) {
        return (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
                q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]));
    }

    function orientation(p, q, r) {
        const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
        if (val === 0) return 0;
        return (val > 0) ? 1 : 2;
    }

    function doIntersect(p1, p2, q1, q2) {
        const o1 = orientation(p1, p2, q1);
        const o2 = orientation(p1, p2, q2);
        const o3 = orientation(q1, q2, p1);
        const o4 = orientation(q1, q2, p2);

        if (o1 !== o2 && o3 !== o4) return true;

        if (o1 === 0 && onSegment(p1, q1, p2)) return true;
        if (o2 === 0 && onSegment(p1, q2, p2)) return true;
        if (o3 === 0 && onSegment(q1, p1, q2)) return true;
        if (o4 === 0 && onSegment(q1, p2, q2)) return true;

        return false;
    }

    const boxEdges = [
        [[xMin, yMin], [xMax, yMin]],
        [[xMax, yMin], [xMax, yMax]],
        [[xMax, yMax], [xMin, yMax]],
        [[xMin, yMax], [xMin, yMin]],
    ];

    for (let edge of boxEdges) {
        if (doIntersect(p1, p2, edge[0], edge[1])) {
            return true;
        }
    }

    return (p1[0] >= xMin && p1[0] <= xMax && p1[1] >= yMin && p1[1] <= yMax) ||
           (p2[0] >= xMin && p2[0] <= xMax && p2[1] >= yMin && p2[1] <= yMax);
}