/**
 * Smoke tests for the compiled system (dist/system.js) running against an imitation of the Foundry VTT v14 API.
 * Run `npm run build` first, then `npm test`.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEnvironment, DIST, SYSTEM_ID } from "./harness/foundry-env.mjs";

const noop = () => {};
// Values created inside the jsdom window belong to another realm, compare them as plain JSON
const plain = (value) => JSON.parse(JSON.stringify(value));
const fakeEvent = (currentTarget = {}, extra = {}) => ({
    preventDefault: noop,
    stopPropagation: noop,
    currentTarget,
    ...extra,
});

function sheetClass(env, name) {
    const registration = env.log.sheetRegistrations.find((r) => r.action === "register" && r.sheetClass.name === name);
    assert.ok(registration, `sheet ${name} is registered`);
    return registration.sheetClass;
}

async function createCharacterFromPreset(env, presetName = "core") {
    const FateActor = env.CONFIG.Actor.documentClass;
    const actor = await FateActor.create({ name: "Test Hero", type: "character" });

    // Open the sheet setup the same way the header button does
    const CharacterSheet = sheetClass(env, "CharacterSheet");
    const sheet = new CharacterSheet(actor);
    sheet._onOpenSheetSetup(fakeEvent());
    const setup = Object.values(actor.apps).find((app) => app.constructor.name === "SheetSetup");
    assert.ok(setup, "sheet setup registered on the actor");

    const data = await setup.getData();
    const html = await env.renderTemplate(`systems/${SYSTEM_ID}/templates/apps/sheet-setup.hbs`, data);
    const container = env.window.document.createElement("div");
    container.innerHTML = html;
    env.window.document.body.append(container);

    // Select every entry of the preset and add each section to the sheet
    const tab = container.querySelector(`.tab[data-tab="${presetName}"]`);
    assert.ok(tab, `preset ${presetName} is rendered`);
    for (const input of tab.querySelectorAll("input[type=checkbox]")) input.checked = true;
    for (const button of tab.querySelectorAll(".fatex-js-add-selection")) {
        await setup._onSetupType(fakeEvent(button));
    }

    container.remove();
    return { actor, sheet, setup };
}

describe("FateX Continued on the Foundry v14 API imitation", () => {
    let env;

    before(async () => {
        assert.ok(fs.existsSync(path.join(DIST, "system.js")), "run `npm run build` before the tests");
        env = createEnvironment();
        await env.init();
        await env.ready();
    });

    test("manifest is valid and consistent with the build", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(DIST, "system.json"), "utf8"));
        assert.equal(manifest.id, SYSTEM_ID);
        assert.equal(manifest.compatibility.minimum, "14");
        assert.equal(manifest.compatibility.verified, "14.368");
        assert.equal(manifest.socket, true);
        assert.deepEqual(manifest.scripts, ["system.js"]);
        assert.ok(manifest.manifest.endsWith("/releases/latest/download/system.json"));
        assert.ok(manifest.download.endsWith(`/${SYSTEM_ID}.zip`));
        assert.deepEqual(Object.keys(manifest.documentTypes.Actor), ["character", "group"]);
        assert.deepEqual(Object.keys(manifest.documentTypes.Item), [
            "stress",
            "aspect",
            "consequence",
            "skill",
            "stunt",
            "extra",
            "actorReference",
            "tokenReference",
        ]);
        assert.ok(!fs.existsSync(path.join(DIST, "template.json")), "template.json (deprecated in v14) is not shipped");
        for (const language of manifest.languages) {
            assert.ok(fs.existsSync(path.join(DIST, language.path)), `language file ${language.path}`);
        }
    });

    test("init registers document classes, data models, settings, sheets and templates", () => {
        assert.equal(env.CONFIG.Actor.documentClass.name, "FateActor");
        assert.equal(env.CONFIG.Item.documentClass.name, "FateItem");
        assert.equal(env.CONFIG.Scene.documentClass.name, "FateScene");
        assert.equal(env.CONFIG.Combat.documentClass.name, "FateCombat");
        assert.deepEqual(Object.keys(env.CONFIG.Actor.dataModels).sort(), ["character", "group"]);
        assert.equal(Object.keys(env.CONFIG.Item.dataModels).length, 8);

        for (const key of [
            "enableAlphaFeatures",
            "autoUpdateTokenName",
            "guildCodexMagicSystemEnabled",
            "enable2d6RollMode",
            "worldMigrationVersion",
        ]) {
            assert.ok(env.game.settings.settings.has(`${SYSTEM_ID}.${key}`), `setting ${key}`);
        }

        const registrations = env.log.sheetRegistrations.filter((r) => r.action === "register");
        assert.ok(
            registrations.every((r) => r.scope === "FateX"),
            "sheet scope kept as FateX for existing worlds",
        );
        assert.equal(registrations.length, 9);

        const templates = env.log.loadedTemplates;
        assert.equal(templates.length, 43);
        for (const template of templates) {
            assert.ok(template.startsWith(`systems/${SYSTEM_ID}/templates/`), template);
        }

        assert.ok(env.game.socket.listeners[`system.${SYSTEM_ID}`], "socket listener uses the new system id");
        assert.ok(env.Hooks.registered("renderChatMessageHTML") > 0);
        assert.ok(env.Hooks.registered("renderSettings") > 0);
        assert.equal(
            env.Hooks.registered("renderChatLog"),
            0,
            "no delegated chat log listeners (duplicate handler risk)",
        );
        assert.equal(typeof env.CONFIG.FateX.migrateWorld, "function");
    });

    test("data models provide template.json defaults and sanitize legacy values", async () => {
        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({
            name: "Legacy",
            type: "character",
            system: { fatepoints: { current: "5", refresh: "abc" }, biography: { value: "<p>Bio</p>" } },
            items: [
                { _id: "stress0000000001", name: "Physical", type: "stress", system: { size: "4", value: "3" } },
                { _id: "skill00000000001", name: "Fight", type: "skill", system: { rank: "3" } },
                { _id: "extra00000000001", name: "Old extra", type: "extra", system: {} },
            ],
        });

        assert.equal(actor.system.fatepoints.current, 5);
        assert.equal(actor.system.fatepoints.refresh, 3);
        assert.equal(actor.system.biography.value, "<p>Bio</p>");

        const stress = actor.items.get("stress0000000001");
        assert.equal(stress.system.size, 4);
        assert.equal(stress.system.value, 3);
        assert.equal(stress.system.labelType, 0);
        assert.equal(stress.boxes.length, 4);
        assert.equal(stress.boxes.filter((b) => b.isChecked).length, 2);

        const skill = actor.items.get("skill00000000001");
        assert.equal(skill.system.rank, 3);
        assert.equal(skill.system.options.isMagicSkill, false);
        assert.equal(skill.system.isPositive, true);

        const extra = actor.items.get("extra00000000001");
        assert.equal(extra.system.parentID, "");
        assert.equal(extra.visible, true, "extras without a parent are not treated as sub items");

        const group = await FateActor.create({ name: "Group", type: "group" });
        assert.equal(group.system.groupType, "manual");
        assert.equal(group.system.options.showArtwork, true);
    });

    test("sheet setup imports the Fate Core preset with automation flags in the new scope", async () => {
        const { actor } = await createCharacterFromPreset(env, "core");
        const types = actor.items.map((i) => i.type);

        for (const type of ["aspect", "consequence", "skill", "stress"]) {
            assert.ok(types.includes(type), `preset created ${type} items`);
        }

        const automated = actor.items.filter(
            (i) => i.flags?.[SYSTEM_ID]?.skillReferences || i.flags?.[SYSTEM_ID]?.skillReferenceSettings,
        );
        assert.ok(automated.length > 0, "preset automation flags use the fatexcontinued scope");
        assert.ok(
            actor.items.every((i) => !i.flags?.fatex),
            "no legacy flags are created",
        );
        assert.ok(
            actor.items.every((i) => !("data" in i._source)),
            "legacy data key converted to system",
        );
    });

    test("character, limited and inline sheets render with all partials", async () => {
        const { actor } = await createCharacterFromPreset(env, "core");
        await actor.createEmbeddedDocuments("Item", [
            { name: "Sword", type: "stunt", system: { description: "Hits @UUID[Actor.abc]{hard}" } },
            { name: "Horse", type: "extra", system: { description: "<p>Fast</p>" } },
        ]);

        const CharacterSheet = sheetClass(env, "CharacterSheet");
        const sheet = new CharacterSheet(actor);
        const data = await sheet.getData();
        const html = await env.renderTemplate(sheet.template, data);

        assert.match(html, /fatex-desk__aspects/);
        assert.match(html, /High Concept/);
        assert.match(html, /class="content-link"/, "stunt description is enriched");
        assert.match(html, /<p>Fast<\/p>/, "extra description rendered");
        assert.doesNotMatch(html, /undefined/);
        assert.equal(
            actor.items.find((i) => i.name === "Sword").system.description,
            "Hits @UUID[Actor.abc]{hard}",
            "item data is not mutated by enrichment",
        );

        // Limited view (was referencing a missing partial)
        env.game.user.isGM = false;
        Object.defineProperty(actor, "limited", { value: true, configurable: true });
        assert.ok(sheet.template.endsWith("/actor/limited.hbs"));
        const limitedHtml = await env.renderTemplate(sheet.template, data);
        assert.match(limitedHtml, /fatex-artwork/);
        env.game.user.isGM = true;
        delete actor.limited;

        // Inline sheet used by actor groups
        env.game.actors.set(actor.id, actor);
        const FateActor = env.CONFIG.Actor.documentClass;
        const group = await FateActor.create({
            name: "Party",
            type: "group",
            items: [{ _id: "reference0000001", name: "ref", type: "actorReference", system: { id: actor.id } }],
        });
        const GroupSheet = sheetClass(env, "GroupSheet");
        const groupSheet = new GroupSheet(group);
        const groupData = await groupSheet.getData();
        const groupHtml = await env.renderTemplate(groupSheet.template, groupData);
        assert.match(groupHtml, /fatex-js-actor-group-sheets/);
        assert.match(groupHtml, /value="manual"/);

        await groupSheet.renderInlineActor(group.items.get("reference0000001"));
        assert.equal(groupSheet.inlineSheets.length, 1);
        const inlineSheet = groupSheet.inlineSheets[0];
        assert.equal(inlineSheet.options.group, groupSheet, "the group is passed to the inline sheet");
        assert.equal(inlineSheet.popOut, false);
        const inlineData = await inlineSheet.getData();
        assert.equal(inlineData.referenceID, "reference0000001");
        const inlineHtml = await env.renderTemplate(inlineSheet.template, inlineData);
        assert.match(inlineHtml, /data-id="reference0000001"/);
        await groupSheet.close();
        assert.equal(groupSheet.inlineSheets.length, 0);
    });

    test("header buttons, edit mode and sheet setup buttons are kept", () => {
        const CharacterSheet = sheetClass(env, "CharacterSheet");
        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = new FateActor({ name: "Buttons", type: "character" });
        const sheet = new CharacterSheet(actor, { editable: true });
        const buttons = sheet._getHeaderButtons().map((b) => b.class);
        assert.deepEqual(buttons.slice(0, 2), ["fatex-toggle-edit-mode", "fatex-open-sheet-manager"]);
    });

    test("every item sheet renders", async () => {
        const { actor } = await createCharacterFromPreset(env, "core");
        await actor.createEmbeddedDocuments("Item", [
            { name: "Stunt", type: "stunt" },
            { name: "Extra", type: "extra" },
            { name: "Ref", type: "actorReference", system: { id: "abc" } },
            { name: "Tok", type: "tokenReference", system: { id: "abc", scene: "def" } },
        ]);

        const sheetsByType = {
            stress: "StressSheet",
            aspect: "AspectSheet",
            consequence: "ConsequenceSheet",
            skill: "SkillSheet",
            stunt: "StuntSheet",
            extra: "ExtraSheet",
            actorReference: "ReferenceSheet",
            tokenReference: "ReferenceSheet",
        };

        for (const [type, sheetName] of Object.entries(sheetsByType)) {
            const item = actor.items.find((i) => i.type === type);
            assert.ok(item, `item of type ${type}`);
            const SheetClass = sheetClass(env, sheetName);
            const sheet = new SheetClass(item);
            const data = await sheet.getData();
            const html = await env.renderTemplate(sheet.template, data);
            assert.ok(html.includes("fatex-desk"), `${type} sheet rendered`);
            assert.ok(!html.includes("[object Object]"), `${type} sheet has no object leaks`);
        }
    });

    test("skill rolls create chat cards with the v14 message mode and system flags", async () => {
        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({
            name: "Roller",
            type: "character",
            items: [{ _id: "skill00000000002", name: "Athletics", type: "skill", system: { rank: 2 } }],
        });
        env.game.actors.set(actor.id, actor);
        const skill = actor.items.get("skill00000000002");
        const SkillItem = env.CONFIG.FateX.itemClasses.skill;

        env.setNextDiceResults([1, 1, 0, -1]);
        await SkillItem.rollSkill({ actor }, skill, { shiftKey: false });

        const message = env.log.chatMessages.at(-1);
        assert.ok(message, "a chat message was created");
        const card = message.flags[SYSTEM_ID].chatCard;
        assert.ok(card, "chat card stored under the new flag scope");
        assert.equal(card.messageId, message.id);
        assert.deepEqual(plain(card.rolls[0].faces), [1, 1, 0, -1]);
        assert.equal(card.rolls[0].rank, 2);
        assert.equal(card.rolls[0].options.actorId, actor.id);
        assert.ok(!("actor" in card.rolls[0].options), "the actor document is not stored in the message");
        assert.equal(env.log.appliedModes.at(-1), "public");
        assert.match(message.content, /\+3/);
        assert.match(message.content, /fatex-roll-actions/);
        assert.equal(message._source.author, env.game.user.id);
        env.game.messages.set(message.id, message);

        // The +2 and reroll buttons work through renderChatMessageHTML
        const element = env.window.document.createElement("li");
        element.className = "chat-message message";
        element.dataset.messageId = message.id;
        element.innerHTML = message.content;
        env.window.document.body.append(element);
        env.Hooks.callAll("renderChatMessageHTML", message, element, {});

        element.querySelector('button[data-action="increase"]').click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(message.flags[SYSTEM_ID].chatCard.rolls[0].bonus, 2);
        assert.match(message.content, /\+5/);

        env.setNextDiceResults([-1, -1, -1, -1]);
        element.querySelector('button[data-action="reroll"]').click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const rerolled = message.flags[SYSTEM_ID].chatCard.rolls[0];
        assert.deepEqual(plain(rerolled.faces), [-1, -1, -1, -1]);
        assert.equal(rerolled.history.length, 2);
        assert.deepEqual(plain(rerolled.history[1].previousRoll), [1, 1, 0, -1]);
        element.remove();
    });

    test("in-character and gm message modes are respected", async () => {
        const local = createEnvironment({ settings: { "core.messageMode": "ic" } });
        await local.init();
        const FateActor = local.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({
            name: "IC",
            type: "character",
            items: [{ _id: "skill00000000003", name: "Will", type: "skill", system: { rank: 1 } }],
        });
        await local.CONFIG.FateX.itemClasses.skill.rollSkill({ actor }, actor.items.get("skill00000000003"), {
            shiftKey: false,
        });
        assert.equal(local.log.appliedModes.at(-1), "public");

        const gm = createEnvironment({ settings: { "core.messageMode": "gm" } });
        await gm.init();
        const GmActor = gm.CONFIG.Actor.documentClass;
        const gmActor = await GmActor.create({
            name: "GM",
            type: "character",
            items: [{ _id: "skill00000000004", name: "Lore", type: "skill", system: { rank: 1 } }],
        });
        await gm.CONFIG.FateX.itemClasses.skill.rollSkill({ actor: gmActor }, gmActor.items.get("skill00000000004"), {
            shiftKey: false,
        });
        assert.equal(gm.log.appliedModes.at(-1), "gm");
    });

    test("magic dice count a plus as two and the 2d6 mode still works", async () => {
        const local = createEnvironment({ settings: { [`${SYSTEM_ID}.guildCodexMagicSystemEnabled`]: true } });
        await local.init();
        assert.equal(local.CONFIG.Dice.terms.m?.name, "MagicDie");

        const FateActor = local.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({
            name: "Mage",
            type: "character",
            items: [
                {
                    _id: "skill00000000005",
                    name: "Magic",
                    type: "skill",
                    system: { rank: 2, options: { isMagicSkill: true } },
                },
                { _id: "skill00000000006", name: "Lore", type: "skill", system: { rank: 1 } },
            ],
        });
        local.setNextDiceResults([1, -1, 1, 0]);
        await local.CONFIG.FateX.itemClasses.skill.rollSkill({ actor }, actor.items.get("skill00000000006"), {
            shiftKey: true,
        });
        const card = local.log.chatMessages.at(-1).flags[SYSTEM_ID].chatCard;
        assert.deepEqual(plain(card.rolls[0].faces), [2, -1, 1, 0], "magic plus counts double");
        assert.equal(card.rolls[0].options.magicCount, 2);

        const twoD6 = createEnvironment({ settings: { [`${SYSTEM_ID}.enable2d6RollMode`]: true } });
        await twoD6.init();
        const Actor2 = twoD6.CONFIG.Actor.documentClass;
        const actor2 = await Actor2.create({
            name: "D6",
            type: "character",
            items: [{ _id: "skill00000000007", name: "Shoot", type: "skill", system: { rank: 1 } }],
        });
        twoD6.setNextDiceResults([5, 2]);
        await twoD6.CONFIG.FateX.itemClasses.skill.rollSkill({ actor: actor2 }, actor2.items.get("skill00000000007"), {
            shiftKey: false,
        });
        const card2 = twoD6.log.chatMessages.at(-1).flags[SYSTEM_ID].chatCard;
        assert.deepEqual(plain(card2.rolls[0].faces), [5, 2]);
        assert.match(twoD6.log.chatMessages.at(-1).content, /\+4/);
    });

    test("settings sidebar receives the template button (Application V2 markup)", () => {
        const section = env.window.document.createElement("section");
        section.innerHTML = `<section class="settings flexcol"><button type="button" data-action="openApp" data-app="configure">Configure</button></section>`;
        env.Hooks.callAll("renderSettings", {}, section, {});
        const button = section.querySelector('[data-fatex="templates"]');
        assert.ok(button, "button inserted");
        assert.equal(button.nextElementSibling?.dataset.app, "configure");
        assert.ok(!button.hasAttribute("data-action"), "does not collide with Application V2 actions");

        env.Hooks.callAll("renderSettings", {}, section, {});
        assert.equal(section.querySelectorAll('[data-fatex="templates"]').length, 1, "button is only added once");
    });

    test("template picker creates regular actors from templates", async () => {
        const FateActor = env.CONFIG.Actor.documentClass;
        const template = await FateActor.create({
            name: "PC Template",
            type: "character",
            img: "custom.png",
            flags: { [SYSTEM_ID]: { isTemplateActor: true }, fatex: { isTemplateActor: true } },
            items: [{ name: "High Concept", type: "aspect", system: { label: "High Concept" } }],
        });
        env.game.actors.set(template.id, template);
        assert.equal(template.isTemplateActor, true);
        assert.equal(template.visible, false, "templates are hidden from the sidebar");

        const picker = env.CONFIG.FateX.applications.templatePicker;
        const createdBefore = env.log.creates.length;
        await picker._chooseTemplate(fakeEvent({ dataset: { template: template.id } }));
        const created = env.log.creates.slice(createdBefore).find((c) => c.documentName === "Actor");
        assert.ok(created, "actor created");
        assert.equal(created.data.flags[SYSTEM_ID].templateActor, template.id);
        assert.ok(!("isTemplateActor" in created.data.flags[SYSTEM_ID]));
        assert.ok(!("fatex" in created.data.flags), "legacy template flag is not copied");
        assert.ok(!("img" in created.data));
        assert.equal(created.data.items.length, 1);

        const settings = env.CONFIG.FateX.applications.templateSettings;
        const data = await settings.getData();
        assert.ok(data.templateActors.some((t) => t._id === template.id));
        const html = await env.renderTemplate(`systems/${SYSTEM_ID}/templates/apps/template-actors.hbs`, data);
        assert.match(html, /PC Template/);
    });

    test("dropping a journal entry creates an extra", async () => {
        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({ name: "Reader", type: "character" });
        env.game.journal.set("journal000000001", {
            name: "Lore book",
            documentName: "JournalEntry",
            pages: { contents: [{ type: "text", text: { content: "<p>Secret</p>" } }, { type: "image" }] },
        });
        const CharacterSheet = sheetClass(env, "CharacterSheet");
        const sheet = new CharacterSheet(actor);
        const event = {
            dataTransfer: {
                getData: () => JSON.stringify({ type: "JournalEntry", uuid: "JournalEntry.journal000000001" }),
            },
        };
        await sheet._onDrop(event);
        const extra = actor.items.find((i) => i.type === "extra");
        assert.equal(extra?.name, "Lore book");
        assert.equal(extra?.system.description, "<p>Secret</p>");
    });

    test("automation reads legacy flags until the world is migrated", async () => {
        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = await FateActor.create({
            name: "Auto",
            type: "character",
            items: [
                { _id: "skill00000000008", name: "Physique", type: "skill", system: { rank: 1 } },
                {
                    _id: "stress0000000002",
                    name: "Physical",
                    type: "stress",
                    system: { size: 2 },
                    flags: {
                        fatex: {
                            skillReferences: [{ type: 1, skill: "Physique", condition: 1, operator: 4, argument: 1 }],
                        },
                    },
                },
            ],
        });
        assert.equal(actor.items.get("stress0000000002").boxes.length, 3, "legacy automation adds a box");
    });
});

describe("world migration from the original fatex system", () => {
    test("copies legacy flags and settings without deleting them", async () => {
        const env = createEnvironment({
            worldSettings: [
                { key: "fatex.enable2d6RollMode", value: "true" },
                { key: "fatex.enableAlphaFeatures", value: "true" },
                { key: "fatex.removedSetting", value: "1" },
            ],
        });
        await env.init();

        const FateActor = env.CONFIG.Actor.documentClass;
        const actor = new FateActor({
            _id: "actor00000000001",
            name: "Old template",
            type: "character",
            flags: { fatex: { isTemplateActor: true } },
            items: [
                {
                    _id: "cons000000000001",
                    name: "Mild",
                    type: "consequence",
                    flags: { fatex: { skillReferences: [{ skill: "Will", condition: 2 }] } },
                },
            ],
        });
        env.game.actors.set(actor.id, actor);

        const ChatMessage = env.classes.ChatMessage;
        const message = new ChatMessage({
            _id: "message000000001",
            content: "old",
            flags: {
                fatex: {
                    chatCard: {
                        messageId: "message000000001",
                        speaker: {},
                        rolls: [
                            {
                                id: "r1",
                                name: "Fight",
                                rank: 1,
                                faces: [0, 0, 0, 0],
                                options: { actor: { _id: "actor00000000001", name: "Big" } },
                            },
                        ],
                    },
                },
            },
        });
        env.game.messages.set(message.id, message);

        assert.equal(actor.isTemplateActor, true, "legacy flag is read before the migration");

        await env.ready();

        assert.equal(env.game.settings.get(SYSTEM_ID, "enable2d6RollMode"), true);
        assert.equal(env.game.settings.get(SYSTEM_ID, "enableAlphaFeatures"), true);
        assert.equal(env.game.settings.get(SYSTEM_ID, "worldMigrationVersion"), "2.0.0");

        assert.equal(actor.flags[SYSTEM_ID].isTemplateActor, true);
        assert.equal(actor.flags.fatex.isTemplateActor, true, "legacy flags are kept");
        assert.deepEqual(plain(actor.items.get("cons000000000001").flags[SYSTEM_ID].skillReferences), [
            { skill: "Will", condition: 2 },
        ]);

        const card = message.flags[SYSTEM_ID].chatCard;
        assert.equal(card.rolls[0].options.actorId, "actor00000000001");
        assert.ok(!("actor" in card.rolls[0].options));

        // A second run does not touch anything
        const updates = env.log.updates.length;
        await env.CONFIG.FateX.migrateWorld({ force: true });
        assert.equal(env.log.updates.length, updates);
    });

    test("new worlds are marked as migrated without notifications", async () => {
        const env = createEnvironment();
        await env.init();
        await env.ready();
        assert.equal(env.game.settings.get(SYSTEM_ID, "worldMigrationVersion"), "2.0.0");
        assert.equal(env.log.notifications.filter((n) => n[0] === "info" || n[0] === "warn").length, 0);
    });
});
