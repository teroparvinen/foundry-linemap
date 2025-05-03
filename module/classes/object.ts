import { Vec2, SnapPoint, SnapType, AdjustmentPoint, PointType } from "../dto.js";
import { generateId } from "../helpers/generate-id.js";
import { ConstrainedPoint } from "./constrained-point.js";

export interface ObjectData {
    id: string;
    type: string;
    isRevealed: boolean;
}

export interface ObjectDrawLayers {
    areas?: any;
    lines?: any;
    footprints?: any;
    symbols?: any;
}

export type ObjectIdMapping = Record<string, ObjectType>;

export class ObjectType {
    static type: string;

    id: string;

    isSelected = false;
    isRevealed = false;

    constructor(id?: string) {
        this.id = id ?? generateId();
    }

    static getType(data: any): typeof ObjectType {
        return this;
    }

    static create(data: any): ObjectType {
        const objType = CONFIG.linemap.objectTypes[data.type];
        const subType = objType.getType(data);
        return new subType(data.id);
    }

    deserialize(data: any, objectMap: ObjectIdMapping) {
        this.isRevealed = data.isRevealed;
    }

    get _currentColor(): [number, number, number] {
        return this.isSelected ? canvas.linemap._selectionColor : canvas.linemap._objectColor;
    }

    get _currentColorHex(): number {
        return this.isSelected ? canvas.linemap._selectionColorHex : canvas.linemap._objectColorHex;
    }

    get serialized(): ObjectData {
        return {
            id: this.id,
            type: (this.constructor as typeof ObjectType).type,
            isRevealed: this.isRevealed
        };
    }

    get isVisible(): boolean {
        return this.isRevealed || game.user.isGM;
    }

    get pointType(): PointType {
        return PointType.point;
    }

    get textAscent(): number {
        return 30;
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
    setAdjustmentPoint(index: number, point: ConstrainedPoint, isFinal: boolean): boolean {
        return true;
    }

    getParametricPoint(t: number, type: PointType): Vec2 {
        return [0, 0];
    }
    getParametricOrientation(t: number): number {
        return 0;
    }

    hasConstraintTo(object: ObjectType): boolean {
        return false;
    }
}