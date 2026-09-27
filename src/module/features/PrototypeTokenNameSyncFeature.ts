// @ts-nocheck
import { SYSTEM_ID } from "../../constants";

export class PrototypeTokenNameSyncFeature {
    static hooks() {
        Hooks.on("preUpdateActor", (actor, changes) => {
            if (!game.settings.get(SYSTEM_ID, "autoUpdateTokenName")) return;
            if (!("name" in changes)) return;

            if (!actor.isToken) {
                if (actor.prototypeToken.name !== actor.name) return;
                changes.prototypeToken = { ...changes.prototypeToken, name: changes.name };
            }

            if (actor.isToken) {
                const token = actor.token;
                if (!token || token.name !== actor.name) return;

                token.update({ name: changes.name });
            }
        });
    }
}
