/**
 * Custom name for fate points (system setting): the sheet, the extras, the chat cards and the warnings use it.
 * Run `npm run build` first, then `npm test`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createEnvironment, SYSTEM_ID } from "./harness/foundry-env.mjs";

const wait = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (element) => element?.textContent.replace(/\s+/g, " ").trim();

function sheetClass(env, name) {
    const registration = env.log.sheetRegistrations.find((r) => r.action === "register" && r.sheetClass.name === name);
    assert.ok(registration, `sheet ${name} is registered`);
    return registration.sheetClass;
}

async function setup(language = "en") {
    const env = createEnvironment({ language });
    await env.init();
    await env.ready();
    return env;
}

/** Sets the name like the settings window does (Foundry calls onChange after saving) */
async function setName(env, value) {
    await env.game.settings.set(SYSTEM_ID, "fatePointsName", value);
    env.game.settings.settings.get(`${SYSTEM_ID}.fatePointsName`).onChange(value);
}

async function createHero(env) {
    const FateActor = env.CONFIG.Actor.documentClass;
    const actor = await FateActor.create({
        name: "Hero",
        type: "character",
        system: { fatepoints: { current: 1, refresh: 3 } },
        items: [
            { _id: "skillFight000001", name: "Fight", type: "skill", system: { rank: 3 } },
            { _id: "extraRing0000001", name: "Ring", type: "extra", system: { skill: "Fight", fateCost: 1 } },
            { _id: "extraStaff000001", name: "Staff", type: "extra", system: { skill: "Fight", fateCost: 2 } },
        ],
    });
    env.game.actors.set(actor.id, actor);
    return actor;
}

async function renderCharacterSheet(env, actor) {
    const CharacterSheet = sheetClass(env, "CharacterSheet");
    const sheet = new CharacterSheet(actor);
    const html = await env.renderTemplate(sheet.template, await sheet.getData());
    const container = env.window.document.createElement("section");
    container.className = "window-content";
    container.innerHTML = html;
    env.window.document.body.append(container);
    sheet.activateListeners(env.window.$(container));
    return { sheet, container };
}

async function renderExtraSheet(env, item) {
    const ExtraSheet = sheetClass(env, "ExtraSheet");
    const sheet = new ExtraSheet(item);
    const container = env.window.document.createElement("div");
    container.innerHTML = await env.renderTemplate(sheet.template, await sheet.getData());
    return container;
}

/** Everything the player reads about fate points: sheet label, extra sheet, roll line, card and warning */
async function fatePointTexts(env) {
    const actor = await createHero(env);
    const { container } = await renderCharacterSheet(env, actor);
    const labelElement = container.querySelector(".fatex-header__fate-points .fatex-header__label");
    const label = text(labelElement);
    assert.equal(labelElement.title, label, "the whole name on hover (a long one is cut on the sheet)");
    const costLine = text(container.querySelector('.fatex-extra-roll[data-item="extraStaff000001"] .fatex-extra-roll__cost'));
    const extraSheet = await renderExtraSheet(env, actor.items.get("extraStaff000001"));

    env.setNextDiceResults([0, 0, 0, 0]);
    container.querySelector('.fatex-extra-roll[data-item="extraRing0000001"]').click();
    await wait();
    const card = env.window.document.createElement("div");
    card.innerHTML = env.log.chatMessages.at(-1).content;
    const spent = text(card.querySelector(".fatex-roll__extra-cost"));

    // Staff costs 2, Hero has 0 left
    container.querySelector('.fatex-extra-roll[data-item="extraStaff000001"]').click();
    await wait();
    const warning = env.log.notifications.filter((n) => n[0] === "warn").at(-1)?.[1];
    container.remove();

    return { label, costLine, extraSheet: text(extraSheet), spent, warning };
}

