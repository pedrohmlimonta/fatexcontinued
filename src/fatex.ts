/**
 * FateX Continued - the Fate extended game system for Foundry VTT (v14+)
 *
 * Original author: Patrick Bauer (Daddi#2333) - https://github.com/anvil-vtt/FateX
 * FateX Continued: community continuation of FateX, updated for Foundry VTT v14.
 * Software License: MIT
 * Content License:
 *      This work is based on Fate Core System and Fate Accelerated Edition (found at http://www.faterpg.com/),
 *      products of Evil Hat Productions, LLC, developed, authored, and edited by Leonard Balsera, Brian Engard,
 *      Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, and Rob Donoghue,
 *      and licensed for our use under the Creative Commons Attribution 3.0 Unported license
 *      (http://creativecommons.org/licenses/by/3.0/).
 */

import "./styles/fatex.scss";

import { FateX } from "./config";
import { SHEET_SCOPE, SYSTEM_ID } from "./constants";
import { FateActor } from "./module/actor/FateActor";
import { CharacterSheet } from "./module/actor/sheets/CharacterSheet";
import { HandlebarsHelpers } from "./module/helper/HandlebarsHelpers";
import { TemplatePreloader } from "./module/helper/TemplatePreloader";
import { AspectSheet } from "./module/item/aspect/AspectSheet";
import { ConsequenceSheet } from "./module/item/consequence/ConsequenceSheet";
import { ExtraSheet } from "./module/item/extra/ExtraSheet";
import { FateItem } from "./module/item/FateItem";
import { SkillSheet } from "./module/item/skill/SkillSheet";
import { StressSheet } from "./module/item/stress/StressSheet";
import { StuntSheet } from "./module/item/stunt/StuntSheet";
import { TemplateActorsFeature } from "./module/features/TemplateActorsFeature";
import { GroupSheet } from "./module/actor/sheets/GroupSheet";
import { ActorGroupFeature } from "./module/features/ActorGroupFeature";
import { ReferenceSheet } from "./module/item/references/ReferenceSheet";
import { FateScene } from "./module/scene/FateScene";
import { FateCombat } from "./module/combat/FateCombat";
import { FateXSettings } from "./module/helper/Settings";
import { ChatActionsFeature } from "./module/features/ChatActionsFeature";
import { PrototypeTokenNameSyncFeature } from "./module/features/PrototypeTokenNameSyncFeature";
import { MagicSystem } from "./module/features/MagicSystem";
import { Roll2d6Feature } from "./module/features/Roll2d6Feature";
import { ACTOR_DATA_MODELS } from "./module/data/models/ActorModels";
import { ITEM_DATA_MODELS } from "./module/data/models/ItemModels";
import { Migration } from "./module/migration/Migration";

/* -------------------------------- */
/*	System initialization			*/
/* -------------------------------- */
Hooks.once("init", async () => {
    console.log(`FateX | Initializing FateX Continued (${SYSTEM_ID})`);

    // Initialise config
    CONFIG.FateX = FateX;
    CONFIG.FateX.migrateWorld = (options = {}) => Migration.migrateWorld(options);

    CONFIG.Actor.documentClass = FateActor;
    CONFIG.Item.documentClass = FateItem;
    CONFIG.Scene.documentClass = FateScene;
    CONFIG.Combat.documentClass = FateCombat;

    // System data models (replace the deprecated template.json)
    Object.assign(CONFIG.Actor.dataModels, ACTOR_DATA_MODELS);
    Object.assign(CONFIG.Item.dataModels, ITEM_DATA_MODELS);

    CONFIG.FateX.global.useMarkdown = !!game.modules.get("markdown-editor")?.active;

    // Register generic system settings
    FateXSettings.registerSettings();

    // Register HandlebarsHelpers
    HandlebarsHelpers.registerHelpers();

    const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

    // Unregister Core sheets
    DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
    DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);

    // Register FateX actor sheets
    DocumentSheetConfig.registerSheet(Actor, SHEET_SCOPE, CharacterSheet, {
        types: ["character"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Actor, SHEET_SCOPE, GroupSheet, {
        types: ["group"],
        makeDefault: true,
    });

    // Register FateX item sheets
    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, StressSheet, {
        types: ["stress"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, AspectSheet, {
        types: ["aspect"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, ConsequenceSheet, {
        types: ["consequence"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, SkillSheet, {
        types: ["skill"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, StuntSheet, {
        types: ["stunt"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, ExtraSheet, {
        types: ["extra"],
        makeDefault: true,
    });

    DocumentSheetConfig.registerSheet(Item, SHEET_SCOPE, ReferenceSheet, {
        types: ["actorReference", "tokenReference"],
        makeDefault: true,
        label: "FAx.Sheets.Reference",
    });

    // Preload all needed templates
    await TemplatePreloader.preloadHandlebarsTemplates();
});

/* -------------------------------- */
/*	Register hooks      			*/
/* -------------------------------- */
TemplateActorsFeature.hooks();
ActorGroupFeature.hooks();
ChatActionsFeature.hooks();
PrototypeTokenNameSyncFeature.hooks();
MagicSystem.hooks();
Roll2d6Feature.hooks();
Migration.hooks();

/* -------------------------------- */
/*	Webpack HMR (development only)  */
/* -------------------------------- */
if (module.hot) {
    module.hot.accept();

    if (module.hot.status() === "apply") {
        TemplatePreloader.preloadHandlebarsTemplates().then(() => {
            for (const application of Object.values(ui.windows ?? {})) {
                (application as any).render(true);
            }
        });
    }
}
