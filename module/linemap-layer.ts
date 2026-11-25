import { ObjectData, ObjectType, UnknownObject } from "./classes/object.js";
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

    // GPU render targets, made once per canvas draw in _draw and destroyed in _tearDown.
    renderTexture: any;
    lineTexture: any;
    maskTexture: any;
    // The display objects of the last redraw: destroyed at the start of the next one (objects read
    // their sprite's size between redraws, so they cannot be destroyed straight after rendering).
    drawn: any[] = [];

    // Sorting in the primary group (see _draw).
    elevation = 0;
    sortLayer = 0;
    sort = 1;

    // Stage handlers bound once, so _deactivate removes exactly what _activate added.
    stageHandlers: Record<string, (event: any) => void>;

    // The name core records to restore the active layer after a canvas redraw, and the scene
    // control activate() switches to. Unset, it was "", so a redraw dropped the GM onto Tokens.
    static get layerOptions() {
        return foundry.utils.mergeObject(super.layerOptions, { name: "linemap" });
    }

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
        this.stageHandlers = {
            mousedown: this._leftMouseDown.bind(this),
            mouseup: this._leftMouseUp.bind(this),
            rightdown: this._rightMouseDown.bind(this),
            rightup: this._rightMouseUp.bind(this),
            pointermove: this._pointerMove.bind(this),
            pointerout: this._pointerOut.bind(this)
        };

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

        // A canvas draw restores the active layer (layerOptions.name) and only afterwards clears every
        // stage listener (Canvas#addListeners: stage.removeAllListeners()), then fires canvasReady. So
        // when this layer is the one restored, its handlers are put back here.
        Hooks.on("canvasReady", () => {
            if (this.active) this._attachStageHandlers();
        });
    }

    /**
     * preUpdateScene: when a Scene is resized with autoReposition (its config window sets it when
     * the Scene has a background), core moves every placeable to keep its place on the background.
     * Move the map the same way, in the same update; it used to stay put and slide off its places.
     * Runs after core's own _preUpdate, so the transform is core's: scale by the size change, then
     * offset to the new Scene rectangle.
     */
    static onPreUpdateScene(scene: any, changed: any, options: any) {
        if (!options?.autoReposition) return;
        const data = foundry.utils.getProperty(changed, "flags.linemap.serialized") ?? scene.getFlag("linemap", "serialized");
        if (!data?.objects?.length) return;

        const dims: Record<string, any> = {};
        for (const key of ["width", "height", "padding", "shiftX", "shiftY", "grid"]) {
            if (key in changed) dims[key] = foundry.utils.deepClone(changed[key]);
        }
        const updated = scene.clone(dims);
        const sx = updated.width / scene.width;
        const sy = updated.height / scene.height;
        const ox = updated.dimensions.sceneX - sx * scene.dimensions.sceneX;
        const oy = updated.dimensions.sceneY - sy * scene.dimensions.sceneY;
        if (![sx, sy, ox, oy].every(Number.isFinite) || (sx === 1 && sy === 1 && ox === 0 && oy === 0)) return;

        const move = ([x, y]: Vec2): Vec2 => [x * sx + ox, y * sy + oy];
        const objects = data.objects.map(o => {
            const cls = CONFIG.linemap.objectTypes[o?.type];
            return cls ? cls.moveData(o, move) : o;
        });
        foundry.utils.setProperty(changed, "flags.linemap.serialized", { ...data, objects });
    }

    /** Add the stage handlers; safe to repeat, since each is removed by identity first. */
    _attachStageHandlers() {
        for (const [type, handler] of Object.entries(this.stageHandlers)) {
            canvas.stage.removeEventListener(type, handler);
            canvas.stage.addEventListener(type, handler);
        }
    }

    _detachStageHandlers() {
        for (const [type, handler] of Object.entries(this.stageHandlers)) {
            canvas.stage.removeEventListener(type, handler);
        }
    }

    // Core's activate()/deactivate() call these only on a real change of state. The handlers are
    // bound once and removed by identity: a fresh .bind() would match nothing, and a set of
    // listeners piled up on every visit to the layer.
    _activate() {
        this._attachStageHandlers();
        this.undoHistory = [];
        this.pushHistory();
    }

    _deactivate() {
        this._detachStageHandlers();
        this.interactionData = undefined;
        this.interactionDataRight = undefined;
        // Takes the tool's option bar and preview off screen; the tool's own onChange(true)
        // re-activates it when the GM comes back to the control.
        this.clearTool();
        this.undoHistory = [];
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
        this.clearPreview();
    }

    /** Remove and destroy the preview's graphics: they are always made fresh, and a Graphics holds GPU buffers until destroyed. */
    clearPreview() {
        this.preview?.removeChildren().forEach(c => c.destroy({ children: true }));
    }

    /** Destroy the previous redraw's display objects. Shared textures (icons, render targets) are kept. */
    _disposeDrawn() {
        this.objectContainer?.removeChildren();
        this.drawn.forEach(c => c.destroy({ children: true }));
        this.drawn = [];
    }

    hotkeyPressed(key: ToolHotkey) {
        this.activeTool?.hotkeyPressed(key);
    }

    clear(withUndo: boolean = true) {
        this.objects = [];

        if (withUndo) {
            this.registerHistory();
        }
        // this.quadtree.clear();
    }

    addObject(obj: ObjectType) {
        obj.isRevealed = this.revealNewObjects;
        this.objects.push(obj);

        this.registerHistory();
        this.redraw();
    }

    deleteObjects(...obj: ObjectType[]) {
        const gone = new Set(obj);
        // A point linked to a deleted object is pinned where it is now. Left linked, it kept following
        // the deleted object in this session and was saved naming it, so a reload put it back where
        // it had first been drawn.
        for (const o of this.objects) if (!gone.has(o)) o.releaseConstraints(gone);
        this.objects = this.objects.filter(o => !gone.has(o));

        this.registerHistory();
        this.redraw();
    }

    async _draw(options) {
        const size = { width: canvas.dimensions.width, height: canvas.dimensions.height };
        this.renderTexture = PIXI.RenderTexture.create(size);
        this.lineTexture = PIXI.RenderTexture.create(size);
        this.maskTexture = PIXI.RenderTexture.create(size);
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

        // In the primary group, sit just above the background of the level being viewed: v14 draws
        // each level's background at that level's bottom elevation, so at elevation 0 a raised
        // level's background covered the map. Tiles, drawings and tokens there stay above it, as on
        // the ground level. Viewing another level redraws the canvas, which runs this again.
        // (canvas.level is v14's; on v13 this stays at elevation 0, as before.)
        this.elevation = canvas.level?.elevation?.bottom ?? 0;
        this.sortLayer = foundry.canvas.groups?.PrimaryCanvasGroup?.SORT_LAYERS?.SCENE ?? 0;
        this.sort = 1;
        if (this.parent) this.parent.sortDirty = true;

        this.objectContainer = new PIXI.Container();

        this.renderSprite = this.addChild(new PIXI.Sprite(this.renderTexture));

        this.preview = this.addChild(new PIXI.Container());

        this.fetchData();
        this.redraw();

        this.visible = true;
    }

    redraw(highQuality = true) {
        // Nothing to draw into before the canvas has drawn this layer (_draw makes the targets).
        if (!this.renderTexture) return;
        this._disposeDrawn();

        const layers = {
            areas: new PIXI.Container(),
            lines: new PIXI.Container(),
            footprints: new PIXI.Container(),
            symbols: new PIXI.Container()
        }

        this.objects.forEach(obj => {
            obj.draw(layers);
        });

        this.drawn = Object.values(layers);

        if (!highQuality) {
            this.objectContainer.addChild(layers.areas);
            this.objectContainer.addChild(layers.lines);
            this.objectContainer.addChild(layers.symbols);
            canvas.app.renderer.render(this.objectContainer, { renderTexture: this.renderTexture, clear: true });
            return;
        }

        // The line and mask targets are reused: a fresh pair per redraw was never freed (PIXI's texture
        // GC skips render textures) and leaked two scene-sized textures per click.
        canvas.app.renderer.render(layers.lines, { renderTexture: this.lineTexture, clear: true });
        canvas.app.renderer.render(layers.footprints, { renderTexture: this.maskTexture, clear: true });

        const lineContainer = new PIXI.Container();
        const lineSprite = lineContainer.addChild(new PIXI.Sprite(this.lineTexture));
        lineSprite.filters = [this.lineFilter];
        this.lineFilter.uniforms.lineTexture = this.lineTexture;
        this.lineFilter.uniforms.maskTexture = this.maskTexture;
        this.drawn.push(lineContainer);

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
        this._disposeDrawn();
        this.objectContainer?.destroy({ children: true });
        this.objectContainer = undefined;
        // Destroys renderSprite and preview with their children (not their textures).
        await super._tearDown(options);
        for (const texture of [this.renderTexture, this.lineTexture, this.maskTexture]) texture?.destroy(true);
        this.renderTexture = this.lineTexture = this.maskTexture = undefined;
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
            // Links resolve only to objects this build can draw; a link to an unknown one falls
            // back to the point saved with it.
            const objectMap = objectEntries?.reduce((acc, obj) => {
                if (!(obj[0] instanceof UnknownObject)) acc[obj[0].id] = obj[0];
                return acc;
            }, {}) ?? {};
            objectEntries?.forEach(([obj, data]: [ObjectType, ObjectData]) => obj.deserialize(data, objectMap));
            this.objects = objectEntries?.map(o => o[0]) ?? [];
            this.isLightMode = !!data.isLightMode;
            this.symbolScale = data.symbolScale ?? 1.0;
        } else {
            // A scene with no drawing yet starts from the defaults. The layer outlives scenes, so
            // without this the previous scene's colour and scale showed here and were saved into
            // this scene on its first edit.
            this.objects = [];
            this.isLightMode = false;
            this.symbolScale = 1.0;
        }
    }

    static prepareSceneControls(): any {
        if (game.user.isGM) {
            return {
                name: "linemap",
                // After core's controls (0 to 8 in v14). Unset, core's sort compared against
                // undefined (NaN), so where Line Map landed was left to the sort.
                order: 9,
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
                        order: 4,
                        name: "drawSymbol",
                        title: "linemap.tools.drawSymbol",
                        icon: "fas fa-shapes",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawSymbol"); }
                    },
                    drawWaypoint: {
                        order: 5,
                        name: "drawWaypoint",
                        title: "linemap.tools.drawWaypoint",
                        icon: "fas fa-circle-nodes",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawWaypoint"); }
                    },
                    drawArea: {
                        order: 6,
                        name: "drawArea",
                        title: "linemap.tools.drawArea",
                        icon: "fas fa-vector-polygon",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawArea"); }
                    },
                    drawText: {
                        order: 7,
                        name: "drawText",
                        title: "linemap.tools.drawText",
                        icon: "fas fa-text",
                        visible: true,
                        onChange: (event, active) => { active && canvas.linemap.activateTool("drawText"); }
                    },
                    clearObjects: {
                        order: 8,
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
                                // clear() saves and records history; a redraw replaces the old
                                // _draw() call, which made a second set of textures and children.
                                const state = canvas.linemap._captureState();
                                canvas.linemap.clear();
                                canvas.linemap.redraw();
                                canvas.linemap._stateInvalidated(state);
                            }
                        }
                    },
                    newObjectsRevealed: {
                        order: 9,
                        name: "newObjectsRevealed",
                        title: "linemap.tools.newObjectsRevealed",
                        icon: "fas fa-eye",
                        toggle: true,
                        // Live state: the controls are rebuilt on every canvas draw.
                        active: canvas.linemap?.revealNewObjects ?? true,
                        onChange: (event, active) => {
                            canvas.linemap.revealNewObjects = active;
                        }
                    },
                    adjustLinked: {
                        order: 10,
                        name: "adjustLinked",
                        title: "linemap.tools.adjustLinked",
                        icon: "fas fa-arrows-left-right",
                        toggle: true,
                        active: canvas.linemap?.adjustLinked ?? true,
                        // onChange(event, active): the deprecated onClick is called with one
                        // argument, which left adjustLinked undefined.
                        onChange: (event, active) => {
                            canvas.linemap.adjustLinked = active;
                        }
                    },
                    linemapSettings: {
                        order: 11,
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
