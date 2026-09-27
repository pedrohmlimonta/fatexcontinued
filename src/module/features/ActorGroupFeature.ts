import { FateActor } from "../actor/FateActor";
import { GroupSheet } from "../actor/sheets/GroupSheet";
import { getOpenGroupSheets, renderGroupSheetsByGroupType } from "../helper/ActorGroupHelper";
import { ASSETS_PATH, SYSTEM_ID } from "../../constants";

/**
 * Represents the actor group panel containing multiple actor groups.
 * Is displayed inside the actor sidebar tab by default.
 */
export class ActorGroupFeature {
    static hooks() {
        Hooks.on("renderActorDirectory", (_app, html) => {
            if (game.settings.get(SYSTEM_ID, "enableAlphaFeatures")) {
                const root: HTMLElement | undefined = html instanceof HTMLElement ? html : html?.[0];

                if (!root) {
                    return;
                }

                this.addCreateGroupButton(root);
                this.styleGroupEntries(root);
            }
        });

        /**
         * Rerender all inline-sheets of updated actor (needed for synthetic actor token to circumvent patching the _onUpdateBaseActor method)
         */
        Hooks.on("updateActor", (document) => {
            if (game.settings.get(SYSTEM_ID, "enableAlphaFeatures")) {
                for (const groupSheet of getOpenGroupSheets()) {
                    const inlineSheetsOfUpdatedActor = groupSheet.inlineSheets.filter(
                        (sheet) => sheet.actor?.id === document.id,
                    );

                    for (const inlineSheet of inlineSheetsOfUpdatedActor) {
                        inlineSheet.render();
                    }
                }
            }
        });

        /**
         * Rerender groupsheets of type scene whenever the viewed scene changes to another scene
         */
        Hooks.on("canvasReady", () => {
            if (game.settings.get(SYSTEM_ID, "enableAlphaFeatures")) {
                renderGroupSheetsByGroupType("scene");
            }
        });
    }

    static addCreateGroupButton(html: HTMLElement) {
        if (!game.user?.isGM || html.querySelector(".fatex-header-actions")) {
            return;
        }

        // Add "Create Group" button
        const actions = document.createElement("div");
        actions.classList.add("fatex-header-actions", "header-actions", "action-buttons", "flexrow");
        actions.innerHTML = `
            <button type="button" class="create-actor-group">
                <i class="fas fa-users" inert></i> ${game.i18n.localize("FAx.ActorGroups.New")}
            </button>
        `;

        const headerActions = html.querySelector(".header-actions");

        if (headerActions) {
            headerActions.insertAdjacentElement("afterend", actions);
        } else {
            (html.querySelector(".directory-header") ?? html).prepend(actions);
        }

        actions
            .querySelector("button")
            ?.addEventListener("click", (e) => this._onClickCreateGroup.call(this, e as MouseEvent));

        html.querySelectorAll<HTMLElement>(".folder[data-folder-id]").forEach((element) => {
            const folderId = element.dataset.folderId ?? "";
            const header = element.querySelector(".folder-header");

            if (!folderId || !header || header.querySelector(".create-folder-group")) {
                return;
            }

            const name = game.folders?.get(folderId)?.name ?? "";
            const link = document.createElement("a");
            link.classList.add("create-folder-group");
            link.dataset.folder = folderId;
            link.dataset.groupname = name;
            link.innerHTML = `<i class="fas fa-user-friends fa-fw" inert></i>`;
            link.addEventListener("click", (e) => this._onClickCreateGroup.call(this, e as MouseEvent));

            header.append(link);
        });
    }

    static styleGroupEntries(html: HTMLElement) {
        const groupActors = game.actors?.filter((actor) => actor.type === "group") || [];

        groupActors.forEach((actor) => {
            // Add small group icon infront of each group name
            const group = html.querySelector(`[data-entry-id="${actor.id}"], [data-document-id="${actor.id}"]`);

            if (!group || group.classList.contains("fatex__actorDirectory__entry")) {
                return;
            }

            group.classList.add("fatex__actorDirectory__entry");

            const name = group.querySelector(".entry-name, .document-name");
            const icon = document.createElement("i");
            icon.classList.add("fas", "fa-users");

            name?.insertAdjacentElement("afterend", icon);
        });
    }

    /*************************
     * EVENT HANDLER
     *************************/

    /**
     * Creates a new group actor and renders it immediately (inside the group panel)
     */
    static async _onClickCreateGroup(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const target = event.currentTarget as HTMLElement;

        const actorData: any = {
            name: target.dataset.groupname || game.i18n.localize("FAx.ActorGroups.New"),
            type: "group",
            img: `${ASSETS_PATH}/icons/group.svg`,
            folder: target.dataset.folder || undefined,
        };

        const newGroup = await FateActor._create(actorData, { renderSheet: true });
        const sheet = newGroup?.sheet;

        if (target.dataset.folder && sheet instanceof GroupSheet) {
            await sheet._createActorReferencesFromFolder(target.dataset.folder);
        }
    }
}
