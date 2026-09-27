/**
 * System data models for items.
 * They mirror the structure previously defined in template.json (including its "base" and "subItem"
 * templates) so existing items keep all of their data.
 */
import { booleanField, htmlField, isObject, numberField, sanitizeNumber, stringField } from "./fields";

const TypeDataModel = foundry.abstract.TypeDataModel;

/**
 * Fields of the former "base" template
 */
function baseFields() {
    return {
        disabled: booleanField(false),
        description: htmlField(),
    };
}

/**
 * Fields of the former "subItem" template
 */
function subItemFields() {
    return {
        parentID: stringField(""),
    };
}

export class StressDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            ...baseFields(),
            size: numberField(2),
            value: numberField(0),
            labelType: numberField(0),
            customLabel: stringField(""),
        };
    }

    static migrateData(source: Record<string, any>) {
        sanitizeNumber(source, "size", 2);
        sanitizeNumber(source, "value", 0);
        sanitizeNumber(source, "labelType", 0);

        return super.migrateData(source);
    }
}

export class AspectDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            ...baseFields(),
            label: stringField(""),
            value: htmlField(),
            corrupted: booleanField(false),
        };
    }
}

export class ConsequenceDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            ...baseFields(),
            label: stringField(""),
            value: htmlField(),
            icon: stringField(""),
            type: numberField(0),
            active: booleanField(false),
            boxAmount: numberField(1),
            boxValues: numberField(0),
        };
    }

    static migrateData(source: Record<string, any>) {
        sanitizeNumber(source, "type", 0);
        sanitizeNumber(source, "boxAmount", 1);
        sanitizeNumber(source, "boxValues", 0);

        return super.migrateData(source);
    }
}

export class SkillDataModel extends TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;

        return {
            ...baseFields(),
            rank: numberField(0),
            options: new fields.SchemaField({
                isMagicSkill: booleanField(false),
            }),
        };
    }

    static migrateData(source: Record<string, any>) {
        sanitizeNumber(source, "rank", 0);

        if (source && "options" in source && !isObject(source.options)) {
            delete source.options;
        }

        return super.migrateData(source);
    }
}

export class StuntDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            ...baseFields(),
            shortDescription: stringField(""),
            collapsed: booleanField(false),
        };
    }
}

export class ExtraDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            ...baseFields(),
            ...subItemFields(),
            shortDescription: stringField(""),
            collapsed: booleanField(false),
        };
    }
}

export class ActorReferenceDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            id: stringField(""),
        };
    }
}

export class TokenReferenceDataModel extends TypeDataModel {
    static defineSchema() {
        return {
            id: stringField(""),
            scene: stringField(""),
        };
    }
}

export const ITEM_DATA_MODELS = {
    stress: StressDataModel,
    aspect: AspectDataModel,
    consequence: ConsequenceDataModel,
    skill: SkillDataModel,
    stunt: StuntDataModel,
    extra: ExtraDataModel,
    actorReference: ActorReferenceDataModel,
    tokenReference: TokenReferenceDataModel,
};
