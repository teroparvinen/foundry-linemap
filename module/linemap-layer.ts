import { ObjectData, ObjectType } from "./classes/object.js";
import { Tool, ToolHotkey } from "./classes/tool.js";
import { Vec2, SnapType, SnapPoint } from "./dto.js";
import { length2, sub2 } from "./helpers/utils.js";
import { DrawLineTool } from "./tools/draw-line.js";
import { DrawSymbolTool } from "./tools/draw-symbol.js";
import { DrawWaypointTool } from "./tools/draw-waypoint.js";
import { DrawAreaTool } from "./tools/draw-area.js";
import { DrawTextTool } from "./tools/draw-text.js";
import { SelectTool } from "./tools/select-tool.js";
import { AdjustTool } from "./tools/adjust-tool.js";
import { ScenePropertiesApp } from "./apps/scene-properties.js";

const { layers } = foundry.canvas;

interface LayerData {
    objects: ObjectData[];
    isLightMode: boolean;
    symbolScale: number;
}

interface InterfaceState {
    selectedIds: string[];
}

export type TextureCollection = Record<string, { icon: any, footprint: any }>;

export class LineMapLayer extends layers.InteractionLayer {
    objects: ObjectType[] = [];
    placeables: any[] = [];

    undoHistory: LayerData[] = [];

    tools: Record<string, Tool> = {};
    activeTool: Tool;
    revealNewObjects = true;
    adjustLinked = true;

    symbolTextures: TextureCollection = {};
    waypointTextures: TextureCollection = {};
    patternTextures: TextureCollection = {};

    isLightMode = false;
    symbolScale = 1.0;

    constructor() {
        super();

        this.tools = {
            selectObject: new SelectTool(this),
            adjustObject: new AdjustTool(this),
            drawLine: new DrawLineTool(this),
            drawSymbol: new DrawSymbolTool(this),
            drawWaypoint: new DrawWaypointTool(this),
            drawArea: new DrawAreaTool(this),
            drawText: new DrawTextTool(this)
        };
        this.activeTool = this.tools['selectObject'];

        this.symbolTextures = Object.fromEntries(Object.entries(CONFIG.linemap.symbols).map(([key, value]: [string, any]) => {
            return [key, {
                icon: PIXI.Texture.from(value.icon),
                footprint: value.footprint ? PIXI.Texture.from(value.footprint) : undefined
            }];
        }));
        this.waypointTextures = Object.fromEntries(Object.entries(CONFIG.linemap.waypoints).map(([key, value]: [string, any]) => {
            return [key, {
                icon: PIXI.Texture.from(value.icon),
                footprint: value.footprint ? PIXI.Texture.from(value.footprint) : undefined
            }];
        }));
        this.patternTextures = Object.fromEntries(
            Object.entries(CONFIG.linemap.patterns)
                .filter(([key, value]: [string, any]) => value.texture)
                .map(([key, value]: [string, any]) => {
                    return [key, {
                        icon: PIXI.Texture.from(value.texture, { wrapMode: PIXI.WRAP_MODES.REPEAT }),
                        footprint: undefined
                    }];
                })
        );

        Hooks.on("updateScene", (obj, updates, { userId }: { userId?: string } = {}) => {
            if (obj === canvas.scene && updates.flags?.linemap?.serialized && userId != game.user.id) {
                this.fetchData();
                this.redraw();
            }
        });
    }

    activate({ tool }: { tool?: string } = {}) {
        super.activate({tool});
        canvas.stage.addEventListener("mousedown", this._leftMouseDown.bind(this));
        canvas.stage.addEventListener("mouseup", this._leftMouseUp.bind(this));
        canvas.stage.addEventListener("rightdown", this._rightMouseDown.bind(this));
        canvas.stage.addEventListener("rightup", this._rightMouseUp.bind(this));
        canvas.stage.addEventListener("pointermove", this._pointerMove.bind(this));
        canvas.stage.addEventListener("pointerout", this._pointerOut.bind(this));
        this.undoHistory = [];
        this.pushHistory();
        return this;
    }

