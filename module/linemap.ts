import { LineMapLayer } from "./linemap-layer.js";
import { Line } from "./objects/line.js";
import { Symbol } from "./objects/symbol.js";
import { Area } from "./objects/area.js";
import { Text } from "./objects/text.js";
import { SolidLine } from "./objects/line-styles/solid-line.js";
import { DashLine } from "./objects/line-styles/dash-line.js";
import { WaveLine } from "./objects/line-styles/wave-line.js";
import { BarrierLine } from "./objects/line-styles/barrier-line.js";
import { ToolHotkey } from "./classes/tool.js";
import { Waypoint } from "./objects/waypoint.js";
import { ScenePropertiesApp } from "./apps/scene-properties.js";

Hooks.on("getSceneControlButtons", (controls: any) => {
    if (game.user.isGM) {
        const layerControls: any = {
            name: "linemap",
            title: "Line Map",
            layer: "linemap",
            icon: "fas fa-route",
            tools: [
                {
                    name: "selectObject",
                    title: "linemap.tools.selectObject",
                    icon: "fas fa-arrow-pointer",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("selectObject"); }
                },
                {
                    name: "adjustObject",
                    title: "linemap.tools.adjustObject",
                    icon: "fas fa-up-down-left-right",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("adjustObject"); }
                },
                {
                    name: "drawLine",
                    title: "linemap.tools.drawLine",
                    icon: "fas fa-slash",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("drawLine"); }
                },
                {
                    name: "drawSymbol",
                    title: "linemap.tools.drawSymbol",
                    icon: "fas fa-shapes",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("drawSymbol"); }
                },
                {
                    name: "drawWaypoint",
                    title: "linemap.tools.drawWaypoint",
                    icon: "fas fa-circle-nodes",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("drawWaypoint"); }
                },
                {
                    name: "drawArea",
                    title: "linemap.tools.drawArea",
                    icon: "fas fa-vector-polygon",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("drawArea"); }
                },
                {
                    name: "drawText",
                    title: "linemap.tools.drawText",
                    icon: "fas fa-text",
                    visible: true,
                    onClick: () => { canvas.linemap.activateTool("drawText"); }
                },
                {
                    name: "clearObjects",
                    title: "linemap.tools.trash",
                    icon: "fas fa-trash",
                    visible: true,
                    button: true,
                    onClick: async () => {
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
                }
            ],
            activeTool: "selectObject",
            visible: true
        };

        if (canvas.linemap) {
            if (canvas.linemap.revealNewObjects) {
                layerControls.tools.push({
                    name: "newObjectsRevealed",
                    title: "linemap.tools.newObjectsRevealed",
                    icon: "fas fa-eye",
                    toggle: true,
                    active: true,
                    onClick: () => {
                        canvas.linemap.revealNewObjects = false;
                        ui.controls.initialize();
                    }
                });
            } else {
                layerControls.tools.push({
                    name: "newObjectsHidden",
                    title: "linemap.tools.newObjectsHidden",
                    icon: "fas fa-eye-slash",
                    toggle: true,
                    active: false,
                    onClick: () => {
                        canvas.linemap.revealNewObjects = true;
                        ui.controls.initialize();
                    }
                });
            }
    
            if (canvas.linemap.adjustLinked) {
                layerControls.tools.push({
                    name: "adjustLinked",
                    title: "linemap.tools.adjustLinked",
                    icon: "fas fa-arrows-left-right",
                    toggle: true,
                    active: true,
                    onClick: () => {
                        canvas.linemap.adjustLinked = false;
                        ui.controls.initialize();
                    }
                });
            } else {
                layerControls.tools.push({
                    name: "adjustUnlinked",
                    title: "linemap.tools.adjustUnlinked",
                    icon: "fas fa-arrow-right-arrow-left",
                    toggle: true,
                    active: false,
                    onClick: () => {
                        canvas.linemap.adjustLinked = true;
                        ui.controls.initialize();
                    }
                });
            }
    
            layerControls.tools.push({
                name: "linemapSettings",
                title: "linemap.tools.settings",
                icon: "fas fa-cog",
                visible: true,
                button: true,
                onClick: () => {
                    ScenePropertiesApp.activate();
                }
            });
        }

        controls.push(layerControls);
    }
});

