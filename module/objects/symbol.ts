import { ObjectData, ObjectDrawLayers, ObjectType } from "../classes/object.js";
import { AdjustmentPoint, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, containsAabb, intersectAabb, length2, sub2 } from "../helpers/utils.js";

export interface SymbolData extends ObjectData {
}

export class Symbol extends ObjectType {
    static type = "symbol"

    point: Vec2;
    symbol: string;

    sprite: any;

    constructor({ point, symbol }: { point: Vec2, symbol: string }) {
        super();

        this.point = [...point];
        this.symbol = symbol;
    }

    static deserialize(data: any): ObjectType {
        return new Symbol(data);
    }

    get serialized(): SymbolData {
        return { ...super.serialized, ...{
            point: this.point,
            symbol: this.symbol
        }};
    }

    draw(layers: ObjectDrawLayers) {
        const icon = canvas.linemap.symbolTextures[this.symbol].icon;
        const footprint = canvas.linemap.symbolTextures[this.symbol].footprint;
        if (this.isVisible && icon) {
            const sprite = new PIXI.Sprite(icon);
            sprite.anchor.set(0.5);
            sprite.x = this.point[0];
            sprite.y = this.point[1];
            sprite.alpha = this.isRevealed ? 1.0 : 0.4;

            if (this.isSelected) {
                const tintColor = canvas.linemap._selectionColor;
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
            }

            layers.symbols?.addChild(sprite);
            this.sprite = sprite;

            if (footprint) {
                const sprite = new PIXI.Sprite(footprint);
                sprite.anchor.set(0.5);
                sprite.x = this.point[0];
                sprite.y = this.point[1];
                
                layers.footprints?.addChild(sprite);
            }
        }
    }

    getSnapPoints(pt: Vec2, types: SnapType[]) {
        const result: SnapPoint[] = [];
        const config = CONFIG.linemap.snap;

        if (types.includes(SnapType.symbol)) {
            const d = length2(sub2(pt, this.point));
            if (d <= config.lineEnd) {
                result.push(new SnapPoint(this.point, this, 0, SnapType.symbol));
            }
        }

        return result;
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        const w = this.sprite?.width ?? 0;
        const h = this.sprite?.height ?? 0;
        const spriteAabb = [
            sub2(this.point, [w/2, h/2]),
            add2(this.point, [w/2, h/2])
        ];

        return pt2 ? intersectAabb([pt1, pt2], spriteAabb) : containsAabb(pt1, spriteAabb);
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return [new AdjustmentPoint(this, 0, this.point)];
    }
    setAdjustmentPoint(index: number, point: Vec2) {
        this.point = point;
    }
}