    deactivate() {
        super.deactivate();
        canvas.stage.removeEventListener("mousedown", this._leftMouseDown.bind(this));
        canvas.stage.removeEventListener("mouseup", this._leftMouseUp.bind(this));
        canvas.stage.removeEventListener("rightdown", this._rightMouseDown.bind(this));
        canvas.stage.removeEventListener("rightup", this._rightMouseUp.bind(this));
        canvas.stage.removeEventListener("pointermove", this._pointerMove.bind(this));
        canvas.stage.removeEventListener("pointerout", this._pointerOut.bind(this));
        this.undoHistory = [];
        return this;
    }

    activateTool(tool: string) {
        this.clearTool();
        this.activeTool = this.tools[tool];
        this.activeTool?.activate();
        this.redraw();
    }

    clearTool() {
        this.activeTool?.deactivate();
        this.activeTool = null;
        this.preview.removeChildren();
    }

    hotkeyPressed(key: ToolHotkey) {
        this.activeTool?.hotkeyPressed(key);
    }

    clear(withUndo: boolean = true) {
        this.objects = [];

        if (withUndo) {
            this.registerHistory();
        }

        this.removeChildren();
        // this.quadtree.clear();
    }

    addObject(obj: ObjectType) {
        obj.isRevealed = this.revealNewObjects;
        this.objects.push(obj);

        this.registerHistory();
        this.redraw();
    }

    deleteObjects(...obj: ObjectType[]) {
        this.objects = this.objects.filter(o => !obj.includes(o));

        this.registerHistory();
        this.redraw();
    }

    async _draw(options) {
        this.renderTexture = PIXI.RenderTexture.create({ width: canvas.dimensions.width, height: canvas.dimensions.height });
        this.lineFilter = new PIXI.Filter(`
            attribute vec2 aVertexPosition;

            uniform mat3 projectionMatrix;

            varying vec2 vTextureCoord;
            varying vec2 vMaskTextureCoord;

            uniform vec4 inputSize;
            uniform vec4 outputFrame;
            uniform vec2 screenDimensions;

            vec4 filterVertexPosition( void )
            {
                vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.)) + outputFrame.xy;

                return vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
            }

            vec2 filterTextureCoord( void )
            {
                return aVertexPosition * (outputFrame.zw * inputSize.zw);
            }

            void main(void)
            {
                gl_Position = filterVertexPosition();
                vTextureCoord = filterTextureCoord();
                vMaskTextureCoord = (vTextureCoord * inputSize.xy + outputFrame.xy) / screenDimensions;
            }
        `, `
            uniform sampler2D uSampler;
            uniform sampler2D lineTexture;
            uniform sampler2D maskTexture;

            varying vec2 vTextureCoord;
            varying vec2 vMaskTextureCoord;

            void main(void)
            {
                vec2 uv = vMaskTextureCoord;
                vec4 line = texture2D(lineTexture, uv);
                vec4 mask = texture2D(maskTexture, uv);
                gl_FragColor = line * (1.0 - mask.a);
                gl_FragColor.a = line.a * (1.0 - mask.a);
            }
        `, { screenDimensions: [this.renderTexture.width, this.renderTexture.height] });

        this.objectContainer = new PIXI.Container();

        this.renderSprite = this.addChild(new PIXI.Sprite(this.renderTexture));

        this.preview = this.addChild(new PIXI.Container());

        this.fetchData();
        this.redraw();

        this.visible = true;
    }

