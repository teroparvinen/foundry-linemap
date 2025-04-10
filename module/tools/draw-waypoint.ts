import { ConstrainedPoint } from "../classes/constrained-point.js";
import { ObjectType } from "../classes/object.js";
import { SnapType } from "../dto.js";
import { Waypoint } from "../objects/waypoint.js";
import { BaseIconTool } from "./base-icon.js";

export class DrawWaypointTool extends BaseIconTool {
    get symbolCollection(): any { 
        return CONFIG.linemap.waypoints;
    }

    get snapTypes(): SnapType[] {
        return [SnapType.line];
    }

    _createObject(point: ConstrainedPoint): ObjectType {
        const waypoint = new Waypoint();
        waypoint.construct(point, this.activeSymbol);
        return waypoint;
    }
}
