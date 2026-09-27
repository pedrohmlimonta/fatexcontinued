import { ItemSheetFate } from "../ItemSheetFate";
import { SYSTEM_ID } from "../../../constants";

export class SkillSheet extends ItemSheetFate {
    async getData(): Promise<any> {
        const data = await super.getData();
        data.magicSystemEnabled = game.settings.get(SYSTEM_ID, "guildCodexMagicSystemEnabled");

        return data;
    }
}