    redraw(highQuality = true) {
        this.objectContainer.removeChildren();

        const layers = {
            areas: new PIXI.Container(),
            lines: new PIXI.Container(),
            footprints: new PIXI.Container(),
            symbols: new PIXI.Container()
        }

        this.objects.forEach(obj => {
            obj.draw(layers);
        });

        if (!highQuality) {
            this.objectContainer.addChild(layers.areas);
            this.objectContainer.addChild(layers.lines);
            this.objectContainer.addChild(layers.symbols);
            canvas.app.renderer.render(this.objectContainer, { renderTexture: this.renderTexture, clear: true });
            return;
        }

        const lineTexture = PIXI.RenderTexture.create({ width: canvas.dimensions.width, height: canvas.dimensions.height });
        const maskTexture = PIXI.RenderTexture.create({ width: canvas.dimensions.width, height: canvas.dimensions.height });

        canvas.app.renderer.render(layers.lines, { renderTexture: lineTexture, clear: true });
        canvas.app.renderer.render(layers.footprints, { renderTexture: maskTexture, clear: true });

        const lineContainer = new PIXI.Container();
        const lineSprite = lineContainer.addChild(new PIXI.Sprite(lineTexture));
        lineSprite.filters = [this.lineFilter];
        this.lineFilter.uniforms.lineTexture = lineTexture;
        this.lineFilter.uniforms.maskTexture = maskTexture;

        canvas.app.renderer.render(layers.areas, { renderTexture: this.renderTexture, clear: true });
        canvas.app.renderer.render(lineContainer, { renderTexture: this.renderTexture, clear: false });
        canvas.app.renderer.render(layers.symbols, { renderTexture: this.renderTexture, clear: false });
    }

    assetsLoaded() {
        this.activeTool?.deactivate();
        this.activeTool?.activate();
    }

    async _tearDown(options) {
        this.clear(false);
        super._tearDown(options);
    }

    getSnapPoints(pt: Vec2, types: SnapType[]): SnapPoint[] {
        return this.objects.flatMap(obj => obj.getSnapPoints(pt, types));
    }

    getSnapPoint(pt: Vec2, types: SnapType[], exclude?: ObjectType[]): SnapPoint {
        let snaps = this.objects
            .filter(obj => !exclude || !exclude.includes(obj))
            .flatMap(obj => obj.getSnapPoints(pt, types));
        if (snaps.find(s => s.type === SnapType.symbol)) {
            snaps = snaps.filter(s => s.type === SnapType.symbol);
        }
        return snaps.reduce((cur, snap) => {
            if (!cur) {
                return snap;
            }
            return length2(sub2(cur.pt, pt)) > length2(sub2(snap.pt, pt)) ? snap : cur;
        }, undefined);
    }

    get _selectionColor(): [number, number, number] {
        return [
            (CONFIG.Canvas.dispositionColors.CONTROLLED >> 16 & 0xff) / 256,
            (CONFIG.Canvas.dispositionColors.CONTROLLED >> 8 & 0xff) / 256,
            (CONFIG.Canvas.dispositionColors.CONTROLLED & 0xff) / 256
        ]
    }

    get _selectionColorHex(): number {
        return CONFIG.Canvas.dispositionColors.CONTROLLED;
    }

