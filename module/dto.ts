import { ObjectType } from "./classes/object.js";
import { eq2 } from "./helpers/utils.js";

export type Point = { x: number, y: number }

export type Vec2 = [number, number];

export enum SnapType {
    line = 'line',
    lineEnd = 'line-end',
    symbol = 'symbol'
};

export class SnapPoint {
    constructor(
        public pt: Vec2,
        public object: ObjectType,
        public t: number,
        public type: SnapType
    ) {}
}

export class AdjustmentPoint {
    constructor(
        public object: ObjectType,
        public index: number,
        public original: Vec2
    ) {}

    equals(other: AdjustmentPoint): boolean {
        return this.object === other.object && this.index === other.index && eq2(this.original, other.original);
    }
}