import { Point, Vec2 } from "../dto.js";
import { LineMapLayer } from "../linemap-layer.js";

export enum ToolHotkey {
    reveal,
    hide,
    reverse
}

export class Tool {
    constructor(public layer: LineMapLayer) {}

    activate() {}
    deactivate() {}

    stateInvalidated() {}

    onMouseMove(event, point: Point) {}
    onMouseOut(event) {}
    onDragLeftStart(event) {}
    onClickLeft(event) {}
    onClickRight(event) {}
    onDragLeftMove(event) {}
    async onDragLeftDrop(event) {}
    async onDeleteKey(event) {}

    hotkeyPressed(key: ToolHotkey) {}
}
