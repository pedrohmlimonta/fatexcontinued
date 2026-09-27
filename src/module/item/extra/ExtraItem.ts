import { StuntItem } from "../stunt/StuntItem";

export class ExtraItem extends StuntItem {
    static get documentName() {
        return "extra";
    }

    static async getActorSheetData(sheetData) {
        await this.enrichDescriptions(sheetData.extras);

        return sheetData;
    }
}
