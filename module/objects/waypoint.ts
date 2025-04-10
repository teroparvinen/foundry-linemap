import { ConstrainedPoint, ConstrainedPointData } from "../classes/constrained-point.js";
import { ObjectData } from "../classes/object.js";
import { TextureCollection } from "../linemap-layer.js";
import { Line } from "./line.js";
import { Symbol } from "./symbol.js";

export interface WaypointData extends ObjectData {
    point: ConstrainedPointData;
    symbol: string;
}

export class Waypoint extends Symbol {
    static type = "waypoint"

    get textureCollection(): TextureCollection {
        return canvas.linemap.waypointTextures;
    }

    get orientation(): number {
        return this.point.sourceObject?.getParametricOrientation(this.point.sourceT) ?? 0;
    }

    setAdjustmentPoint(index: number, point: ConstrainedPoint): boolean {
        if (point.sourceObject instanceof Line) {
            this.point.setFrom(point, this);
            return true;
        }
        return false;
    }

    reverseDirection() {
        const reverseSymbol = CONFIG.linemap.waypoints[this.symbol]?.reverse;
        if (reverseSymbol) {
            this.symbol = reverseSymbol;
        }
    }
}
