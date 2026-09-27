import { InlineActorSheetFate } from "./InlineActorSheetFate";
import { getReferencesByGroupType } from "../../helper/ActorGroupHelper";
import type { FateActor } from "../FateActor";
import type { ReferenceItemData } from "../../item/ItemTypes";
import Sortable, { SortableEvent } from "sortablejs";
import { TEMPLATES_PATH } from "../../../constants";

/**
 * Represents a single actor group
 */
export class GroupSheet extends (foundry.appv1.sheets.ActorSheet as AnyConstructor) {
    public inlineSheets: InlineActorSheetFate[];
    private _inlineRenderId: number;

    /**
     * Initialize inlineSheets as an empty array of sheets
     */
    constructor(object: FateActor, options = {}) {
        super(object, options);

        /**
         * Inline sheets that are rendered by this actor group instance
         */
        this.inlineSheets = [];
        this._inlineRenderId = 0;
    }

    /**
     * Sets the default options for every actor group sheet
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["fatex", "fatex-sheet", "sheet", "actor_group_overview", "actor_group_overview--front"],
            resizable: true,
            template: `${TEMPLATES_PATH}/actor/group.hbs`,
            dragDrop: [{ dropSelector: null }],
            scrollY: [".fatex-desk__content"],
        });
    }

    get template(): string {
        return `${TEMPLATES_PATH}/actor/group.hbs`;
    }

    async getData() {
        // Basic fields and flags
        const data: any = {
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
        data.data = data.actor;
        data.items = this.actor.items.map((i) => foundry.utils.duplicate(i));
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

        // Create list of available tokens in the current scene for manual groups
        if (this.actor.type == "group" && (this.actor.system.groupType || "manual") == "manual") {
            const viewedSceneId = canvas?.scene?.id;
            const usedTokenReferences = this.actor.items.filter(
                (i) => i.type === "tokenReference" && i.system.scene === viewedSceneId,
            );
            const usedTokenReferencesMap: string[] = usedTokenReferences.map((token) => token.system.id);

            if (canvas?.scene) {
                data.availableTokens = canvas.scene.tokens
                    .filter((token) => !token.isLinked && !usedTokenReferencesMap.includes(token.id || ""))
                    .map((token) => ({ _id: token.id, id: token.id, name: token.name, img: token.texture?.src }));
            }
        }

        return data;
    }

    activateListeners(html: JQuery) {
        super.activateListeners(html);

        html.find(`.fatex__actor_group__createToken`).on("click", (e: JQuery.ClickEvent) =>
            this._onCreateTokenReference.call(this, e),
        );
        html.find(`.fatex__actor_group__sheet__navigation a`).on("click", (e: JQuery.ClickEvent) =>
            this._onChangeGroupNavigation.call(this, e),
        );

        // Custom sheet listeners for every ItemType
        for (const itemType in CONFIG.FateX.itemClasses) {
            CONFIG.FateX.itemClasses[itemType]?.activateActorSheetListeners(html, this);
        }

        // Custom sheet listeners for every SheetComponent
        for (const sheetComponent in CONFIG.FateX.sheetComponents.actor) {
            CONFIG.FateX.sheetComponents.actor[sheetComponent].activateListeners(html, this);
        }
    }

    /**
     * Adds sortableJS handlers to groups.
     *
     * Saves manual group order by sorting embedded entities.
     * Saves scene/encounter group order by using sortables integrated localstorage sorting
     */
    addSortableJSHandler(html: JQuery) {
        const container = html.find(".fatex-js-actor-group-sheets")[0];

        if (this.actor.type != "group" || !container) return;

        if ((this.actor.system.groupType || "manual") == "manual") {
            Sortable.create(container, {
                animation: 150,
                removeOnSpill: true,
                onEnd: (e: SortableEvent) => this.sortInlineSheets.call(this, e),
                onSpill: (e: SortableEvent) => this.spillInlineSheet.call(this, e),
            });

            return;
        }

        Sortable.create(container, {
            group: ["groupSort", this.actor.id].join("-"),
            animation: 150,
        });
    }

    async spillInlineSheet(event: SortableEvent) {
        const itemId = event.item.dataset.id;

        if (itemId && this.actor.items.has(itemId)) {
            await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
        }
    }

