// @ts-nocheck
import { FateRollHistoryDataModel } from "./FateRollHistoryDataModel";

export class FateRollDataModel extends foundry.abstract.DataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            id: new fields.StringField({ required: true, blank: false }),
            name: new fields.StringField({ required: true, blank: false }),
            rank: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
            bonus: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
            faces: new fields.ArrayField(new fields.NumberField({ required: true, nullable: false })),
            history: new fields.ArrayField(new fields.EmbeddedDataField(FateRollHistoryDataModel), {
                required: false,
            }),
            options: new fields.ObjectField({ required: false }),
        };
    }

    static migrateData(source) {
        if (source && "_id" in source) {
            source.id = source._id;
            delete source._id;
        }

        if (source && source.bonus === null) {
            source.bonus = 0;
        }

        // FateX 1.x stored the complete actor document inside the roll options (and therefore inside every chat
        // message). Only keep a reference to the actor.
        const actor = source?.options?.actor;

        if (actor && typeof actor === "object") {
            source.options.actorId ??= actor._id ?? actor.id ?? null;
            delete source.options.actor;
        }

        return super.migrateData(source);
    }
}
