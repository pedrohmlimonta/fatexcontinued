/**
 * Character tokens linked to their actor: the token and the actor in the Actors tab share the same sheet.
 * Run `npm run build` first, then `npm test`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createEnvironment, SYSTEM_ID } from "./harness/foundry-env.mjs";

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

async function createActor(env, data) {
    const actor = await env.CONFIG.Actor.documentClass.create(data);
    env.game.actors.set(actor.id, actor);
    return actor;
}

/** A scene with placed tokens (only what the feature uses) */
function addScene(env, id, tokens) {
    const Collection = env.game.scenes.constructor;
    const collection = new Collection();
    for (const token of tokens) collection.set(token._id, { id: token._id, ...token });
    const scene = {
        id,
        tokens: collection,
        updates: [],
        async updateEmbeddedDocuments(type, updates) {
            this.updates.push({ type, updates });
            for (const { _id, ...changes } of updates) Object.assign(collection.get(_id), changes);
            return updates;
        },
    };
    env.game.scenes.set(id, scene);
    return scene;
}

const linkSetting = (env) => env.game.settings.settings.get(`${SYSTEM_ID}.linkCharacterTokens`);

describe("character tokens linked to their sheet", () => {
    test("new characters are created with a linked token; given link states and groups are kept", async () => {
        const env = createEnvironment();
        await env.init();
        await env.ready();

        const setting = linkSetting(env);
        assert.equal(setting.default, true);
        assert.equal(setting.scope, "world");
        assert.equal(setting.config, true);
        assert.equal(setting.name, "FAx.Settings.LinkCharacterTokens.Name");
        assert.match(env.localize(setting.hint), /Link Actor Data/);

        const hero = await createActor(env, { name: "Hero", type: "character" });
        assert.equal(hero.prototypeToken.actorLink, true, "new characters share their sheet with their tokens");

        const mook = await createActor(env, { name: "Mook", type: "character", prototypeToken: { actorLink: false } });
        assert.equal(mook.prototypeToken.actorLink, false, "an explicit choice (copy, import, template) is kept");

        const party = await createActor(env, { name: "Party", type: "group" });
        assert.notEqual(party.prototypeToken.actorLink, true, "groups are not changed");
    });

    test("existing characters and their placed tokens are linked once, when a GM opens the world", async () => {
        const env = createEnvironment();
        await env.init();

        // Characters created before this feature: unlinked prototype tokens
        const hero = await createActor(env, {
            _id: "actorHero0000001",
            name: "Novo modelo",
            type: "character",
            prototypeToken: { actorLink: false },
            system: { fatepoints: { current: 3, refresh: 3 } },
        });
        const linked = await createActor(env, {
            _id: "actorLinked00001",
            name: "Already linked",
            type: "character",
            prototypeToken: { actorLink: true },
        });
        const template = await createActor(env, {
            _id: "actorTemplate001",
            name: "Template",
            type: "character",
            prototypeToken: { actorLink: false },
            flags: { [SYSTEM_ID]: { isTemplateActor: true } },
        });
        const party = await createActor(env, {
            _id: "actorParty000001",
            name: "Party",
            type: "group",
            prototypeToken: { actorLink: false },
        });
        const scene = addScene(env, "scene0000000001", [
            { _id: "tokenHero0000001", actorId: hero.id, actorLink: false },
            { _id: "tokenHero0000002", actorId: hero.id, actorLink: false },
            { _id: "tokenLinked00001", actorId: linked.id, actorLink: true },
            { _id: "tokenParty000001", actorId: party.id, actorLink: false },
            { _id: "tokenOrphan00001", actorId: "deletedActor0001", actorLink: false },
            { _id: "tokenNoActor0001", actorId: null, actorLink: false },
        ]);
        addScene(env, "scene0000000002", []);

        await env.ready();
        await wait();

        assert.equal(hero.prototypeToken.actorLink, true);
        assert.equal(template.prototypeToken.actorLink, true, "characters created from templates will be linked too");
        assert.equal(linked.prototypeToken.actorLink, true);
        assert.equal(party.prototypeToken.actorLink, false, "groups are not changed");

        const link = (id) => scene.tokens.get(id).actorLink;
        assert.equal(link("tokenHero0000001"), true, "tokens already on the scene use the actor's sheet");
        assert.equal(link("tokenHero0000002"), true);
        assert.equal(link("tokenParty000001"), false);
        assert.equal(link("tokenOrphan00001"), false, "tokens without an actor are left alone");
        assert.equal(link("tokenNoActor0001"), false);
        assert.deepEqual(JSON.parse(JSON.stringify(scene.updates)), [
            {
                type: "Token",
                updates: [
                    { _id: "tokenHero0000001", actorLink: true },
                    { _id: "tokenHero0000002", actorLink: true },
                ],
            },
        ]);

        assert.equal(env.game.settings.get(SYSTEM_ID, "linkedTokensMigrated"), true);
        assert.deepEqual(
            env.log.notifications
                .filter((n) => n[0] === "info")
                .at(-1)
                .slice(0, 2),
            ["info", "2 character(s) and 2 token(s) now share the sheet of the Actors tab."],
        );
    });

    test("players never link anything, and a GM links only once", async () => {
        const env = createEnvironment();
        await env.init();
        env.game.user.isGM = false;
        const hero = await createActor(env, { name: "Hero", type: "character", prototypeToken: { actorLink: false } });
        await env.ready();
        await wait();
        assert.equal(hero.prototypeToken.actorLink, false);
        assert.equal(env.game.settings.get(SYSTEM_ID, "linkedTokensMigrated"), false);

        const gm = createEnvironment({ worldSettings: [{ key: `${SYSTEM_ID}.linkedTokensMigrated`, value: "true" }] });
        await gm.init();
        const unlinked = await createActor(gm, {
            name: "Mook",
            type: "character",
            prototypeToken: { actorLink: false },
        });
        await gm.ready();
        await wait();
        assert.equal(unlinked.prototypeToken.actorLink, false, "already done: later unlinked actors (mooks) are kept");
    });

    test("with the setting off nothing is linked; turning it on links what exists", async () => {
        const env = createEnvironment({ settings: { [`${SYSTEM_ID}.linkCharacterTokens`]: false } });
        await env.init();
        const hero = await createActor(env, { name: "Hero", type: "character" });
        assert.notEqual(hero.prototypeToken.actorLink, true, "new characters keep Foundry's default");
        const scene = addScene(env, "scene0000000003", [
            { _id: "tokenHero0000003", actorId: hero.id, actorLink: false },
        ]);

        await env.ready();
        await wait();
        assert.notEqual(hero.prototypeToken.actorLink, true);
        assert.equal(scene.tokens.get("tokenHero0000003").actorLink, false);
        assert.equal(env.game.settings.get(SYSTEM_ID, "linkedTokensMigrated"), false);

        await env.game.settings.set(SYSTEM_ID, "linkCharacterTokens", true);
        await linkSetting(env).onChange(true);
        await wait();
        assert.equal(hero.prototypeToken.actorLink, true);
        assert.equal(scene.tokens.get("tokenHero0000003").actorLink, true);
        assert.equal(env.game.settings.get(SYSTEM_ID, "linkedTokensMigrated"), true);
    });
});

describe("character tokens linked to their sheet (Português)", () => {
    test("setting and notice are translated", async () => {
        const env = createEnvironment({ language: "pt-BR" });
        await env.init();
        const hero = await createActor(env, { name: "Herói", type: "character", prototypeToken: { actorLink: false } });
        addScene(env, "scene0000000004", [{ _id: "tokenHeroi000001", actorId: hero.id, actorLink: false }]);
        await env.ready();
        await wait();

        const setting = linkSetting(env);
        assert.equal(env.localize(setting.name), "Tokens de personagem ligados à ficha");
        assert.match(env.localize(setting.hint), /Vincular dados do ator/);
        assert.equal(
            env.log.notifications.filter((n) => n[0] === "info").at(-1)[1],
            "1 personagem(ns) e 1 token(s) agora usam a mesma ficha da aba Atores.",
        );
    });
});
