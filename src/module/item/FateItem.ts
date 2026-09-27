export class FateItem extends Item {
    prepareData() {
        super.prepareData();

        // Let every itemType prepare itself
        if (this.actor?.system) {
            if (CONFIG.FateX.itemClasses[this.type]) {
                CONFIG.FateX.itemClasses[this.type].prepareItemData(this, this);
            }
        }
    }

    get visible(): boolean {
        if (this.isSubitem()) {
            return false;
        }

        return super.visible;
    }

    private isSubitem() {
        if (this.type === "extra") {
            return !!this.system?.parentID;
        }

        return false;
    }
}
