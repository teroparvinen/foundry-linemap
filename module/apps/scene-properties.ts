const { api } = foundry.applications;

export class ScenePropertiesApp extends api.HandlebarsApplicationMixin(
	api.ApplicationV2
) {
	static DEFAULT_OPTIONS = {
		id: 'linemap-scene-properties',
        classes: ['linemap-scene-properties'],
        tag: 'form',
        window: {
            title: 'linemap.ui.propertiesTitle'
        },
        form: {
            submitOnChange: true,
            handler: ScenePropertiesApp.handleSubmit
        }
	};

	static PARTS = {
		main: {
			template: "modules/linemap/templates/scene-properties.hbs"
		}
	};

    _prepareContext(options: any) {
        const isLightMode = canvas.linemap.isLightMode;
        const symbolScale = canvas.linemap.symbolScale;
        const labelFont = canvas.linemap.labelFont;
        const labelFonts = Object.fromEntries((CONFIG.linemap.labelFonts as string[]).map(f => [f, f]));

        return { isLightMode, symbolScale, labelFont, labelFonts };
    }

    static async handleSubmit(event, form, formData) {
        canvas.linemap.isLightMode = !!form.elements.isLightMode.value;
        canvas.linemap.symbolScale = parseFloat(form.elements.symbolScale.value) ?? 1.0;
        const font = form.elements.labelFont?.value;
        if (CONFIG.linemap.labelFonts.includes(font)) canvas.linemap.labelFont = font;
        canvas.linemap.redraw();
        await canvas.linemap.dataChanged();

        this.render();
    }

    static instance: ScenePropertiesApp;

    static activate() {
        this.instance = this.instance ?? new ScenePropertiesApp();
        this.instance.render(true);
    }
}
