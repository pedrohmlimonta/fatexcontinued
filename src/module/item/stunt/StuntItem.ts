import { BaseItem } from "../BaseItem";
import { marked } from "marked";

export class StuntItem extends BaseItem {
    static documentName = "stunt";

    static async getActorSheetData(sheetData) {
        await this.enrichDescriptions(sheetData.stunts);

        return sheetData;
    }

    static async getSheetData(sheetData) {
        sheetData.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            sheetData.system?.description ?? "",
            {
                secrets: sheetData.item?.isOwner ?? false,
                relativeTo: sheetData.item,
            },
        );

        return sheetData;
    }

    /**
     * Adds the rendered (enriched) description to each item.
     * The item's own system data is never modified, so enriched HTML can't be saved back by accident.
     */
    static async enrichDescriptions(items) {
        const TextEditor = foundry.applications.ux.TextEditor.implementation;

        for (const item of items ?? []) {
            const description = item.system?.description ?? "";

            item.enrichedDescription = await TextEditor.enrichHTML(description, {
                secrets: item.isOwner,
                relativeTo: item,
            });

            item.markdownDescription = CONFIG.FateX.global.useMarkdown ? marked(description) : "";
        }
    }

    static activateActorSheetListeners(html, sheet) {
        super.activateActorSheetListeners(html, sheet);

        html.find(".fatex-js-item-collapse").on("click", (e) => this._onCollapseToggle.call(this, e, sheet));
    }

    /*************************
     * EVENT HANDLER
     *************************/

    static async _onCollapseToggle(e, sheet) {
        e.preventDefault();

        const dataset = e.currentTarget.dataset;
        const item = sheet.actor.items.get(dataset.item);

        if (item) {
            await item.update(
                {
                    "system.collapsed": !item.system.collapsed,
                },
                {},
            );
        }
    }
}
