/**
 * A small, self-contained imitation of the Foundry VTT v14 client API.
 *
 * It is NOT Foundry. It only provides the parts of the API FateX Continued touches, so the compiled bundle
 * (dist/system.js) can be loaded and exercised by smoke tests: init/ready hooks, sheet registration,
 * data models, template rendering, rolls, chat cards and the world migration.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import Handlebars from "handlebars";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DIST = path.join(ROOT, "dist");
export const SYSTEM_ID = "fatexcontinued";

/* ------------------------------------------------------------------ */
/*  Utilities (subset of foundry.utils)                               */
/* ------------------------------------------------------------------ */

/**
 * The bundle runs inside the jsdom window (another JavaScript realm), so plain objects are detected by their
 * prototype chain instead of comparing constructors.
 */
function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
}

function getType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "Array";
    if (typeof value !== "object") return typeof value;
    if (isPlainObject(value)) return "Object";
    return "Unknown";
}

function deepClone(original) {
    if (typeof original !== "object" || original === null) return original;
    if (Array.isArray(original)) return original.map((o) => deepClone(o));
    if (Object.prototype.toString.call(original) === "[object Date]") return new Date(original);
    if (!isPlainObject(original)) return original;
    const clone = {};
    for (const k of Object.keys(original)) clone[k] = deepClone(original[k]);
    return clone;
}

function expandObject(obj) {
    const expanded = {};
    for (const [k, v] of Object.entries(obj)) {
        setProperty(expanded, k, getType(v) === "Object" ? expandObject(v) : v);
    }
    return expanded;
}

function mergeObject(original, other = {}, { insertKeys = true, overwrite = true, inplace = true } = {}) {
    if (!inplace) original = deepClone(original);
    if (Object.keys(other).some((k) => k.includes("."))) other = expandObject(other);
    for (const [k, v] of Object.entries(other)) {
        const existing = original[k];
        if (getType(v) === "Object" && getType(existing) === "Object") {
            mergeObject(existing, v, { insertKeys, overwrite, inplace: true });
        } else if (k in original) {
            if (overwrite) original[k] = getType(v) === "Object" ? mergeObject({}, v) : v;
        } else if (insertKeys) {
            original[k] = getType(v) === "Object" ? mergeObject({}, v) : v;
        }
    }
    return original;
}

function getProperty(object, key) {
    if (!object || !key) return undefined;
    let target = object;
    for (const part of key.split(".")) {
        if (target === null || target === undefined || typeof target !== "object") return undefined;
        target = target[part];
    }
    return target;
}

function setProperty(object, key, value) {
    const parts = key.split(".");
    const last = parts.pop();
    let target = object;
    for (const part of parts) {
        if (typeof target[part] !== "object" || target[part] === null) target[part] = {};
        target = target[part];
    }
    target[last] = value;
    return true;
}

function objectsEqual(a, b) {
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((k) => [k, sortKeys(value[k])]),
        );
    }
    return value;
}

function isNewerVersion(v1, v0) {
    const a = String(v1).split(".").map(Number);
    const b = String(v0).split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        if (x !== y) return x > y;
    }
    return false;
}

let idCounter = 0;
function randomID(length = 16) {
    idCounter += 1;
    return `id${String(idCounter).padStart(length - 2, "0")}`.slice(0, length);
}

