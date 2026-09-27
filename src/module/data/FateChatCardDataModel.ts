// @ts-nocheck
import { FateRoll } from "../chat/FateRoll";

export class FateChatCardDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            messageId: new fields.StringField({ required: false, blank: true }),
            speaker: new fields.ObjectField({ required: true }),
            rolls: new fields.ArrayField(
                new fields.EmbeddedDataField(FateRoll, {
                    required: true,
                    nullable: false,
                }),
                {
                    required: true,
                    nullable: false,
                    initial: [],
                },
            ),
            options: new fields.ObjectField({
                required: false,
                nullable: true,
            }),
        };
    }

    static migrateData(source) {
        const schema = this.schema;

        for (const [name, value] of Object.entries(source ?? {})) {
            const field = schema.get(name);

            if (!field) continue;

            if (field instanceof foundry.data.fields.EmbeddedDataField) {
                source[name] = field.model.migrateDataSafe(value || {});
            } else if (
                field instanceof foundry.data.fields.ArrayField &&
                field.element instanceof foundry.data.fields.EmbeddedDataField &&
                Array.isArray(value)
            ) {
                value.forEach((d) => field.element.model.migrateDataSafe(d));
            }
        }

        return super.migrateData(source);
    }
}
