/**
 * One-time world migration for worlds that were created with the original "fatex" system.
 *
 * FateX Continued uses the system id "fatexcontinued". Flags and world settings written by the original system
 * live under the "fatex" namespace. This migration copies them to the new namespace. It never deletes the
 * original data, so it is safe to run and can be repeated manually by a GM (browser console):
 *
 *     CONFIG.FateX.migrateWorld({ force: true })
 *
 * Until the migration ran, the system still reads the legacy flags as a fallback (see getSystemFlag).
 */
import { LEGACY_SYSTEM_ID, SYSTEM_ID } from "../../constants";

const MIGRATION_VERSION = "2.0.0";
const MESSAGE_BATCH_SIZE = 64;

type FlagTransform = (flags: Record<string, any>) => void;

export class Migration {
    static hooks() {
        Hooks.once("ready", async () => {
            try {
                await this.migrateWorldIfNeeded();
            } catch (err) {
                console.error("FateX | World migration failed.", err);
            }
        });
    }

    /**
     * Only a single connected GM must migrate the world.
     */
    static get isResponsibleGM(): boolean {
        if (!game.user?.isGM) {
            return false;
        }

        const activeGM = game.users?.activeGM;
        return activeGM ? activeGM.id === game.user.id : true;
    }

    static async migrateWorldIfNeeded() {
        if (!this.isResponsibleGM) {
            return;
        }

        const migratedVersion = game.settings.get(SYSTEM_ID, "worldMigrationVersion");

        if (migratedVersion && !foundry.utils.isNewerVersion(MIGRATION_VERSION, migratedVersion)) {
            return;
        }

        await this.migrateWorld();
    }

    /**
     * Migrates settings, actors (including their items), items, chat messages, unlinked tokens and world compendiums.
     */
    static async migrateWorld({ force = false } = {}) {
        if (!game.user?.isGM) {
            ui.notifications?.warn(game.i18n.localize("FAx.Migration.GMOnly"));
            return;
        }

        let errors = 0;
        const run = async (label: string, callback: () => Promise<unknown>) => {
            try {
                await callback();
            } catch (err) {
                errors++;
                console.error(`FateX | Migration failed for ${label}.`, err);
            }
        };

        const migrateWorldDocuments = force || this.worldHasLegacyData();

        if (migrateWorldDocuments) {
            ui.notifications?.info(game.i18n.localize("FAx.Migration.Begin"));
            console.log(`FateX | Migrating world data from "${LEGACY_SYSTEM_ID}" to "${SYSTEM_ID}"`);

            await run("world settings", () => this.migrateSettings());

            for (const actor of game.actors?.contents ?? []) {
                await run(`Actor ${actor.name} [${actor.id}]`, () => this.migrateActor(actor));
            }

            for (const item of game.items?.contents ?? []) {
                await run(`Item ${item.name} [${item.id}]`, () => this.migrateDocument(item));
            }

            await run("chat messages", () => this.migrateChatMessages());

            for (const scene of game.scenes?.contents ?? []) {
                for (const token of scene.tokens?.contents ?? []) {
                    await run(`Token ${token.name} [${token.id}] in scene ${scene.name}`, () =>
                        this.migrateTokenActor(token),
                    );
                }
            }
        }

        // World compendiums can only be inspected by loading them, which is done silently
        let migratedPacks = 0;

        for (const pack of game.packs?.contents ?? []) {
            if (pack.metadata?.packageType !== "world" || !["Actor", "Item"].includes(pack.documentName)) {
                continue;
            }

            await run(`compendium ${pack.collection}`, async () => {
                if (await this.migrateCompendium(pack)) {
                    migratedPacks++;
                }
            });
        }

        await game.settings.set(SYSTEM_ID, "worldMigrationVersion", MIGRATION_VERSION);

        if (errors) {
            ui.notifications?.warn(game.i18n.localize("FAx.Migration.CompleteWithErrors"), { permanent: true });
        } else if (migrateWorldDocuments || migratedPacks) {
            ui.notifications?.info(game.i18n.localize("FAx.Migration.Complete"));
        }
    }

    /*************************
     * DETECTION
     *************************/

    static getWorldSettings(): any[] {
        const storage = game.settings.storage?.get("world");

        if (!storage) {
            return [];
        }

        return Array.from(storage.values?.() ?? storage);
    }

    static worldHasLegacyData(): boolean {
        const hasLegacyFlags = (source) => !!this.getLegacyFlags(source);

        if (
            this.getWorldSettings().some((setting: any) =>
                String(setting?.key ?? "").startsWith(`${LEGACY_SYSTEM_ID}.`),
            )
        ) {
            return true;
        }

        for (const actor of game.actors?.contents ?? []) {
            if (hasLegacyFlags(actor._source) || (actor._source.items ?? []).some(hasLegacyFlags)) {
                return true;
            }
        }

        if ((game.items?.contents ?? []).some((item) => hasLegacyFlags(item._source))) {
            return true;
        }

        if ((game.messages?.contents ?? []).some((message) => hasLegacyFlags(message._source))) {
            return true;
        }

        for (const scene of game.scenes?.contents ?? []) {
            for (const token of scene.tokens?.contents ?? []) {
                const delta = token.delta?._source;

                if (delta && (hasLegacyFlags(delta) || (delta.items ?? []).some(hasLegacyFlags))) {
                    return true;
                }
            }
        }

        return false;
    }

    /*************************
     * SETTINGS
     *************************/