describe("custom name for fate points", () => {
    test("the setting is a text field for the world, empty by default", async () => {
        const env = await setup();
        const setting = env.game.settings.settings.get(`${SYSTEM_ID}.fatePointsName`);
        assert.ok(setting, "registered");
        assert.equal(setting.type, env.window.String, "a text field");
        assert.equal(setting.default, "");
        assert.equal(setting.scope, "world");
        assert.equal(setting.config, true);
        assert.equal(env.localize(setting.name), "Fate points name");
        assert.match(env.localize(setting.hint), /Cursed Energy, Power Points, Nen/);
        assert.equal(env.game.settings.get(SYSTEM_ID, "fatePointsName"), "");
    });

    test("without a name, every text stays as before", async () => {
        const env = await setup();
        const texts = await fatePointTexts(env);
        assert.equal(texts.label, "Fate Points");
        assert.equal(texts.costLine, "costs 2 FP");
        assert.match(texts.extraSheet, /Fate point cost/);
        assert.equal(texts.spent, "spent 1 fate point");
        assert.equal(texts.warning, 'Hero doesn\'t have enough fate points for "Staff" (costs 2, has 0).');
    });

    test("with a name, the sheet, the extras, the cards and the warnings use it", async () => {
        const env = await setup();
        await setName(env, "Cursed Energy");
        const texts = await fatePointTexts(env);

        assert.equal(texts.label, "Cursed Energy");
        assert.equal(texts.costLine, "costs 2 Cursed Energy");
        assert.match(texts.extraSheet, /Cursed Energy cost/);
        assert.match(texts.extraSheet, /How much Cursed Energy each roll made through the extra spends \(0 = free\)/);
        assert.doesNotMatch(texts.extraSheet, /fate point/i);
        assert.equal(texts.spent, "spent 1 Cursed Energy");
        assert.equal(texts.warning, 'Hero can\'t use "Staff": it costs 2 Cursed Energy and they have 0.');

        assert.equal(env.localize("FAx.Item.Extra.Roll.CannotSpendFatePoints"), "You can't spend the Cursed Energy of {actor}.");
        assert.match(env.localize("FAx.Settings.LinkCharacterTokens.Hint"), /share the same sheet \(Cursed Energy, stress, consequences…\)/);
        assert.equal(env.localize("FAx.Item.Extra.Roll.SpentMany"), "spent {cost} Cursed Energy", "the other placeholders stay");

        // The fate point field of a group's members says it too
        const actor = env.game.actors.contents.at(-1);
        const inline = await env.renderTemplate("systems/fatexcontinued/templates/inline-sheet/character.hbs", {
            actor: actor.toObject(),
        });
        assert.match(inline, /name="system\.fatepoints\.current"[^>]*title="Cursed Energy"/);
    });

    test("changing or clearing the name updates the texts and the open sheets right away", async () => {
        const env = await setup();
        const actor = await createHero(env);
        const rendered = [];
        env.window.ui.windows[1] = { document: actor, render: (force) => rendered.push(["actor", force]) };
        env.window.ui.windows[2] = { object: actor.items.get("extraRing0000001"), render: (force) => rendered.push(["item", force]) };
        env.window.ui.windows[3] = { document: null, render: () => rendered.push(["other"]) };

        await setName(env, "Nen");
        assert.equal(env.localize("FAx.Sheet.FatePoints"), "Nen");
        assert.equal(env.localize("FAx.Item.Extra.Roll.SpentOne"), "spent 1 Nen");
        assert.deepEqual(rendered, [
            ["actor", false],
            ["item", false],
        ]);

        await setName(env, "Power Points");
        assert.equal(env.localize("FAx.Sheet.FatePoints"), "Power Points");

        await setName(env, "   ");
        assert.equal(env.localize("FAx.Sheet.FatePoints"), "Fate Points", "blank is the same as empty");
        assert.equal(env.localize("FAx.Item.Extra.Roll.Cost"), "costs {cost} FP");
        assert.equal(env.localize("FAx.Item.Extra.Roll.SpentOne"), "spent 1 fate point");

        delete env.window.ui.windows[1];
        delete env.window.ui.windows[2];
        delete env.window.ui.windows[3];
    });

    test("the name is plain text: tags and extra spaces are dropped, and a $ is kept", async () => {
        const env = await setup();
        await setName(env, "  <b>Ki</b>   do <i>Dragão</i> ");
        assert.equal(env.localize("FAx.Sheet.FatePoints"), "Ki do Dragão");
        await setName(env, "Pontos $&");
        assert.equal(env.localize("FAx.Item.Extra.Roll.SpentOne"), "spent 1 Pontos $&");
    });

    test("modules add their own texts, also when their language files use flat keys", async () => {
        const env = await setup();
        const translations = env.game.i18n.translations;
        translations["FAx.NewSession.Question"] = "This will refresh Fate Points for this character.";
        translations["FAx.NewSession.CustomFatePoints.Question"] = "This will refresh {fatePoints} for this character.";
        env.CONFIG.FateX.fatePointTexts["FAx.NewSession.Question"] = "FAx.NewSession.CustomFatePoints.Question";
        // A text whose template only exists in English is taken from the fallback
        env.CONFIG.FateX.fatePointTexts["FAx.Test.OnlyEnglish"] = "FAx.FatePointsName.Sheet";

        await setName(env, "Chakra");
        assert.equal(env.localize("FAx.NewSession.Question"), "This will refresh Chakra for this character.");
        assert.equal(translations["FAx.NewSession.Question"], "This will refresh Chakra for this character.", "the flat key itself");
        assert.equal(env.localize("FAx.Test.OnlyEnglish"), "Chakra");

        await setName(env, "");
        assert.equal(env.localize("FAx.NewSession.Question"), "This will refresh Fate Points for this character.");
        assert.equal(env.localize("FAx.Test.OnlyEnglish"), "FAx.Test.OnlyEnglish", "a text that didn't exist is gone again");
        assert.equal(env.game.i18n.translations.FAx.Test?.OnlyEnglish, undefined);
    });

    test("a name saved in the world is used from the start", async () => {
        const env = createEnvironment({ settings: { [`${SYSTEM_ID}.fatePointsName`]: "Mana" } });
        await env.init();
        await env.ready();
        assert.equal(env.localize("FAx.Sheet.FatePoints"), "Mana");
        assert.equal(env.localize("FAx.Item.Extra.FateCost"), "Mana cost");
    });
});

