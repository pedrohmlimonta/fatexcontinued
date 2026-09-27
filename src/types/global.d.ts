/**
 * Ambient declarations for the Foundry VTT v14 client API.
 *
 * The original project was type-checked against foundry-vtt-types v9, which no longer matches the
 * Foundry VTT v14 API. Foundry globals are therefore declared as `any` so TypeScript still checks the
 * system's own code without relying on outdated third party definitions.
 */

/* eslint-disable no-var, @typescript-eslint/no-explicit-any */

declare var foundry: any;
declare var game: any;
declare var CONFIG: any;
declare var CONST: any;
declare var Hooks: any;
declare var ui: any;
declare var canvas: any;
declare var Handlebars: any;

declare var Actor: any;
declare var Item: any;
declare var Scene: any;
declare var Combat: any;
declare var ChatMessage: any;
declare var JournalEntry: any;
declare var Folder: any;
declare var Roll: any;

declare var fromUuid: (uuid: string, options?: any) => Promise<any>;
declare var fromUuidSync: (uuid: string, options?: any) => any;

declare var $: any;
declare var jQuery: any;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type JQuery<TElement = HTMLElement> = any;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace JQuery {
    type ClickEvent = any;
}

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

/**
 * Constructor type used when extending Foundry classes, which are declared as `any`.
 */
type AnyConstructor = (new (...args: any[]) => any) & { [key: string]: any };
