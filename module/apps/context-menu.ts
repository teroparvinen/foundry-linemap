const { api } = foundry.applications;

export interface MenuOption {
    icon: string,
    label: string,
    handler: () => void
}

export class ContextMenu extends api.HandlebarsApplicationMixin(
	api.ApplicationV2
) {
	static DEFAULT_OPTIONS = {
		id: "linemap-context-menu",
        classes: ['linemap-menu'],
        window: {
            frame: false
        },
		actions: {
			selectOption: ContextMenu.selectOption,
            closeMenu: ContextMenu.closeMenu
		}
	};

	static PARTS = {
		main: {
			template: "modules/linemap/templates/context-menu.hbs"
		}
	};

    menuOptions: Record<string, MenuOption>;

    constructor(menuOptions: Record<string, MenuOption>, options = {}) {
        super(options);

        this.menuOptions = menuOptions;
    }

    _prepareContext(options) {
        return { menuOptions: this.menuOptions };
    }

    _attachFrameListeners() {
        super._attachFrameListeners();
        this.element.addEventListener("mouseleave", () => {
            this.close({ animate: false });
        });
    }

    static selectOption(event, target) {
        this.close({ animate: false });
        this.menuOptions[target.dataset.option]?.handler();
    }

    static closeMenu() {

    }
}
