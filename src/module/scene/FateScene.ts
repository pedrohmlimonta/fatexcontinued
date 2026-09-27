import { renderGroupSheetsByGroupType } from "../helper/ActorGroupHelper";
import { SYSTEM_ID } from "../../constants";

export class FateScene extends Scene {
    /**
     * Re-render actor groups whenever tokens of a scene change.
     * Replaces the _onUpdateEmbeddedDocuments override, which is no longer called since Foundry VTT v11.
     */
    _onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId) {
        super._onUpdateDescendantDocuments(parent, collection, documents, changes, options, userId);

        if (collection === "tokens" && game.settings.get(SYSTEM_ID, "enableAlphaFeatures")) {
            renderGroupSheetsByGroupType("scene");
            renderGroupSheetsByGroupType("manual");
        }
    }
}
