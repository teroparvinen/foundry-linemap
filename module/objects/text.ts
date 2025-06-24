import { ConstrainedPoint, ConstrainedPointData } from "../classes/constrained-point.js";
import { ObjectData, ObjectDrawLayers, ObjectIdMapping, ObjectType } from "../classes/object.js";
import { AdjustmentPoint, PointType, Vec2 } from "../dto.js";
import { add2, containsAabb, intersectAabb, length2, sub2, vec2fromXY } from "../helpers/utils.js";

const { PreciseText } = foundry.canvas.containers;

export enum TextStyle {
    normal = 'normal',
    bold = 'bold',
    italic = 'italic',
    bolditalic = 'bolditalic'
}

export interface TextData extends ObjectData {
    point: ConstrainedPointData;
    offset: Vec2;
    text: string;
    style: TextStyle;
}

export class Text extends ObjectType {
    static type = "text"

    point: ConstrainedPoint;
    offset: Vec2;
    text: string;
    style: TextStyle;

    sprite: any;

    construct(point: ConstrainedPoint, offset: Vec2, text: string, style: TextStyle = TextStyle.normal) {
        this.point = point;
        this.offset = offset;
        this.text = text;
        this.style = style;
    }

    deserialize(data: TextData, objectMap: ObjectIdMapping) {
        super.deserialize(data, objectMap);
        this.construct(
            new ConstrainedPoint(this.pointType, data.point.point, objectMap[data.point.sourceId], data.point.sourceT),
            data.offset,
            data.text,
            data.style
        );
    }

    get serialized(): TextData {
        return { ...super.serialized, ...{
            point: this.point.serialized,
            offset: this.offset,
            text: this.text,
            style: this.style
        }};
    }

    get _transform(): any {
        return new PIXI.Matrix()
            .translate(...this.offset)
            .rotate(this._adjustedOrientation);
    }

    get _transformedProperties(): [Vec2, number] {
        const adjustedOrientation = this._adjustedOrientation;
        const offset = new PIXI.Matrix()
            .translate(...this.offset)
            .rotate(adjustedOrientation)
            .apply({ x: 0, y: 0 });
        return [[offset.x, offset.y], adjustedOrientation];
    }

    get _adjustedOrientation(): number {
        const orientation = this.point.sourceObject?.getParametricOrientation(this.point.sourceT) ?? 0
        return Math.abs(orientation) > Math.PI / 2 ? orientation + Math.PI : orientation;
    }

    static get _staticPixiOptions(): any {
        return {
            fontFamily: 'Noticia Text',
            fontSize: 36,
            align: 'center'
        };
    }

    get _pixiOptions(): any {
        return {
            ...Text._staticPixiOptions,
            fontStyle: this.style === TextStyle.italic || this.style === TextStyle.bolditalic ? 'italic' : 'normal',
            fontWeight: this.style === TextStyle.bold || this.style === TextStyle.bolditalic ? 'bold': 'normal',
            fill: this._currentColorHex,
        };
    }

    toggleStyle(style: TextStyle) {
        switch (style) {
            case TextStyle.bold:
                switch (this.style) {
                    case TextStyle.normal:
                        this.style = TextStyle.bold;
                        break;
                    case TextStyle.bold:
                        this.style = TextStyle.normal;
                        break;
                    case TextStyle.italic:
                        this.style = TextStyle.bolditalic;
                        break;
                    case TextStyle.bolditalic:
                        this.style = TextStyle.italic;
                        break;
                }
                break;
            case TextStyle.italic:
                switch (this.style) {
                    case TextStyle.normal:
                        this.style = TextStyle.italic;
                        break;
                    case TextStyle.bold:
                        this.style = TextStyle.bolditalic;
                        break;
                    case TextStyle.italic:
                        this.style = TextStyle.normal;
                        break;
                    case TextStyle.bolditalic:
                        this.style = TextStyle.bold;
                        break;
                }
                break;
        }
    }

