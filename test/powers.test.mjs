/**
 * Powers: extras grouped as the stunts of another extra (their power), and the extra's description in its roll card.
 * Run `npm run build` first, then `npm test`.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEnvironment, DIST, SYSTEM_ID } from "./harness/foundry-env.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (element) => element?.textContent.replace(/\s+/g, " ").trim();

function sheetClass(env, name) {
    const registration = env.log.sheetRegistrations.find((r) => r.action === "register" && r.sheetClass.name === name);
    assert.ok(registration, `sheet ${name} is registered`);
    return registration.sheetClass;
}

async function createHero(env, extras = [], name = "Hero") {
    const FateActor = env.CONFIG.Actor.documentClass;
    const actor = await FateActor.create({
        name,
        type: "character",
        items: [
            { _id: "skillAthletics01", name: "Athletics", type: "skill", system: { rank: 2 } },
            { _id: "skillFight000001", name: "Fight", type: "skill", system: { rank: 3 } },
            ...extras,
        ],
    });
    env.game.actors.set(actor.id, actor);
    return actor;
}

/** Renders the character sheet into the document with its listeners, like Foundry does */
async function renderCharacterSheet(env, actor, { editMode = false } = {}) {
    const CharacterSheet = sheetClass(env, "CharacterSheet");
    const sheet = new CharacterSheet(actor);
    const data = await sheet.getData();
    const html = await env.renderTemplate(sheet.template, data);

    const container = env.window.document.createElement("section");
    container.className = `window-content${editMode ? " fatex-js-edit-mode" : ""}`;
    container.innerHTML = html;
    env.window.document.body.append(container);
    sheet.activateListeners(env.window.$(container));

    return { sheet, data, container };
}

async function renderExtraSheet(env, item) {
    const ExtraSheet = sheetClass(env, "ExtraSheet");
    const sheet = new ExtraSheet(item);
    const data = await sheet.getData();
    const html = await env.renderTemplate(sheet.template, data);
    const container = env.window.document.createElement("div");
    container.innerHTML = html;
    return { data, html, container };
}

/** The Extras tab as a list: [name, [stunt names]] for each extra on the top level */
function extrasTab(container) {
    const grid = container.querySelector('[data-tab="extras"] .fatex-item-grid');
    return [...grid.children]
        .filter((element) => element.classList.contains("fatex-extra"))
        .map((element) => [
            text(element.querySelector(":scope > header .fatex-headline__text")),
            [...element.querySelectorAll(":scope > .fatex-power__stunts > .fatex-extra--stunt")].map((stunt) =>
                text(stunt.querySelector(":scope > header .fatex-headline__text")),
            ),
        ]);
}

/** A power (Unlimited) with two stunts, an extra on its own and a few broken links */
const POWER_EXTRAS = [
    { _id: "extraPower000001", name: "Unlimited", type: "extra", sort: 100, system: { description: "<p>Infinity.</p>" } },
    {
        _id: "extraStuntRed001",
        name: "Red",
        type: "extra",
        sort: 300,
        system: { power: "extraPower000001", skill: "Fight", bonus: 2, description: "<p>Repels.</p>" },
    },
    { _id: "extraStuntBlue01", name: "Blue", type: "extra", sort: 200, system: { power: "extraPower000001" } },
    { _id: "extraMoney000001", name: "Money", type: "extra", sort: 400 },
    { _id: "extraOrphan00001", name: "Orphan", type: "extra", sort: 500, system: { power: "extraDeleted0001" } },
    { _id: "extraSelf0000001", name: "Self", type: "extra", sort: 600, system: { power: "extraSelf0000001" } },
    { _id: "extraDeep0000001", name: "Deep", type: "extra", sort: 700, system: { power: "extraStuntRed001" } },
];

