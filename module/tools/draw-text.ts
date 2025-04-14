import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Tool } from "../classes/tool.js"
import { Point, PointType, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, sub2 } from "../helpers/utils.js";
import { Text } from "../objects/text.js";

export class DrawTextTool extends Tool {
    snapPoint: SnapPoint;

    activate() {
        this.layer.setSelection();
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

    async onClickLeft(event: any) {
        const eventPt: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        this.snapPoint = this.layer.getSnapPoint(eventPt, [SnapType.lineContour, SnapType.symbol]);
        const pt = this.snapPoint ? this.snapPoint.pt : eventPt;

        try {
            const content = await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize('linemap.ui.enterTextTitle') },
                content: '<input name="content" autofocus>',
                ok: {
                    label: game.i18n.localize('linemap.ui.enterTextButton'),
                    callback: (event, button, dialog) => button.form.elements.content.value
                }
            });

            this.layer.preview.removeChildren();
        
            const offset: Vec2 = [0, this.snapPoint ? -this.snapPoint.object.textAscent : 0]

            const text = new Text();
            text.construct(ConstrainedPoint.fromSnapOrPoint(PointType.point, pt, this.snapPoint), offset, content);
            this.layer.addObject(text);
        } catch {
            return;
        }        
    }

    onMouseMove(event: any, point: Point) {
        this.snapPoint = this.layer.getSnapPoint([point.x, point.y], [SnapType.lineContour, SnapType.symbol]);
        this._updatePreview();
    }

}
