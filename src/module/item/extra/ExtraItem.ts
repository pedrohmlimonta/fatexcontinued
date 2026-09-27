import { StuntItem } from "../stunt/StuntItem";
import { SkillItem } from "../skill/SkillItem";
import { Automation } from "../../components/Automation/Automation";

/**
 * Bonuses offered on the extra sheet (negative values are penalties)
 */
export const EXTRA_BONUS_RANGE = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

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
        sheetData.availableBonuses = EXTRA_BONUS_RANGE;

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
     * What the character sheet shows for a rollable extra (null if the extra isn't linked to a skill)
     */
    static getRollInfo(extra) {
        const skillName = String(extra?.system?.skill ?? "").trim();

        if (!skillName) {
            return null;
        }

        const bonus = Number(extra.system.bonus) || 0;
        const skill = this.getLinkedSkill(extra.actor ?? extra.parent, skillName);
        const rank = skill ? Number(skill.system.rank) || 0 : 0;

        const bonusLabel = bonus
            ? game.i18n.format(bonus < 0 ? "FAx.Item.Extra.Roll.Penalty" : "FAx.Item.Extra.Roll.Bonus", {
                  bonus: signed(bonus),
              })
            : "";

        const title = [
            game.i18n.format("FAx.Item.Extra.Roll.Title", { skill: skill?.name ?? skillName }),
            skill ? `(${signed(rank)})` : "",
            bonusLabel,
        ]
            .filter(Boolean)
            .join(" ");

        return {
            skill: skill?.name ?? skillName,
            found: !!skill,
            rank: signed(rank),
            bonus: bonusLabel,
            isPenalty: bonus < 0,
            title,
        };
    }

    /*************************
     * EVENT HANDLER
     *************************/

    static async _onRollExtra(e, sheet) {
        e.preventDefault();
        e.stopPropagation();

        // Like skills, the extra's name doesn't roll in edit mode (the dice line always does)
        if (e.currentTarget.classList.contains("fatex-extra__name--rollable") && this.isEditMode(e)) {
            return;
        }

        const extra = sheet.actor.items.get(e.currentTarget.dataset.item);

        if (extra) {
            await this.rollExtra(sheet, extra, e);
        }
    }

    /**
     * Rolls the skill linked to an extra, adding the extra's bonus (or penalty)
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

        await SkillItem.rollSkill(sheet, skill, event, {
            extra: { name: extra.name, bonus: Number(extra.system.bonus) || 0 },
        });
    }
}