describe("powers: extras grouped as stunts of a power", () => {
    let env;

    before(async () => {
        assert.ok(fs.existsSync(path.join(DIST, "system.js")), "run `npm run build` before the tests");
        env = createEnvironment();
        await env.init();
        await env.ready();
    });

    test("extras belong to no power by default", async () => {
        const actor = await createHero(env, [{ _id: "extraPlain000001", name: "Horse", type: "extra" }]);
        assert.equal(actor.items.get("extraPlain000001").system.power, "");
    });

    test("the Extras tab lists each power with its stunts under it; broken links show the extra on its own", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        const { container, data } = await renderCharacterSheet(env, actor);

        assert.deepEqual(extrasTab(container), [
            ["Unlimited 2 stunts", ["Blue", "Red"]],
            ["Money", []],
            ["Orphan", []],
            ["Self", []],
            ["Deep", []],
        ]);
        assert.equal(data.extras.length, 7, "the flat list is still there");

        const power = container.querySelector('.fatex-extra--power[data-item-id="extraPower000001"]');
        assert.ok(power, "the power is marked");
        assert.match(text(power.querySelector(":scope > .fatex-item-description")), /Infinity/);
        assert.equal(text(power.querySelector(".fatex-extra__power-tag")), "2 stunts");

        // The stunts look like extras, with a smaller headline and without the "add a stunt" button
        const red = power.querySelector('.fatex-extra--stunt[data-item-id="extraStuntRed001"]');
        assert.ok(red.querySelector(":scope > header").classList.contains("fatex-headline--power-stunt"));
        assert.equal(red.querySelector(".fatex-js-extra-add-stunt"), null);
        assert.ok(red.querySelector('.fatex-js-extra-roll[data-item="extraStuntRed001"]'), "a stunt still rolls");
        assert.match(text(red.querySelector(".fatex-item-description")), /Repels/);
        assert.equal(red.querySelector(":scope > header").dataset.itemId, "extraStuntRed001", "it can be dragged to sort");

        // Every extra on the top level can get stunts
        const tops = [...container.querySelectorAll(".fatex-item-grid > .fatex-extra")];
        assert.ok(tops.every((top) => top.querySelector(":scope > header .fatex-js-extra-add-stunt")));
        assert.equal(container.querySelectorAll(".fatex-extra__power-tag").length, 1, "only powers have the tag");
        container.remove();

        // A power whose own link points to itself is still a power
        const loop = await createHero(env, [
            { _id: "extraLoop0000001", name: "Loop", type: "extra", sort: 1, system: { power: "extraLoop0000001" } },
            { _id: "extraLoopStunt01", name: "Spin", type: "extra", sort: 2, system: { power: "extraLoop0000001" } },
        ]);
        const looped = await renderCharacterSheet(env, loop);
        assert.deepEqual(extrasTab(looped.container), [["Loop 1 stunt", ["Spin"]]]);
        looped.container.remove();
    });

    test("collapsing a power hides its description and its stunts", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        await actor.items.get("extraPower000001").update({ "system.collapsed": true });
        const { container } = await renderCharacterSheet(env, actor);

        const power = container.querySelector('.fatex-extra--power[data-item-id="extraPower000001"]');
        assert.equal(power.querySelector(".fatex-power__stunts"), null);
        assert.equal(power.querySelector(".fatex-item-description"), null);
        assert.equal(text(power.querySelector(".fatex-extra__power-tag")), "2 stunts", "the tag still counts them");
        container.remove();
    });

    test("the stunt button creates a stunt in the power, and opens a collapsed power", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        await actor.items.get("extraMoney000001").update({ "system.collapsed": true });
        const { container } = await renderCharacterSheet(env, actor, { editMode: true });

        const creates = env.log.creates.length;
        container.querySelector('.fatex-js-extra-add-stunt[data-item="extraMoney000001"]').click();
        await wait();

        assert.equal(env.log.creates.length, creates + 1);
        const { data, options } = env.log.creates.at(-1);
        assert.deepEqual(plain(data), [
            { name: "New stunt", type: "extra", sort: 9000000, system: { power: "extraMoney000001" } },
        ]);
        assert.equal(options.renderSheet, true, "its sheet opens, like a new extra's");
        assert.equal(actor.items.get("extraMoney000001").system.collapsed, false, "the power opened");

        const stunt = actor.items.find((item) => item.name === "New stunt");
        assert.equal(stunt.system.power, "extraMoney000001");
        const again = await renderCharacterSheet(env, actor);
        assert.deepEqual(extrasTab(again.container)[1], ["Money 1 stunt", ["New stunt"]]);

        // A stunt can't have stunts (only one level), even through the handler
        const ExtraItem = env.CONFIG.FateX.itemClasses.extra;
        const event = { preventDefault() {}, stopPropagation() {}, currentTarget: { dataset: { item: stunt.id } } };
        await ExtraItem._onAddStunt(event, again.sheet);
        assert.equal(env.log.creates.length, creates + 1, "nothing created");
        container.remove();
        again.container.remove();
    });

    test("the extra's sheet chooses its power among the character's other extras", async () => {
        const actor = await createHero(env, POWER_EXTRAS);

        // An extra on its own: every other extra on the top level can be its power
        const money = await renderExtraSheet(env, actor.items.get("extraMoney000001"));
        const select = money.container.querySelector('select[name="system.power"]');
        assert.ok(select, "power select rendered");
        assert.deepEqual(
            [...select.options].map((option) => [option.value, option.textContent]),
            [
                ["", "— None (extra on its own) —"],
                ["extraPower000001", "Unlimited (2 stunts)"],
                ["extraOrphan00001", "Orphan"],
                ["extraSelf0000001", "Self"],
                ["extraDeep0000001", "Deep"],
            ],
        );
        assert.equal(select.value, "", "on its own");
        assert.match(money.container.textContent, /Power/);
        assert.match(money.container.textContent, /Any extra that isn't a stunt can be a power/);

        // A stunt has its power selected
        const red = await renderExtraSheet(env, actor.items.get("extraStuntRed001"));
        assert.equal(red.container.querySelector('select[name="system.power"]').value, "extraPower000001");

        // A broken link selects nothing (saving the sheet clears it)
        const orphan = await renderExtraSheet(env, actor.items.get("extraOrphan00001"));
        assert.equal(orphan.container.querySelector('select[name="system.power"]').value, "");

        // A power keeps its stunts: no select, it says how many it has
        const power = await renderExtraSheet(env, actor.items.get("extraPower000001"));
        assert.equal(power.container.querySelector('select[name="system.power"]'), null);
        assert.match(text(power.container.querySelector(".fatex-extra-power-info")), /This extra is a power with 2 stunts/);

        // An extra outside a character has no power
        const ItemClass = env.CONFIG.Item.documentClass;
        const loose = new ItemClass({ _id: "extraWorld000001", name: "Loose", type: "extra" });
        const world = await renderExtraSheet(env, loose);
        assert.equal(world.data.powerSetting, null);
        assert.equal(world.container.querySelector('select[name="system.power"]'), null);
    });

    test("deleting a power asks whether its stunts stay as extras or go with it", async () => {
        const deleteThrough = async (answer) => {
            const actor = await createHero(env, POWER_EXTRAS);
            const { container } = await renderCharacterSheet(env, actor, { editMode: true });
            env.window.__dialogWait = answer;
            container.querySelector('.fatex-js-extra-delete[data-item="extraPower000001"]').click();
            await wait();
            container.remove();
            return actor;
        };

        // Only the power: its stunts stay, on their own
        let actor = await deleteThrough("power");
        const dialog = env.log.notifications.filter((n) => n[0] === "dialog").at(-1)[1];
        assert.equal(dialog.window.title, "Delete Unlimited");
        assert.match(dialog.content, /<strong>Unlimited<\/strong> is a power with 2 stunts/);
        assert.deepEqual(
            plain(dialog.buttons.map((button) => [button.action, button.label])),
            [
                ["power", "Only the power"],
                ["all", "The power and its stunts"],
                ["cancel", "Cancel"],
            ],
        );
        assert.equal(actor.items.get("extraPower000001"), undefined);
        assert.equal(actor.items.get("extraStuntRed001").system.power, "");
        assert.equal(actor.items.get("extraStuntBlue01").system.power, "");
        assert.equal(actor.items.get("extraDeep0000001").system.power, "extraStuntRed001", "other links untouched");

        // The power and its stunts
        actor = await deleteThrough("all");
        for (const id of ["extraPower000001", "extraStuntRed001", "extraStuntBlue01"]) {
            assert.equal(actor.items.get(id), undefined, `${id} deleted`);
        }
        assert.ok(actor.items.get("extraMoney000001"), "the other extras stay");

        // Cancelled or closed: nothing happens
        for (const answer of ["cancel", null]) {
            actor = await deleteThrough(answer);
            assert.ok(actor.items.get("extraPower000001"));
            assert.equal(actor.items.get("extraStuntRed001").system.power, "extraPower000001");
        }

        // An extra without stunts is deleted with the usual confirmation
        actor = await createHero(env, POWER_EXTRAS);
        const { container } = await renderCharacterSheet(env, actor, { editMode: true });
        env.window.__dialogAnswer = true;
        container.querySelector('.fatex-js-extra-delete[data-item="extraMoney000001"]').click();
        await wait();
        assert.equal(actor.items.get("extraMoney000001"), undefined);
        assert.match(env.log.notifications.filter((n) => n[0] === "dialog").at(-1)[1].window.title, /Delete Money/);
        env.window.__dialogAnswer = undefined;
        container.remove();
    });

    test("a stunt's roll card names its power and shows its description under the roll, in the same message", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        await actor.items.get("extraStuntRed001").update({
            "system.description": '<p>Repels <strong>everything</strong> @UUID[JournalEntry.abc]{Notes}</p>',
        });
        const { container } = await renderCharacterSheet(env, actor);

        const before = env.log.chatMessages.length;
        env.setNextDiceResults([1, 0, 0, 0]);
        container.querySelector('.fatex-extra-roll[data-item="extraStuntRed001"]').click();
        await wait();

        assert.equal(env.log.chatMessages.length, before + 1, "a single message");
        const message = env.log.chatMessages.at(-1);
        const extra = message.flags[SYSTEM_ID].chatCard.rolls[0].options.extra;
        assert.deepEqual(plain(extra), {
            name: "Red",
            bonus: 2,
            power: "Unlimited",
            description:
                '<p>Repels <strong>everything</strong> <a class="content-link" data-uuid="JournalEntry.abc">Notes</a></p>',
        });

        const card = env.window.document.createElement("div");
        card.innerHTML = message.content;
        assert.equal(text(card.querySelector(".fatex-roll__extra__power")), "Unlimited");
        assert.equal(text(card.querySelector(".fatex-roll__extra__name")), "Red");
        assert.match(message.content, /fatex-roll__total">\+6</, "1 (dice) + 3 (skill) + 2 (stunt)");
        const description = card.querySelector(".fatex-rollWrapper > .fatex-roll__description");
        assert.ok(description, "the description is in the roll card");
        assert.ok(
            card.querySelector(".fatex-roll").compareDocumentPosition(description) &
                env.window.Node.DOCUMENT_POSITION_FOLLOWING,
            "under the roll",
        );
        assert.equal(description.querySelector("strong").textContent, "everything");
        assert.ok(description.querySelector('a.content-link[data-uuid="JournalEntry.abc"]'), "links are enriched");

        // +2 and reroll keep it
        env.game.messages.set(message.id, message);
        const element = env.window.document.createElement("li");
        element.className = "chat-message message";
        element.dataset.messageId = message.id;
        element.innerHTML = message.content;
        env.window.document.body.append(element);
        env.Hooks.callAll("renderChatMessageHTML", message, element, {});
        element.querySelector('button[data-action="increase"]').click();
        await wait();
        assert.match(message.content, /fatex-roll__total">\+8</);
        assert.match(message.content, /class="fatex-roll__description"><p>Repels <strong>everything<\/strong>/);
        assert.match(message.content, /fatex-roll__extra__power">Unlimited</);

        env.setNextDiceResults([-1, -1, 0, 0]);
        element.querySelector('button[data-action="reroll"]').click();
        await wait();
        assert.match(message.content, /fatex-roll__total">\+5</, "-2 (dice) + 3 (skill) + 2 (stunt) + 2 (+2)");
        assert.match(message.content, /class="fatex-roll__description"><p>Repels <strong>everything<\/strong>/);
        assert.match(message.content, /fatex-roll__extra__power">Unlimited</);
        assert.equal(env.log.chatMessages.length, before + 1, "still a single message");
        element.remove();
        container.remove();
    });

    test("the card shows the description of any extra, rendered without secrets, and nothing when it's empty", async () => {
        const actor = await createHero(env, [
            { _id: "extraSword000001", name: "Sword", type: "extra", system: { skill: "Fight", description: "<p>Sharp.</p>" } },
            { _id: "extraEmpty000001", name: "Empty", type: "extra", system: { skill: "Fight", description: "<p>&nbsp;</p>" } },
            { _id: "extraNone0000001", name: "None", type: "extra", system: { skill: "Fight" } },
            {
                _id: "extraImage000001",
                name: "Image",
                type: "extra",
                system: { skill: "Fight", description: '<p><img src="icons/sword.webp"></p>' },
            },
            {
                _id: "extraSecret00001",
                name: "Secret",
                type: "extra",
                system: {
                    skill: "Fight",
                    description: '<p>Glows.</p><section class="secret" id="secret-1"><p>Cursed by the GM</p></section>',
                },
            },
        ]);
        const TextEditor = env.foundry.applications.ux.TextEditor.implementation;
        const enrich = TextEditor.enrichHTML;
        const calls = [];
        TextEditor.enrichHTML = async (content, options) => {
            calls.push({ content, options });
            return enrich(content, options);
        };

        try {
            const { container } = await renderCharacterSheet(env, actor);
            const roll = async (id) => {
                env.setNextDiceResults([0, 0, 0, 0]);
                container.querySelector(`.fatex-extra-roll[data-item="${id}"]`).click();
                await wait();
                return env.log.chatMessages.at(-1);
            };

            calls.length = 0;
            let message = await roll("extraSword000001");
            assert.match(message.content, /class="fatex-roll__description"><p>Sharp\.<\/p><\/div>/);
            assert.equal(message.content.match(/fatex-roll__description/g).length, 1);
            const card = env.window.document.createElement("div");
            card.innerHTML = message.content;
            assert.equal(text(card.querySelector(".fatex-roll__extra")), "Sword", "an extra on its own names no power");
            const call = calls.find((c) => c.content === "<p>Sharp.</p>");
            assert.ok(call, "enriched for the card");
            assert.equal(call.options.secrets, false, "secrets stay out of the chat");
            assert.equal(call.options.relativeTo, actor.items.get("extraSword000001"));

            for (const id of ["extraEmpty000001", "extraNone0000001"]) {
                message = await roll(id);
                assert.doesNotMatch(message.content, /fatex-roll__description/, `${id}: no description block`);
                assert.equal(message.flags[SYSTEM_ID].chatCard.rolls[0].options.extra.description, undefined);
            }

            message = await roll("extraImage000001");
            assert.match(message.content, /fatex-roll__description"><p><img src="icons\/sword\.webp"><\/p>/, "an image counts");

            // The secret part stays on the sheet only
            message = await roll("extraSecret00001");
            assert.match(message.content, /fatex-roll__description"><p>Glows\.<\/p><\/div>/);
            assert.doesNotMatch(message.content, /Cursed by the GM/);
            assert.doesNotMatch(JSON.stringify(message.flags), /Cursed by the GM/, "not in the stored roll either");
            container.remove();
        } finally {
            TextEditor.enrichHTML = enrich;
        }

        // Markdown descriptions (world setting) are shown like on the sheet, also without secrets
        env.CONFIG.FateX.global.useMarkdown = true;
        try {
            const markdown = await createHero(env, [
                {
                    _id: "extraMarkdown001",
                    name: "Notes",
                    type: "extra",
                    system: {
                        skill: "Fight",
                        description: 'Very **sharp** @UUID[Item.abc]{Forge}\n\n<section class="secret">GM eyes only</section>',
                    },
                },
            ]);
            const { container } = await renderCharacterSheet(env, markdown);
            env.setNextDiceResults([0, 0, 0, 0]);
            container.querySelector('.fatex-extra-roll[data-item="extraMarkdown001"]').click();
            await wait();
            const message = env.log.chatMessages.at(-1);
            assert.match(
                message.content,
                /fatex-roll__description"><p>Very <strong>sharp<\/strong> <a class="content-link" data-uuid="Item\.abc">Forge<\/a><\/p>/,
            );
            assert.doesNotMatch(message.content, /GM eyes only/);
            assert.doesNotMatch(JSON.stringify(message.flags), /GM eyes only/);
            container.remove();
        } finally {
            env.CONFIG.FateX.global.useMarkdown = false;
        }
    });

    test("powers stay one level deep, even through a sheet left open or a macro", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        const warnings = () => env.log.notifications.filter((n) => n[0] === "warn").map((n) => n[1]);
        const money = actor.items.get("extraMoney000001");

        // Money's sheet was opened while it had no stunts; meanwhile it got one
        const stale = await renderExtraSheet(env, money);
        assert.ok(stale.container.querySelector('select[name="system.power"]'), "the select was offered then");
        await actor.createEmbeddedDocuments("Item", [
            { _id: "extraCoin0000001", name: "Coin", type: "extra", system: { power: "extraMoney000001" } },
        ]);

        // Saving that sheet with a power keeps Money a power; the other changes are saved
        await money.update({ name: "Wealth", "system.power": "extraPower000001" });
        assert.equal(money.name, "Wealth");
        assert.equal(money.system.power, "", "still a power");
        assert.equal(
            warnings().at(-1),
            "Money is a power with 1 stunt, so it can't become a stunt of another power. The other changes were saved.",
            "named as it was before this change",
        );
        const sheet = await renderCharacterSheet(env, actor);
        assert.deepEqual(extrasTab(sheet.container)[1], ["Wealth 1 stunt", ["Coin"]]);
        sheet.container.remove();

        // A stunt can't get stunts, also through updateEmbeddedDocuments (nested changes)
        await actor.updateEmbeddedDocuments("Item", [{ _id: "extraOrphan00001", system: { power: "extraStuntRed001" } }]);
        assert.equal(actor.items.get("extraOrphan00001").system.power, "extraDeleted0001", "unchanged");
        assert.equal(warnings().at(-1), "Red is a stunt, so it can't have stunts of its own. The other changes were saved.");

        // Valid changes go through without warnings
        const count = warnings().length;
        await actor.items.get("extraOrphan00001").update({ "system.power": "extraPower000001" });
        assert.equal(actor.items.get("extraOrphan00001").system.power, "extraPower000001");
        await actor.items.get("extraStuntRed001").update({ "system.power": "" });
        assert.equal(actor.items.get("extraStuntRed001").system.power, "");
        await actor.items.get("extraSelf0000001").update({ "system.bonus": 1 });
        // An extra whose own power is gone is on its own, so it can be a power
        await actor.createEmbeddedDocuments("Item", [
            { _id: "extraLost0000001", name: "Lost", type: "extra", system: { power: "extraGone0000001" } },
        ]);
        await actor.items.get("extraStuntBlue01").update({ "system.power": "extraLost0000001" });
        assert.equal(actor.items.get("extraStuntBlue01").system.power, "extraLost0000001");
        assert.equal(warnings().length, count);

        // Changes written with flat keys are handled the same way
        const ExtraItem = env.CONFIG.FateX.itemClasses.extra;
        const changed = { "system.power": "extraStuntBlue01", "system.bonus": 2 };
        ExtraItem.keepPowersOneLevel(actor.items.get("extraSelf0000001"), changed);
        assert.deepEqual(changed, { "system.bonus": 2 });
        assert.equal(warnings().at(-1), "Blue is a stunt, so it can't have stunts of its own. The other changes were saved.");
    });

    test("cards of older rolls, without a description, look as before", async () => {
        const actor = await createHero(env, POWER_EXTRAS);
        const { container } = await renderCharacterSheet(env, actor);
        env.setNextDiceResults([0, 0, 0, 0]);
        container.querySelector('.fatex-extra-roll[data-item="extraStuntRed001"]').click();
        await wait();
        const message = env.log.chatMessages.at(-1);
        assert.match(message.content, /fatex-roll__extra__power/);
        assert.match(message.content, /fatex-roll__description/);

        // The same card as stored by 2.0.4 (no description, no power)
        const card = message.flags[SYSTEM_ID].chatCard;
        delete card.rolls[0].options.extra.description;
        delete card.rolls[0].options.extra.power;
        env.game.messages.set(message.id, message);
        const element = env.window.document.createElement("li");
        element.className = "chat-message message";
        element.dataset.messageId = message.id;
        element.innerHTML = message.content;
        env.window.document.body.append(element);
        env.Hooks.callAll("renderChatMessageHTML", message, element, {});
        element.querySelector('button[data-action="increase"]').click();
        await wait();
        assert.doesNotMatch(message.content, /fatex-roll__description/);
        assert.doesNotMatch(message.content, /fatex-roll__extra__power/);
        assert.match(message.content, /fatex-roll__extra__name">Red</);
        element.remove();
        container.remove();
    });
});

describe("powers (Português)", () => {
    test("tab, sheet, button and deletion are translated", async () => {
        const env = createEnvironment({ language: "pt-BR" });
        await env.init();
        await env.ready();

        const actor = await createHero(env, POWER_EXTRAS);
        const { container } = await renderCharacterSheet(env, actor, { editMode: true });
        assert.deepEqual(extrasTab(container)[0], ["Unlimited 2 façanhas", ["Blue", "Red"]]);
        assert.equal(
            container.querySelector('.fatex-js-extra-add-stunt[data-item="extraMoney000001"]').title,
            "Adicionar uma façanha a este poder",
        );

        container.querySelector('.fatex-js-extra-add-stunt[data-item="extraMoney000001"]').click();
        await wait();
        assert.equal(env.log.creates.at(-1).data[0].name, "Nova façanha");
        const again = await renderCharacterSheet(env, actor);
        assert.equal(text(again.container.querySelector('[data-item-id="extraMoney000001"] .fatex-extra__power-tag')), "1 façanha");

        const sheet = await renderExtraSheet(env, actor.items.get("extraOrphan00001"));
        assert.match(sheet.container.textContent, /Poder/);
        assert.equal(sheet.container.querySelector('select[name="system.power"]').options[0].textContent, "— Nenhum (extra independente) —");
        assert.match(sheet.container.textContent, /Qualquer extra que não seja façanha pode ser um poder/);
        const power = await renderExtraSheet(env, actor.items.get("extraPower000001"));
        assert.match(text(power.container.querySelector(".fatex-extra-power-info")), /Este extra é um poder com 2 façanhas/);

        env.window.__dialogWait = "cancel";
        container.querySelector('.fatex-js-extra-delete[data-item="extraPower000001"]').click();
        await wait();
        const dialog = env.log.notifications.filter((n) => n[0] === "dialog").at(-1)[1];
        assert.equal(dialog.window.title, "Excluir Unlimited");
        assert.match(dialog.content, /é um poder com 2 façanhas\. Excluir só o poder deixa as façanhas na ficha como extras independentes/);
        assert.deepEqual(
            plain(dialog.buttons.map((button) => button.label)),
            ["Só o poder", "O poder e as façanhas", "Cancelar"],
        );
        container.remove();
        again.container.remove();
    });
});
