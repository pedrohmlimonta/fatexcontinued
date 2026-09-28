// @ts-nocheck
import { FateRollDataModel } from "../data/FateRollDataModel";
import { SkillItemData } from "../item/ItemTypes";
import { SYSTEM_ID, TEMPLATES_PATH } from "../../constants";

export const ROLL_MODES = {
    "4dF": "4dF",
    "2d6": "1d6-1d6",
};

export class FateRoll extends FateRollDataModel {
    /**
     * Runtime reference to the rolling actor. It is never stored in the chat message.
     */
    private _actor = null;

    static createFromSkill(
        skill: SkillItemData & Record<string, any>,
        {
            magic = false,
            extra = null,
        }: { magic?: boolean; extra?: { name: string; bonus: number; fateCost?: number } | null } = {},
    ) {
        const actor = skill.actor ?? null;
        const options = {
            magic,
            actorId: actor?.id ?? null,
            actorUuid: actor?.uuid ?? null,
        };

        // Rolled through an extra: its bonus (or penalty) starts in the roll's bonus, and its name (and the fate
        // points it cost) are shown on the card
        const extraBonus = extra ? Number(extra.bonus) || 0 : 0;

        if (extra) {
            const fateCost = Math.max(0, Math.round(Number(extra.fateCost) || 0));
            options["extra"] = { name: String(extra.name ?? ""), bonus: extraBonus, ...(fateCost ? { fateCost } : {}) };
        }

        if (game.settings.get(SYSTEM_ID, "guildCodexMagicSystemEnabled") && magic) {
            options["magicCount"] = this.determineMagicCount(skill);

            if (options["magicCount"] === false) {
                return false;
            }
        }

        if (game.settings.get(SYSTEM_ID, "enable2d6RollMode") && !magic) {
            options["rollmode"] = ROLL_MODES["2d6"];
        }

        const fateRoll = new FateRoll({
            id: foundry.utils.randomID(),
            name: skill.name,
            rank: Number(skill.system.rank ?? 0),
            bonus: extraBonus,
            options,
        });

        fateRoll._actor = actor;

        return fateRoll;
    }

    /**
     * The actor which performed this roll (if it still exists).
     */
    get actor() {
        if (this._actor) {
            return this._actor;
        }

        const { actorUuid, actorId } = this.options ?? {};

        if (actorUuid) {
            const actor = fromUuidSync(actorUuid, { strict: false });

            if (actor) {
                return actor;
            }
        }

        return actorId ? game.actors?.get(actorId) ?? null : null;
    }

    async roll(userId = "") {
        if (game.settings.get(SYSTEM_ID, "guildCodexMagicSystemEnabled")) {
            if (this.options?.magic && this.options?.magicCount > 0) {
                return this.rollMagic(userId, this.options.magicCount);
            }
        }

        const rollMode = this.options?.rollmode ?? ROLL_MODES["4dF"];
        const rollThrough = new Roll(rollMode);
        const roll = await rollThrough.evaluate();

        if (this.is2d6Roll) {
            this.updateSource({
                faces: [...roll.terms[0].results, ...roll.terms[2].results].map((r) => r.count ?? r.result),
            });
        } else {
            this.updateSource({ faces: roll.terms[0].results.map((r) => r.count ?? r.result) });
        }

        await FateRoll.showDiceSoNice(roll, userId);

        Hooks.callAll("fatex.roll", this);

        return this;
    }

    async rollMagic(userId = "", magicCount: number) {
        const rollThrough = new Roll(`${magicCount}dM + ${4 - magicCount}dF`);
        const roll = await rollThrough.evaluate();

        this.updateSource({
            faces: [...roll.terms[0].results, ...(roll.terms[2]?.results ?? [])].map((r) => r.count ?? r.result),
        });

        await FateRoll.showDiceSoNice(roll, userId);

        Hooks.callAll("fatex.rollMagic", this);

        return this;
    }

    async reroll(userId = "", { shiftKey }: { shiftKey: boolean }) {
        const history = this.addHistoryEntry(userId, { type: "reroll", previousRoll: [...(this.faces ?? [])] });
        await this.roll(userId);

        this.updateSource({ history: history });

        Hooks.callAll("fatex.reroll", this, { userId, shiftKey });

        return this;
    }

