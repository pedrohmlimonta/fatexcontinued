import { DataManager } from "./DataManager";
import { BaseItem } from "../../item/BaseItem";
import { LEGACY_SYSTEM_ID, SYSTEM_ID, TEMPLATES_PATH } from "../../../constants";

const CLEAR = {
    EVERYTHING: 0,
    ASPECTS: 1,
    CONSEQUENCES: 2,
    SKILLS: 3,
    STRESS: 4,
};

const TYPES = {
    1: "aspect",
    2: "consequence",
    3: "skill",
    4: "stress",
};

export class SheetSetup extends (foundry.appv1.api.FormApplication as AnyConstructor) {
    constructor(object: any, options = {}) {
        super(object, options);

        this.actor.apps[this.appId] = this;
    }

    get actor() {
        return this.object;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize("FAx.Apps.Setup.Title"),
            template: `${TEMPLATES_PATH}/apps/sheet-setup.hbs`,
            resizable: true,
            classes: ["fatex", "fatex-sheet", "fatex-sheet--app"],
            width: 600,
            height: 700,
            scrollY: [".fatex-desk__content"],
            tabs: [
                {
                    navSelector: ".fatex-js-vertical-tabs-navigation",
                    contentSelector: ".fatex-js-vertical-tabs-content",
                },
            ],
        });
    }

    async getData() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {
            options: this.options,
            isOwnedBy: this.actor ? this.actor.name : false,

            hasAspects: !!this.actor.items.filter((i) => i.type === "aspect").length,
            hasSkills: !!this.actor.items.filter((i) => i.type === "skill").length,
            hasConsequences: !!this.actor.items.filter((i) => i.type === "consequence").length,
            hasStress: !!this.actor.items.filter((i) => i.type === "stress").length,
            hasAny: !!this.actor.items.size,
        };

        const dataManager = new DataManager();
        data.systems = await dataManager.getSystems();

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Clear actions
        html.find(".fatex-js-clear").on("click", (e) => this._onClear.call(this, e, CLEAR.EVERYTHING));
        html.find(".fatex-js-clear-stress").on("click", (e) => this._onClear.call(this, e, CLEAR.STRESS));
        html.find(".fatex-js-clear-skills").on("click", (e) => this._onClear.call(this, e, CLEAR.SKILLS));
        html.find(".fatex-js-clear-consequences").on("click", (e) => this._onClear.call(this, e, CLEAR.CONSEQUENCES));
        html.find(".fatex-js-clear-aspects").on("click", (e) => this._onClear.call(this, e, CLEAR.ASPECTS));

        // Setup actions
        html.find(".fatex-js-add-selection").on("click", (e) => this._onSetupType.call(this, e));
        html.find(".fatex-js-toggle-selection").on("click", (e) => this._onToggleType.call(this, e));
    }

    /**
     * Converts an entry of the bundled setup presets (data/<lang>/systems/*.json) into item creation data.
     * The presets use the legacy "data" key and may carry flags of the original "fatex" system.
     */
    static prepareItemData(entry: Record<string, any>) {
        const itemData = foundry.utils.deepClone(entry);

        if (itemData.data && !itemData.system) {
            itemData.system = itemData.data;
        }

        delete itemData.data;
        delete itemData._id;

        const flags = itemData.flags ?? {};

        if (flags[LEGACY_SYSTEM_ID]) {
            flags[SYSTEM_ID] = foundry.utils.mergeObject(flags[LEGACY_SYSTEM_ID], flags[SYSTEM_ID] ?? {}, {
                inplace: false,
            });
            delete flags[LEGACY_SYSTEM_ID];
        }

        itemData.flags = flags;

        return itemData;
    }

    /*************************
     * EVENT HANDLER
     *************************/

    async _onSetupType(event) {
        event.preventDefault();

        const button = $(event.currentTarget);
        const type = button.parents(".fatex-sheet-setup__section").first();
        const entries = type.find("input:checked");

        if (!entries.length) {
            return;
        }

        const itemData = entries
            .toArray()
            .map((input) => {
                if (!input.dataset.document) {
                    return null;
                }

                try {
                    return SheetSetup.prepareItemData(JSON.parse(input.dataset.document));
                } catch (err) {
                    console.error("FateX | Invalid setup preset entry.", err);
                    return null;
                }
            })
            .filter((data) => !!data);

        if (!itemData.length) {
            return;
        }

        await this.actor.createEmbeddedDocuments("Item", itemData);
        this.render(true);
    }

    async _onToggleType(event) {
        event.preventDefault();

        const button = $(event.currentTarget);
        const type = button.parents(".fatex-sheet-setup__section, .fatex-sheet-setup__group").first();
        const entries = type.find("input");

        entries.prop("checked", !entries.first().prop("checked"));
    }

    async _onClear(event, type) {
        event.preventDefault();

        // Return early to not lose items by any chance
        if (type === undefined) {
            return;
        }

        const confirmed = await BaseItem.confirmDialog(
            game.i18n.localize("FAx.Dialog.ActorClear"),
            game.i18n.localize("FAx.Dialog.ActorClearText"),
        );

        if (confirmed) {
            await this._doClear(type);
        }
    }

    async _doClear(type) {
        let items;

        if (type > 0) {
            items = this.actor.items.filter((i) => i.type === TYPES[type]);
        } else {
            items = this.actor.items.contents;
        }

        const deletions = items.map((i) => i.id || "").filter((id) => !!id);

        if (deletions.length) {
            await this.actor.deleteEmbeddedDocuments("Item", deletions);
        }

        this.render(true);
    }

    async close(options = {}) {
        if (this.actor?.apps) {
            delete this.actor.apps[this.appId];
        }

        return super.close(options);
    }

    async _updateObject() {
        // No update necessary.
    }
}
