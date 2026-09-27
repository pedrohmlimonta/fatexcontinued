/**
 * Item type holding the reference to an actor or a token in a scene
 */
import { FateActor } from "../actor/FateActor";
import { ReferenceItemData } from "../item/ItemTypes";
import { groupType } from "../actor/ActorTypes";
import { GroupSheet } from "../actor/sheets/GroupSheet";

/**
 * Returns all references of actors or tokens to be rendered as inlineSheets based on a given groupType
 * Defaults to type "manual" which consists of manually added actors and tokens
 */
export function getReferencesByGroupType(
    groupType: groupType | string = "manual",
    actor?: FateActor,
): ReferenceItemData[] {
    switch (groupType) {
        case "scene":
            return [];
        case "encounter":
            return [];
        default: {
            if (!actor) {
                return [];
            }

            const items = actor.items.filter((i) => ["actorReference", "tokenReference"].includes(i.type));
            return items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        }
    }
}

export function getImageFromReference(reference: ReferenceItemData): string {
    if (reference.type === "actorReference") {
        const actor = game.actors?.get(reference.system?.id);

        return actor?.img ?? CONST.DEFAULT_TOKEN;
    }

    if (reference.type === "tokenReference") {
        const scene = game.scenes?.get(reference.system?.scene);
        const token = scene?.tokens.get(reference.system?.id);

        return token?.texture?.src ?? CONST.DEFAULT_TOKEN;
    }

    return CONST.DEFAULT_TOKEN;
}

/**
 * Returns all currently opened group sheets
 */
export function getOpenGroupSheets(): GroupSheet[] {
    return Object.values(ui.windows ?? {}).filter((app): app is GroupSheet => app instanceof GroupSheet);
}

export function renderGroupSheetsByGroupType(groupType: groupType) {
    for (const groupSheet of getOpenGroupSheets()) {
        if (groupSheet.actor?.type !== "group") {
            continue;
        }

        if ((groupSheet.actor.system.groupType || "manual") == groupType) {
            groupSheet.render();
        }
    }
}
