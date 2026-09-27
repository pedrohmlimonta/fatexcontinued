import { TemplateActorPicker } from "../applications/template-actors/TemplateActorPicker";
import { TemplateActorSettings } from "../applications/template-actors/TemplateActorSettings";

export class TemplateActorsFeature {
    static hooks() {
        Hooks.once("ready", async () => {
            // Initialize instances in config
            CONFIG.FateX.applications.templateSettings = new TemplateActorSettings({});
            CONFIG.FateX.applications.templatePicker = new TemplateActorPicker({});
        });

        // Add extra button to foundrys settings sidebar (Application V2 since Foundry VTT v13)
        Hooks.on("renderSettings", (_app, html) => {
            if (!game.user?.isGM) {
                return;
            }

            const root: HTMLElement | undefined = html instanceof HTMLElement ? html : html?.[0];

            if (!root || root.querySelector('[data-fatex="templates"]')) {
                return;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.dataset.fatex = "templates";
            button.innerHTML = `<i class="fas fa-file-medical" inert></i> ${game.i18n.localize(
                "FAx.Settings.Templates.Button",
            )}`;
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                CONFIG.FateX.applications.templateSettings?.render(true);
            });

            const configureButton = root.querySelector('button[data-app="configure"], button[data-action="configure"]');

            if (configureButton) {
                configureButton.insertAdjacentElement("beforebegin", button);
                return;
            }

            const section = root.querySelector("section.settings") ?? root.querySelector("section") ?? root;
            section.append(button);
        });
    }
}
