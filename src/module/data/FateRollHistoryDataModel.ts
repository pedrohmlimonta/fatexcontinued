// @ts-nocheck
export class FateRollHistoryDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            user: new fields.StringField({ required: true, blank: false }),
            type: new fields.StringField({
                required: true,
                blank: false,
                choices: ["reroll", "increase"],
            }),
            timestamp: new fields.NumberField({ required: true, nullable: false, initial: () => Date.now() }),
            previousRoll: new fields.ArrayField(new fields.NumberField({ required: true, nullable: false }), {
                required: false,
            }),
        };
    }

    get previousRollTotal() {
        const total = (this.previousRoll ?? []).reduce((a, b) => a + b, 0);
        return total >= 0 ? `+${total}` : `${total}`;
    }

    get message() {
        switch (this.type) {
            case "reroll":
                return game.i18n.format("FAx.ChatCard.History.Reroll", { previous: this.previousRollTotal });
            case "increase":
                return game.i18n.localize("FAx.ChatCard.History.Increase");
        }

        return "";
    }
}
