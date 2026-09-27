/**
 * FateActor is the default document class for actors inside the FateX system.
 * Adds custom features based on the system.
 */
import { getImageFromReference, getReferencesByGroupType } from "../helper/ActorGroupHelper";
import { getSystemFlag } from "../../constants";

export class FateActor extends Actor {
    /**
     * Open the template picker instead of showing the default creation dialog.
     * The default dialog is still used when creating actors inside a compendium.
     */
    static async createDialog(data: any = {}, createOptions: any = {}, ...args: any[]): Promise<any> {
        const picker = CONFIG.FateX.applications.templatePicker;

        if (!picker || createOptions?.pack || createOptions?.parent) {
            return super.createDialog(data, createOptions, ...args);
        }

        const folder = data?.folder;
        picker.options.folder = typeof folder === "object" && folder !== null ? folder.id ?? folder._id : folder;

        return picker.render(true);
    }

    /**
     * Creates a new actor and optionally renders its sheet.
     * Kept as a single entry point for the template picker, the template settings and actor groups.
     */
    static async _create(data: any, options = {}) {
        return this.create(data, options);
    }

    /**
     * Re-render all open FateX applications as soon a single actor is updated (used for TemplateActorSettings and TemplateActorPicker)
     */
    render(force = false, options: any = {}) {
        const result = super.render?.(force, options);

        for (const app in CONFIG.FateX.applications) {
            const application = CONFIG.FateX.applications[app];

            if (application?.rendered) {
                application.render();
            }
        }

        return result;
    }

    /**
     * Returns true if the current actor is an actor template
     */
    get isTemplateActor() {
        return !!getSystemFlag(this, "isTemplateActor");
    }

    /**
     * Hides some actors from the sidebar directory list
     */
    get visible() {
        if (this.isTemplateActor) {
            return false;
        }

        return super.visible;
    }

    /**
     * Helper method to only test for visibility based on permissions
     */
    get isVisibleByPermission() {
        return super.visible;
    }

    get images(): string[] {
        if (this.type !== "group") {
            return [];
        }

        const images: string[] = [];
        const actorReferences = getReferencesByGroupType(this.system.groupType, this);

        for (let i = 0; i < 4; i++) {
            images.push(actorReferences[i] ? getImageFromReference(actorReferences[i]) : CONST.DEFAULT_TOKEN);
        }

        return images;
    }
}
