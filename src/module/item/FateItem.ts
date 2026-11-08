export class FateItem extends Item {
    async _preUpdate(changed: any, options: any, user: any) {
        const allowed = await super._preUpdate?.(changed, options, user);

        if (allowed === false) {
            return false;
        }

        // Powers stay one level deep, whatever made the change
        if (this.type === "extra") {
            CONFIG.FateX.itemClasses.extra?.keepPowersOneLevel?.(this, changed);
        }

        return allowed;
    }

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
