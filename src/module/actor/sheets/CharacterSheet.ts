/**
 * FateX base class for all actor sheets.
 * Defines what information on the actor's sheet may be rendered.
 *
 * The sheet still uses the Application V1 framework (foundry.appv1), which Foundry VTT v14 keeps available
 * until v16. The markup and css classes are unchanged, so themes and add-on modules keep working.
 */
import { SheetSetup } from "../../applications/sheet-setup/SheetSetup";
import type { GroupSheet } from "./GroupSheet";
import { BaseItem } from "../../item/BaseItem";
import { TEMPLATES_PATH } from "../../../constants";

export interface CharacterSheetOptions {
    type?: string;
    combatant?: any;
    referenceID?: string;
    group?: GroupSheet;
    [key: string]: any;
}

export class CharacterSheet extends (foundry.appv1.sheets.ActorSheet as AnyConstructor) {
    /**
     * Defines the default options for all FateX actor sheets.
     * This consists of things like css classes, the sheet type and the tab configuration.
     */
    static get defaultOptions() {
        const sheetOptions: Partial<CharacterSheetOptions> = {
            classes: ["fatex", "fatex-sheet", "sheet"],
            tabs: [
                {
                    navSelector: ".fatex-js-tabs-navigation",
                    contentSelector: ".fatex-js-tab-content",
                    initial: "skills",
                },
            ],
            scrollY: [".fatex-desk__content"],
            width: 900,
            type: "full",
        };

        return foundry.utils.mergeObject(super.defaultOptions, sheetOptions);
    }

    get template(): string {
        if (!game.user?.isGM && this.actor.limited) {
            return `${TEMPLATES_PATH}/actor/limited.hbs`;
        }

        return `${TEMPLATES_PATH}/actor/character.hbs`;
    }

    /**
     * Activates DOM-listeners on elements to react to different events like "click" or "change".
     * ItemTypes and sheet components can activate their own listeners and receive the sheet as a reference.
     *
     * @param html
     *  The rendered html content of the created actor sheet.
     */
    activateListeners(html: JQuery) {
        super.activateListeners(html);

        // Custom sheet listeners for every ItemType
        for (const itemType in CONFIG.FateX.itemClasses) {
            CONFIG.FateX.itemClasses[itemType]?.activateActorSheetListeners(html, this);
        }

        // Custom sheet listeners for every SheetComponent
        for (const sheetComponent in CONFIG.FateX.sheetComponents.actor) {
            CONFIG.FateX.sheetComponents.actor[sheetComponent].activateListeners(html, this);
        }

        html.find(".fatex-js-item-to-chat").on("click", (e) => {
            BaseItem._onItemSendToChat(e, this);
        });
    }

    /**
     * Returns all data that is needed to render the sheet.
     * All variables are available inside the handelbar templates.
     *
     * Items are split into their categories for easier access.
     *
     * returns {Object}
     */
    async getData() {
        // Basic fields and flags
        let data: any = {
            owner: this.actor.isOwner,
            options: this.options,
            editable: this.isEditable,
            isTemplateActor: this.actor.isTemplateActor,
            isEmptyActor: !this.actor.items.size,
            isToken: !!this.token && !this.token.actorLink,
            config: CONFIG.FateX,
        };

        // Add actor, actor data and item
        data.actor = foundry.utils.duplicate(this.actor);
        data.data = data.actor.system;
        data.items = this.actor.items.map((item) => item);
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

        // Add filtered item lists for easier access
        data.stress = data.items.filter((item) => item.type === "stress");
        data.aspects = data.items.filter((item) => item.type === "aspect");
        data.skills = data.items.filter((item) => item.type === "skill");
        data.stunts = data.items.filter((item) => item.type === "stunt");
        data.extras = data.items.filter((item) => item.type === "extra");
        data.consequences = data.items.filter((item) => item.type === "consequence");

        data.enrichedBiography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            this.actor.system.biography?.value ?? "",
            {
                secrets: this.actor.isOwner,
                relativeTo: this.actor,
            },
        );

