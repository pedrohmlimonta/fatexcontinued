import { SYSTEM_ID } from "../../constants";

/**
 * Registers all settings of the system.
 * Names and hints are passed as localization keys, Foundry localizes them when rendering the settings.
 */
export class FateXSettings {
    static registerSettings() {
        game.settings.register(SYSTEM_ID, "enableAlphaFeatures", {
            name: "FAx.Settings.System.Alpha.Name",
            hint: "FAx.Settings.System.Alpha.Hint",
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        });

        game.settings.register(SYSTEM_ID, "autoUpdateTokenName", {
            name: "FAx.Settings.autoUpdateTokenName.Name",
            hint: "FAx.Settings.autoUpdateTokenName.Hint",
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });

        game.settings.register(SYSTEM_ID, "guildCodexMagicSystemEnabled", {
            name: "FAx.Settings.magicSystemEnabled.Name",
            hint: "FAx.Settings.magicSystemEnabled.Hint",
            scope: "world",
            config: true,
            default: false,
            requiresReload: true,
            type: Boolean,
        });

        game.settings.register(SYSTEM_ID, "enable2d6RollMode", {
            name: "FAx.Settings.enable2d6RollMode.Name",
            hint: "FAx.Settings.enable2d6RollMode.Hint",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
        });

        // Internal: last FateX Continued version which migrated this world
        game.settings.register(SYSTEM_ID, "worldMigrationVersion", {
            name: "World migration version",
            scope: "world",
            config: false,
            default: "",
            type: String,
        });
    }
}
