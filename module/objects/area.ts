import { ConstrainedPoint } from "../classes/constrained-point.js";
import { ObjectData, ObjectDrawLayers, ObjectIdMapping, ObjectType } from "../classes/object.js";
import { AdjustmentPoint, PointType, Vec2 } from "../dto.js";
import { add2, distanceToLine, dotProduct, lengthAndUnitVector, mult2, sub2 } from "../helpers/utils.js";

export interface AreaData extends ObjectData {
    points: Vec2[];
    pattern: string;
}

export class Area extends ObjectType {
    static type = "area"

    points: Vec2[];
    pattern: string;

    construct(points: Vec2[], pattern: string) {
        this.points = [...points];
        this.pattern = pattern;
    }

    deserialize(data: AreaData, objectMap: ObjectIdMapping) {
        super.deserialize(data, objectMap);
        this.construct(
            data.points,
            data.pattern
        );
    }

    get serialized(): AreaData {
        return { ...super.serialized, ...{
            points: this.points,
            pattern: this.pattern
        }};
    }

    get _polygon(): any {
        const poly = new PIXI.Polygon(...this.points.flatMap(pt => pt));
        poly.closeStroke = true;
        return poly;
    }

    draw(layers: ObjectDrawLayers) {
        if (this.isVisible && this.points) {
            const poly = this._polygon;
            const texture = canvas.linemap.patternTextures[this.pattern]?.icon;
            const points = poly.points;
            const uvs = points.map(pt => pt / texture.width);
            const indices = PIXI.utils.earcut(points);

            const shader = PIXI.Shader.from(`
                precision highp float;
                attribute vec2 aVertexPosition;
                attribute vec2 aTextureCoord;

                uniform mat3 projectionMatrix;

                varying vec2 vTextureCoord;

                void main(void){
                    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
                    vTextureCoord = aTextureCoord;
                }
            `, `
                precision mediump float;
                varying vec2 vTextureCoord;

                uniform sampler2D uSampler;

                void main(void){
                    vec2 uv = vTextureCoord;
                    gl_FragColor = texture2D(uSampler, uv);
                }            
            `, { uSampler: texture })
            const geometry = new PIXI.Geometry();
            geometry.addAttribute('aVertexPosition', points, 2);
            geometry.addAttribute('aTextureCoord', uvs, 2);
            geometry.addIndex(indices);
            const mesh = new PIXI.Mesh(geometry, shader, undefined, PIXI.DRAW_MODES.TRIANGLES);
            mesh.alpha = this.isRevealed ? 1.0 : 0.2;
            layers.areas?.addChild(mesh);

            const gfx = new PIXI.Graphics()
                .lineStyle(4, this.isSelected ? canvas.linemap._selectionColorHex : 0x0)
                .drawPolygon(poly);
            gfx.alpha = this.isRevealed ? 1.0 : 0.2;
            layers.areas?.addChild(gfx);
        }
    }

    testSelection(pt1: Vec2, pt2?: Vec2): boolean {
        if (pt2) {
            const d = sub2(pt2, pt1);
            return !!new PIXI.Rectangle(...pt1, ...d).intersectPolygon(this._polygon).points.length;
        } else {
            return this._polygon.contains(...pt1);
        }
    }

    lineHitTest(point: Vec2): [number, number] {
        for (let i = 0; i < this.points.length; i++) {
            const pt1 = this.points[i];
            const pt2 = this.points[(i+1) % this.points.length];
            if (distanceToLine(point, pt1, pt2, false) < 5) {
                const d = sub2(pt2, pt1);
                const [l, u] = lengthAndUnitVector(d);
                const t = dotProduct(u, sub2(point, pt1)) / l;
                return [i, t];
            }
        }
        return undefined;
    }

    getAdjustmentPoints(): AdjustmentPoint[] {
        return this.points.map((pt, i) => new AdjustmentPoint(PointType.line, this, i, pt, false));
    }
    setAdjustmentPoint(index: number, point: ConstrainedPoint, isFinal: boolean): boolean {
        this.points[index] = [...point.point];
        return true;
    }

    removeVertex(index: number) {
        if (index !== undefined && this.points.length > 3) {
            this.points.splice(index, 1);
        }
    }
    addVertex(index: number, t: number) {
        const pt1 = this.points[index];
        const pt2 = this.points[(index + 1) % this.points.length];
        const d = sub2(pt2, pt1);
        const [l, u] = lengthAndUnitVector(d);
        const pt = add2(pt1, mult2(u, l * t));

        this.points.splice(index + 1, 0, pt);
    }
}