        // Allow every item type to add data to the actorsheet
        for (const itemType in CONFIG.FateX.itemClasses) {
            data = await CONFIG.FateX.itemClasses[itemType].getActorSheetData(data, this);
        }

        return data;
    }

    /**
     * Adds FateX specific buttons to the sheets header bar.
     *
     * @returns Application.HeaderButton[]
     *   A list of buttons to be rendered.
     */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();

        // Edit mode button to toggle which interactive elements are visible on the sheet.
        const canConfigure = game.user?.isGM || this.actor.isOwner;

        if (this.options.editable && canConfigure) {
            // noinspection JSUnusedGlobalSymbols
            buttons.unshift(
                {
                    class: "fatex-toggle-edit-mode",
                    label: game.i18n.localize("FAx.Sheet.Buttons.EditMode"),
                    icon: "fas fa-edit",
                    onclick: (e: JQuery.ClickEvent) => this._onToggleEditMode(e),
                },
                {
                    class: "fatex-open-sheet-manager",
                    label: game.i18n.localize("FAx.Sheet.Buttons.SheetSetup"),
                    icon: "fas fa-tools",
                    onclick: (e: JQuery.ClickEvent) => this._onOpenSheetSetup(e),
                },
            );
        }

        return buttons;
    }

    /**
     * OnClick handler for the previously declaried "Edit mode" button.
     * Toggles the 'fatex-js-edit-mode' class for the sheet container.
     */
    _onToggleEditMode(e: JQuery.ClickEvent): void {
        e.preventDefault();

        const target = $(e.currentTarget);
        const app = target.parents(".app");
        const html = app.find(".window-content");

        html.toggleClass("fatex-js-edit-mode");
    }

    /**
     * OnClick handler for the previously declaried "Sheet setup" button.
     * Opens a new sheet setup instance for this sheet.
     */
    _onOpenSheetSetup(e: JQuery.ClickEvent): void {
        e.preventDefault();

        const sheetSetup = new SheetSetup(this.actor, {});
        sheetSetup.render(true);
    }

    /** @override */
    async _onDrop(event: DragEvent) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

        if (data?.type === "JournalEntry" || data?.type === "JournalEntryPage") {
            return this._onDropJournalEntry(data);
        }

        return super._onDrop(event);
    }

    /**
     * Creates a new extra based on a dropped journal entry (or journal entry page).
     */
    async _onDropJournalEntry(data: any) {
        if (!this.isEditable) {
            return false;
        }

        const journal = await fromUuid(data.uuid);

        if (!journal) {
            return false;
        }

        const pages = journal.documentName === "JournalEntryPage" ? [journal] : journal.pages?.contents ?? [];
        const description = pages
            .filter((page) => page.type === "text")
            .map((page) => page.text?.content ?? "")
            .join("");

        const extraData = {
            type: "extra",
            name: journal.name ?? "",
            system: {
                description,
            },
        };

        return await this.actor.createEmbeddedDocuments("Item", [extraData]);
    }

    /**
     * Saves and restores the focus of a child element
     * This is needed because FVTT only handles this for inputs that belong to the form itself
     *
     * @param force
     * @param options
     */
    async _render(force, options) {
        // Identify the focused element and save its caret position
        const focusedElement: string = this.element.find(":focus").data("focus-id");
        const selection = window.getSelection();
        const position = selection?.focusOffset ?? 0;

        // Render the application
        await super._render(force, options);

        // Restore focus and caret position
        if (focusedElement) {
            const element = this.element.find(`[data-focus-id="${focusedElement}"]`)[0];

            if (!element) {
                return;
            }

            try {
                const textNode = element.childNodes[0];

                if (textNode) {
                    const range = document.createRange();
                    range.setStart(textNode, Math.min(position, textNode.textContent?.length ?? 0));
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            } catch (_err) {
                // Restoring the caret position is best effort only
            }

            element.focus();
        }
    }
}
