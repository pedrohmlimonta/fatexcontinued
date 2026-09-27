import { renderGroupSheetsByGroupType } from "../helper/ActorGroupHelper";
import { SYSTEM_ID } from "../../constants";

export class FateCombat extends Combat {
    _onDelete(options, userId) {
        super._onDelete(options, userId);

        if (game.settings.get(SYSTEM_ID, "enableAlphaFeatures")) {
            renderGroupSheetsByGroupType("encounter");
        }
    }
}
