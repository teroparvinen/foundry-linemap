# Linemap for the Foundry VTT

This module allows you to draw line and symbol based maps (point crawls) as inspired by the Grimwild RPG.

## Drawings

The different object types available are:

- **Lines (hotkey L):** Various line types to indicate paths, rivers or other routes
- **Symbols (hotkey S):** Symbols to indicate towns, sites, dangers, curiosities and other point features
- **Waypoints (hotkey W):** Symbols that can only be attached to lines, to mark days of travel, portals and elevation changes
- **Areas (hotkey P):** Larger geographic areas like lakes
- **Text (hotkey T):** Labels to help you remember

## Snapping and object linking

When using the drawing tools, most objects snap to each other and form a link, allowing you to reposition elements and have the connected paths, symbols and waypoints automatically adjust their position.

To break these links, toggle the **Adjusting linked points preserves links** option in the layer control buttons. It works for both the select and adjust tools, slightly differently. Experiment to find the exact workflow and don't forget the tool hotkeys to quickly move between the available tools.

## Hiding and revealing objects

All drawing objects are visible to players by default. As the GM, you can select to hide and reveal objects during play. To make new objects appear hidden, toggle the **Created objects are revealed** option in the layer control buttons. Objects can be toggled by either selecting them with the select tool (shift select or area select to select multiple) and either using the context menu (right mouse button) or using the hotkeys **R** (to reveal) and **H** (to hide).

## Object details

### Text offset and orientation

Text objects that are linked to another object have two adjustment points. One is the point where they attach to the other object and another is the offset that makes the text not lie on top of the object it is labeling. These can be adjusted individually using the adjust tool (hotkey A). Text snapped to a line will orient itself to the line's direction.

To detach text from an object, deselect the preserve links option and move the text object using the select tool (hotkey V). To attach a separated text to an object, use the adjustment tool to snap the single adjustment handle to the target object.

### Editing text

Double click on a text object using the select tool to edit the text content. Shift-enter will insert a new line in the text editing dialog.

### Manipulating areas

Areas are created as rectangles, but can be freely shaped using the adjust tool (hotkey A) and moving the adjustment points around. To add or remove adjustment points, switch to the area tool (hotkey P) and double click on a line or point to add or delete one.

### Flipping waypoints

Some waypoints are directional. You can flip their direction by selecting the waypoint using the select tool (hotkey V) and pressing **D**.

## Other settings

Access other scene specific settings using the settings layer control button.

- Change the icon scale from 100% to 200% to represent lower or higher levels of scale detail
- Change the content color to white or black for better contrast with the scene background used
