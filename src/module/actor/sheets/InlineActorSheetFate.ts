import { CharacterSheet } from "./CharacterSheet";
import { TEMPLATES_PATH } from "../../../constants";

/**
 * A compact, non pop-out character sheet which is rendered inside of an actor group sheet.
 */
export class InlineActorSheetFate extends CharacterSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            group: undefined,
            width: "auto",
            height: "auto",
            tabs: [
                {
                    navSelector: ".fatex-js-tabs-navigation",
                    contentSelector: ".fatex-js-tab-content",
                    initial: "aspects",
                },
            ],
        });
    }

    async getData() {
        const data = await super.getData();

        if (this.options.referenceID) {
            data.referenceID = this.options.referenceID;
        }

        if (this.options.combatant) {
            data.defeated = this.options.combatant.defeated;
            data.hidden = this.options.combatant.hidden;
        }

        return data;
    }

    get id() {
        return this.options.id ? this.options.id : `inline-app-${this.appId}`;
    }

    get popOut() {
        return false;
    }

    get template() {
        return `${TEMPLATES_PATH}/inline-sheet/character.hbs`;
    }

    /**
     * Renders the inline sheet and resolves once it was injected into its group.
     *
     * Circumvents DocumentSheet#render() as it wouldn't allow InlineActorSheets
     * to update for actors which the user has no view-permission for.
     */
    async renderInline(force = false, options = {}) {
        if (this.object?.apps) {
            this.object.apps[this.appId] = this;
        }

        await this._render(force, options);

        return this;
    }

    render(force = false, options = {}) {
        this.renderInline(force, options).catch((err) => {
            console.error("FateX | Failed to render an inline actor sheet.", err);
        });

        return this;
    }

    /**
     * Injects the inline sheet into the actor group it belongs to.
     */
    _injectHTML(html: JQuery) {
        const group = this.options.group;
        const container = group?.element?.find?.(".fatex-js-actor-group-sheets");

        if (container?.length) {
            container.append(html);
        } else if (group?.id) {
            $(`#${group.id} .fatex-js-actor-group-sheets`).append(html);
        }

        this._element = html;
    }
}
