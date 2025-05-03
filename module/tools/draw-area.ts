import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Tool } from "../classes/tool.js";
import { AdjustmentPoint, Vec2 } from "../dto.js";
import { add2, compareDistance, length2, sub2 } from "../helpers/utils.js";
import { Area } from "../objects/area.js";
import { AdjustTool } from "./adjust-tool.js";

export class DrawAreaTool extends Tool {
    optionsElement: any;
    optionsTemplate: any;

    selectedAdjustmentPoint: AdjustmentPoint;

    activePattern: string = Object.keys(CONFIG.linemap.patterns)[0];

    get selectedArea(): Area {
        const obj = this.layer.selection[0];
        return obj instanceof Area ? obj as Area : undefined;
    }

    activate() {
        this._setupOptionsElement();
        this.layer.setSelection();
    }

    deactivate() {
        this.optionsElement?.remove();
    }

    async _setupOptionsElement() {
        this.optionsTemplate = await getTemplate("modules/linemap/templates/draw-area-tool-options.hbs");
        this.optionsElement = $('<div class="linemap-tool-ui"></div>');
        $("#ui-top").append(this.optionsElement);

        this._updateOptionsElement();
    }

    _updateOptionsElement() {
        const htmlStr = this.optionsTemplate({
            styles: CONFIG.linemap.patterns,
            activePattern: this.activePattern
        });
        const html = $(htmlStr);

        html.on('click', '[data-action="set-area-pattern"]', (event) => {
            this.activePattern = event.currentTarget.dataset.areaPattern;
            this._updateOptionsElement();

            if (this.selectedArea) {
                this.selectedArea.pattern = this.activePattern;
                this.layer.registerHistory();
                this.layer.redraw();
            }
        });

        this.optionsElement.html("");
        this.optionsElement.append(html);
    }

    updateIndicators() {
        this.layer.preview.removeChildren();

        const adjPts = this.selectedArea?.getAdjustmentPoints() ?? [];

        for (let i = 0; i < adjPts.length; i++) {
            const pt = adjPts[i];
            const gfx = new PIXI.Graphics()
            if (pt.index === this.selectedAdjustmentPoint?.index) {
                gfx.lineStyle(4, canvas.linemap._selectionColorHex);
            } else {
                gfx.lineStyle(2, 0xffffff);
            }

            this.layer.preview.addChild(gfx.drawCircle(...pt.current, AdjustTool.PointRadius));
        }
    }

    stateInvalidated() {
        this.selectedAdjustmentPoint = undefined;
        this.updateIndicators();
    }

    onClickLeft(event: any) {
        const eventPt: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];

        const select = (area, pt) => {
            if (area) {
                this.layer.setSelection(area);

                this.activePattern = area.pattern;
                this._updateOptionsElement();
            } else {
                this.layer.setSelection();
            }
            this.selectedAdjustmentPoint = pt;
            this.updateIndicators();
        }

        const adjPts = this.selectedArea?.getAdjustmentPoints() ?? [];
        const adjPt = adjPts.find(pt => compareDistance(pt.original, eventPt, AdjustTool.PointRadius) <= 0);
        if (adjPt) {
            select(this.selectedArea, adjPt);
            return;
        }

        for (const area of this.layer.objects.filter(o => o instanceof Area) as Area[]) {
            if (area.lineHitTest(eventPt)) {
                select(area, undefined);
                return;
            }
        }

        select(undefined, undefined);
    }

    async onDoubleClick(event: any) {
        const eventPt: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];

        const area = this.selectedArea;
        const adjPts = area?.getAdjustmentPoints() ?? [];
        const adjPt = adjPts.find(pt => compareDistance(pt.original, eventPt, AdjustTool.PointRadius) <= 0);
        if (adjPt) {
            area.removeVertex(adjPt.index);
            this.selectedAdjustmentPoint = undefined;
            await this.layer.registerHistory();
        } else {
            for (const area of this.layer.objects.filter(o => o instanceof Area) as Area[]) {
                const hit = area.lineHitTest(eventPt);
                if (hit) {
                    area.addVertex(...hit);
                    await this.layer.registerHistory();
                    break;
                }
            }
        }

        this.layer.redraw();
        this.updateIndicators();
    }

    onDragLeftStart(event: any): void {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];

        const adjPts = this.selectedArea?.getAdjustmentPoints() ?? [];
        const adjPt = adjPts.find(pt => compareDistance(pt.original, pt1, AdjustTool.PointRadius) <= 0);

        this.selectedAdjustmentPoint = adjPt;
    }

    onDragLeftMove(event: any) {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const d = sub2(pt2, pt1);

        if (this.selectedAdjustmentPoint) {
            const apt = this.selectedAdjustmentPoint;
            const pt = add2(apt.original, d);
            if (apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, pt), false)) {
                apt.current = pt;
            }
            this.layer.redraw(false);
            this.updateIndicators();
        } else {
            this.layer.preview.removeChildren();

            if (length2(d) > 3) {
                const lineWidth = CONFIG.linemap.patterns[this.activePattern]?.lineWidth ?? 4;
                const gfx = this.layer.preview.addChild(new PIXI.Graphics());
                gfx
                    .lineStyle(lineWidth, 0x0)
                    .drawRect(...pt1, ...d)
            }
        }
    }

    async onDragLeftDrop(event: any) {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const d = sub2(pt2, pt1);

        if (this.selectedAdjustmentPoint) {
            const apt = this.selectedAdjustmentPoint;
            const pt = add2(apt.original, d);
            if (apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, pt), true)) {
                apt.current = pt;
            }
            await this.layer.registerHistory();
            this.layer.redraw(false);
            this.updateIndicators();
        } else {
            this.layer.preview.removeChildren();

            const area = new Area();
            area.construct([pt1, [pt2[0], pt1[1]], pt2, [pt1[0], pt2[1]]], this.activePattern);
            this.layer.addObject(area);
            this.layer.setSelection(area);
            this.selectedAdjustmentPoint = undefined;
            this.updateIndicators();
        }
    }

    async onDeleteKey(event: any) {
        this.selectedArea?.removeVertex(this.selectedAdjustmentPoint?.index);
        await this.layer.registerHistory();
        this.layer.redraw();
        this.updateIndicators();
    }
}