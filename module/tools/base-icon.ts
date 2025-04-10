import { ConstrainedPoint } from "../classes/constrained-point.js";
import { ObjectType } from "../classes/object.js";
import { Tool } from "../classes/tool.js"
import { Point, PointType, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, sub2 } from "../helpers/utils.js";
import { Symbol } from "../objects/symbol.js";

export class BaseIconTool extends Tool {
    snapPoint: SnapPoint;

    optionsElement: any;
    optionsTemplate: any;

    activeSymbol: string;

    get symbolCollection(): any { 
        return undefined;
    }

    get snapTypes(): SnapType[] {
        return [];
    }

    activate() {
        this._setupOptionsElement();
        this.layer.setSelection();

        if (!this.activeSymbol) {
            this.activeSymbol = Object.keys(this.symbolCollection)[0];
        }
    }

    deactivate() {
        this.optionsElement?.remove();
    }

    async _setupOptionsElement() {
        this.optionsTemplate = await getTemplate("modules/linemap/templates/draw-symbol-tool-options.hbs");
        this.optionsElement = $('<div class="linemap-tool-ui"></div>');
        $("#ui-top").append(this.optionsElement);

        this._updateOptionsElement();
    }

    _updateOptionsElement() {
        const htmlStr = this.optionsTemplate({
            symbols: this.symbolCollection,
            activeSymbol: this.activeSymbol
        });
        const html = $(htmlStr);

        html.on('click', '[data-action="set-symbol"]', (event) => {
            this.activeSymbol = event.currentTarget.dataset.lineStyle;
            this._updateOptionsElement();
        });

        this.optionsElement.html("");
        this.optionsElement.append(html);
    }    

    _updatePreview() {
        this.layer.preview.removeChildren();

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

    _createObject(point: ConstrainedPoint): ObjectType {
        return null;
    }

    onMouseMove(event: any, point: Point) {
        this.snapPoint = this.layer.getSnapPoint([point.x, point.y], this.snapTypes);
        this._updatePreview();
    }

    onClickLeft(event: any): void {
        const eventPt: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        this.snapPoint = this.layer.getSnapPoint(eventPt, this.snapTypes);
        const pt = this.snapPoint ? this.snapPoint.pt : eventPt;

        this.layer.preview.removeChildren();
        
        const object = this._createObject(ConstrainedPoint.fromSnapOrPoint(PointType.point, pt, this.snapPoint));
        this.layer.addObject(object);
    }
}