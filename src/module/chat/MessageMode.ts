/**
 * Chat message visibility helpers.
 *
 * Foundry VTT v14 replaced the "roll modes" (core.rollMode / ChatMessage.applyRollMode) with "message modes"
 * (core.messageMode / ChatMessage.applyMode). On 14.368 the legacy core.rollMode setting no longer returns a
 * usable value, so the system always works with the new message modes.
 */

const LEGACY_TO_MESSAGE_MODE: Record<string, string> = {
    roll: "public",
    publicroll: "public",
    gmroll: "gm",
    blindroll: "blind",
    selfroll: "self",
};

const MESSAGE_TO_LEGACY_MODE: Record<string, string> = {
    public: "publicroll",
    gm: "gmroll",
    blind: "blindroll",
    self: "selfroll",
};

function readCoreSetting(key: string): string | undefined {
    try {
        return game.settings.get("core", key) ?? undefined;
    } catch (_err) {
        return undefined;
    }
}

/**
 * Returns the message mode currently selected by the user.
 * The in-character mode ("ic") is treated as public, because roll cards are not character speech.
 */
export function getMessageMode(): string {
    const mode = readCoreSetting("messageMode") ?? readCoreSetting("rollMode");

    if (!mode || mode === "ic") {
        return "public";
    }

    return LEGACY_TO_MESSAGE_MODE[mode] ?? mode;
}

/**
 * Applies the given (or current) message mode to a chat message data object.
 */
export function applyMessageMode(chatData: Record<string, any>, mode: string = getMessageMode()) {
    if (typeof ChatMessage.applyMode === "function") {
        return ChatMessage.applyMode(chatData, mode);
    }

    return ChatMessage.applyRollMode(chatData, MESSAGE_TO_LEGACY_MODE[mode] ?? mode);
}
