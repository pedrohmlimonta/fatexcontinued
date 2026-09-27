/**
 * Extras linked to a skill: the extra sheet chooses the skill and the bonus, the character sheet rolls it.
 * Run `npm run build` first, then `npm test`.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEnvironment, DIST, SYSTEM_ID } from "./harness/foundry-env.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

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

    return { sheet, container, html };
}

async function renderExtraSheet(env, item) {
    const ExtraSheet = sheetClass(env, "ExtraSheet");
    const sheet = new ExtraSheet(item);
    const data = await sheet.getData();
    const html = await env.renderTemplate(sheet.template, data);
    return { sheet, data, html };
}

describe("extras linked to a skill", () => {
    let env;

    before(async () => {
        assert.ok(fs.existsSync(path.join(DIST, "system.js")), "run `npm run build` before the tests");
        env = createEnvironment();
        await env.init();
        await env.ready();
    });

    test("extras get the skill and bonus fields, and legacy values are sanitized", async () => {
        const actor = await createHero(env, [
            { _id: "extraPlain000001", name: "Horse", type: "extra" },
            { _id: "extraLegacy00001", name: "Old", type: "extra", system: { skill: "Fight", bonus: "2" } },
            { _id: "extraBroken00001", name: "Broken", type: "extra", system: { bonus: "oops" } },
        ]);

        const horse = actor.items.get("extraPlain000001");
        assert.equal(horse.system.skill, "");
        assert.equal(horse.system.bonus, 0);

        const old = actor.items.get("extraLegacy00001");
        assert.equal(old.system.skill, "Fight");
        assert.equal(old.system.bonus, 2, "a bonus stored as text becomes a number");
        assert.equal(actor.items.get("extraBroken00001").system.bonus, 0, "an invalid bonus doesn't break the extra");
    });

    test("the extra sheet lists the character's skills and the bonuses", async () => {
        const actor = await createHero(env, [
            { _id: "extraSword000001", name: "Flaming Sword", type: "extra", system: { skill: "Fight", bonus: 1 } },
            { _id: "extraMissing0001", name: "Bow", type: "extra", system: { skill: "Shoot", bonus: 0 } },
        ]);

        const { data, html } = await renderExtraSheet(env, actor.items.get("extraSword000001"));
        assert.deepEqual(plain(data.skillOptions), [
            { value: "Athletics", label: "Athletics (+2)", selected: false },
            { value: "Fight", label: "Fight (+3)", selected: true },
        ]);
        assert.deepEqual(plain(data.availableBonuses), [-4, -3, -2, -1, 0, 1, 2, 3, 4]);

        const container = env.window.document.createElement("div");
        container.innerHTML = html;
        const select = container.querySelector('select[name="system.skill"]');
        assert.ok(select, "skill select rendered");
        assert.equal(select.value, "Fight");
        assert.equal(select.options[0].value, "", "the first option unlinks the skill");
        assert.match(select.options[0].textContent, /None/);

        const bonuses = [...container.querySelectorAll('.fatex-js-radio-button[data-name="system.bonus"]')];
        assert.equal(bonuses.length, 9);
        assert.deepEqual(
            bonuses.filter((b) => b.classList.contains("fatex-radio-rank--active")).map((b) => b.dataset.value),
            ["1"],
        );
        assert.ok(bonuses.every((b) => b.dataset.dtype === "Number"));
        assert.ok(
            bonuses
                .filter((b) => Number(b.dataset.value) < 0)
                .every((b) => b.classList.contains("fatex-radio-rank--negative")),
        );
        assert.match(html, /Linked skill/);
        assert.match(html, /negative values are penalties/);
        assert.doesNotMatch(html, /undefined|\[object Object\]/);

        // A skill the character doesn't have stays selected, marked as missing
        const bow = await renderExtraSheet(env, actor.items.get("extraMissing0001"));
        assert.deepEqual(plain(bow.data.skillOptions.at(-1)), {
            value: "Shoot",
            label: "Shoot - not on this character",
            selected: true,
        });
    });

    test("an extra outside a character lists the skills of every actor", async () => {
        await createHero(env, [], "Other");
        const Item = env.CONFIG.Item.documentClass;
        const item = new Item({ _id: "worldExtra000001", name: "Relic", type: "extra", system: { skill: "Lore" } });

        const { data } = await renderExtraSheet(env, item);
        const values = data.skillOptions.map((o) => o.value);
        assert.ok(values.includes("Athletics") && values.includes("Fight"));
        assert.equal(new Set(values).size, values.length, "skill names are not repeated");
        assert.deepEqual(plain(data.skillOptions.at(-1)), { value: "Lore", label: "Lore", selected: true });
    });

    test("clicking a linked extra rolls the skill with the extra's bonus", async () => {
        const actor = await createHero(env, [
            { _id: "extraSword000002", name: "Flaming Sword", type: "extra", system: { skill: "Fight", bonus: 1 } },
        ]);
        const { container } = await renderCharacterSheet(env, actor);

        const line = container.querySelector('.fatex-extra-roll[data-item="extraSword000002"]');
        assert.ok(line, "the extra shows the skill it rolls");
        assert.match(line.textContent.replace(/\s+/g, " "), /Fight \+3 bonus \+1/);
        assert.equal(line.title, "Roll Fight (+3) bonus +1");

        const messagesBefore = env.log.chatMessages.length;
        env.setNextDiceResults([1, 1, 0, -1]);
        line.click();
        await wait();

        assert.equal(env.log.chatMessages.length, messagesBefore + 1, "one roll was sent to the chat");
        const message = env.log.chatMessages.at(-1);
        const roll = message.flags[SYSTEM_ID].chatCard.rolls[0];
        assert.equal(roll.name, "Fight");
        assert.equal(roll.rank, 3);
        assert.equal(roll.bonus, 1, "the extra's bonus is part of the roll");
        assert.deepEqual(plain(roll.options.extra), { name: "Flaming Sword", bonus: 1 });
        assert.match(message.content, /fatex-roll__total">\+5</, "1 (dice) + 3 (skill) + 1 (extra)");
        assert.match(message.content, /fatex-roll__extra__name">Flaming Sword</);
        assert.match(message.content, /fatex-roll__extra__bonus">\+1</);

        // +2 and reroll keep the extra's bonus
        env.game.messages.set(message.id, message);
        const element = env.window.document.createElement("li");
        element.className = "chat-message message";
        element.dataset.messageId = message.id;
        element.innerHTML = message.content;
        env.window.document.body.append(element);
        env.Hooks.callAll("renderChatMessageHTML", message, element, {});

        element.querySelector('button[data-action="increase"]').click();
        await wait();
        assert.equal(message.flags[SYSTEM_ID].chatCard.rolls[0].bonus, 3);
        assert.match(message.content, /fatex-roll__total">\+7</);
        assert.match(message.content, /fatex-roll__extra__bonus">\+1</, "the card still shows the extra's own bonus");

        env.setNextDiceResults([-1, -1, 0, 0]);
        element.querySelector('button[data-action="reroll"]').click();
        await wait();
        assert.match(message.content, /fatex-roll__total">\+4</, "-2 (dice) + 3 (skill) + 3 (extra and +2)");
        element.remove();
        container.remove();
    });

    test("clicking the extra's name rolls too, except in edit mode where only the dice line rolls", async () => {
        const actor = await createHero(env, [
            { _id: "extraShield00001", name: "Shield", type: "extra", system: { skill: "Athletics", bonus: 0 } },
        ]);

        const normal = await renderCharacterSheet(env, actor);
        const name = normal.container.querySelector('span.fatex-extra__name--rollable[data-item="extraShield00001"]');
        assert.ok(name, "the name is clickable");
        let before = env.log.chatMessages.length;
        env.setNextDiceResults([0, 0, 0, 0]);
        name.click();
        await wait();
        assert.equal(env.log.chatMessages.length, before + 1);
        const roll = env.log.chatMessages.at(-1).flags[SYSTEM_ID].chatCard.rolls[0];
        assert.equal(roll.name, "Athletics");
        assert.equal(roll.bonus, 0);
        assert.doesNotMatch(env.log.chatMessages.at(-1).content, /fatex-roll__extra__bonus/, "no bonus shown");
        assert.match(env.log.chatMessages.at(-1).content, /fatex-roll__extra__name">Shield</);
        normal.container.remove();

        const editing = await renderCharacterSheet(env, actor, { editMode: true });
        before = env.log.chatMessages.length;
        editing.container.querySelector('span.fatex-extra__name--rollable[data-item="extraShield00001"]').click();
        await wait();
        assert.equal(env.log.chatMessages.length, before, "the name doesn't roll in edit mode");

        env.setNextDiceResults([0, 0, 0, 0]);
        editing.container.querySelector('.fatex-extra-roll[data-item="extraShield00001"]').click();
        await wait();
        assert.equal(env.log.chatMessages.length, before + 1, "the dice line rolls in edit mode");
        editing.container.remove();
    });

    test("a penalty subtracts and is highlighted", async () => {
        const actor = await createHero(env, [
            { _id: "extraHeavy000001", name: "Heavy Armor", type: "extra", system: { skill: "Athletics", bonus: -2 } },
        ]);
        const { container } = await renderCharacterSheet(env, actor);
        const line = container.querySelector('.fatex-extra-roll[data-item="extraHeavy000001"]');
        assert.match(line.textContent.replace(/\s+/g, " "), /Athletics \+2 penalty -2/);
        assert.ok(line.querySelector(".fatex-extra-roll__bonus--negative"));

        env.setNextDiceResults([1, 0, 0, 0]);
        line.click();
        await wait();
        const message = env.log.chatMessages.at(-1);
        assert.equal(message.flags[SYSTEM_ID].chatCard.rolls[0].bonus, -2);
        assert.match(message.content, /fatex-roll__total">\+1</, "1 (dice) + 2 (skill) - 2 (extra)");
        assert.match(message.content, /fatex-roll__extra__bonus fatex-roll__extra__bonus--negative">-2</);
        container.remove();
    });

    test("an extra linked to a skill the character doesn't have warns instead of rolling", async () => {
        const actor = await createHero(env, [
            { _id: "extraBow00000001", name: "Bow", type: "extra", system: { skill: "Shoot", bonus: 1 } },
        ]);
        const { container } = await renderCharacterSheet(env, actor);
        const line = container.querySelector('.fatex-extra-roll[data-item="extraBow00000001"]');
        assert.ok(line.classList.contains("fatex-extra-roll--missing"));
        assert.match(line.textContent, /not on this character/);

        const before = env.log.chatMessages.length;
        line.click();
        await wait();
        assert.equal(env.log.chatMessages.length, before, "nothing is rolled");
        assert.deepEqual(env.log.notifications.at(-1).slice(0, 2), [
            "warn",
            'Hero doesn\'t have the skill "Shoot" linked to the extra "Bow".',
        ]);
        container.remove();

        // Names are text, not HTML
        const odd = await createHero(
            env,
            [{ _id: "extraOdd00000001", name: "Arco <longo>", type: "extra", system: { skill: "<b>Atirar</b>" } }],
            "Hero & <Co>",
        );
        const oddSheet = await renderCharacterSheet(env, odd);
        const oddLine = oddSheet.container.querySelector('.fatex-extra-roll[data-item="extraOdd00000001"]');
        assert.match(oddLine.textContent, /<b>Atirar<\/b>/, "the skill name is shown as text on the sheet");
        oddLine.click();
        await wait();
        assert.equal(
            env.log.notifications.at(-1)[1],
            'Hero &amp; &lt;Co&gt; doesn\'t have the skill "&lt;b&gt;Atirar&lt;/b&gt;" linked to the extra "Arco &lt;longo&gt;".',
        );
        oddSheet.container.remove();
    });

    test("skill names match ignoring case and spaces, and plain extras look as before", async () => {
        const actor = await createHero(env, [
            { _id: "extraCase0000001", name: "Boots", type: "extra", system: { skill: " athletics ", bonus: 2 } },
            { _id: "extraPlain000002", name: "Horse", type: "extra" },
        ]);
        const { container } = await renderCharacterSheet(env, actor);

        const boots = container.querySelector('.fatex-extra-roll[data-item="extraCase0000001"]');
        assert.ok(!boots.classList.contains("fatex-extra-roll--missing"));
        env.setNextDiceResults([0, 0, 0, 0]);
        boots.click();
        await wait();
        assert.equal(env.log.chatMessages.at(-1).flags[SYSTEM_ID].chatCard.rolls[0].name, "Athletics");

        assert.equal(container.querySelector('[data-item="extraPlain000002"].fatex-extra-roll'), null);
        assert.equal(container.querySelector('span.fatex-extra__name--rollable[data-item="extraPlain000002"]'), null);
        assert.match(container.innerHTML, /<h3 class="fatex-headline__text">Horse<\/h3>/, "same markup as before");
        container.remove();

        // The extra's own sheet selects the same skill the character sheet rolls
        const { data } = await renderExtraSheet(env, actor.items.get("extraCase0000001"));
        assert.deepEqual(plain(data.skillOptions.filter((o) => o.selected)), [
            { value: "Athletics", label: "Athletics (+2)", selected: true },
        ]);
        assert.equal(data.skillOptions.length, 2, "no extra 'missing' option");
    });

    test("only the extra's name rolls from the header, not the icons next to it", async () => {
        const actor = await createHero(env, [
            { _id: "extraIcons000001", name: "Rope", type: "extra", system: { skill: "Athletics", bonus: 1 } },
        ]);
        const { container } = await renderCharacterSheet(env, actor);
        const header = container.querySelector('header[data-item-id="extraIcons000001"]');
        const before = env.log.chatMessages.length;

        header.querySelector("h3").click();
        header.querySelector(".fatex-js-item-collapse").click();
        header.click();
        await wait();
        assert.equal(env.log.chatMessages.length, before, "clicks outside the name don't roll");

        env.setNextDiceResults([0, 0, 0, 0]);
        header.querySelector(".fatex-extra__name--rollable").click();
        await wait();
        assert.equal(env.log.chatMessages.length, before + 1);
        container.remove();
    });

    test("regular skill rolls don't show an extra", async () => {
        const actor = await createHero(env);
        const SkillItem = env.CONFIG.FateX.itemClasses.skill;
        env.setNextDiceResults([0, 0, 0, 0]);
        await SkillItem.rollSkill({ actor }, actor.items.get("skillFight000001"), { shiftKey: false });
        const message = env.log.chatMessages.at(-1);
        assert.equal(message.flags[SYSTEM_ID].chatCard.rolls[0].bonus, 0);
        assert.ok(!("extra" in message.flags[SYSTEM_ID].chatCard.rolls[0].options));
        assert.doesNotMatch(message.content, /fatex-roll__extra/);
    });
});

describe("extras linked to a skill (Português)", () => {
    test("the sheet and the warning are translated", async () => {
        const env = createEnvironment({ language: "pt-BR" });
        await env.init();
        await env.ready();

        const actor = await createHero(env, [
            { _id: "extraSword000003", name: "Espada", type: "extra", system: { skill: "Fight", bonus: 1 } },
            { _id: "extraBow00000002", name: "Arco", type: "extra", system: { skill: "Atirar", bonus: -1 } },
        ]);
        const { container } = await renderCharacterSheet(env, actor);
        const sword = container.querySelector('.fatex-extra-roll[data-item="extraSword000003"]');
        assert.match(sword.textContent.replace(/\s+/g, " "), /Fight \+3 bônus \+1/);
        assert.equal(sword.title, "Rolar Fight (+3) bônus +1");
        const bow = container.querySelector('.fatex-extra-roll[data-item="extraBow00000002"]');
        assert.match(bow.textContent.replace(/\s+/g, " "), /Atirar não existe nesta ficha penalidade -1/);

        bow.click();
        await wait();
        assert.equal(env.log.notifications.at(-1)[1], 'Hero não tem a perícia "Atirar" ligada ao extra "Arco".');

        const { html } = await renderExtraSheet(env, actor.items.get("extraSword000003"));
        assert.match(html, /Perícia ligada/);
        assert.match(html, /Bônus ou penalidade na rolagem/);
        assert.match(html, /— Nenhuma —/);
        container.remove();
    });
});
