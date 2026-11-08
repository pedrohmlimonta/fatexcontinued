import { marked } from "marked";
import { StuntItem } from "../stunt/StuntItem";
import { SkillItem } from "../skill/SkillItem";
import { Automation } from "../../components/Automation/Automation";

/**
 * Bonuses offered on the extra sheet (negative values are penalties).
 * The − and + buttons next to them go beyond these values, without limit.
 */
export const EXTRA_BONUS_RANGE = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

const MIN_LISTED_BONUS = EXTRA_BONUS_RANGE[0];
const MAX_LISTED_BONUS = EXTRA_BONUS_RANGE[EXTRA_BONUS_RANGE.length - 1];

const signed = (value: number) => (value < 0 ? "-" : "+").concat(Math.abs(value).toString());
const normalize = (value: unknown) =>
    String(value ?? "")
        .trim()
        .toLowerCase();

export class ExtraItem extends StuntItem {
    static get documentName() {
        return "extra";
    }

    /**
     * Clicking an extra that is linked to a skill rolls that skill with the extra's bonus
     */
    static activateActorSheetListeners(html, sheet) {
        super.activateActorSheetListeners(html, sheet);

        html.find(".fatex-js-extra-roll").on("click", (e) => this._onRollExtra.call(this, e, sheet));
        html.find(".fatex-js-extra-add-stunt").on("click", (e) => this._onAddStunt.call(this, e, sheet));
    }

    /**
     * Extra sheet: the − and + buttons change the bonus by one, beyond the listed values
     */
    static activateListeners(html, sheet) {
        super.activateListeners(html, sheet);

        html.find(".fatex-js-extra-bonus-step").on("click", (e) => this._onStepBonus.call(this, e, sheet));
    }

    static async getActorSheetData(sheetData) {
        await this.enrichDescriptions(sheetData.extras);

        for (const extra of sheetData.extras ?? []) {
            extra.rollInfo = this.getRollInfo(extra);
        }

        sheetData.extraTree = this.getExtraTree(sheetData.extras ?? []);

        return sheetData;
    }

    /**
     * The extras as the Extras tab lists them: each power with its stunts (in the extras' order), the rest on their own
     */
    static getExtraTree(extras) {
        const powers = this.getPowers(extras);
        const entries = new Map();
        const tree: { extra; stunts: any[]; isPower?: boolean; stuntCount?: string }[] = [];

        for (const extra of extras) {
            if (!powers.has(extra.id)) {
                const entry = { extra, stunts: [] };
                entries.set(extra.id, entry);
                tree.push(entry);
            }
        }

        for (const extra of extras) {
            if (powers.has(extra.id)) {
                entries.get(powers.get(extra.id))?.stunts.push(extra);
            }
        }

        for (const entry of tree) {
            entry.isPower = entry.stunts.length > 0;
            entry.stuntCount = entry.isPower ? this.stuntCountLabel(entry.stunts.length) : "";
        }

        return tree;
    }

    /**
     * Power of each stunt among these extras (stunt id → power id).
     * An extra is a stunt of the power its "power" field points to when that power is another extra of the list
     * and isn't a stunt itself (one level only). A stunt whose power was deleted, or that points to itself or to
     * another stunt, is shown on its own, so nothing ever disappears from the sheet.
     */
    static getPowers(items): Map<string, string> {
        const extras = [...(items ?? [])].filter((item) => item?.type === "extra");
        const ids = new Set(extras.map((extra) => extra.id));
        const pointsToAnotherExtra = (extra) => {
            const target = this.getPowerId(extra);
            return !!target && target !== extra.id && ids.has(target);
        };
        const byId = new Map(extras.map((extra) => [extra.id, extra]));
        const powers = new Map<string, string>();

        for (const extra of extras) {
            if (!pointsToAnotherExtra(extra)) {
                continue;
            }

            const powerId = this.getPowerId(extra);

            if (!pointsToAnotherExtra(byId.get(powerId))) {
                powers.set(extra.id, powerId);
            }
        }

        return powers;
    }

    static getPowerId(extra): string {
        return String(extra?.system?.power ?? "").trim();
    }

    /**
     * The power an extra of a character belongs to (undefined if it's on its own)
     */
    static getPower(extra) {
        const actor = extra?.actor ?? extra?.parent;
        const powerId = actor?.items ? this.getPowers(actor.items).get(extra.id) : undefined;

        return powerId ? actor.items.get(powerId) : undefined;
    }

    /**
     * The stunts of a power, in the sheet's order
     */
    static getStunts(actor, power) {
        const powers = this.getPowers(actor?.items ?? []);

        return [...(actor?.items ?? [])]
            .filter((item) => powers.get(item.id) === power?.id)
            .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }

