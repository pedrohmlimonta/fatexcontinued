/**
 * System data models for actors.
 * They replace the deprecated template.json (deprecated in Foundry VTT v14, removed in v16) and keep the
 * exact same data structure, so existing actors do not need any data migration.
 */
import { htmlField, isObject, numberField, sanitizeNumber, stringField, booleanField } from "./fields";

const TypeDataModel = foundry.abstract.TypeDataModel;

export class CharacterDataModel extends TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            biography: new fields.SchemaField({
                value: htmlField(),
            }),
            fatepoints: new fields.SchemaField({
                current: numberField(3),
                refresh: numberField(3),
            }),
        };
    }

    static migrateData(source: Record<string, any>) {
        if (isObject(source?.fatepoints)) {
            sanitizeNumber(source.fatepoints, "current", 3);
            sanitizeNumber(source.fatepoints, "refresh", 3);
        }

        return super.migrateData(source);
    }
}

export class GroupDataModel extends TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            groupType: stringField("manual"),
            options: new fields.SchemaField({
                showArtwork: booleanField(true),
            }),
        };
    }
}

export const ACTOR_DATA_MODELS = {
    character: CharacterDataModel,
    group: GroupDataModel,
};