    static async migrateSettings() {
        const settings = this.getWorldSettings();
        const storedKeys = new Set(settings.map((setting) => String(setting?.key ?? "")));
        const legacyPrefix = `${LEGACY_SYSTEM_ID}.`;

        for (const setting of settings) {
            const key = String(setting?.key ?? "");

            if (!key.startsWith(legacyPrefix)) {
                continue;
            }

            const name = key.slice(legacyPrefix.length);
            const newKey = `${SYSTEM_ID}.${name}`;

            // Only migrate settings which still exist and were not changed in FateX Continued yet
            if (!game.settings.settings.has(newKey) || storedKeys.has(newKey)) {
                continue;
            }

            const raw = setting._source?.value ?? setting.value;
            let value = raw;

            if (typeof raw === "string") {
                try {
                    value = JSON.parse(raw);
                } catch (_err) {
                    value = raw;
                }
            }

            await game.settings.set(SYSTEM_ID, name, value);
            console.log(`FateX | Migrated world setting ${key} -> ${newKey}`);
        }
    }

    /*************************
     * DOCUMENTS
     *************************/

    static getLegacyFlags(source): Record<string, any> | null {
        const legacy = source?.flags?.[LEGACY_SYSTEM_ID];

        if (!legacy || typeof legacy !== "object" || foundry.utils.isEmpty(legacy)) {
            return null;
        }

        return legacy;
    }

    /**
     * Returns the new flags for a document source (legacy flags merged with already existing new flags),
     * or null if nothing has to be changed.
     */
    static getMigratedFlags(source, transform?: FlagTransform): Record<string, any> | null {
        const legacy = this.getLegacyFlags(source);

        if (!legacy) {
            return null;
        }

        const current = source.flags?.[SYSTEM_ID] ?? {};
        const migrated = foundry.utils.mergeObject(foundry.utils.deepClone(legacy), foundry.utils.deepClone(current), {
            inplace: false,
        });

        transform?.(migrated);

        if (foundry.utils.objectsEqual(migrated, current)) {
            return null;
        }

        return migrated;
    }

    static async migrateDocument(document, transform?: FlagTransform) {
        const flags = this.getMigratedFlags(document._source, transform);

        if (flags) {
            await document.update({ [`flags.${SYSTEM_ID}`]: flags }, { render: false });
        }
    }

    static getEmbeddedItemUpdates(itemSources: any[] = []) {
        return itemSources
            .map((itemSource) => {
                const flags = this.getMigratedFlags(itemSource);
                return flags ? { _id: itemSource._id, [`flags.${SYSTEM_ID}`]: flags } : null;
            })
            .filter((update) => !!update);
    }

    static async migrateActor(actor) {
        await this.migrateDocument(actor);

        const itemUpdates = this.getEmbeddedItemUpdates(actor._source.items);

        if (itemUpdates.length) {
            await actor.updateEmbeddedDocuments("Item", itemUpdates, { render: false });
        }
    }

    /**
     * Unlinked tokens store changed items and flags inside their ActorDelta.
     */
    static async migrateTokenActor(token) {
        if (token.actorLink || !token.delta) {
            return;
        }

        const delta = token.delta._source ?? {};
        const actorFlags = this.getMigratedFlags(delta);
        const itemFlags = (delta.items ?? [])
            .map((itemSource) => ({ id: itemSource._id, flags: this.getMigratedFlags(itemSource) }))
            .filter((entry) => !!entry.flags);

        // Only instantiate the synthetic actor if there is something to migrate
        if (!actorFlags && !itemFlags.length) {
            return;
        }

        const actor = token.actor;

        if (!actor) {
            return;
        }

        if (actorFlags) {
            await actor.update({ [`flags.${SYSTEM_ID}`]: actorFlags }, { render: false });
        }

        for (const { id, flags } of itemFlags) {
            const item = actor.items.get(id);

            if (item) {
                await item.update({ [`flags.${SYSTEM_ID}`]: flags }, { render: false });
            }
        }
    }

    /**
     * FateX 1.x stored the complete actor inside every roll of a chat card, only a reference is kept.
     */
    static stripActorsFromChatCard(flags: Record<string, any>) {
        for (const roll of flags?.chatCard?.rolls ?? []) {
            const actor = roll?.options?.actor;

            if (actor && typeof actor === "object") {
                roll.options.actorId ??= actor._id ?? actor.id ?? null;
                delete roll.options.actor;
            }
        }
    }

    static async migrateChatMessages() {
        let batch: Record<string, any>[] = [];

        const flush = async () => {
            if (!batch.length) {
                return;
            }

            await ChatMessage.implementation.updateDocuments(batch, { render: false });
            batch = [];
        };

        for (const message of game.messages?.contents ?? []) {
            const flags = this.getMigratedFlags(message._source, (migrated) => this.stripActorsFromChatCard(migrated));

            if (!flags) {
                continue;
            }

            batch.push({ _id: message.id, [`flags.${SYSTEM_ID}`]: flags });

            if (batch.length >= MESSAGE_BATCH_SIZE) {
                await flush();
            }
        }

        await flush();
    }

    /**
     * Migrates the documents of a world compendium. Returns true if any document had to be migrated.
     */
    static async migrateCompendium(pack): Promise<boolean> {
        const documents = await pack.getDocuments();
        const pending = documents.filter((document) => {
            if (this.getMigratedFlags(document._source)) {
                return true;
            }

            return pack.documentName === "Actor" && this.getEmbeddedItemUpdates(document._source.items).length > 0;
        });

        if (!pending.length) {
            return false;
        }

        const wasLocked = pack.locked;

        try {
            if (wasLocked) {
                await pack.configure({ locked: false });
            }

            for (const document of pending) {
                if (pack.documentName === "Actor") {
                    await this.migrateActor(document);
                } else {
                    await this.migrateDocument(document);
                }
            }
        } finally {
            if (wasLocked) {
                await pack.configure({ locked: true });
            }
        }

        return true;
    }
}
