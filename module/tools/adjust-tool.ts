import { ConstrainedPoint } from "../classes/constrained-point.js";
import { Tool } from "../classes/tool.js";
import { AdjustmentPoint, SnapPoint, SnapType, Vec2 } from "../dto.js";
import { add2, compareDistance, containsAabb, eq2, length2, sub2 } from "../helpers/utils.js";

enum DragOperation {
    move,
    select
}

export class AdjustTool extends Tool {
    static PointRadius = 10;

    adjustmentPoints: AdjustmentPoint[];
    selectedAdjustmentPoints: AdjustmentPoint[] = [];
    dragOperation: DragOperation;
    snapPoint: SnapPoint;

    activate() {
        this.layer.setSelection();
        this.updatePoints();
        this.updateIndicators();
    }

    stateInvalidated() {
        this.updatePoints();
        this.updateIndicators();
    }

    updatePoints(preserveSelection = false) {
        const prev = this.selectedAdjustmentPoints.map(pt => ({ object: pt.object, index: pt.index }));
        const all = this.layer.objects.flatMap(obj => obj.getAdjustmentPoints());
        const sel = [];
        for (const pt of all) {
            if (preserveSelection && prev.find(item => pt.object === item.object && pt.index === item.index)) {
                sel.push(pt);
            }
        }
        this.adjustmentPoints = all;
        this.selectedAdjustmentPoints = sel;
    }

    updateIndicators() {
        this.layer.preview.removeChildren();

        const selectedPts: Vec2[] = [];
        const nonSelectedPts: Vec2[] = [];

        for (const adjPt of this.affectedAdjustmentPoints) {
            if (!selectedPts.find(pt => eq2(pt, adjPt.original))) {
                selectedPts.push(adjPt.current);
            }
        }
        for (const adjPt of this.adjustmentPoints) {
            if (!selectedPts.find(pt => eq2(pt, adjPt.original)) && !nonSelectedPts.find(pt => eq2(pt, adjPt.original))) {
                nonSelectedPts.push(adjPt.current);
            }
        }

        for (const pt of selectedPts) {
            this.layer.preview.addChild(
                new PIXI.Graphics()
                    .lineStyle(4, canvas.linemap._selectionColorHex)
                    .drawCircle(pt[0], pt[1], AdjustTool.PointRadius)
            );
        }
        if (this.dragOperation !== DragOperation.move) {
            for (const pt of nonSelectedPts) {
                this.layer.preview.addChild(
                    new PIXI.Graphics()
                        .lineStyle(2, 0xffffff)
                        .drawCircle(pt[0], pt[1], AdjustTool.PointRadius)
                );
            }
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

    onClickLeft(event: any) {
        const point: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        let covered = this.adjustmentPoints.filter(pt => compareDistance(pt.original, point, AdjustTool.PointRadius) <= 0);
        if (covered.find(pt => !pt.object)) {
            covered = covered.filter(pt => !pt.object);
        }
        if (!event.shiftKey) {
            this.selectedAdjustmentPoints = covered;
        } else {
            this.selectedAdjustmentPoints.push(...covered.filter(p1 => this.selectedAdjustmentPoints.find(p2 => !p2.equals(p1))));
        }
        this.updateIndicators();
    }

    onDragLeftStart(event: any) {
        const point: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        let adjPts = this.adjustmentPoints.filter(pt => compareDistance(pt.original, point, AdjustTool.PointRadius) <= 0);
        if (adjPts.find(pt => !pt.object)) {
            adjPts = adjPts.filter(pt => !pt.object);
        }
        const cmpPt = adjPts[0]?.original;
        event.interactionData.pointOffset = cmpPt ? sub2(point, cmpPt) : [0, 0];
        const coveredEqual = cmpPt && adjPts.slice(1).every(pt => eq2(pt.original, cmpPt));
        let selectedMatching = cmpPt && !!this.selectedAdjustmentPoints.find(pt => eq2(pt.original, cmpPt));

        if (!selectedMatching && adjPts.length) {
            this.selectedAdjustmentPoints = adjPts;
            selectedMatching = true;
        }

        if (cmpPt && coveredEqual && selectedMatching) {
            this.dragOperation = DragOperation.move;
        } else {
            this.dragOperation = DragOperation.select;
        }
    }

    onDragLeftMove(event: any) {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2e: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        this.snapPoint = this.layer.getSnapPoint(pt2e, [SnapType.line, SnapType.lineEnd, SnapType.symbol], this.selectedAdjustmentPoints.map(pt => pt.object));
        const pt2 = this.snapPoint ? this.snapPoint.pt : pt2e;

        const d = add2(sub2(pt2, pt1), event.interactionData.pointOffset ?? [0, 0]);

        if (this.dragOperation === DragOperation.select) {
            this.layer.preview.removeChildren();
            this.updateIndicators();

            if (length2(d) > 3) {
                const gfx = this.layer.preview.addChild(new PIXI.Graphics());
                gfx
                    .lineStyle(2, 0x00ffff)
                    .drawRect(...pt1, ...d)            
            }
        } else {
            for (const apt of this.affectedAdjustmentPoints) {
                const pt = add2(apt.original, d);
                if (apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, pt, this.snapPoint?.object, this.snapPoint?.t))) {
                    apt.current = pt;
                }
            }
            this.layer.redraw(false);
            this.updateIndicators();
        }
    }

    async onDragLeftDrop(event: any) {
        const pt1: Vec2 = [event.interactionData.origin.x, event.interactionData.origin.y];
        const pt2e: Vec2 = [event.interactionData.destination.x, event.interactionData.destination.y];
        this.snapPoint = this.layer.getSnapPoint(pt2e, [SnapType.line, SnapType.lineEnd, SnapType.symbol], this.selectedAdjustmentPoints.map(pt => pt.object));
        const pt2 = this.snapPoint ? this.snapPoint.pt : pt2e;

        const d = add2(sub2(pt2, pt1), event.interactionData.pointOffset ?? [0, 0]);

        if (this.dragOperation === DragOperation.select) {
            const min: Vec2 = [Math.min(pt1[0], pt2[0]), Math.min(pt1[1], pt2[1])];
            const max: Vec2 = [Math.max(pt1[0], pt2[0]), Math.max(pt1[1], pt2[1])];

            const covered = this.adjustmentPoints.filter(pt => containsAabb(pt.original, [min, max]));
            if (!event.shiftKey) {
                this.selectedAdjustmentPoints = covered;
            } else {
                this.selectedAdjustmentPoints.push(...covered.filter(p1 => this.selectedAdjustmentPoints.find(p2 => !p2.equals(p1))));
            }
        } else {
            for (const apt of this.affectedAdjustmentPoints) {
                const pt = add2(apt.original, d);
                if (this.snapPoint && eq2(pt, this.snapPoint.pt)) {
                    apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, pt, this.snapPoint.object, this.snapPoint.t));
                } else {
                    apt.object.setAdjustmentPoint(apt.index, new ConstrainedPoint(apt.type, pt));
                }
            }
            this.updatePoints(true);
            this.layer.registerHistory();

            this.layer.redraw();
        }

        this.dragOperation = undefined;
        this.snapPoint = undefined;
        
        this.updateIndicators();
    }

    get affectedAdjustmentPoints(): AdjustmentPoint[] {
        const pointGroups: Record<string, AdjustmentPoint[]> = {};
        for (const pt of this.selectedAdjustmentPoints) {
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