const utils = {
    deepClone,
    duplicate: (o) => JSON.parse(JSON.stringify(o)),
    mergeObject,
    expandObject,
    getProperty,
    setProperty,
    getType,
    isEmpty: (o) => !o || (typeof o === "object" && Object.keys(o).length === 0),
    objectsEqual,
    isNewerVersion,
    randomID,
    escapeHTML: (value) =>
        String(value ?? "").replace(
            /[&<>"']/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c],
        ),
};

/* ------------------------------------------------------------------ */
/*  Data fields & models (simplified)                                 */
/* ------------------------------------------------------------------ */

class DataField {
    constructor(options = {}) {
        Object.assign(
            this,
            { required: false, nullable: false, initial: undefined },
            this.constructor.defaults,
            options,
        );
    }
    static get defaults() {
        return {};
    }
    getInitialValue(data) {
        return typeof this.initial === "function" ? this.initial(data) : deepClone(this.initial);
    }
    clean(value, data) {
        if (value === null) {
            if (this.nullable) return null;
            value = undefined;
        }
        if (value === undefined) return this.getInitialValue(data);
        return this._cast(value);
    }
    _cast(value) {
        return value;
    }
    validate(value, path) {
        if (value === undefined || value === null) {
            if (value === null && this.nullable) return [];
            if (this.required) return [`${path}: required`];
            return [];
        }
        return this._validateType(value, path);
    }
    _validateType() {
        return [];
    }
    initialize(value) {
        return value;
    }
}

class StringField extends DataField {
    static get defaults() {
        return { initial: undefined, blank: true };
    }
    _cast(value) {
        return String(value);
    }
    _validateType(value, path) {
        if (typeof value !== "string") return [`${path}: must be a string`];
        if (!this.blank && value === "") return [`${path}: may not be blank`];
        if (this.choices && !this.choices.includes(value)) return [`${path}: invalid choice`];
        return [];
    }
}

class HTMLField extends StringField {}

class NumberField extends DataField {
    static get defaults() {
        return { initial: null, nullable: true };
    }
    _cast(value) {
        return Number(value);
    }
    _validateType(value, path) {
        if (typeof value !== "number" || Number.isNaN(value)) return [`${path}: must be a number`];
        return [];
    }
}

class BooleanField extends DataField {
    static get defaults() {
        return { initial: false, required: true };
    }
    _cast(value) {
        if (typeof value === "string") return value === "true";
        return Boolean(value);
    }
}

class ObjectField extends DataField {
    static get defaults() {
        return { initial: () => ({}), required: true };
    }
    _cast(value) {
        return getType(value) === "Object" ? value : {};
    }
}

class SchemaField extends DataField {
    constructor(fields, options = {}) {
        super({ required: true, ...options });
        this.fields = fields;
    }
    getInitialValue() {
        return this.clean({});
    }
    get(name) {
        return this.fields[name];
    }
    entries() {
        return Object.entries(this.fields);
    }
    clean(value = {}) {
        // Foundry cleans source data in place, embedded models share their source object with the parent
        if (getType(value) !== "Object") value = {};
        for (const key of Object.keys(value)) {
            if (!(key in this.fields)) delete value[key];
        }
        for (const [name, field] of Object.entries(this.fields)) {
            value[name] = field.clean(value[name], value);
        }
        return value;
    }
    validate(value, path = "") {
        const errors = [];
        for (const [name, field] of Object.entries(this.fields)) {
            errors.push(...field.validate(value?.[name], path ? `${path}.${name}` : name));
        }
        return errors;
    }
    initialize(value, model) {
        const initialized = {};
        for (const [name, field] of Object.entries(this.fields)) {
            initialized[name] = field.initialize(value?.[name], model);
        }
        return initialized;
    }
}

class ArrayField extends DataField {
    constructor(element, options = {}) {
        super({ initial: () => [], required: true, ...options });
        this.element = element;
    }
    clean(value) {
        if (value === undefined || value === null) return this.getInitialValue();
        if (!Array.isArray(value)) value = [value];
        for (let i = 0; i < value.length; i++) value[i] = this.element.clean(value[i]);
        return value;
    }
    validate(value, path) {
        if (!Array.isArray(value)) return this.required ? [`${path}: must be an array`] : [];
        return value.flatMap((v, i) => this.element.validate(v, `${path}.${i}`));
    }
    initialize(value, model) {
        return (value ?? []).map((v) => this.element.initialize(v, model));
    }
}

class EmbeddedDataField extends DataField {
    constructor(model, options = {}) {
        super({ required: true, ...options });
        this.model = model;
    }
    clean(value) {
        if (value && typeof value.toObject === "function") value = value.toObject();
        return this.model.cleanData(value ?? {});
    }
    validate(value, path) {
        return this.model.schema.validate(value, path);
    }
    initialize(value, model) {
        return new this.model(value, { parent: model });
    }
}

class DataModel {
    constructor(data = {}, { parent = null, strict = true } = {}) {
        Object.defineProperty(this, "parent", { value: parent, writable: true, enumerable: false });
        let source = data && typeof data.toObject === "function" ? data.toObject() : data ?? {};
        source = this.constructor.migrateDataSafe(source);
        Object.defineProperty(this, "_source", {
            value: this.constructor.cleanData(source),
            writable: false,
            enumerable: false,
        });
        const errors = this.constructor.schema.validate(this._source);
        if (errors.length && strict)
            throw new Error(`${this.constructor.name} validation errors: ${errors.join(", ")}`);
        this._initialize();
    }
    static defineSchema() {
        return {};
    }
    static get schema() {
        if (!Object.prototype.hasOwnProperty.call(this, "_schema")) {
            this._schema = new SchemaField(this.defineSchema());
        }
        return this._schema;
    }
    static cleanData(source) {
        return this.schema.clean(source ?? {});
    }
    static migrateData(source) {
        return source;
    }
    static migrateDataSafe(source) {
        try {
            this.migrateData(source);
        } catch (err) {
            console.error(err);
        }
        return source;
    }
    _initialize() {
        const initialized = this.constructor.schema.initialize(this._source, this);
        for (const [key, value] of Object.entries(initialized)) this[key] = value;
    }
    updateSource(changes = {}) {
        const expanded = expandObject(changes);
        const schema = this.constructor.schema;
        for (const [key, value] of Object.entries(expanded)) {
            const field = schema.get(key);
            if (!field) continue;
            this._source[key] = field.clean(
                value && typeof value === "object" ? deepClone(value) : value,
                this._source,
            );
        }
        const errors = schema.validate(this._source);
        if (errors.length) throw new Error(`${this.constructor.name} validation errors: ${errors.join(", ")}`);
        this._initialize();
        return changes;
    }
    toObject() {
        return deepClone(this._source);
    }
    toJSON() {
        return this.toObject();
    }
}

class TypeDataModel extends DataModel {
    prepareBaseData() {}
    prepareDerivedData() {}
}

/* ------------------------------------------------------------------ */
/*  Collections & documents                                           */
/* ------------------------------------------------------------------ */

class Collection extends Map {
    get contents() {
        return Array.from(this.values());
    }
    find(fn) {
        return this.contents.find(fn);
    }
    filter(fn) {
        return this.contents.filter(fn);
    }
    map(fn) {
        return this.contents.map(fn);
    }
    some(fn) {
        return this.contents.some(fn);
    }
    every(fn) {
        return this.contents.every(fn);
    }
    [Symbol.iterator]() {
        return this.values();
    }
}

export function createEnvironment({ settings = {}, worldSettings = [], language = "en" } = {}) {
    const dom = new JSDOM("<!DOCTYPE html><html><head></head><body><div id='interface'></div></body></html>", {
        runScripts: "outside-only",
        pretendToBeVisual: true,
        url: "http://localhost:30000/game",
    });
    const window = dom.window;
    const log = {
        updates: [],
        creates: [],
        deletes: [],
        chatMessages: [],
        socket: [],
        notifications: [],
        appliedModes: [],
        sheetRegistrations: [],
    };

    const translations = JSON.parse(fs.readFileSync(path.join(DIST, "languages", `${language}.json`), "utf8"));
    const localize = (key) => {
        const value = getProperty(translations, key);
        return typeof value === "string" ? value : key;
    };

    /* ---------------- Hooks ---------------- */
    const hookRegistry = new Map();
    const Hooks = {
        on(name, fn) {
            if (!hookRegistry.has(name)) hookRegistry.set(name, []);
            hookRegistry.get(name).push({ fn, once: false });
            return fn;
        },
        once(name, fn) {
            if (!hookRegistry.has(name)) hookRegistry.set(name, []);
            hookRegistry.get(name).push({ fn, once: true });
            return fn;
        },
        callAll(name, ...args) {
            const entries = hookRegistry.get(name) ?? [];
            const results = [];
            for (const entry of [...entries]) {
                if (entry.once) entries.splice(entries.indexOf(entry), 1);
                results.push(entry.fn(...args));
            }
            return results;
        },
        call(name, ...args) {
            return this.callAll(name, ...args);
        },
        registered: (name) => (hookRegistry.get(name) ?? []).length,
    };

    /* ---------------- Settings ---------------- */
    const registered = new Map();
    const storedWorld = new Collection();
    for (const { key, value } of worldSettings) {
        storedWorld.set(key, { key, value: JSON.parse(value), _source: { key, value } });
    }
    const settingsApi = {
        settings: registered,
        storage: new Map([["world", storedWorld]]),
        register(namespace, key, config) {
            registered.set(`${namespace}.${key}`, { ...config, namespace, key });
        },
        get(namespace, key) {
            const id = `${namespace}.${key}`;
            if (namespace === "core") {
                if (key === "messageMode") return settings["core.messageMode"] ?? "public";
                if (key === "rollMode") return null;
                throw new Error(`Unknown core setting ${key}`);
            }
            if (!registered.has(id)) throw new Error(`"${id}" is not a registered game setting`);
            if (storedWorld.has(id)) return storedWorld.get(id).value;
            if (id in settings) return settings[id];
            return registered.get(id).default;
        },
        async set(namespace, key, value) {
            const id = `${namespace}.${key}`;
            if (!registered.has(id)) throw new Error(`"${id}" is not a registered game setting`);
            storedWorld.set(id, { key: id, value, _source: { key: id, value: JSON.stringify(value) } });
            return value;
        },
    };

    /* ---------------- Documents ---------------- */
    const CONFIG = {
        Actor: { documentClass: null, dataModels: {}, sheetClasses: {} },
        Item: { documentClass: null, dataModels: {}, sheetClasses: {} },
        Scene: { documentClass: null },
        Combat: { documentClass: null },
        Dice: { terms: {}, randomUniform: Math.random },
    };

    const validScopes = () => new Set(["core", "world", SYSTEM_ID]);

    class ClientDocument {
        static documentName = "Document";
        constructor(data = {}, { parent = null } = {}) {
            this.parent = parent;
            this.apps = {};
            this._source = deepClone(data);
            this._source._id ??= randomID();
            this._source.flags ??= {};
            this._initialize();
        }
        static get implementation() {
            return CONFIG[this.documentName]?.documentClass ?? this;
        }
        _initialize() {
            const src = this._source;
            this._id = src._id;
            this.name = src.name;
            this.type = src.type;
            this.img = src.img;
            this.sort = src.sort ?? 0;
            this.folder = src.folder ?? null;
            this.flags = deepClone(src.flags ?? {});
            const Model = CONFIG[this.constructor.documentName]?.dataModels?.[src.type];
            if (Model) {
                this.system = new Model(src.system ?? {}, { parent: this });
                this._source.system = this.system.toObject();
            } else {
                this.system = deepClone(src.system ?? {});
            }
        }
        get id() {
            return this._id;
        }
        get uuid() {
            return this.parent
                ? `${this.parent.uuid}.${this.constructor.documentName}.${this.id}`
                : `${this.constructor.documentName}.${this.id}`;
        }
        get isOwner() {
            return true;
        }
        get visible() {
            return true;
        }
        get documentName() {
            return this.constructor.documentName;
        }
        getFlag(scope, key) {
            if (!validScopes().has(scope))
                throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
            return getProperty(this.flags, `${scope}.${key}`);
        }
        async setFlag(scope, key, value) {
            if (!validScopes().has(scope))
                throw new Error(`Flag scope "${scope}" is not valid or not currently active`);
            return this.update({ [`flags.${scope}.${key}`]: value });
        }
        updateSource(changes = {}) {
            mergeObject(this._source, expandObject(deepClone(changes)));
            this._initialize();
            return changes;
        }
        static async updateDocuments(updates = [], options = {}) {
            const collection = this._collection?.();
            for (const { _id, ...changes } of updates) await collection?.get(_id)?.update(changes, options);
            return updates;
        }
        async update(changes = {}, options = {}) {
            log.updates.push({ uuid: this.uuid, changes: deepClone(changes), options });
            const expanded = expandObject(deepClone(changes));
            mergeObject(this._source, expanded);
            this._initialize();
            this.prepareData?.();
            return this;
        }
        async delete() {
            log.deletes.push(this.uuid);
            this.parent?.items?.delete(this.id);
            return this;
        }
        toObject() {
            return deepClone(this._source);
        }
        toJSON() {
            return this.toObject();
        }
        prepareData() {}
        render() {
            for (const app of Object.values(this.apps)) app.render?.(false);
        }
        static async create(data, options = {}) {
            const cls = this.implementation;
            const doc = new cls(deepClone(data), options);
            if (typeof doc._preCreate === "function") {
                const allowed = await doc._preCreate(deepClone(data), options, game.user);
                if (allowed === false) return undefined;
            }
            doc.prepareData();
            log.creates.push({ documentName: this.documentName, data: deepClone(data), options });
            cls._collection?.()?.set(doc.id, doc);
            return doc;
        }
    }

    class Item extends ClientDocument {
        static documentName = "Item";
        static _collection = () => game.items;
        get actor() {
            return this.parent?.constructor?.documentName === "Actor" ? this.parent : null;
        }
        get isOwned() {
            return !!this.actor;
        }
        get isEmbedded() {
            return !!this.parent;
        }
        get sheet() {
            return { render: () => log.notifications.push(["render-item-sheet", this.id]) };
        }
    }

    class Actor extends ClientDocument {
        static documentName = "Actor";
        static _collection = () => game.actors;
        _initialize() {
            super._initialize();
            const ItemClass = CONFIG.Item.documentClass ?? Item;
            this.items = new Collection();
            for (const itemData of this._source.items ?? []) {
                const item = new ItemClass(itemData, { parent: this });
                this.items.set(item.id, item);
            }
            this.prototypeToken = deepClone(this._source.prototypeToken ?? { name: this._source.name });
        }
        prepareData() {
            for (const item of this.items.values()) item.prepareData();
        }
        get isToken() {
            return false;
        }
        get token() {
            return null;
        }
        get limited() {
            return false;
        }
        get sheet() {
            return this._sheet ?? null;
        }
        _syncItemsSource() {
            this._source.items = this.items.contents.map((item) => item.toObject());
        }
        async createEmbeddedDocuments(name, data = [], options = {}) {
            const ItemClass = CONFIG.Item.documentClass ?? Item;
            const created = data.map((d) => {
                const item = new ItemClass(deepClone(d), { parent: this });
                this.items.set(item.id, item);
                return item;
            });
            this._syncItemsSource();
            this.prepareData();
            log.creates.push({ documentName: name, parent: this.uuid, data: deepClone(data), options });
            return created;
        }
        async updateEmbeddedDocuments(name, updates = [], options = {}) {
            log.updates.push({ uuid: `${this.uuid}.embedded`, changes: deepClone(updates), options });
            for (const update of updates) {
                const item = this.items.get(update._id);
                if (!item) throw new Error(`Item ${update._id} does not exist`);
                const { _id, ...changes } = update;
                mergeObject(item._source, expandObject(deepClone(changes)));
                item._initialize();
            }
            this._syncItemsSource();
            this.prepareData();
            return updates;
        }
        async deleteEmbeddedDocuments(name, ids = []) {
            for (const id of ids) this.items.delete(id);
            this._syncItemsSource();
            log.deletes.push(...ids.map((id) => `${this.uuid}.Item.${id}`));
            return ids;
        }
        static async createDialog() {
            return "core-create-dialog";
        }
    }

    class ChatMessage extends ClientDocument {
        static documentName = "ChatMessage";
        static _collection = () => game.messages;
        static getSpeaker({ actor } = {}) {
            return { actor: actor?.id ?? null, alias: actor?.name ?? "Gamemaster", scene: null, token: null };
        }
        static applyMode(chatData, mode) {
            log.appliedModes.push(mode);
            chatData.whisper = mode === "public" ? [] : ["gm"];
            chatData.blind = mode === "blind";
            return chatData;
        }
        static async create(data, options = {}) {
            const message = await super.create(data, options);
            log.chatMessages.push(message);
            return message;
        }
        static async updateDocuments(updates = [], options = {}) {
            for (const update of updates) {
                const { _id, ...changes } = update;
                await game.messages.get(_id).update(changes, options);
            }
            return updates;
        }
        _initialize() {
            super._initialize();
            this.content = this._source.content;
            this.author = this._source.author;
            this.speaker = this._source.speaker;
        }
    }

    class Scene extends ClientDocument {
        static documentName = "Scene";
        _onUpdateDescendantDocuments() {}
    }

    class Combat extends ClientDocument {
        static documentName = "Combat";
        _onDelete() {}
    }

    /* ---------------- Dice ---------------- */
    let nextResults = [];
    class DiceTerm {
        constructor({ number = 1, faces = 6 } = {}) {
            this.number = number;
            this.faces = faces;
            this.results = [];
        }
        async _roll() {
            return nextResults.length ? nextResults.shift() : undefined;
        }
        randomFace() {
            return Math.ceil(Math.random() * this.faces);
        }
        async evaluate() {
            for (let i = 0; i < this.number; i++) await this.roll();
            return this;
        }
    }
    class Die extends DiceTerm {
        async roll() {
            const roll = { result: (await this._roll()) ?? this.randomFace(), active: true };
            this.results.push(roll);
            return roll;
        }
    }
    class FateDie extends DiceTerm {
        static DENOMINATION = "f";
        constructor(options = {}) {
            super({ ...options, faces: 3 });
        }
        async roll({ minimize = false, maximize = false } = {}) {
            const roll = { result: undefined, active: true };
            if (minimize) roll.result = -1;
            else if (maximize) roll.result = 1;
            else roll.result = await this._roll();
            if (roll.result === undefined) roll.result = Math.ceil(Math.random() * 3 - 2);
            if (roll.result === -1) roll.failure = true;
            if (roll.result === 1) roll.success = true;
            this.results.push(roll);
            return roll;
        }
    }
    class Roll {
        constructor(formula) {
            this.formula = formula;
            this.terms = [];
            for (const part of formula.split(/\s*([+-])\s*/)) {
                if (part === "+" || part === "-") {
                    this.terms.push({ operator: part });
                    continue;
                }
                const match = /^(\d+)d(\w+)$/i.exec(part.trim());
                if (!match) throw new Error(`Unsupported formula part ${part}`);
                const [, number, denomination] = match;
                const lower = denomination.toLowerCase();
                const TermClass = lower === "f" ? FateDie : CONFIG.Dice.terms[lower] ?? Die;
                this.terms.push(new TermClass({ number: Number(number), faces: Number(denomination) || 3 }));
            }
        }
        async evaluate() {
            for (const term of this.terms) if (term.evaluate) await term.evaluate();
            return this;
        }
    }

    /* ---------------- Applications (V1 imitation) ---------------- */
    let appId = 0;
    class Application {
        constructor(options = {}) {
            this.options = mergeObject(this.constructor.defaultOptions, options, { inplace: false });
            this.appId = ++appId;
            this._state = 0;
            this._element = null;
            this.rendered = false;
        }
        static get defaultOptions() {
            return { classes: [], template: null, width: 400, height: "auto", resizable: false, scrollY: [], tabs: [] };
        }
        get element() {
            return this._element ?? window.$();
        }
        get template() {
            return this.options.template;
        }
        get id() {
            return this.options.id ?? `app-${this.appId}`;
        }
        render(force = false, options = {}) {
            if (!force && !this.rendered) return this;
            this._render(force, options).catch((err) => log.notifications.push(["render-error", err]));
            return this;
        }
        async _render() {
            this.rendered = true;
            log.notifications.push(["render", this.constructor.name, this.appId]);
        }
        async close() {
            this.rendered = false;
        }
        _getHeaderButtons() {
            return [{ class: "close", label: "Close", icon: "fas fa-times" }];
        }
        activateListeners() {}
    }
    class FormApplication extends Application {
        constructor(object = {}, options = {}) {
            super(options);
            this.object = object;
        }
    }
    class DocumentSheet extends FormApplication {
        get document() {
            return this.object;
        }
        get isEditable() {
            return true;
        }
        getData() {
            return {
                cssClass: "editable",
                editable: true,
                document: this.document,
                data: this.document.toObject(),
                options: this.options,
                owner: true,
            };
        }
    }
    class ActorSheet extends DocumentSheet {
        static get defaultOptions() {
            return mergeObject(super.defaultOptions, {
                classes: ["sheet", "actor"],
                template: "templates/sheets/actor-sheet.html",
                dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
            });
        }
        get actor() {
            return this.object;
        }
        get token() {
            return this.object.token || this.options.token || null;
        }
        _getHeaderButtons() {
            return [
                { class: "configure-sheet", label: "Sheet" },
                { class: "configure-token", label: "Token" },
                ...super._getHeaderButtons(),
            ];
        }
        async _onDrop() {
            return "core-drop";
        }
        async _onDropItem() {
            return "core-drop-item";
        }
    }
    class ItemSheet extends DocumentSheet {
        get item() {
            return this.object;
        }
        get actor() {
            return this.object.actor;
        }
        getData() {
            const data = super.getData();
            data.item = data.document;
            return data;
        }
    }

    /* ---------------- Handlebars ---------------- */
    const hb = Handlebars.create();
    hb.registerHelper("localize", (key, options) => {
        const value = localize(key);
        if (options?.hash && Object.keys(options.hash).length) {
            return value.replace(/{(\w+)}/g, (_m, k) => options.hash[k] ?? "");
        }
        return value;
    });
    hb.registerHelper("editor", (content, options) => {
        const target = options.hash.target;
        return new hb.SafeString(
            `<div class="editor"><div class="editor-content" data-edit="${target}">${content ?? ""}</div></div>`,
        );
    });
    hb.registerHelper("checked", (value) => (value ? "checked" : ""));
    hb.registerHelper("eq", (a, b) => a === b);
    hb.registerHelper("ne", (a, b) => a !== b);
    hb.registerHelper("lt", (a, b) => a < b);
    hb.registerHelper("lte", (a, b) => a <= b);
    hb.registerHelper("gt", (a, b) => a > b);
    hb.registerHelper("gte", (a, b) => a >= b);
    hb.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
    hb.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
    hb.registerHelper("not", (a) => !a);

    const templateFile = (templatePath) => {
        const prefix = `systems/${SYSTEM_ID}/`;
        if (!templatePath.startsWith(prefix)) throw new Error(`Template outside of the system: ${templatePath}`);
        return path.join(DIST, templatePath.slice(prefix.length));
    };
    const compiled = new Map();
    const getTemplate = (templatePath) => {
        if (!compiled.has(templatePath)) {
            const source = fs.readFileSync(templateFile(templatePath), "utf8");
            compiled.set(templatePath, hb.compile(source));
        }
        return compiled.get(templatePath);
    };
    const loadTemplates = async (paths) => {
        for (const templatePath of paths) {
            const source = fs.readFileSync(templateFile(templatePath), "utf8");
            hb.registerPartial(templatePath, source);
            getTemplate(templatePath);
        }
        log.loadedTemplates = paths;
        return paths;
    };
    const renderTemplate = async (templatePath, data) => {
        return getTemplate(templatePath)(data, {
            allowProtoPropertiesByDefault: true,
            allowProtoMethodsByDefault: true,
        });
    };

    /* ---------------- Globals ---------------- */
    const game = {
        system: { id: SYSTEM_ID, version: "2.0.0" },
        i18n: {
            lang: language,
            localize,
            format: (key, data = {}) => localize(key).replace(/{(\w+)}/g, (_m, k) => data[k] ?? ""),
        },
        settings: settingsApi,
        user: { id: "gm0000000000000", name: "Gamemaster", isGM: true },
        users: null,
        actors: new Collection(),
        items: new Collection(),
        messages: new Collection(),
        scenes: new Collection(),
        folders: new Collection(),
        journal: new Collection(),
        packs: new Collection(),
        modules: new Map(),
        socket: {
            listeners: {},
            on(name, fn) {
                this.listeners[name] = fn;
            },
            emit(name, data) {
                log.socket.push({ name, data });
            },
        },
    };
    game.users = new Collection([[game.user.id, { ...game.user, active: true }]]);
    game.users.activeGM = game.users.get(game.user.id);
    game.users.get = Map.prototype.get.bind(game.users);

    const notifications = {
        info: (message, options) => log.notifications.push(["info", message, options]),
        warn: (message, options) => log.notifications.push(["warn", message, options]),
        error: (message, options) => log.notifications.push(["error", message, options]),
    };

    const foundry = {
        utils,
        abstract: { DataModel, TypeDataModel },
        data: {
            fields: {
                DataField,
                StringField,
                HTMLField,
                NumberField,
                BooleanField,
                ObjectField,
                SchemaField,
                ArrayField,
                EmbeddedDataField,
            },
        },
        dice: { Roll, terms: { DiceTerm, Die, FateDie } },
        appv1: { api: { Application, FormApplication, DocumentSheet }, sheets: { ActorSheet, ItemSheet } },
        documents: { Actor, Item, ChatMessage, Scene, Combat },
        applications: {
            api: {
                DialogV2: {
                    confirm: async (config) => {
                        log.notifications.push(["dialog", config]);
                        return window.__dialogAnswer ?? true;
                    },
                },
            },
            apps: {
                DocumentSheetConfig: {
                    registerSheet(documentClass, scope, sheetClass, options) {
                        log.sheetRegistrations.push({
                            action: "register",
                            documentName: documentClass.documentName,
                            scope,
                            sheetClass,
                            options,
                        });
                    },
                    unregisterSheet(documentClass, scope, sheetClass) {
                        log.sheetRegistrations.push({
                            action: "unregister",
                            documentName: documentClass.documentName,
                            scope,
                            sheetClass,
                        });
                    },
                },
            },
            handlebars: { loadTemplates, renderTemplate, getTemplate },
            ux: {
                TextEditor: {
                    implementation: {
                        enrichHTML: async (content) =>
                            String(content ?? "").replace(
                                /@UUID\[([^\]]+)\]\{([^}]+)\}/g,
                                '<a class="content-link" data-uuid="$1">$2</a>',
                            ),
                        getDragEventData: (event) => {
                            try {
                                return JSON.parse(event.dataTransfer.getData("text/plain"));
                            } catch (_err) {
                                return {};
                            }
                        },
                    },
                },
            },
        },
    };

    Object.assign(window, {
        foundry,
        game,
        CONFIG,
        CONST: { DEFAULT_TOKEN: "icons/svg/mystery-man.svg" },
        Hooks,
        ui: { notifications, windows: {} },
        canvas: { scene: null },
        Handlebars: hb,
        Actor,
        Item,
        ChatMessage,
        Scene,
        Combat,
        JournalEntry: class JournalEntry extends ClientDocument {
            static documentName = "JournalEntry";
        },
        Folder: class Folder extends ClientDocument {
            static documentName = "Folder";
        },
        Roll,
        fromUuid: async (uuid) => resolveUuid(uuid),
        fromUuidSync: (uuid) => resolveUuid(uuid),
    });

    function resolveUuid(uuid) {
        const [documentName, id, , itemId] = String(uuid).split(".");
        if (documentName === "Actor") {
            const actor = game.actors.get(id);
            return itemId ? actor?.items.get(itemId) : actor;
        }
        if (documentName === "Item") return game.items.get(id);
        if (documentName === "JournalEntry") return game.journal.get(id);
        if (documentName === "Folder") return game.folders.get(id);
        return null;
    }

    // fetch() for the bundled setup presets (DataManager)
    window.fetch = async (url) => {
        const prefix = `systems/${SYSTEM_ID}/`;
        const file = String(url).startsWith(prefix) ? path.join(DIST, String(url).slice(prefix.length)) : null;
        if (!file || !fs.existsSync(file)) {
            return { status: 404, json: async () => ({}) };
        }
        return { status: 200, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
    };

    Math.clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    window.Math.clamp = Math.clamp;

    // jQuery (the real library is not needed, a tiny subset is enough for the smoke tests)
    const jquerySource = fs.readFileSync(path.join(ROOT, "node_modules", "jquery", "dist", "jquery.js"), "utf8");
    window.eval(jquerySource);

    const bundle = fs.readFileSync(path.join(DIST, "system.js"), "utf8");
    window.eval(bundle);

    return {
        window,
        game,
        CONFIG,
        Hooks,
        foundry,
        log,
        localize,
        classes: { Actor, Item, ChatMessage, Application },
        setNextDiceResults: (results) => {
            nextResults = [...results];
        },
        async init() {
            await Promise.all(Hooks.callAll("init"));
            await Promise.all(Hooks.callAll("i18nInit"));
            await Promise.all(Hooks.callAll("setup"));
        },
        async ready() {
            await Promise.all(Hooks.callAll("ready"));
        },
        renderTemplate,
    };
}
