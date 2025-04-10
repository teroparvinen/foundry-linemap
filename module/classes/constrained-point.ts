import { PointType, SnapPoint, Vec2 } from "../dto.js";
import { ObjectType } from "./object.js";

export interface ConstrainedPointData {
    point?: Vec2;
    sourceId?: string;
    sourceT?: number;
}

export class ConstrainedPoint {
    type: PointType;
    unconstrainedPoint: Vec2 | undefined;
    sourceObject: ObjectType | undefined;
    sourceT: number | undefined;

    constructor(type: PointType, point?: Vec2, object?: ObjectType, t?: number) {
        this.type = type;
        this.unconstrainedPoint = point;
        this.sourceObject = object;
        this.sourceT = t;
    }

    get serialized(): ConstrainedPointData {
        const result: ConstrainedPointData = {};
        if (this.unconstrainedPoint) {
            result.point = this.unconstrainedPoint;
        }
        if (this.sourceObject) {
            result.sourceId = this.sourceObject.id;
            result.sourceT = this.sourceT;
        }
        return result;
    }

    get point(): Vec2 {
        if (this.sourceObject) {
            return this.sourceObject?.getParametricPoint(this.sourceT!, this.type);
        }
        return this.unconstrainedPoint;
    }

    setFrom(other: ConstrainedPoint, owner: ObjectType) {
        const isCyclic = other.sourceObject?.hasConstraintTo(owner);

        if (isCyclic) {
            ui.notifications.warn(game.i18n.localize('linemap.error.cyclicConstraint'));
        }

        if (!isCyclic && other.sourceObject) {
            this.unconstrainedPoint = other.unconstrainedPoint;
            this.sourceObject = other.sourceObject;
            this.sourceT = other.sourceT;
        } else {
            this.unconstrainedPoint = other.unconstrainedPoint;
            this.sourceObject = this.sourceT = undefined;
        }
    }

    static fromSnapOrPoint(type: PointType, point: Vec2, snapPoint: SnapPoint): ConstrainedPoint {
        if (snapPoint) {
            return new ConstrainedPoint(type, [...point], snapPoint.object, snapPoint.t);
        } else {
            return new ConstrainedPoint(type, [...point], undefined, undefined);
        }
    }
}