    get _objectColor(): [number, number, number] {
        return this.isLightMode ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0];
    }

    get _objectColorHex(): number {
        return this.isLightMode ? 0xffffff : 0x0;
    }

    get selection(): ObjectType[] {
        return this.objects.filter(o => o.isSelected);
    }

    setSelection(...input: ObjectType[]) {
        const objects = input.filter(i => i);
        this.objects.forEach(o => o.isSelected = false);
        objects.forEach(o => o.isSelected = true);

        this.redraw();
    }

    _leftMouseDown(event) {
        const pt = event.data.getLocalPosition(canvas.app.stage);
        this.interactionData = {
            screenOrigin: { x: event.global.x, y: event.global.y },
            origin: pt,
            destination: pt
        };
    }
    
    _leftMouseUp(event) {
        if (this.interactionData) {
            const pt = event.data.getLocalPosition(canvas.app.stage);
            this.interactionData.destination = pt;
            event.interactionData = this.interactionData;

            let isDoubleClick = false;
            if (this.lastInteractionData) {
                const dx = this.interactionData.screenOrigin.x - this.lastInteractionData.screenOrigin.x;
                const dy = this.interactionData.screenOrigin.y - this.lastInteractionData.screenOrigin.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= 3) {
                    isDoubleClick = true;
                }

                this.lastInteractionData = undefined;
            }

            if (!isDoubleClick) {
                if (!this.interactionData.isDragging) {
                    this.tools[game.activeTool]?.onClickLeft(event);     
                } else {
                    this.tools[game.activeTool]?.onDragLeftDrop(event);
                }
    
                this.interactionData.timer = setTimeout(() => {
                    this.lastInteractionData = undefined;
                }, 250);
                this.lastInteractionData = this.interactionData;
            } else {
                this.tools[game.activeTool]?.onDoubleClick(event);
            }
        }

        this.interactionData = undefined;
    }

    _rightMouseDown(event) {
        const pt = event.data.getLocalPosition(canvas.app.stage);
        this.interactionDataRight = {
            screenOrigin: { x: event.global.x, y: event.global.y },
            origin: pt,
            destination: pt
        };
    }

    _rightMouseUp(event) {
        if (this.interactionDataRight && !this.interactionDataRight.isDragging) {
            event.interactionData = this.interactionDataRight;
            this.tools[game.activeTool]?.onClickRight(event);
        }
        this.interactionDataRight = undefined;
    }

    _pointerMove(event) {
        if (this.interactionData) {
            const pt = event.data.getLocalPosition(canvas.app.stage);
            this.interactionData.destination = pt;
            event.interactionData = this.interactionData;

            if (!this.interactionData.isDragging) {
                const dx = this.interactionData.screenOrigin.x - event.global.x;
                const dy = this.interactionData.screenOrigin.y - event.global.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 3) {
                    this.interactionData.isDragging = true;
                    this.tools[game.activeTool]?.onDragLeftStart(event);
                }
            } else {
                this.tools[game.activeTool]?.onDragLeftMove(event);
            }
        }

        if (this.interactionDataRight) {
            if (!this.interactionDataRight.isDragging) {
                const dx = this.interactionDataRight.screenOrigin.x - event.global.x;
                const dy = this.interactionDataRight.screenOrigin.y - event.global.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 3) {
                    this.interactionDataRight.isDragging = true;
                }
            }
        }

        if (!this.interactionData?.isDragging && event.srcElement === canvas.app.view) {
            const pt = event.data.getLocalPosition(canvas.app.stage);
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
            this.tools[game.activeTool]?.onMouseMove(event, pt);
        }
    }

    _pointerOut(event) {
        event.interactionData = this.interactionData;
        this.tools[game.activeTool]?.onMouseOut(event);
        this.interactionData = undefined;
        this.interactionDataRight = undefined;
    }

    async _onDeleteKey(event) {
        await this.tools[game.activeTool]?.onDeleteKey(event);
    }

    async registerHistory() {
        await this.dataChanged();
        this.pushHistory();
    }

    async undo() {
        if (this.undoHistory.length >= 2) {
            const state = this._captureState();
            this.undoHistory.pop();
            this.applyData(this.undoHistory.at(-1));
            await this._saveData();
            this.redraw();
            this._stateInvalidated(state);
        }
    }

    _captureState(): InterfaceState {
        return {
            selectedIds: this.objects.filter(o => o.isSelected).map(o => o.id)
        };
    }

    _stateInvalidated(state: InterfaceState) {
        this.setSelection(...this.objects.filter(o => state.selectedIds.includes(o.id)));

        this.tools[game.activeTool]?.stateInvalidated();        
    }

    get serialized(): LayerData {
        const objects = this.objects.map(o => o.serialized);
        const isLightMode = this.isLightMode;
        const symbolScale = this.symbolScale;
        return { objects, isLightMode, symbolScale };
    }

    pushHistory() {
        this.undoHistory.push(structuredClone(this.serialized));
    }

    async dataChanged() {
        await this._saveData();
    }

    fetchData() {
        this.applyData(canvas.scene.getFlag("linemap", "serialized"));
    }

    async _saveData() {
        await canvas.scene.update({ "flags.linemap.serialized": this.serialized }, { userId: game.user.id });
    }

    applyData(data: LayerData) {
        if (data) {
            // this.quadtree.clear();
            const objectEntries: [ObjectType, ObjectData][] = data.objects?.map(o => [ObjectType.create(o), o]);
            const objectMap = objectEntries?.reduce((acc, obj) => {
                acc[obj[0].id] = obj[0];
                return acc;
            }, {}) ?? {};
            objectEntries?.forEach(([obj, data]: [ObjectType, ObjectData]) => obj.deserialize(data, objectMap));
            this.objects = objectEntries?.map(o => o[0]) ?? [];
            this.isLightMode = data.isLightMode;
            this.symbolScale = data.symbolScale ?? 1.0;
        }
    }

    static prepareSceneControls(): any {
        if (game.user.isGM) {
            return {
                name: "linemap",
                title: "Line Map",
                layer: "linemap",
                icon: "fas fa-route",
                onChange: (event, active) => {
                    if (active) {
                        canvas.linemap.activate();
                    } else {
                        canvas.linemap.deactivate();
                    }
                },
                tools: {
                    selectObject: {
                        order: 1,
                        name: "selectObject",
                        title: "linemap.tools.selectObject",
                        icon: "fas fa-arrow-pointer",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("selectObject"); }
                    },
                    adjustObject: {
                        order: 2,
                        name: "adjustObject",
                        title: "linemap.tools.adjustObject",
                        icon: "fas fa-up-down-left-right",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("adjustObject"); }
                    },
                    drawLine: {
                        order: 3,
                        name: "drawLine",
                        title: "linemap.tools.drawLine",
                        icon: "fas fa-slash",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawLine"); }
                    },
                    drawSymbol: {
                        order: 3,
                        name: "drawSymbol",
                        title: "linemap.tools.drawSymbol",
                        icon: "fas fa-shapes",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawSymbol"); }
                    },
                    drawWaypoint: {
                        order: 4,
                        name: "drawWaypoint",
                        title: "linemap.tools.drawWaypoint",
                        icon: "fas fa-circle-nodes",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawWaypoint"); }
                    },
                    drawArea: {
                        order: 5,
                        name: "drawArea",
                        title: "linemap.tools.drawArea",
                        icon: "fas fa-vector-polygon",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawArea"); }
                    },
                    drawText: {
                        order: 6,
                        name: "drawText",
                        title: "linemap.tools.drawText",
                        icon: "fas fa-text",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawText"); }
                    },
                    clearObjects: {
                        order: 7,
                        name: "clearObjects",
                        title: "linemap.tools.trash",
                        icon: "fas fa-trash",
                        visible: true,
                        button: true,
                        onChange: async () => {
                            if (await foundry.applications.api.DialogV2.confirm({
                                content: game.i18n.localize('linemap.ui.confirmDelete'),
                                rejectClose: false,
                                modal: true
                            })) {
                                canvas.linemap.clear();
                                await canvas.linemap.dataChanged();
                                canvas.linemap._draw();
                            }
                        }
                    },
                    newObjectsRevealed: {
                        order: 8,
                        name: "newObjectsRevealed",
                        title: "linemap.tools.newObjectsRevealed",
                        icon: "fas fa-eye",
                        toggle: true,
                        active: true,
                        onChange: (event, active) => {
                            canvas.linemap.revealNewObjects = active;
                        }
                    },
                    adjustLinked: {
                        order: 9,
                        name: "adjustLinked",
                        title: "linemap.tools.adjustLinked",
                        icon: "fas fa-arrows-left-right",
                        toggle: true,
                        active: true,
                        onClick: (event, active) => {
                            canvas.linemap.adjustLinked = active;
                        }
                    },
                    linemapSettings: {
                        order: 10,
                        name: "linemapSettings",
                        title: "linemap.tools.settings",
                        icon: "fas fa-cog",
                        visible: true,
                        button: true,
                        onChange: () => {
                            ScenePropertiesApp.activate();
                        }
                    }
                },
                activeTool: "selectObject",
                visible: true
            };
        }
    }
}
