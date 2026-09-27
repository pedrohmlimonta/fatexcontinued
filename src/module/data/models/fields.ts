/**
 * Small helpers shared by the system data models.
 *
 * Worlds created with the original "fatex" system stored their data through template.json, which never
 * validated types. Values typed into text inputs (like fate points) may therefore be stored as strings.
 * The data models sanitize such values in migrateData() so that legacy documents never fail validation.
 */

export function toFiniteNumber(value: unknown, fallback: number): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (trimmed === "") {
            return fallback;
        }

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    if (typeof value === "boolean") {
        return Number(value);
    }

    return fallback;
}

/**
 * Sanitizes a numeric property in place, but only if it is present.
 * Partial update data must never receive keys it did not contain.
 */
export function sanitizeNumber(source: Record<string, unknown> | undefined | null, key: string, fallback: number) {
    if (!source || typeof source !== "object" || !(key in source)) {
        return;
    }

    source[key] = toFiniteNumber(source[key], fallback);
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

export function numberField(initial: number) {
    return new foundry.data.fields.NumberField({ required: true, nullable: false, initial });
}

export function stringField(initial = "") {
    return new foundry.data.fields.StringField({ required: true, nullable: false, blank: true, initial });
}

export function htmlField(initial = "") {
    return new foundry.data.fields.HTMLField({ required: true, nullable: false, blank: true, initial });
}

export function booleanField(initial = false) {
    return new foundry.data.fields.BooleanField({ required: true, initial });
}