    increase(userId = "", { shiftKey }: { shiftKey: boolean }) {
        const history = this.addHistoryEntry(userId, { type: "increase" });

        this.updateSource({ bonus: (this.bonus ?? 0) + 2, history: history });

        Hooks.callAll("fatex.increase", this, { userId, shiftKey });

        return this;
    }

    private addHistoryEntry(userId: string, data) {
        const history = (this.history ?? []).map((entry) =>
            entry?.toObject ? entry.toObject() : foundry.utils.deepClone(entry),
        );
        const user = userId ? game.users.get(userId) : game.user;
        const entry = { user: user?.name ?? game.user.name, ...data };

        history.push(entry);
        return history;
    }

    static async showDiceSoNice(roll, userId = "") {
        if (!game.modules.get("dice-so-nice")?.active || !game.dice3d) {
            return;
        }

        const user = userId ? game.users.get(userId) : game.user;
        await game.dice3d.showForRoll(roll, user ?? game.user, true);
    }

    get total() {
        const bonus = this.bonus ?? 0;

        if (this.is2d6Roll) {
            return this.faces[0] - this.faces[1] + this.rank + bonus;
        }

        return this.faces.reduce((a, b) => a + b, 0) + this.rank + bonus;
    }

    get ladder() {
        const total = Math.clamp(this.total, -4, 8);
        const totalString = (total < 0 ? "-" : "+").concat(Math.abs(total).toString());

        return game.i18n.localize(`FAx.Global.Ladder.${totalString}`);
    }

    get totalString() {
        return (this.total < 0 ? "-" : "+").concat(Math.abs(this.total).toString());
    }

    get symbols() {
        if (this.is2d6Roll) {
            return this.faces;
        }

        return this.faces.map((f) => (f > 0 ? "+" : f < 0 ? "-" : "0"));
    }

    get is2d6Roll() {
        return this.options?.rollmode === ROLL_MODES["2d6"];
    }

    /**
     * Bonus of the extra this roll was made through (empty if none)
     */
    get extraBonusString() {
        const bonus = Number(this.options?.extra?.bonus) || 0;

        return bonus ? (bonus < 0 ? "-" : "+").concat(Math.abs(bonus).toString()) : "";
    }

    get extraIsPenalty() {
        return (Number(this.options?.extra?.bonus) || 0) < 0;
    }

    /**
     * Fate points spent to roll through the extra (empty if none)
     */
    get extraFateCostLabel() {
        const cost = Number(this.options?.extra?.fateCost) || 0;

        if (cost <= 0) {
            return "";
        }

        return cost === 1
            ? game.i18n.localize("FAx.Item.Extra.Roll.SpentOne")
            : game.i18n.format("FAx.Item.Extra.Roll.SpentMany", { cost });
    }

    get rankStatus() {
        return this.rank >= 0 ? "positive" : "negative";
    }

    async render() {
        const template = `${TEMPLATES_PATH}/chat/roll.hbs`;

        return await foundry.applications.handlebars.renderTemplate(template, this);
    }

    static determineMagicCount(skill: SkillItemData & Record<string, any>) {
        const magicSkills = (skill.parent?.items ?? []).filter(
            (i) => i.type === "skill" && i.system.options?.isMagicSkill,
        );

        if (magicSkills.length === 0) {
            ui.notifications.error(game.i18n.localize("FAx.Item.Skill.Roll.NoMagicSkills"));
            return false;
        }

        if (magicSkills.length > 1) {
            ui.notifications.warn(
                game.i18n.format("FAx.Item.Skill.Roll.MultipleMagicSkills", {
                    skills: magicSkills.map((s) => s.name).join(", "),
                }),
            );
        }

        const magicRank = Math.clamp(Number(magicSkills[0].system.rank ?? 0), 0, 4);

        if (magicRank < 1) {
            ui.notifications.error(game.i18n.localize("FAx.Item.Skill.Roll.MagicSkillTooLow"));
            return false;
        }

        return magicRank;
    }
}
