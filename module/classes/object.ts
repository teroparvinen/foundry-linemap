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
    // Symbols in the map colour and in the selection colour: each container is tinted as a whole.
    symbols?: any;
    selectedSymbols?: any;
    labels?: any;
}

export type ObjectIdMapping = Record<string, ObjectType>;

/** Moves one point of the map (a Scene resize). */
export type PointMover = (pt: Vec2) => Vec2;

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
        const objType = CONFIG.linemap.objectTypes[data?.type];
        // A type this build does not know (a newer build's, or one a package that is now off added)
        // is kept as saved, not drawn. Before, it threw and the whole map failed to load.
        if (!objType) return new UnknownObject(data?.id);
        const subType = objType.getType(data);
        return new subType(data.id);
    }

    /** The saved data of one object of this type, with its points moved (a Scene resize). */
    static moveData(data: any, move: PointMover): any {
        return data;
    }

    /** The linked points this object has. */
    get constrainedPoints(): ConstrainedPoint[] {
        return [];
    }

    /** Unlink every point linked to one of these objects, leaving it where it is. */
    releaseConstraints(gone: Set<ObjectType>) {
        for (const cp of this.constrainedPoints) {
            if (cp?.sourceObject && gone.has(cp.sourceObject)) cp.release();
        }
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

/**
 * An object of a type this build does not know. It is not drawn, cannot be selected, and saves back
 * exactly as it was loaded, so opening a map in this build never loses another build's objects.
 */
export class UnknownObject extends ObjectType {
    raw: any;

    deserialize(data: any, objectMap: ObjectIdMapping) {
        super.deserialize(data, objectMap);
        this.raw = { ...structuredClone(data), id: this.id };
    }

    get serialized(): ObjectData {
        return structuredClone(this.raw);
    }
}
