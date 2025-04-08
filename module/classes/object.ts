import { Vec2, SnapPoint, SnapType, AdjustmentPoint } from "../dto.js";

export interface ObjectData {
    type: string;
    isRevealed: boolean;
}

export interface ObjectDrawLayers {
    lines?: any;
    footprints?: any;
    symbols?: any;
}

export class ObjectType {
    static type: string;

    static deserialize(data: any): ObjectType {
        const objType = CONFIG.linemap.objectTypes[data.type];
        const obj = objType.deserialize(data);
        obj.isRevealed = data.isRevealed;
        return obj;
    }

    isSelected = false;
    isRevealed = false;

    get serialized(): ObjectData {
        return {
            type: (this.constructor as typeof ObjectType).type,
            isRevealed: this.isRevealed
        };
    }

    get isVisible(): boolean {
        return this.isRevealed || game.user.isGM;
    }

    draw(layers: ObjectDrawLayers) {}

    getSnapPoints(pt: Vec2, types: SnapType[]): SnapPoint[] {
        return [];
    }
    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        return false;
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return [];
    }
    setAdjustmentPoint(index: number, point: Vec2) {}
}