    static stuntCountLabel(count: number) {
        return game.i18n.format(
            count === 1 ? "FAx.Item.Extra.Power.StuntCountOne" : "FAx.Item.Extra.Power.StuntCountMany",
            {
                count,
            },
        );
    }

    /**
     * Keeps powers one level deep for every change (the extra's sheet only offers valid powers, but a sheet left open
     * or a macro may not know about newer changes): a power that has stunts doesn't become a stunt, and an extra
     * doesn't become a stunt of another stunt. Only the power is left out of such an update; the rest is saved.
     */
    static keepPowersOneLevel(item, changed) {
        const flat = Object.prototype.hasOwnProperty.call(changed ?? {}, "system.power");
        const value = flat ? changed["system.power"] : changed?.system?.power;
        const powerId = typeof value === "string" ? value.trim() : "";
        const actor = item?.actor;

        if (!powerId || !actor?.items) {
            return;
        }

        const target = actor.items.get(powerId);

        if (!target || target.type !== "extra" || target.id === item.id) {
            return;
        }

        const escape = foundry.utils.escapeHTML;
        const ownStunts = this.getStunts(actor, item).length;
        const targetPower = this.getPowerId(target);
        const targetIsStunt = !!targetPower && targetPower !== target.id && !!actor.items.get(targetPower);
        let warning = "";

        if (ownStunts) {
            warning = game.i18n.format("FAx.Item.Extra.Power.AlreadyPower", {
                extra: escape(item.name),
                stunts: this.stuntCountLabel(ownStunts),
            });
        } else if (targetIsStunt) {
            warning = game.i18n.format("FAx.Item.Extra.Power.TargetIsStunt", { power: escape(target.name) });
        }

        if (!warning) {
            return;
        }

        if (flat) {
            delete changed["system.power"];
        } else {
            delete changed.system.power;
        }

        ui.notifications.warn(warning);
    }

    /**
     * Adds the skills that can be linked and the available bonuses to the extra's sheet
     */
    static async getSheetData(sheetData, sheet?) {
        sheetData = await super.getSheetData(sheetData);

        const item = sheet?.item ?? sheetData.item;
        const actor = item?.actor ?? null;
        const current = String(item?.system?.skill ?? "").trim();

        // Skills of the owning character; extras outside a character list the skills of every actor (like automation)
        let options: { value: string; label: string }[] = actor
            ? actor.items
                  .filter((i) => i.type === "skill")
                  .map((skill) => ({
                      value: skill.name,
                      label: `${skill.name} (${signed(Number(skill.system.rank) || 0)})`,
                  }))
            : Automation.getAllAvailableSkills().map((name) => ({ value: name, label: name }));

        options = options
            .filter((option, index, all) => all.findIndex((o) => o.value === option.value) === index)
            .sort((a, b) => a.value.localeCompare(b.value));

        // The same skill the character sheet rolls (the name may differ in case or spaces)
        const selected = (actor && this.getLinkedSkill(actor, current)?.name) || current;

        // A linked skill the character doesn't have (renamed or removed) stays selected until it is changed
        if (selected && !options.some((option) => option.value === selected)) {
            const missing = actor ? ` - ${game.i18n.localize("FAx.Item.Extra.Roll.Missing")}` : "";
            options.push({ value: selected, label: `${selected}${missing}` });
        }

        sheetData.skillOptions = options.map((option) => ({ ...option, selected: option.value === selected }));

        // A bonus beyond the listed values (set with − or +) is shown at that end of the row
        const bonus = Number(item?.system?.bonus) || 0;
        sheetData.availableBonuses = [
            ...(bonus < MIN_LISTED_BONUS ? [bonus] : []),
            ...EXTRA_BONUS_RANGE,
            ...(bonus > MAX_LISTED_BONUS ? [bonus] : []),
        ];

        sheetData.powerSetting = actor ? this.getPowerSetting(actor, item) : null;

        return sheetData;
    }

    /**
     * "Power" on the extra's sheet: the character's other extras that can hold it as a stunt.
     * A power that has stunts can't become the stunt of another one (only one level).
     */
    static getPowerSetting(actor, item) {
        const extras = actor.items
            .filter((extra) => extra.type === "extra")
            .sort((a, b) => (a.sort || 0) - (b.sort || 0));
        const powers = this.getPowers(extras);
        const ownStunts = extras.filter((extra) => powers.get(extra.id) === item.id).length;

        if (ownStunts) {
            return {
                isPower: true,
                text: game.i18n.format("FAx.Item.Extra.Power.IsPower", { stunts: this.stuntCountLabel(ownStunts) }),
            };
        }

        const current = powers.get(item.id) ?? "";
        const options = extras
            .filter((extra) => extra.id !== item.id && !powers.has(extra.id))
            .map((extra) => {
                const stunts = extras.filter((other) => powers.get(other.id) === extra.id).length;

                return {
                    value: extra.id,
                    label: stunts ? `${extra.name} (${this.stuntCountLabel(stunts)})` : extra.name,
                    selected: extra.id === current,
                };
            });

        return { isPower: false, options };
    }

