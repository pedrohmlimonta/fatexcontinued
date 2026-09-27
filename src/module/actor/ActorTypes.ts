export type groupType = "manual" | "scene" | "encounter";

interface CharacterData {
    biography: { value: string };
    fatepoints: { current: number; refresh: number };
}

interface CharacterActorData {
    type: "character";
    system: CharacterData;
}

interface GroupData {
    groupType: groupType;
    options: { showArtwork: boolean };
}

interface GroupActorData {
    type: "group";
    system: GroupData;
}

export type ActorDataFate = CharacterActorData | GroupActorData;
