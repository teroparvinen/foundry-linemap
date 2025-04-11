import { ObjectType } from "./classes/object.js";
import { eq2 } from "./helpers/utils.js";

export type Point = { x: number, y: number }

export type Vec2 = [number, number];

export enum SnapType {
    line = 'line',
    lineContour = 'line-contour',
    lineEnd = 'line-end',
    symbol = 'symbol'
};

export enum PointType {
    point,
    line
}

export class SnapPoint {
    constructor(
        public pt: Vec2,
        public object: ObjectType,
        public t: number,
        public type: SnapType
    ) {}
}

export class AdjustmentPoint {
    current: Vec2;

    constructor(
        public type: PointType,
        public object: ObjectType,
        public index: number,
        public original: Vec2,
        public isConstrained: boolean
    ) {
        this.current = original;
    }

    equals(other: AdjustmentPoint): boolean {
        return this.object === other.object && this.index === other.index && eq2(this.original, other.original);
    }
}