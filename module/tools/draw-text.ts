import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Tool, ToolHotkey } from "../classes/tool.js"
import { Point, PointType, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, sub2 } from "../helpers/utils.js";
import { Text, TextStyle } from "../objects/text.js";

const { renderTemplate } = foundry.applications.handlebars;

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

    static async promptText(initial: string = ''): Promise<string> {
        try {
            return await foundry.applications.api.DialogV2.prompt({
                window: { title: game.i18n.localize('linemap.ui.enterTextTitle') },
                content: await renderTemplate('modules/linemap/templates/text-entry.hbs', { initial }),
                render: (event, dialog) => {
                    dialog.element.querySelector("textarea").addEventListener("keypress", e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.closest("form").querySelector("button").click();
                        }
                    });
                },
                submit: result => {
                    console.log(result);
                },
                ok: {
                    label: initial ? game.i18n.localize('linemap.ui.updateTextButton') : game.i18n.localize('linemap.ui.enterTextButton'),
                    callback: (event, button, dialog) => button.form.elements.content.value
                }
            });
        } catch {
            return undefined;
        }
    }

    async onClickLeft(event: any) {
        const eventPt: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const snapPoint = this.layer.getSnapPoint(eventPt, [SnapType.lineContour, SnapType.symbol]);
        const pt = snapPoint ? snapPoint.pt : eventPt;

        const text = this.layer.objects.find(obj => obj instanceof Text && obj.testSelection(eventPt));
        if (text) {
            this.layer.setSelection(text);
        } else {
            const content = await DrawTextTool.promptText();
            if (content) {
                const height = Text.calculateHeight(content);
                const offset: Vec2 = [0, snapPoint ? -(snapPoint.object.textAscent + height / 2) : 0]
    
                const text = new Text();
                text.construct(ConstrainedPoint.fromSnapOrPoint(PointType.point, pt, snapPoint), offset, content);
                this.layer.addObject(text);
                this.layer.registerHistory();
                this.layer.setSelection(text);
            } else {
                this.layer.setSelection();
            }

            this.layer.preview.removeChildren();
        }
    }

    async onDoubleClick(event: any) {
        const eventPt: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const text = this.layer.objects.find(obj => obj instanceof Text && obj.testSelection(eventPt)) as Text;
        const content = await DrawTextTool.promptText(text.text);
        if (content) {
            text.text = content;
            this.layer.registerHistory();
            this.layer.redraw();
        }
    }

    onMouseMove(event: any, point: Point) {
        this.snapPoint = this.layer.getSnapPoint([point.x, point.y], [SnapType.lineContour, SnapType.symbol]);
        this._updatePreview();
    }

    hotkeyPressed(key: ToolHotkey): void {
        const text = this.layer.selection.filter(o => o instanceof Text)?.[0];
        if (text) {
            if (key === ToolHotkey.bold) {
                text.toggleStyle(TextStyle.bold);
                this.layer.registerHistory();
                this.layer.redraw();
            }
            if (key === ToolHotkey.italic) {
                text.toggleStyle(TextStyle.italic);
                this.layer.registerHistory();
                this.layer.redraw();
            }
        }
    }
}
