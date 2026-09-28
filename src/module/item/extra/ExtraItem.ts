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

        return sheetData;
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

        return sheetData;
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
            extra: { name: extra.name, bonus: Number(extra.system.bonus) || 0, fateCost },
            // Paid after the roll is prepared (a magic roll may still be refused) and before the dice are rolled
            beforeRoll: fateCost ? () => this.payFateCost(sheet.actor, extra, fateCost) : undefined,
        });
    }
}
