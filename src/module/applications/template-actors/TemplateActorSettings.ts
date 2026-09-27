import { FateActor } from "../../actor/FateActor";
import { SheetSetup } from "../sheet-setup/SheetSetup";
import { BaseItem } from "../../item/BaseItem";
import { SYSTEM_ID, TEMPLATES_PATH } from "../../../constants";

export class TemplateActorSettings extends (foundry.appv1.api.FormApplication as AnyConstructor) {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize("FAx.Settings.Templates.App.Title"),
            template: `${TEMPLATES_PATH}/apps/template-actors.hbs`,
            id: "template-actors",
            resizable: true,
            classes: ["fatex", "fatex-sheet", "fatex-sheet--app"],
            width: 860,
        });
    }

    async getData() {
        const templateActors = (game.actors?.contents ?? []).filter((actor) => (actor as FateActor).isTemplateActor);
        const filteredActors = foundry.utils.duplicate(templateActors) as Record<string, any>[];

        filteredActors.forEach((actorDocument) => {
            actorDocument.stress = actorDocument.items.filter((item) => item.type === "stress");
            actorDocument.aspects = actorDocument.items.filter((item) => item.type === "aspect");
            actorDocument.skills = actorDocument.items.filter((item) => item.type === "skill");
            actorDocument.consequences = actorDocument.items.filter((item) => item.type === "consequence");
        });

        return {
            options: this.options,
            templateActors: filteredActors,
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find(".fatex-js-create-template").on("click", (e) => this._createTemplate.call(this, e));
        html.find(".fatex-js-delete-template").on("click", (e) => this._deleteTemplate.call(this, e));
        html.find(".fatex-js-configure-template").on("click", (e) => this._configureTemplate.call(this, e));
        html.find(".fatex-js-duplicate-template").on("click", (e) => this._duplicateTemplate.call(this, e));
    }

    /*************************
     * EVENT HANDLER
     *************************/

    async _configureTemplate(e) {
        e.preventDefault();
        e.stopPropagation();

        const data = e.currentTarget.dataset;
        const template = game.actors?.get(data.template);

        if (!template) {
            return;
        }

        template.sheet?.render(true);
    }

    async _deleteTemplate(e) {
        e.preventDefault();
        e.stopPropagation();

        const data = e.currentTarget.dataset;
        const template = game.actors?.get(data.template);

        if (!template) {
            return;
        }

        const confirmed = await BaseItem.confirmDialog(
            `${game.i18n.localize("FAx.Dialog.DocumentDelete")} ${template.name}`,
            game.i18n.localize("FAx.Dialog.DocumentDeleteText"),
        );

        if (!confirmed) {
            return;
        }

        await template.delete();

        // Re-render this settings window and the picker if open
        this.render(true);
        CONFIG.FateX.applications.templatePicker?.render();
    }

    async _createTemplate(e) {
        e.preventDefault();

        const createData = {
            name: game.i18n.localize("FAx.Settings.Templates.New"),
            type: "character",
            flags: {
                [SYSTEM_ID]: {
                    isTemplateActor: true,
                },
            },
        };

        const newTemplateActor = await FateActor._create(createData, { renderSheet: true });

        if (newTemplateActor) {
            // Open sheet setup by default for new templates
            const sheetSetup = new SheetSetup(newTemplateActor, {});
            sheetSetup.render(true);
        }

        // Re-render this settings window and the picker if open
        this.render(true);
        CONFIG.FateX.applications.templatePicker?.render();
    }

    async _duplicateTemplate(e) {
        e.preventDefault();
        e.stopPropagation();

        const data = e.currentTarget.dataset;
        const original = game.actors?.get(data.template);

        if (!original) {
            return;
        }

        const template = original.toObject();

        // Delete id
        delete template._id;

        // Change name
        template.name = template.name + ` (${game.i18n.localize("FAx.Settings.Templates.Copy")})`;

        // Create new duplicate
        await Actor.create(template, { renderSheet: true });

        // Re-render this settings window and the picker if open
        this.render(true);
        CONFIG.FateX.applications.templatePicker?.render();
    }

    async _updateObject() {
        // No update necessary.
    }
}