Hooks.on("init", async () => {
    CONFIG.Canvas.layers.linemap = { group: "primary", layerClass: LineMapLayer };

    const selectTool = (tool: string) => {
        if (canvas.linemap.active) {
            ui.controls.initialize({ tool });
            canvas.linemap.activateTool(tool);
            return true;
        }
    }
    const sendHotkey = (key: ToolHotkey) => {
        if (canvas.linemap.active) {
            canvas.linemap.hotkeyPressed(key);
            return true;
        }
    }

    game.keybindings.register("linemap", "selectTool", {
        name: "linemap.keybindings.selectTool",
        editable: [
            { key: "KeyV" }
        ],
        onDown: () => {
            return selectTool("selectObject");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "adjustTool", {
        name: "linemap.keybindings.adjustTool",
        editable: [
            { key: "KeyA" }
        ],
        onDown: () => {
            return selectTool("adjustObject");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "drawLineTool", {
        name: "linemap.keybindings.drawLineTool",
        editable: [
            { key: "KeyL" }
        ],
        onDown: () => {
            return selectTool("drawLine");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "drawSymbolTool", {
        name: "linemap.keybindings.drawSymbolTool",
        editable: [
            { key: "KeyS" }
        ],
        onDown: () => {
            return selectTool("drawSymbol");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "drawWaypointTool", {
        name: "linemap.keybindings.drawWaypointTool",
        editable: [
            { key: "KeyW" }
        ],
        onDown: () => {
            return selectTool("drawWaypoint");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "drawAreaTool", {
        name: "linemap.keybindings.drawAreaTool",
        editable: [
            { key: "KeyP" }
        ],
        onDown: () => {
            return selectTool("drawArea");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "drawTextTool", {
        name: "linemap.keybindings.drawTextTool",
        editable: [
            { key: "KeyT" }
        ],
        onDown: () => {
            return selectTool("drawText");
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "revealObjects", {
        name: "linemap.keybindings.revealObjects",
        editable: [
            { key: "KeyR" }
        ],
        onDown: () => {
            return sendHotkey(ToolHotkey.reveal);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "hideObjects", {
        name: "linemap.keybindings.hideObjects",
        editable: [
            { key: "KeyH" }
        ],
        onDown: () => {
            return sendHotkey(ToolHotkey.hide);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "reverseWaypointDirection", {
        name: "linemap.keybindings.reverseWaypointDirection",
        editable: [
            { key: "KeyD" }
        ],
        onDown: () => {
            return sendHotkey(ToolHotkey.reverse);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "boldText", {
        name: "linemap.keybindings.boldText",
        editable: [
            { key: "KeyB" }
        ],
        onDown: () => {
            return sendHotkey(ToolHotkey.bold);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "italicText", {
        name: "linemap.keybindings.italicText",
        editable: [
            { key: "KeyI" }
        ],
        onDown: () => {
            return sendHotkey(ToolHotkey.italic);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "toggleLinked", {
        name: "linemap.keybindings.toggleLinked",
        editable: [
            { key: "KeyN" }
        ],
        onDown: () => {
            canvas.linemap.adjustLinked = !canvas.linemap.adjustLinked;
            ui.controls.initialize();
            return true;
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });
    game.keybindings.register("linemap", "deleteSelected", {
        name: "linemap.keybindings.deleteSelected",
        editable: [
            { key: "Delete" },
            { key: "Backspace" }
        ],
        onDown: (event: any) => {
            if (canvas.linemap.active) {
                canvas.linemap._onDeleteKey(event);
                return true;
            }
        }
    });
    game.keybindings.register("linemap", "undo", {
        name: "KEYBINDINGS.Undo",
        uneditable: [
            { key: "KeyZ", modifiers: ["Control"] }
        ],
        onDown: (event: any) => {
            if (canvas.linemap.active) {
                canvas.linemap.undo();
                return true;
            }
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY
    });

    CONFIG.linemap = {
        snap: {
            lineEnd: 10,
            line: 5,
            symbol: 20
        },    
        objectTypes: {
            line: Line,
            symbol: Symbol,
            waypoint: Waypoint,
            area: Area,
            text: Text
        },
        lineStyles: {
            major: {
                icon: 'modules/linemap/assets/lines/major-path.svg',
                lineClass: SolidLine,
                selectTolerance: 5
            },
            minor: {
                icon: 'modules/linemap/assets/lines/minor-path.svg',
                lineClass: DashLine,
                selectTolerance: 5
            },
            rough: {
                icon: 'modules/linemap/assets/lines/rough-path.svg',
                lineClass: WaveLine,
                selectTolerance: 13
            },
            barrier: {
                icon: 'modules/linemap/assets/lines/barrier.svg',
                lineClass: BarrierLine,
                selectTolerance: 13
            }
        },
        symbols: {
            'major-settlement': {
                icon: 'modules/linemap/assets/symbols/major-settlement.svg',
                footprint: 'modules/linemap/assets/footprints/major-settlement.svg'
            },
            'minor-settlement': {
                icon: 'modules/linemap/assets/symbols/minor-settlement.svg',
                footprint: 'modules/linemap/assets/footprints/minor-settlement.svg'
            },
            'major-site': {
                icon: 'modules/linemap/assets/symbols/major-site.svg',
                footprint: 'modules/linemap/assets/footprints/major-site.svg'
            },
            'minor-site': {
                icon: 'modules/linemap/assets/symbols/minor-site.svg',
                footprint: 'modules/linemap/assets/footprints/minor-site.svg'
            },
            'major-danger': {
                icon: 'modules/linemap/assets/symbols/major-danger.svg',
                footprint: 'modules/linemap/assets/footprints/major-danger.svg'
            },
            'minor-danger': {
                icon: 'modules/linemap/assets/symbols/minor-danger.svg',
                footprint: 'modules/linemap/assets/footprints/minor-danger.svg'
            },
            'curiosity': {
                icon: 'modules/linemap/assets/symbols/curiosity.svg'
            },
        },
        waypoints: {
            waypoint: {
                icon: 'modules/linemap/assets/waypoints/waypoint.svg',
                footprint: 'modules/linemap/assets/waypoints/waypoint.svg'
            },
            pass: {
                icon: 'modules/linemap/assets/waypoints/pass.svg',
                footprint: 'modules/linemap/assets/footprints/pass.svg'
            },
            'elevation-left': {
                icon: 'modules/linemap/assets/waypoints/elevation-left.svg',
                reverse: 'elevation-right'
            },
            'elevation-right': {
                icon: 'modules/linemap/assets/waypoints/elevation-right.svg',
                reverse: 'elevation-left'
            }
        },
        patterns: {
            diagonal1: {
                texture: 'modules/linemap/assets/patterns/diagonal1.svg'
            },
            diagonal2: {
                texture: 'modules/linemap/assets/patterns/diagonal2.svg'
            },
            dots: {
                texture: 'modules/linemap/assets/patterns/dots.svg'
            },
            waves: {
                texture: 'modules/linemap/assets/patterns/waves.svg'
            },
            barrier: {
                lineWidth: 12
            }
        }
    };

    const loadables = [...Object.values(CONFIG.linemap.lineStyles), ...Object.values(CONFIG.linemap.symbols)];
    await Promise.all(loadables.map(async (symbol: any) => {
        const response = await fetch(symbol.icon);
        symbol.content = await response.text();
    }));
});
