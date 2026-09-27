import { FateActor } from "../../actor/FateActor";
import { SheetSetup } from "../sheet-setup/SheetSetup";
import { TemplateActorSettings } from "./TemplateActorSettings";
import { LEGACY_SYSTEM_ID, SYSTEM_ID, TEMPLATES_PATH } from "../../../constants";

export class TemplateActorPicker extends TemplateActorSettings {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.format("SIDEBAR.Create", { type: game.i18n.localize("DOCUMENT.Actor") }),
            template: `${TEMPLATES_PATH}/apps/template-actors-picker.hbs`,
            id: "template-actor-picker",
            resizable: true,
            classes: ["fatex", "fatex-sheet", "fatex-sheet--app"],
            width: 860,
        });
    }

    async getData() {
        const data: any = await super.getData();

        data.AppTitle = game.i18n.format("SIDEBAR.Create", { type: game.i18n.localize("DOCUMENT.Actor") });

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".fatex-js-choose-template").on("click", (e) => this._chooseTemplate.call(this, e));
        html.find(".fatex-js-empty-template").on("click", (e) => this._emptyTemplate.call(this, e));
        html.find(".fatex-js-template-header-button").on("click", () => this._openSettings.call(this));
    }

    /*************************
     * EVENT HANDLER
     *************************/

    async _openSettings() {
        CONFIG.FateX.applications.templateSettings?.render(true);
    }

    async _emptyTemplate(e) {
        e.preventDefault();
        e.stopPropagation();

        const data: Record<string, any> = {
            name: game.i18n.localize("FAx.Template.Picker.Empty"),
            type: "character",
        };

        if (this.options.folder) {
            data.folder = this.options.folder;
        }

        // Create actor without template data
        const newActor = await FateActor._create(data, { renderSheet: true });

        if (newActor) {
            // Open sheet setup by default for new empty actors
            const sheetSetup = new SheetSetup(newActor, {});
            sheetSetup.render(true);
        }

        await this.close();
    }

    async _chooseTemplate(e) {
        e.preventDefault();
        e.stopPropagation();

        const data = e.currentTarget.dataset;
        const templateActor = game.actors?.get(data.template);

        if (!templateActor) {
            return;
        }

        const template = templateActor.toObject();
        template.flags ??= {};

        // Legacy flags of the original "fatex" system must not be copied, otherwise the new actor would still be a template
        delete template.flags[LEGACY_SYSTEM_ID];

        const systemFlags = (template.flags[SYSTEM_ID] ??= {}) as Record<string, unknown>;

        // Add current template as a flag for later use
        systemFlags.templateActor = templateActor.id;

        // Delete id, specific flags and the actors image
        delete template._id;
        delete systemFlags.isTemplateActor;
        delete template.img;

        if (this.options.folder) {
            template.folder = this.options.folder;
        }

        // Create the real actor
        await FateActor._create(template, { renderSheet: true });
        await this.close();
    }

    async _updateObject() {
        // No update necessary
    }
}
