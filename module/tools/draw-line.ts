import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Tool } from "../classes/tool.js"
import { Point, PointType, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, length2, sub2 } from "../helpers/utils.js";
import { Line } from "../objects/line.js";

const { getTemplate } = foundry.applications.handlebars;

export class DrawLineTool extends Tool {
    stroke: ConstrainedPoint[];
    snapPoint: SnapPoint;

    optionsElement: any;
    optionsTemplate: any;

    activeStyle: string = Object.keys(CONFIG.linemap.lineStyles)[0];

    activate() {
        this._setupOptionsElement();
        this.layer.setSelection();
    }

    deactivate() {
        this.optionsElement?.remove();
    }

    async _setupOptionsElement() {
        this.optionsTemplate = await getTemplate("modules/linemap/templates/draw-line-tool-options.hbs");
        this.optionsElement = $('<div class="linemap-tool-ui"></div>');
        $("#ui-top").append(this.optionsElement);

        this._updateOptionsElement();
    }

    _updateOptionsElement() {
        const htmlStr = this.optionsTemplate({
            styles: CONFIG.linemap.lineStyles,
            activeStyle: this.activeStyle
        });
        const html = $(htmlStr);

        html.on('click', '[data-action="set-line-style"]', (event) => {
            this.activeStyle = event.currentTarget.dataset.lineStyle;
            this._updateOptionsElement();
        });

        this.optionsElement.html("");
        this.optionsElement.append(html);
    }

    _getLineObject(): Line {
        const style = CONFIG.linemap.lineStyles[this.activeStyle];
        if (style && this.stroke) {
            const line = new (style.lineClass as typeof Line)();
            line.construct(
                this.stroke,
                this.activeStyle
            );
            return line;
        }
        return undefined;
    }

    _updatePreview() {
        this.layer.preview.removeChildren();

        const previewLine = this._getLineObject();
        if (previewLine) {
            const layers = {
                lines: this.layer.preview
            };
            previewLine.draw(layers);
        }

        if (this.snapPoint) {
            const gfx = this.layer.preview.addChild(new PIXI.Graphics());
            const size = 20;
            gfx
                .lineStyle(2, 0x00ffff)
                .moveTo(...sub2(this.snapPoint.pt, [size, size]))
                .lineTo(...add2(this.snapPoint.pt, [size, size]))
                .moveTo(...sub2(this.snapPoint.pt, [size, -size]))
                .lineTo(...add2(this.snapPoint.pt, [size, -size]));
        }
    }

    _submitStroke(event) {
        this.layer.addObject(this._getLineObject());
    }

    onMouseMove(event: any, point: Point) {
        this.snapPoint = this.layer.getSnapPoint([point.x, point.y], [SnapType.lineContour, SnapType.lineEnd, SnapType.symbol]);
        this._updatePreview();
    }

    onDragLeftStart(event) {
        const eventPt: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        this.snapPoint = this.layer.getSnapPoint(eventPt, [SnapType.lineContour, SnapType.lineEnd, SnapType.symbol]);
        const pt = this.snapPoint ? this.snapPoint.pt : eventPt;
        
        this.stroke = [
            ConstrainedPoint.fromSnapOrPoint(PointType.line, eventPt, this.snapPoint),
            ConstrainedPoint.fromSnapOrPoint(PointType.line, eventPt, this.snapPoint)
        ];

        this._updatePreview();

        return true;
    }

    onDragLeftMove(event) {
        const eventPt: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        this.snapPoint = this.layer.getSnapPoint(eventPt, [SnapType.lineContour, SnapType.lineEnd, SnapType.symbol]);
        const pt = this.snapPoint ? this.snapPoint.pt : eventPt;
        
        this.stroke[1] = ConstrainedPoint.fromSnapOrPoint(PointType.line, eventPt, this.snapPoint);

        this._updatePreview();
    }

    async onDragLeftDrop(event) {
        if (length2(sub2(this.stroke[0].point, this.stroke[1].point)) > 10) {
            this._submitStroke(event);
        }
        this.layer.preview.removeChildren();
        this.stroke = undefined;
    }

}