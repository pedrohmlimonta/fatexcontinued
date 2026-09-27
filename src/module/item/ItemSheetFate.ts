import { TEMPLATES_PATH } from "../../constants";

export class ItemSheetFate extends (foundry.appv1.sheets.ItemSheet as AnyConstructor) {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["fatex", "fatex-sheet", "fatex-sheet--item", "sheet"],
            scrollY: [".fatex-desk__content"],
            width: 575,
        });
    }

    async getData() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any = await super.getData();

        // Provide the item's system data under both names used by the templates
        data.data = this.item.system;
        data.system = data.data;

        // Set owner name if possible
        data.isOwnedBy = this.actor ? this.actor.name : false;

        // Let every item type manipulate its own sheet data
        data = (await CONFIG.FateX.itemClasses[this.item.type]?.getSheetData(data, this)) || data;

        // Let every component manipulate an items' sheet data
        for (const sheetComponent in CONFIG.FateX.sheetComponents.item) {
            if (Object.prototype.hasOwnProperty.call(CONFIG.FateX.sheetComponents.item, sheetComponent)) {
                data = await CONFIG.FateX.sheetComponents.item[sheetComponent].getSheetData(data, this);
            }
        }

        return data;
    }

    get template() {
        return `${TEMPLATES_PATH}/item/${this.item.type}-sheet.hbs`;
    }

    activateListeners(html) {
        super.activateListeners(html);

        for (const sheetComponent in CONFIG.FateX.sheetComponents.item) {
            if (Object.prototype.hasOwnProperty.call(CONFIG.FateX.sheetComponents.item, sheetComponent)) {
                CONFIG.FateX.sheetComponents.item[sheetComponent].activateListeners(html, this);
            }
        }

        // Let every item type add its own sheet listeners
        CONFIG.FateX.itemClasses[this.item.type]?.activateListeners(html, this);
    }
}
