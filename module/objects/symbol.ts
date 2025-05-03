import { ConstrainedPoint, ConstrainedPointData } from "../classes/constrained-point.js";
import { ObjectData, ObjectDrawLayers, ObjectIdMapping, ObjectType } from "../classes/object.js";
import { AdjustmentPoint, PointType, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, containsAabb, intersectAabb, length2, sub2 } from "../helpers/utils.js";
import { TextureCollection } from "../linemap-layer.js";

export interface SymbolData extends ObjectData {
    point: ConstrainedPointData;
    symbol: string;
}

export class Symbol extends ObjectType {
    static type = "symbol"

    point: ConstrainedPoint;
    symbol: string;

    sprite: any;

    construct(point: ConstrainedPoint, symbol: string) {
        this.point = point;
        this.symbol = symbol;
    }

    deserialize(data: SymbolData, objectMap: ObjectIdMapping) {
        super.deserialize(data, objectMap);
        this.construct(
            new ConstrainedPoint(this.pointType, data.point.point, objectMap[data.point.sourceId], data.point.sourceT),
            data.symbol
        );
    }

    get serialized(): SymbolData {
        return { ...super.serialized, ...{
            point: this.point.serialized,
            symbol: this.symbol
        }};
    }

    get textureCollection(): TextureCollection {
        return canvas.linemap.symbolTextures;
    }

    get orientation(): number {
        return 0;
    }

    get scale(): number {
        return 0.5 * canvas.linemap.symbolScale;
    }

    get textAscent(): number {
        return this.sprite.height / 2 + 5;
    }

    draw(layers: ObjectDrawLayers) {
        const pt = this.point.point;
        const icon = this.textureCollection[this.symbol].icon;
        const footprint = this.textureCollection[this.symbol].footprint;
        const scale = this.scale;
        if (this.isVisible && icon) {
            const sprite = new PIXI.Sprite(icon);
            sprite.anchor.set(0.5);
            sprite.x = pt[0];
            sprite.y = pt[1];
            sprite.rotation = this.orientation;
            sprite.scale = { x: scale, y: scale };
            sprite.alpha = this.isRevealed ? 1.0 : 0.4;

            const tintColor = this._currentColor;
            sprite.filters = [new PIXI.Filter(null, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform vec3 tintColor;

                void main(void)
                {
                    vec4 s = texture2D(uSampler, vTextureCoord);
                    gl_FragColor.a = s.a;
                    gl_FragColor.rgb = tintColor * s.a;
                }
            `, {
                tintColor
            })];

            layers.symbols?.addChild(sprite);
            this.sprite = sprite;

            if (footprint) {
                const sprite = new PIXI.Sprite(footprint);
                sprite.anchor.set(0.5);
                sprite.x = pt[0];
                sprite.y = pt[1];
                sprite.scale = { x: scale, y: scale };
                sprite.rotation = this.orientation;
                
                layers.footprints?.addChild(sprite);
            }
        }
    }

    getSnapPoints(pt: Vec2, types: SnapType[]) {
        const result: SnapPoint[] = [];
        const config = CONFIG.linemap.snap;

        if (types.includes(SnapType.symbol)) {
            const d = length2(sub2(pt, this.point.point));
            if (d <= config.symbol) {
                result.push(new SnapPoint(this.point.point, this, 0, SnapType.symbol));
            }
        }

        return result;
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        const w = this.sprite?.width ?? 0;
        const h = this.sprite?.height ?? 0;
        const spriteAabb = [
            sub2(this.point.point, [w/2, h/2]),
            add2(this.point.point, [w/2, h/2])
        ];

        return pt2 ? intersectAabb([pt1, pt2], spriteAabb) : containsAabb(pt1, spriteAabb);
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return [new AdjustmentPoint(this.pointType, this, 0, this.point.point, !!this.point.sourceObject)];
    }
    setAdjustmentPoint(index: number, point: ConstrainedPoint, isFinal: boolean): boolean {
        this.point.setFrom(point, this);
        return true;
    }

    getParametricPoint(t: number, type: PointType): Vec2 {
        return this.point.point;
    }

    hasConstraintTo(object: ObjectType): boolean {
        return this.point.sourceObject === object || this.point.sourceObject?.hasConstraintTo(object);
    }
}