describe("custom name for fate points (Português)", () => {
    test("os textos em português usam o nome escolhido", async () => {
        const env = await setup("pt-BR");
        const setting = env.game.settings.settings.get(`${SYSTEM_ID}.fatePointsName`);
        assert.equal(env.localize(setting.name), "Nome dos pontos de destino");
        assert.match(env.localize(setting.hint), /Energia Amaldiçoada, Pontos de Poder, Nen/);

        const before = await fatePointTexts(env);
        assert.equal(before.label, "Pontos de Destino");
        assert.equal(before.costLine, "custa 2 PD");
        assert.equal(before.spent, "gastou 1 ponto de destino");

        await setName(env, "Energia Amaldiçoada");
        const texts = await fatePointTexts(env);
        assert.equal(texts.label, "Energia Amaldiçoada");
        assert.equal(texts.costLine, "custa 2 de Energia Amaldiçoada");
        assert.match(texts.extraSheet, /Custo em Energia Amaldiçoada/);
        assert.match(texts.extraSheet, /Quanto de Energia Amaldiçoada cada rolagem feita pelo extra gasta/);
        assert.equal(texts.spent, "gastou 1 de Energia Amaldiçoada");
        assert.equal(texts.warning, 'Hero não pode usar "Staff": custa 2 de Energia Amaldiçoada e só tem 0.');
        assert.equal(env.localize("FAx.Item.Extra.Roll.SpentMany"), "gastou {cost} de Energia Amaldiçoada");
        assert.equal(
            env.localize("FAx.Item.Extra.Roll.CannotSpendFatePoints"),
            "Você não pode gastar Energia Amaldiçoada de {actor}.",
        );
        assert.match(env.localize("FAx.Settings.LinkCharacterTokens.Hint"), /mesma ficha \(Energia Amaldiçoada, estresse/);

        // A text whose version with the name is missing in Portuguese takes the English one (Foundry's fallback)
        delete env.game.i18n.translations.FAx.FatePointsName.FateCost;
        await setName(env, "Mana");
        assert.equal(env.localize("FAx.Item.Extra.FateCost"), "Mana cost");
        assert.equal(env.localize("FAx.Item.Extra.Roll.Cost"), "custa {cost} de Mana");
    });
});