    async sortInlineSheets(event: SortableEvent) {
        const itemIDs: string[] = Array.from(event.to.children)
            .map((e) => (e as HTMLElement).dataset.id ?? "")
            .filter((id) => id && this.actor.items.has(id));

        const updateData = itemIDs.map((id, index) => ({
            _id: id,
            sort: 100000 + index,
        }));

        await this.actor.updateEmbeddedDocuments("Item", updateData);
    }

    /**
     * Remove some of the default header buttons for group sheets
     */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();

        return buttons.filter((b) => !["configure-token", "configure-sheet"].includes(b.class));
    }

    /**
     * Unregisters (and removes) all inline sheets which were created by this instance
     */
    _clearInlineSheets() {
        for (const inlineSheet of this.inlineSheets) {
            if (inlineSheet.actor?.apps) {
                delete inlineSheet.actor.apps[inlineSheet.appId];
            }

            inlineSheet.element?.remove?.();
        }

        this.inlineSheets = [];
    }

    /**
     * Delete all inline sheets that were created by this instance before closing the window
     */
    async close(options = {}) {
        this._clearInlineSheets();

        return super.close(options);
    }

    /**
     * Render InlineActorSheets after the group itself was rendered
     * @param force
     * @param options
     */
    async _render(force = false, options = {}) {
        await super._render(force, options);

        if (this.actor.type !== "group" || !this.element?.length) {
            return;
        }

        // The previous inline sheets were removed from the DOM by the re-render
        const renderId = ++this._inlineRenderId;
        this._clearInlineSheets();

        const references = getReferencesByGroupType(this.actor.system.groupType, this.actor);

        for (const reference of references) {
            // A newer render of this group started in the meantime
            if (renderId !== this._inlineRenderId) {
                return;
            }

            try {
                if (reference.type === "actorReference") {
                    await this.renderInlineActor(reference, renderId);
                } else if (reference.type === "tokenReference") {
                    await this.renderInlineToken(reference, renderId);
                }
            } catch (err) {
                console.error("FateX | Failed to render an inline sheet of an actor group.", err);
            }
        }

        if (renderId !== this._inlineRenderId) {
            return;
        }

        const scrollTop = this._scrollPositions?.[".fatex-desk__content"];

        if (scrollTop) {
            const content = this.element.find(".fatex-desk__content")[0];

            if (content) {
                content.scrollTop = scrollTop;
            }
        }

        // Add sortable handler after rendering for all sub-sheets is finished
        this.addSortableJSHandler(this.element.find(".window-content"));
    }

    /**
     * Creates and renders a new InlineActorSheet based on an actor reference.
     * An actor is referenced by his actor id
     */
    async renderInlineActor(reference: ReferenceItemData, renderId = this._inlineRenderId) {
        const actor = game.actors?.get(reference.system?.id);

        if (!actor || !(actor as FateActor).isVisibleByPermission) {
            return;
        }

        const actorSheet = new InlineActorSheetFate(actor, { referenceID: reference._id ?? reference.id, group: this });
        await actorSheet.renderInline(true);

        this._addInlineSheet(actorSheet, renderId);
    }

    /**
     * Keeps track of a rendered inline sheet, or discards it if a newer render of this group started meanwhile.
     */
    _addInlineSheet(sheet: InlineActorSheetFate, renderId: number) {
        if (renderId === this._inlineRenderId) {
            this.inlineSheets.push(sheet);
            return;
        }

        if (sheet.actor?.apps) {
            delete sheet.actor.apps[sheet.appId];
        }

        sheet.element?.remove?.();
    }

    /**
     * Creates and renders a new InlineActorSheet based on a token reference.
     * A token is referenced by a combination of the scene where its placed and its token id
     */
    async renderInlineToken(reference: ReferenceItemData, renderId = this._inlineRenderId) {
        const scene = game.scenes?.get((reference.system as any)?.scene);
        const tokenDocument = scene?.tokens.get(reference.system?.id);
        const actor = tokenDocument?.actor;

        if (!actor) {
            return;
        }

        const tokenSheet = new InlineActorSheetFate(actor, {
            referenceID: reference._id ?? reference.id,
            group: this,
            token: tokenDocument,
        });
        await tokenSheet.renderInline(true);

        this._addInlineSheet(tokenSheet, renderId);
    }

    /**
     * Create a new ownedItem of type ActorReference based on a given actor uuid
     * @param actorUUID
     */
    async _createActorReference(actorUUID: string) {
        const actor = (await fromUuid(actorUUID)) as FateActor;

        if (!actor) {
            console.error("FateX | DEBUG: No actor found for this UUID. Aborting.");
            return;
        }

        // Check if character is already present
        if (this.actor.items.find((i) => i.type === "actorReference" && i.system.id === actor.id)) {
            console.log("FateX | DEBUG: The actor is already referenced in this group. Aborting.");
            return;
        }

        // Only allow character-type actors to be referenced
        if (actor.type !== "character") {
            console.log("FateX | DEBUG: The actor is not of type 'character'. Aborting.");
            return;
        }

        const itemData = {
            name: ["actorReference", actor.id].join("-"),
            type: "actorReference",
            system: {
                id: actor.id ?? "",
            },
        };

        try {
            await this.actor.createEmbeddedDocuments("Item", [itemData]);
        } catch (e) {
            console.error("FateX | DEBUG: An error occurred while creating the embedded document:", e);
        }
    }

    /**
     * Creates actor references for all character actors of a folder.
     * Accepts either a folder uuid or a folder id.
     */
    async _createActorReferencesFromFolder(folderUuidOrId: string) {
        const folder = game.folders?.get(folderUuidOrId) ?? fromUuidSync(folderUuidOrId, { strict: false });
        const actors = (folder?.contents ?? []).filter(
            (actor) => actor?.documentName === "Actor" && actor.type === "character",
        );

        for (const actor of actors) {
            await this._createActorReference(actor.uuid);
        }
    }

    /**
     * Create a new ownedItem of type tokenReference based on a given sceneID and tokenID
     */
    _createTokenReference(tokenID: string, sceneID: string): void {
        if (
            this.actor.items.find(
                (i) => i.type === "tokenReference" && i.system.id === tokenID && i.system.scene === sceneID,
            )
        ) {
            return;
        }

        const itemData = {
            name: ["tokenReference", sceneID, tokenID].join("-"),
            type: "tokenReference",
            system: {
                id: tokenID,
                scene: sceneID,
            },
        };

        this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    /*************************
     * EVENT HANDLER
     *************************/

    _onChangeGroupNavigation(e: JQuery.ClickEvent) {
        e.preventDefault();
        e.stopPropagation();

        const target = $(e.currentTarget);
        const app = target.parents(".app");

        // Re-set application classes to represent different group states
        app.removeClass(["actor_group_overview--front", "actor_group_overview--back"]);
        app.addClass(`actor_group_overview--${e.currentTarget.dataset.show}`);

        // Re-set active classes on navigation
        app.find(".fatex__actor_group__sheet__navigation a").removeClass("active");
        app.find(`.fatex__actor_group__sheet__navigation--${e.currentTarget.dataset.show}`).addClass("active");
    }

    _onCreateTokenReference(e: JQuery.ClickEvent) {
        e.preventDefault();
        e.stopPropagation();

        const tokenId = e.currentTarget.dataset.tokenId;
        const scene = canvas?.scene;

        if (!tokenId || !scene?.tokens.get(tokenId)) {
            return;
        }

        this._createTokenReference(tokenId, scene.id);
    }

    /**
     * Override of the default drop handler.
     * Handles the ability to drop actors from the sidebar into an actor group
     */
    async _onDrop(event: DragEvent) {
        let data;

        try {
            data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        } catch (err) {
            console.error("FateX | DEBUG: Error while retrieving drag-and-drop data.", err);
            return false;
        }

        if (this.actor.type != "group" || (this.actor.system.groupType || "manual") != "manual") {
            ui.notifications?.error(game.i18n.localize("FAx.ActorGroups.Notifications.ManualOnly"));
            return false;
        }

        switch (data?.type) {
            case "Actor":
                return await this._createActorReference(data.uuid);
            case "Folder":
                return await this._createActorReferencesFromFolder(data.uuid);
            case "Item":
                return this._onDropItem(event, data);
        }

        return false;
    }
}