    draw(layers: ObjectDrawLayers) {
        const pt = this.point.point;
        const text = new PreciseText(this.text, this._pixiOptions);
        text.anchor.set(0.5);
        text.alpha = this.isRevealed ? 1.0 : 0.4;

        const [offset, orientation] = this._transformedProperties;
        text.x = pt[0] + offset[0];
        text.y = pt[1] + offset[1];
        text.rotation = orientation;

        this.sprite = text;

        layers.symbols.addChild(text);
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        const w = this.sprite?.width ?? 0;
        const h = this.sprite?.height ?? 0;
        const rPt1 = sub2(pt1, this.point.point);
        const rPt2 = pt2 && sub2(pt2, this.point.point);
        const mtx = this._transform;
        const tPt1 = vec2fromXY(mtx.applyInverse({ x: rPt1[0], y: rPt1[1] }));
        const tPt2 = rPt2 && vec2fromXY(mtx.applyInverse({ x: rPt2[0], y: rPt2[1] }));
        const spriteAabb: Vec2[] = [
            [-w / 2, -h / 2],
            [w / 2, h / 2]
        ];

        return tPt2 ? intersectAabb([tPt1, tPt2], spriteAabb) : containsAabb(tPt1, spriteAabb);
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        const anchor = this.point.point;
        const [offset, orientation] = this._transformedProperties;

        // const index = canvas.linemap.activeTool === canvas.linemap.tools['selectObject'] ? 2 : 0;
        // const result = [new AdjustmentPoint(this.pointType, this, index, anchor, !!this.point.sourceObject)];
        // if (index === 0 && length2(offset) > 0) {
        //     result.push(new AdjustmentPoint(this.pointType, this, 1, add2(anchor, offset), !!this.point.sourceObject));
        // }
        // return result;

        if (canvas.linemap.activeTool === canvas.linemap.tools['selectObject']) {
            if (!this.point.sourceObject) {
                return [new AdjustmentPoint(this.pointType, this, 2, anchor, !!this.point.sourceObject)];
            } else {
                return [new AdjustmentPoint(this.pointType, this, 2, add2(anchor, offset), !!this.point.sourceObject)]
            }
        } else {
            const result = [new AdjustmentPoint(this.pointType, this, 0, anchor, !!this.point.sourceObject)];
            if (length2(offset) > 0) {
                result.push(new AdjustmentPoint(this.pointType, this, 1, add2(anchor, offset), !!this.point.sourceObject));
            }
            return result;
        }
    }
    setAdjustmentPoint(index: number, point: ConstrainedPoint, isFinal: boolean): boolean {
        if (index === 0) {
            if (isFinal) {
                if (!point.sourceObject) {
                    this.offset = [0, 0];
                } else if (length2(this.offset) === 0) {
                    this.offset = [0, -(point.sourceObject.textAscent + this.sprite.height / 2)];
                }
            }
            this.point.setFrom(point, this);
        } else if (index === 1) {
            const mtx = new PIXI.Matrix().rotate(this._adjustedOrientation);
            const visualOffset = sub2(point.point, this.point.point);
            const offset = mtx.applyInverse({ x: visualOffset[0], y: visualOffset[1] });
            this.offset = [offset.x, offset.y];
        } else {
            if (canvas.linemap.adjustLinked && this.point.sourceObject) {
                const mtx = new PIXI.Matrix().rotate(this._adjustedOrientation);
                const visualOffset = sub2(point.point, this.point.point);
                const offset = mtx.applyInverse({ x: visualOffset[0], y: visualOffset[1] });
                this.offset = [offset.x, offset.y];
            } else {
                this.offset = [0, 0];
                this.point.setFrom(point, this);
            }
        }

        return true;
    }

    getParametricPoint(t: number, type: PointType): Vec2 {
        return this.point.point;
    }

    hasConstraintTo(object: ObjectType): boolean {
        return this.point.sourceObject === object || this.point.sourceObject?.hasConstraintTo(object);
    }

    static calculateHeight(content: string): number {
        const text = new PreciseText(content, this._staticPixiOptions);
        const bounds = text.getLocalBounds();
        return bounds.height;
    }
}