/**
 * Central identifiers of the system.
 *
 * FateX Continued is a continuation of the original "fatex" system. Everything that is bound to the
 * package id (paths, flags, settings, socket) must use SYSTEM_ID. LEGACY_SYSTEM_ID is only used to
 * read and migrate data created while a world was still running the original "fatex" system.
 */
export const SYSTEM_ID = "fatexcontinued";
export const LEGACY_SYSTEM_ID = "fatex";

export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;
export const TEMPLATES_PATH = `${SYSTEM_PATH}/templates`;
export const ASSETS_PATH = `${SYSTEM_PATH}/assets`;
export const SOCKET_NAME = `system.${SYSTEM_ID}`;

/**
 * Scope used when registering sheets. It is kept as "FateX" on purpose: existing worlds store the chosen
 * sheet class as "FateX.<SheetClass>" in flags.core.sheetClass.
 */
export const SHEET_SCOPE = "FateX";

/**
 * Returns the value of a system flag, falling back to the flags written by the original "fatex" system.
 * The fallback keeps worlds usable before (or without) the one-time world migration.
 */
export function getSystemFlag(document: any, key: string): any {
    if (!document) {
        return undefined;
    }

    const flagPath = `flags.${SYSTEM_ID}.${key}`;
    const value = foundry.utils.getProperty(document, flagPath);

    if (value !== undefined) {
        return value;
    }

    return foundry.utils.getProperty(document, `flags.${LEGACY_SYSTEM_ID}.${key}`);
}
