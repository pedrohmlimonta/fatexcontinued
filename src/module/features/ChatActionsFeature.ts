// @ts-nocheck
import { FateChatCard } from "../chat/FateChatCard";
import { SOCKET_NAME, getSystemFlag } from "../../constants";

/**
 * Handles the action buttons (+2 and reroll) of FateX roll cards in the chat.
 */
export class ChatActionsFeature {
    static hooks() {
        // Since Foundry VTT v13 every rendered message (chat log, popouts and notifications) passes through this hook
        Hooks.on("renderChatMessageHTML", (message, html) => this.chatMessageListeners(message, html));

        Hooks.once("init", () => {
            game.socket.on(SOCKET_NAME, (data) => {
                if (data.type === "totalChanged") {
                    const { messageId, rollIndex } = data;
                    this.triggerTotalChangedAnimation(messageId, rollIndex, false);
                }

                if (data.type === "reroll") {
                    const { messageId, rollIndex } = data;
                    this.triggerRerollAnimation(messageId, rollIndex, false, true);
                }

                if (data.type === "chatAction") {
                    if (!this.isResponsibleGM()) return;

                    const { action, messageId, rollIndex, shiftKey, userId } = data;
                    this.handleChatAction(action, messageId, rollIndex, shiftKey, userId);
                }
            });
        });
    }

    /**
     * Only one connected GM should handle chat actions requested by players.
     */
    private static isResponsibleGM() {
        if (!game.user?.isGM) return false;

        const activeGM = game.users?.activeGM;

        if (activeGM) {
            return activeGM.id === game.user.id;
        }

        const connectedGMs = game.users.filter((u) => u.isGM && u.active);
        return !connectedGMs.some((other) => other.id < game.user.id);
    }

    /**
     * Returns all elements matching the selector, including elements inside detached windows (Foundry VTT v14).
     */
    private static queryAll(selector: string): HTMLElement[] {
        const detached = foundry.applications?.detached;

        if (typeof detached?.querySelectorAll === "function") {
            return Array.from(detached.querySelectorAll(selector));
        }

        return Array.from(document.querySelectorAll(selector));
    }

    private static triggerChatAnimation(type, messageId, rollIndex, disable = false) {
        const messages = this.queryAll(`.message[data-message-id="${messageId}"]`);

        for (const message of messages) {
            message.querySelectorAll(`.fatex-chat__roll[data-roll-index="${rollIndex}"]`).forEach((roll) => {
                roll.classList.add(`fatex-chat__roll--${type}`);
            });

            if (disable) {
                message.querySelectorAll(".fatex-roll-actions button[data-action]").forEach((button) => {
                    button.disabled = true;
                });
            }
        }
    }

    static chatMessageListeners(message, html: HTMLElement | JQuery) {
        const element = html instanceof HTMLElement ? html : html?.[0];

        if (!element || !getSystemFlag(message, "chatCard")) {
            return;
        }

        element.querySelectorAll(".fatex-roll-actions button[data-action]").forEach((button) => {
            button.addEventListener("click", (event) => this._onChatCardAction(event));
        });
    }

    static async _onChatCardAction(event) {
        event.preventDefault();
        event.stopPropagation();

        const button = event.currentTarget;
        const action = button.dataset.action;
        const messageId = button.closest(".message")?.dataset.messageId;
        const rollIndex = button.closest(".fatex-chat__roll")?.dataset.rollIndex;

        if (!messageId || rollIndex === undefined) {
            return;
        }

        if (!game.user.isGM) {
            if (!game.users.filter((u) => u.isGM && u.active).length) {
                return ui.notifications.warn(game.i18n.localize("FAx.ChatCard.NoGMConnected"));
            }

            return game.socket.emit(SOCKET_NAME, {
                type: "chatAction",
                action,
                messageId,
                rollIndex,
                shiftKey: event.shiftKey,
                userId: game.user.id,
            });
        }

        return await this.handleChatAction(action, messageId, rollIndex, event.shiftKey);
    }

    static async handleChatAction(action, messageId, rollIndex, shiftKey, userId = game.user.id) {
        const message = game.messages?.get(messageId);

        const chatCardFlag = getSystemFlag(message, "chatCard") ?? false;
        if (!chatCardFlag) {
            return;
        }

        const chatCard = new FateChatCard(foundry.utils.deepClone(chatCardFlag));

        // Fallback for chat cards which were stored without their message id
        if (!chatCard.messageId) {
            chatCard.updateSource({ messageId });
        }

        const roll = chatCard.rolls[rollIndex];

        if (!roll) {
            return;
        }

        if (action === "reroll") {
            this.triggerRerollAnimation(messageId, rollIndex);
            await roll.reroll(userId, { shiftKey });
            await chatCard.updateMessage();
            this.triggerTotalChangedAnimation(messageId, rollIndex);
        }

        if (action === "increase") {
            roll.increase(userId, { shiftKey });
            await chatCard.updateMessage();
            this.triggerTotalChangedAnimation(messageId, rollIndex);
        }
    }

    static triggerTotalChangedAnimation(messageId: string, rollIndex: string, sync = true, disable = false) {
        this.triggerChatAnimation("totalChanged", messageId, rollIndex, disable);

        if (sync) {
            game.socket.emit(SOCKET_NAME, { type: "totalChanged", messageId, rollIndex });
        }
    }

    static triggerRerollAnimation(messageId: string, rollIndex: string, sync = true, disable = true) {
        this.triggerChatAnimation("reroll", messageId, rollIndex, disable);

        if (sync) {
            game.socket.emit(SOCKET_NAME, { type: "reroll", messageId, rollIndex });
        }
    }
}
