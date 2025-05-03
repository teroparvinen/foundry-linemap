import { ObjectType } from "../classes/object.js";
import { Tool, ToolHotkey } from "../classes/tool.js";
import { AdjustmentPoint, SnapPoint, Vec2 } from "../dto.js";
import { add2, eq2, length2, sub2 } from "../helpers/utils.js";
import { Symbol } from "../objects/symbol.js";
import { ContextMenu } from "../apps/context-menu.js";
import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Waypoint } from "../objects/waypoint.js";
import { Text } from "../objects/text.js";
import { DrawTextTool } from "./draw-text.js";

enum DragOperation {
    move,
    select
}

export class SelectTool extends Tool {
    selectedObjects = [];
    snapPoint: SnapPoint;

    menu: ContextMenu;

    dragOperation: DragOperation;
    adjustmentPoints: AdjustmentPoint[];

    _updateSelection(preserve: boolean, pt1: Vec2, pt2?: Vec2) {
        const selection = preserve ? this.layer.selection : [];

        if (pt2) {
            const min: Vec2 = [Math.min(pt1[0], pt2[0]), Math.min(pt1[1], pt2[1])];
            const max: Vec2 = [Math.max(pt1[0], pt2[0]), Math.max(pt1[1], pt2[1])];
    
            const selected = this.layer.objects
                .filter(obj => obj.testSelection(min, max))
                .filter(obj => !selection.includes(obj));
            this.layer.setSelection(...selection, ...selected);
        } else {
            const selected: ObjectType[] = this.layer.objects.filter(obj => obj.testSelection([pt1[0], pt1[1]]));
            selected.sort((a, b) => a instanceof Symbol ? -1 : b instanceof Symbol ? 1 : 0);
            const target = selected[0];
            if (preserve) {
                if (selection.includes(target)) {
                    this.layer.setSelection(...selection.filter(o => o !== target));
                } else {
                    this.layer.setSelection(...selection, target);
                }
            } else {
                this.layer.setSelection(target);
            }
        }
    }

    onClickLeft(event: any): void {
        const point: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        this._updateSelection(event.shiftKey, point);
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

    onClickRight(event: any): void {
        if (this.layer.selection.length) {
            const { x, y } = event.interactionData.origin;
            const screenCoords = this.layer.worldTransform.apply({ x, y });
            const menu = new ContextMenu({
                left: {
                    icon: 'fa-eye-slash',
                    label: 'linemap.menu.hide',
                    handler: () => {
                        const objs = this.layer.selection.filter(o => o.isRevealed);
                        if (objs.length) {
                            objs.forEach(obj => { obj.isRevealed = false; });
                            this.layer.registerHistory();
                            this.layer.redraw();
                        }
                    }
                },
                right: {
                    icon: 'fa-eye',
                    label: 'linemap.menu.reveal',
                    handler: () => {
                        const objs = this.layer.selection.filter(o => !o.isRevealed);
                        if (objs.length) {
                            objs.forEach(obj => { obj.isRevealed = true; });
                            this.layer.registerHistory();
                            this.layer.redraw();
                        }
                    }
                }
            });
            menu.render(true, { position: { left: screenCoords.x, top: screenCoords.y }});
            this.menu = menu;
        }
    }

    onDragLeftStart(event: any): void {
        const pt: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const objects = this.layer.objects.filter(obj => obj.testSelection(pt));
        objects.sort((a, b) => a instanceof Symbol ? -1 : b instanceof Symbol ? 1 : 0);
        const target = objects[0];
        const selection = this.layer.selection;
        const selected = selection.includes(target);
        
        this.dragOperation = (!objects.length || !selected) ? DragOperation.select : DragOperation.move;

        if (this.dragOperation === DragOperation.move) {
            const pts = selection.flatMap(obj => obj.getAdjustmentPoints());
            const otherPts = this.layer.objects
                .filter(obj => !selection.includes(obj))
                .flatMap(obj => obj.getAdjustmentPoints())
                .filter(candidate => pts.find(pt => eq2(pt.original, candidate.original)));
            if (this.layer.adjustLinked) {
                pts.push(...otherPts);
            } else {
                otherPts
                    .filter(pt => pt.isConstrained)
                    .forEach(pt => pt.object.setAdjustmentPoint(pt.index, new ConstrainedPoint(pt.object.pointType, pt.original), false));
            }
            this.adjustmentPoints = pts;
        }
    }

    onDragLeftMove(event: any): void {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const d = sub2(pt2, pt1);

        if (this.dragOperation === DragOperation.select) {
            this.layer.preview.removeChildren();

            if (length2(d) > 3) {
                const gfx = this.layer.preview.addChild(new PIXI.Graphics());
                gfx
                    .lineStyle(2, 0x00ffff)
                    .drawRect(...pt1, ...d)
            }
        } else {
            for (const apt of this.affectedAdjustmentPoints) {
                apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, add2(apt.original, d)), false);
            }
            this.layer.redraw(false);
        }
    }

    async onDragLeftDrop(event: any) {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        const d = sub2(pt2, pt1);

        if (this.dragOperation === DragOperation.select) {
            this.layer.preview.removeChildren();

            this._updateSelection(event.shiftKey, pt1, pt2);
        } else {
            for (const apt of this.affectedAdjustmentPoints) {
                apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, add2(apt.original, d)), true);
            }
            await this.layer.registerHistory();
            this.layer.redraw();
        }

        this.dragOperation = undefined;
    }

    async onDeleteKey(event: any) {
        this.layer.deleteObjects(...this.layer.selection);
    }

    hotkeyPressed(key: ToolHotkey): void {
        if (key === ToolHotkey.reveal) {
            this.layer.selection.forEach(obj => { obj.isRevealed = true; });
            this.layer.registerHistory();
            this.layer.redraw();
        }
        if (key === ToolHotkey.hide) {
            this.layer.selection.forEach(obj => { obj.isRevealed = false; });
            this.layer.registerHistory();
            this.layer.redraw();
        }
        if (key === ToolHotkey.reverse) {
            this.layer.selection.filter(obj => obj instanceof Waypoint).forEach(wp => wp.reverseDirection());
            canvas.linemap.registerHistory();
            canvas.linemap.redraw();
        }
    }

    get affectedAdjustmentPoints(): AdjustmentPoint[] {
        const pointGroups: Record<string, AdjustmentPoint[]> = {};
        for (const pt of this.adjustmentPoints) {
            const key = `${pt.original[0]},${pt.original[1]}`;
            pointGroups[key] = [...(pointGroups[key] ?? []), pt];
        }

        return Object.values(pointGroups).flatMap(pts => {
            let candidates;
            if (this.layer.adjustLinked) {
                candidates = pts.filter(pt => !pt.isConstrained);
            } else {
                candidates = pts.filter(pt => !!pt.isConstrained).slice(0, 1);
            }
            return candidates.length ? candidates : pts;
        });
    }
}