    /**
     * Skill of a character linked to an extra: same name (or the same name ignoring case and spaces)
     */
    static getLinkedSkill(actor, skillName: string) {
        const name = String(skillName ?? "").trim();

        if (!actor?.items || !name) {
            return undefined;
        }

        const skills = actor.items.filter((item) => item.type === "skill");

        return (
            skills.find((skill) => skill.name === name) ??
            skills.find((skill) => normalize(skill.name) === normalize(name))
        );
    }

    /**
     * Fate points spent each time the extra is rolled (0 = free)
     */
    static getFateCost(extra) {
        return Math.max(0, Math.round(Number(extra?.system?.fateCost) || 0));
    }

    /**
     * What the character sheet shows for a rollable extra (null if the extra isn't linked to a skill)
     */
    static getRollInfo(extra) {
        const skillName = String(extra?.system?.skill ?? "").trim();

        if (!skillName) {
            return null;
        }

        const actor = extra.actor ?? extra.parent;
        const bonus = Number(extra.system.bonus) || 0;
        const skill = this.getLinkedSkill(actor, skillName);
        const rank = skill ? Number(skill.system.rank) || 0 : 0;
        const fateCost = this.getFateCost(extra);

        const bonusLabel = bonus
            ? game.i18n.format(bonus < 0 ? "FAx.Item.Extra.Roll.Penalty" : "FAx.Item.Extra.Roll.Bonus", {
                  bonus: signed(bonus),
              })
            : "";
        const costLabel = fateCost ? game.i18n.format("FAx.Item.Extra.Roll.Cost", { cost: fateCost }) : "";

        const title = [
            game.i18n.format("FAx.Item.Extra.Roll.Title", { skill: skill?.name ?? skillName }),
            skill ? `(${signed(rank)})` : "",
            bonusLabel,
            costLabel,
        ]
            .filter(Boolean)
            .join(" ");

        return {
            skill: skill?.name ?? skillName,
            found: !!skill,
            rank: signed(rank),
            bonus: bonusLabel,
            isPenalty: bonus < 0,
            cost: costLabel,
            cannotAfford: fateCost > (Number(actor?.system?.fatepoints?.current) || 0),
            title,
        };
    }

    /**
     * Spends the extra's fate point cost before its roll. Returns false (and warns) if it can't be paid.
     */
    static async payFateCost(actor, extra, cost: number) {
        if (cost <= 0) {
            return true;
        }

        const escape = foundry.utils.escapeHTML;

        if (!actor?.isOwner) {
            ui.notifications.warn(
                game.i18n.format("FAx.Item.Extra.Roll.CannotSpendFatePoints", { actor: escape(actor?.name ?? "") }),
            );
            return false;
        }

        const current = Number(actor.system?.fatepoints?.current) || 0;

        if (current < cost) {
            ui.notifications.warn(
                game.i18n.format("FAx.Item.Extra.Roll.NotEnoughFatePoints", {
                    actor: escape(actor.name),
                    extra: escape(extra.name),
                    cost,
                    current,
                }),
            );
            return false;
        }

        await actor.update({ "system.fatepoints.current": current - cost });
        return true;
    }

    /*************************
     * EVENT HANDLER
     *************************/

    /**
     * Creates a new stunt in a power (any extra on its own can become a power this way)
     */
    static async _onAddStunt(e, sheet) {
        e.preventDefault();
        e.stopPropagation();

        const power = sheet.actor.items.get(e.currentTarget.dataset.item);

        // Only one level: a stunt can't have stunts of its own
        if (!power || power.type !== "extra" || this.getPowers(sheet.actor.items).has(power.id)) {
            return;
        }

        // A collapsed power opens, so the new stunt shows up
        if (power.system.collapsed) {
            await power.update({ "system.collapsed": false });
        }

        await this.createNewItem(
            {
                name: game.i18n.localize("FAx.Item.Extra.Power.NewStunt"),
                type: this.documentName,
                sort: 9000000,
                system: { power: power.id },
            },
            sheet,
        );
    }

