# Changelog

## FateX Continued

### 2.0.2
* Extras can cost fate points: the extra's sheet has a "Fate point cost" field (0 by default). Rolling the extra checks that the character has enough fate points, spends them and then rolls; without enough fate points it warns and doesn't roll. The character sheet shows the cost next to the skill (in red when it can't be paid) and the chat card says how many fate points were spent. Nothing is spent when the roll can't happen (for example a magic roll without a magic skill), and a double click rolls and pays only once.
* Extras: the roll bonus or penalty has no limit anymore. The extra's sheet keeps the -4 to +4 row and adds − (left) and + (right) buttons that change it by one beyond those values; a bonus outside that range is shown at the matching end of the row.

### 2.0.1
**Extras linked to a skill**
* An extra can be linked to one of the character's skills and carry a roll bonus or penalty, both set on the extra's sheet ("Linked skill" and "Roll bonus or penalty").
* On the character sheet, a linked extra shows the skill it rolls, its rank and the bonus. Clicking the extra's name (except in edit mode) or that line rolls the skill with the extra's bonus, like a skill roll (shift for magic dice, 2d6 mode, Dice So Nice).
* The chat card shows the extra's name and bonus under the skill. The bonus is part of the roll's bonus, so +2 and rerolls keep it.
* The skill is referenced by name (like skill automation), so extras keep working when copied to other characters. If the character doesn't have that skill, the sheet says so and clicking warns instead of rolling.
* Extras created before this version are not linked to any skill and look the same as before.

### 2.0.0
First release of **FateX Continued**, the community continuation of FateX, based on FateX 1.5.4 plus the unreleased upstream change that uses the aspect label as chat title (anvil-vtt/FateX#153).

**Foundry VTT v14**
* Compatible with Foundry VTT v14, verified on 14.368 (minimum: v14).
* New system id `fatexcontinued`: system paths, flags, world settings and the socket channel were renamed.
* Replaced the deprecated `template.json` with `documentTypes` in `system.json` and TypeDataModels that keep the exact same data structure. Legacy values stored as text (for example fate points) are converted to numbers.
* Rolls use the v14 message modes (`core.messageMode` / `ChatMessage.applyMode`). The legacy `core.rollMode` setting returns no value on 14.368. The in-character mode is treated as public for roll cards.
* Chat card buttons (+2 and reroll) are bound through `renderChatMessageHTML`, so they work in the chat log, chat notifications and pop-outs without duplicated listeners.
* Replaced APIs that were removed in v14 (`Math.clamped`, `ChatMessage#user`) and global APIs deprecated since v13 (`renderTemplate`, `loadTemplates`, `TextEditor`, `Actors/Items.registerSheet`, `ActorSheet`, `ItemSheet`, `FormApplication`, `Dialog`, `duplicate`). Confirmations use `DialogV2`.
* The "FateX templates" button is added to the Application V2 settings sidebar again (`renderSettings`).
* Actor directory additions of the alpha features use the v13+ directory markup.
* Scene token updates re-render actor groups again (`_onUpdateDescendantDocuments`).
* The magic die (`dM`) uses the asynchronous dice API, so dice fulfillment keeps working.

**Migration of existing worlds**
* The first time a GM opens a world that used the original `fatex` system, flags (templates, skill automation, chat cards) and world settings are copied to the new namespace. Nothing is deleted. Until then the legacy flags are read as a fallback.
* The migration can be repeated with `CONFIG.FateX.migrateWorld({ force: true })`.

**Fixes**
* The limited actor sheet referenced a missing partial and could not be rendered.
* Actor groups: token references, creating a group from a folder, inline sheet injection and ordering of token references.
* Dropping a journal entry (or page) on a character creates an extra with the text of the entry again.
* Stunt and extra descriptions are enriched for display only; the enriched HTML is no longer written into the item data (it could be saved over the original text, replacing `@UUID` links).
* Chat cards no longer store the whole actor inside every roll (only its id and uuid).
* Sheet setup presets import their automation flags under the new flag scope.
* Aspect titles sent to chat render their enriched HTML.
* Missing Portuguese (Brazil) translations and document type labels.

**Development**
* Removed the outdated foundry-vtt-types v9 dependency (Foundry globals are typed as `any`).
* Added smoke tests running the compiled bundle against an imitation of the v14 API (`npm test`).
* GitHub workflows: CI (lint, types, build, tests) and release (builds `fatexcontinued.zip` and `system.json` for manifest installs).

## FateX (original)

### 1.3.2
* Added the optional 2d6 based roll mode (disabled by default)

### 1.3.1
* Prevented stunt boxes from overflowing into the rest of the layout

### 1.3.0
* Updated all NPM dependencies
* Added support for Foundry v11

### 1.2.4
* Allow magic and normal dice to be rolled at the same time

### 1.2.2
* Added option to change the color for magic dice

### 1.2.1
* Fixed some wording and added a reload button after changing specific system settings

### 1.2.0
* Added support for the GuildCodex magic system (disabled by default)

### 1.1.1
* Automatically updates the prototype token name when an actors name is changed (if both were identical). Can be disabled in the system settings.

### 1.1.0
* Fixed skill modifier display in chat messages
* Updated all npm dependencies to newest versions
* Added action buttons to new chat messages (+2 and reroll)

### 1.0.2
* Roll 4dFm while holding shift - a modifier which counts pluses double

### 1.0.1
* Fixed inline character sheet size (group view)

### 1.0.0
* Initial 1.0 release!
* Added support for Foundry v10

### 0.16.1
* Wrap actor template inside picker and settings menu instead of using a horizontal scroll bar

### 0.16.1
* Allow artwork of all sized to be fully shown
* Fixed focus loss on sheet re-render

### 0.16.0
* Updated all npm dependencies to newest versions
* Added new translations
  * Portuguese (Brazil) (big thanks to contributor [luizbgomide](https://github.com/luizbgomide))
* Updated existing translations
  * German (big thanks to contributor [ianw12345](https://github.com/ianw12345))
  * French (big thanks to contributor [em-squared](https://github.com/em-squared))
* Added compatibility to Baileywikis maps modules 

### 0.15.3
* Fixed text wrapping of headline icons (e.g. +2)
* Fixed wrongly associated language keys

### 0.15.2
* Enrich the output of stunts and extras with entity links

### 0.15.1
* Allow skill ranks to go beyond +9

### 0.15.0
* Added compatibility to FoundryVTT v9

### 0.14.1
* Added the ability to change the image for unlinked items

### 0.14.0
* Another big round of style refactorings
* Added compatibility to the compendium folders module
* Made the actor system compatible to 0.8 again
* Updated all npm dependencies except for FoundryVTT types

### 0.13.0
* Fixed bug which sorted skills into alternating columns
* Added skill sorting by name and a sort reversal button

### 0.12.4
* Fixed sorting for aspects and consequences

### 0.12.3
* Updated Swedish transalation to include all character setup files (big thanks to contributor [Grottmastaren](https://github.com/Grottmastaren))
* Bug fixes for the template picker system

### 0.12.2
* Re-enabled the description field for skills

### 0.12.1
* Fixed a bug there the character biography was not editable anymore

### 0.12.0
* Big refactoring of all style files by [Pjb518](https://github.com/Pjb518)
* Updated compatability up to FoundryVTT 0.8.8

### 0.11.3
* Moved template preloading to the end of the init hook to prevent ActorSheets to be registered too late

### 0.11.2
* Changed terser settings to stop rewriting class names

### 0.11.1
* Fixed bug when opening the german sheet setup window

### 0.11.0
* Added compatibility to FoundryVTT 0.8 (big thanks to contributors [saif-ellafi](https://github.com/saif-ellafi) and [Pjb518](https://github.com/Pjb518))
* Updated all npm dependencies

### 0.10.0
* Added new translations
  * Swedish (big thanks to contributor [Grottmastaren](https://github.com/Grottmastaren))
* Updated all npm dependencies
* Added new "Alpha features" setting to system
  * This enables experimental alpha features. These are subject to change and could potentially break things.
* Added alpha version of the group system. This is still a very early, unfinished version. Only meant for deverloper use.

### 0.9.3
* Added new translations
  * Korean (big thanks to contributor [MaronKB](https://github.com/MaronKB))
* Updated all npm dependencies


### 0.9.2
* Fixed italian language file
* Updated all npm dependencies
* Fixed build errors

### 0.9.1
* Fixed biography editor 
* Better handling of tab height for actor sheets

### 0.9.0
* Started this changelog
* Added new translations
  * Chinese (big thanks to contributor [Nowpaper](https://github.com/Nowpaper))
  * Italian (big thanks to contributor [smoothingplane#6772](https://github.com/smoothingplane))
* [Added the ability to sort skills by rank](https://github.com/anvil-vtt/FateX/pull/40) (big thanks to contributor JeansenVaars#2857 / [Saif Addin](https://github.com/saif-ellafi))
* Switched to [foundry-vtt-types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types) 
* Fixed some generic build / type errors
* Updated all npm dependencies
