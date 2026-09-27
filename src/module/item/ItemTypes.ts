/**
 * Lightweight type descriptions of the system data of each item type.
 * The actual schemas are defined by the data models in module/data/models/ItemModels.ts.
 */

interface StressData {
    size: number;
    value: number;
    labelType: number;
    customLabel: string;
    description: string;
}

export interface StressItemData {
    type: "stress";
    system: StressData;
}

///////////////////////////////

interface AspectData {
    label: string;
    value: string;
}

export interface AspectItemData {
    type: "aspect";
    system: AspectData;
}

///////////////////////////////

interface TokenReferenceData {
    id: string;
    scene: string;
}

export interface TokenReferenceItemData {
    type: "tokenReference";
    system: TokenReferenceData;
}

///////////////////////////////

interface CombatantReferenceData {
    id: string;
}

export interface CombatantReferenceItemData {
    type: "combatantReference";
    system: CombatantReferenceData;
}

///////////////////////////////

interface ActorReferenceData {
    id: string;
}

export interface ActorReferenceItemData {
    type: "actorReference";
    system: ActorReferenceData;
}

///////////////////////////////

interface ExtraData {
    description: string;
    parentID?: string;
    skill: string;
    bonus: number;
}

export interface ExtraItemData {
    type: "extra";
    system: ExtraData;
}

///////////////////////////////

interface SkillData {
    rank: number;
    options?: {
        isMagicSkill?: boolean;
    };
}

export interface SkillItemData {
    type: "skill";
    name: string;
    system: SkillData;
}

///////////////////////////////

interface StuntData {
    description: string;
    shortDescription: string;
    collapsed: boolean;
}

export interface StuntItemData {
    type: "stunt";
    system: StuntData;
}

///////////////////////////////

interface ConsequenceData {
    label: string;
}

export interface ConsequenceItemData {
    type: "consequence";
    system: ConsequenceData;
}

///////////////////////////////

export type ReferenceItemData = (TokenReferenceItemData | ActorReferenceItemData | CombatantReferenceItemData) & {
    _id?: string;
    id?: string;
    sort?: number;
};

export type FateItemData =
    | StressItemData
    | AspectItemData
    | TokenReferenceItemData
    | ActorReferenceItemData
    | ExtraItemData
    | SkillItemData
    | StuntItemData
    | ConsequenceItemData;
