import { SYSTEM_ID } from "../../constants";

/**
 * Custom name for fate points ("Energia Amaldiçoada", "Power Points", "Nen"…), typed in the system settings.
 *
 * Every text that mentions fate points has a version written around that name (the {fatePoints} placeholder),
 * listed in CONFIG.FateX.fatePointTexts (text key → template key). With a name set, those texts are swapped in the
 * loaded translations, so the sheet, the extras, the chat cards, the warnings and the modules that add their own
 * texts to that list (FateX Continued Themes does it in its init hook) all use the name. With the setting empty,
 * the original texts are back. The templates avoid singular/plural and abbreviations ("costs 2 Nen", "spent 1 Nen"),
 * so any name reads right.
 */
export class FatePointsNameFeature {
    static readonly SETTING = "fatePointsName";

    /** Texts as they were loaded, before any swap (undefined: the key only exists in the English fallback) */
    private static originals = new Map<string, unknown>();

    static hooks() {
        // After every package's init (where modules add their texts), with the translations loaded
        Hooks.once("setup", () => this.apply());
        // Again once everything is ready, for texts added later
        Hooks.once("ready", () => this.apply());
    }

    /**
     * The name typed in the settings ("" when empty: the original texts are used)
     */
    static get customName(): string {
        let value: unknown = "";

        try {
            value = game.settings.get(SYSTEM_ID, this.SETTING);
        } catch (_err) {
            value = "";
        }

        // Plain text only: tags (and stray angle brackets) are dropped
        return String(value ?? "")
            .replace(/<[^>]*>/g, "")
            .replace(/[<>]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Swaps the fate point texts for the ones with the custom name (or brings the original ones back)
     */
    static apply({ render = false }: { render?: boolean } = {}) {
        const i18n = game.i18n as any;
        const translations = i18n?.translations;

        if (!translations) {
            return;
        }

        const name = this.customName;

        const texts = (CONFIG.FateX?.fatePointTexts ?? {}) as Record<string, string>;

        for (const [key, templateKey] of Object.entries(texts)) {
            if (!this.originals.has(key)) {
                this.originals.set(key, this.read(translations, key));
            }

            const template = name
                ? this.read(translations, templateKey) ?? this.read(i18n._fallback, templateKey)
                : null;

            if (typeof template === "string") {
                // (split/join: a "$" in the name is kept as typed)
                this.write(translations, key, template.split("{fatePoints}").join(name));
                continue;
            }

            const original = this.originals.get(key);

            if (original === undefined) {
                this.remove(translations, key);
            } else {
                this.write(translations, key, original);
            }
        }

        if (render) {
            this.renderOpenSheets();
        }
    }

    /**
     * Open character, group and item sheets show the new texts right away (chat cards already sent keep theirs,
     * until they are updated by +2 or a reroll)
     */
    static renderOpenSheets() {
        for (const app of Object.values(ui.windows ?? {}) as any[]) {
            const document = app?.document ?? app?.object;

            if (document instanceof Actor || document instanceof Item) {
                app.render(false);
            }
        }
    }

    /*************************
     * TRANSLATION ACCESS
     * Keys may be stored nested ("FAx" → "Sheet" → "FatePoints") or flat ("FAx.Sheet.FatePoints"), as a module's
     * language file can have them.
     *************************/

    private static read(translations, key: string) {
        if (!translations) {
            return undefined;
        }

        if (Object.prototype.hasOwnProperty.call(translations, key)) {
            return translations[key];
        }

        return foundry.utils.getProperty(translations, key);
    }

    private static write(translations, key: string, value: unknown) {
        if (Object.prototype.hasOwnProperty.call(translations, key)) {
            translations[key] = value;
        } else {
            foundry.utils.setProperty(translations, key, value);
        }
    }

    private static remove(translations, key: string) {
        if (Object.prototype.hasOwnProperty.call(translations, key)) {
            delete translations[key];
            return;
        }

        const parts = key.split(".");
        const leaf = parts.pop() as string;
        const parent = parts.length ? foundry.utils.getProperty(translations, parts.join(".")) : translations;

        if (parent && typeof parent === "object") {
            delete parent[leaf];
        }
    }
}
