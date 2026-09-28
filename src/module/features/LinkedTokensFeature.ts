// @ts-nocheck
import { SYSTEM_ID } from "../../constants";
import { Migration } from "../migration/Migration";

/**
 * Character tokens linked to their actor ("Link Actor Data"): the token and the actor in the Actors tab share the
 * same sheet, so fate points, stress, consequences and everything else stay the same on both.
 *
 * - New characters are created with a linked prototype token (see FateActor._preCreate).
 * - Existing characters and the character tokens already placed on scenes are linked once, by the active GM, the
 *   first time the world is opened with this feature (and again whenever the setting is turned on).
 *
 * Actors that should have independent tokens (e.g. several mooks from the same actor) can still be unlinked in
 * their prototype token configuration; the setting can also be turned off.
 */
export class LinkedTokensFeature {
    static hooks() {
        Hooks.once("ready", async () => {
            try {
                await this.linkExistingIfNeeded();
            } catch (err) {
                console.error("FateX | Linking character tokens failed.", err);
            }
        });
    }

    static get enabled(): boolean {
        return !!game.settings.get(SYSTEM_ID, "linkCharacterTokens");
    }

    /**
     * Called when the setting changes. Turning it on links the existing characters and tokens.
     */
    static async onSettingChange(value: boolean) {
        if (!value || !Migration.isResponsibleGM) {
            return;
        }

        await this.linkExistingCharacters();
        await game.settings.set(SYSTEM_ID, "linkedTokensMigrated", true);
    }

    static async linkExistingIfNeeded() {
        if (!Migration.isResponsibleGM || !this.enabled) {
            return;
        }

        if (game.settings.get(SYSTEM_ID, "linkedTokensMigrated")) {
            return;
        }

        await this.linkExistingCharacters();
        await game.settings.set(SYSTEM_ID, "linkedTokensMigrated", true);
    }

    /**
     * Links the prototype token of every character actor and every unlinked character token placed on a scene.
     * Changes that were made only on an unlinked token are replaced by the actor's sheet.
     */
    static async linkExistingCharacters() {
        const isCharacter = (actor) => actor?.type === "character";

        const actorUpdates = (game.actors?.contents ?? [])
            .filter((actor) => isCharacter(actor) && !actor.prototypeToken?.actorLink)
            .map((actor) => ({ _id: actor.id, "prototypeToken.actorLink": true }));

        if (actorUpdates.length) {
            await CONFIG.Actor.documentClass.updateDocuments(actorUpdates);
        }

        let linkedTokens = 0;

        for (const scene of game.scenes?.contents ?? []) {
            const tokenUpdates = (scene.tokens?.contents ?? [])
                .filter((token) => !token.actorLink && token.actorId && isCharacter(game.actors?.get(token.actorId)))
                .map((token) => ({ _id: token.id, actorLink: true }));

            if (tokenUpdates.length) {
                await scene.updateEmbeddedDocuments("Token", tokenUpdates);
                linkedTokens += tokenUpdates.length;
            }
        }

        if (actorUpdates.length || linkedTokens) {
            ui.notifications?.info(
                game.i18n.format("FAx.Settings.LinkCharacterTokens.Done", {
                    actors: actorUpdates.length,
                    tokens: linkedTokens,
                }),
            );
        }

        return { actors: actorUpdates.length, tokens: linkedTokens };
    }
}
