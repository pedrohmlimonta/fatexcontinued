// @ts-nocheck
import { FateActor } from "../actor/FateActor";
import { FateRoll } from "./FateRoll";
import { FateChatCardDataModel } from "../data/FateChatCardDataModel";
import { SYSTEM_ID, TEMPLATES_PATH } from "../../constants";
import { applyMessageMode } from "./MessageMode";

export class FateChatCard extends FateChatCardDataModel {
    static create(actor: FateActor, rolls: FateRoll[], options = {}) {
        const speaker = ChatMessage.getSpeaker({ actor });

        return new FateChatCard({
            speaker,
            rolls: rolls.map((roll) => (roll?.toObject ? roll.toObject() : roll)),
            options,
        });
    }

    async sendToChat() {
        const content = await this.render();

        const chatData = {
            author: game.user?.id,
            speaker: this.speaker,
            content: content,
            flags: {
                [SYSTEM_ID]: {
                    chatCard: this.toObject(false),
                },
            },
        };

        applyMessageMode(chatData);
        const message = await ChatMessage.create(chatData);

        if (!message) {
            return;
        }

        this.updateSource({ messageId: message.id });
        await this.updateMessage();
    }

    async updateMessage() {
        const message = this.getMessage();

        if (!message) {
            ui.notifications.warn(game.i18n.localize("FAx.ChatCard.MessageNotFound"));
            return;
        }

        const content = await this.render();
        return await message.update({ content, flags: { [SYSTEM_ID]: { chatCard: this.toObject(false) } } });
    }

    private getMessage() {
        return game.messages?.get(this.messageId);
    }

    async render() {
        const template = `${TEMPLATES_PATH}/chat/chat-card.hbs`;
        const rolls = await Promise.all(this.rolls.map((roll) => roll.render()));

        return await foundry.applications.handlebars.renderTemplate(template, { rolls });
    }
}