    /**
     * Deleting a power asks what happens to its stunts: they stay on the sheet as extras on their own,
     * or are deleted with it. Other extras are deleted as before.
     */
    static async _onItemDelete(e, sheet) {
        const power = sheet.actor.items.get(e.currentTarget.dataset.item);
        const stunts = power ? this.getStunts(sheet.actor, power) : [];

        if (!stunts.length) {
            return super._onItemDelete(e, sheet);
        }

        e.preventDefault();
        e.stopPropagation();

        const escape = foundry.utils.escapeHTML;
        const choice = await foundry.applications.api.DialogV2.wait({
            window: { title: `${game.i18n.localize("FAx.Dialog.DocumentDelete")} ${power.name}` },
            content: `<p>${game.i18n.format("FAx.Item.Extra.Power.DeleteText", {
                power: escape(power.name),
                stunts: this.stuntCountLabel(stunts.length),
            })}</p>`,
            buttons: [
                {
                    action: "power",
                    label: game.i18n.localize("FAx.Item.Extra.Power.DeleteOnlyPower"),
                    icon: "fas fa-trash",
                    default: true,
                },
                {
                    action: "all",
                    label: game.i18n.localize("FAx.Item.Extra.Power.DeleteWithStunts"),
                    icon: "fas fa-trash",
                },
                {
                    action: "cancel",
                    label: game.i18n.localize("FAx.Dialog.Cancel"),
                    icon: "fas fa-times",
                },
            ],
            rejectClose: false,
            modal: true,
        });

        if (choice === "power") {
            await sheet.actor.updateEmbeddedDocuments(
                "Item",
                stunts.map((stunt) => ({ _id: stunt.id, "system.power": "" })),
            );
            await power.delete();
        } else if (choice === "all") {
            await sheet.actor.deleteEmbeddedDocuments("Item", [power.id, ...stunts.map((stunt) => stunt.id)]);
        }
    }

    static async _onStepBonus(e, sheet) {
        e.preventDefault();

        const item = sheet.document ?? sheet.item;
        const step = Number(e.currentTarget.dataset.step) || 0;

        if (!item || !step || sheet.isEditable === false) {
            return;
        }

        await item.update({ "system.bonus": (Number(item.system.bonus) || 0) + step });
    }

    static async _onRollExtra(e, sheet) {
        e.preventDefault();
        e.stopPropagation();

        // Like skills, the extra's name doesn't roll in edit mode (the dice line always does)
        if (e.currentTarget.classList.contains("fatex-extra__name--rollable") && this.isEditMode(e)) {
            return;
        }

        const extra = sheet.actor.items.get(e.currentTarget.dataset.item);

        if (!extra) {
            return;
        }

        // One roll at a time per extra: a double click doesn't roll (or spend fate points) twice
        const key = `${sheet.actor.uuid ?? sheet.actor.id}.${extra.id}`;

        if (this._rolling.has(key)) {
            return;
        }

        this._rolling.add(key);

        try {
            await this.rollExtra(sheet, extra, e);
        } finally {
            this._rolling.delete(key);
        }
    }

    static _rolling = new Set<string>();

    /**
     * Rolls the skill linked to an extra, adding the extra's bonus (or penalty) and spending its fate point cost
     */
    static async rollExtra(sheet, extra, event) {
        const skillName = String(extra.system.skill ?? "").trim();

        if (!skillName) {
            return;
        }

        const skill = this.getLinkedSkill(sheet.actor, skillName);

        if (!skill) {
            const escape = foundry.utils.escapeHTML;

            ui.notifications.warn(
                game.i18n.format("FAx.Item.Extra.Roll.SkillNotFound", {
                    actor: escape(sheet.actor.name),
                    skill: escape(skillName),
                    extra: escape(extra.name),
                }),
            );
            return;
        }

        const fateCost = this.getFateCost(extra);

        await SkillItem.rollSkill(sheet, skill, event, {
            extra: {
                name: extra.name,
                bonus: Number(extra.system.bonus) || 0,
                fateCost,
                // A stunt's card also names its power, and every card shows the extra's description under the roll
                power: this.getPower(extra)?.name ?? "",
                description: await this.getRollDescription(extra),
            },
            // Paid after the roll is prepared (a magic roll may still be refused) and before the dice are rolled
            beforeRoll: fateCost ? () => this.payFateCost(sheet.actor, extra, fateCost) : undefined,
        });
    }

    /**
     * The extra's description as the chat card shows it: rendered once, at the roll (like on the sheet), without
     * secrets, since everyone who sees the card reads it. Empty if the extra has no description.
     */
    static async getRollDescription(extra): Promise<string> {
        const description = String(extra?.system?.description ?? "");
        const content = description
            .replace(/<(?!\/?(img|iframe|video|audio)\b)[^>]*>/gi, "")
            .replace(/&nbsp;/gi, " ")
            .trim();

        if (!content) {
            return "";
        }

        // Markdown text (world setting) becomes HTML first; either way the enrichment leaves the secrets out
        const html = CONFIG.FateX.global.useMarkdown ? marked(description) : description;

        return await foundry.applications.ux.TextEditor.implementation.enrichHTML(html, {
            secrets: false,
            relativeTo: extra,
        });
    }
}
