// @ts-nocheck
import { SYSTEM_ID } from "../../constants";

/**
 * A fate die for the GuildCodex magic system: a "+" counts double.
 */
export class MagicDie extends foundry.dice.terms.FateDie {
    static DENOMINATION = "m";

    async roll({ minimize = false, maximize = false, ...options } = {}) {
        const roll = (await super.roll({ minimize, maximize, ...options })) ?? this.results[this.results.length - 1];

        if (roll) {
            roll.count = roll.result === 1 ? 2 : roll.result;
        }

        return roll;
    }
}

export class MagicSystem {
    static hooks() {
        Hooks.once("init", () => {
            if (game.settings.get(SYSTEM_ID, "guildCodexMagicSystemEnabled")) {
                CONFIG.Dice.terms["m"] = MagicDie;
            }
        });

        Hooks.once("diceSoNiceReady", (dice3d) => {
            if (!game.settings.get(SYSTEM_ID, "guildCodexMagicSystemEnabled")) return;

            dice3d.addDicePreset(
                {
                    type: "dm",
                    labels: ["−", " ", "+", "−", " ", "+"],
                    values: { min: -1, max: 1 },
                    fontScale: 2,
                    system: "standard",
                },
                "d6",
            );
        });
    }
}
