/**
 * Groups the abc/ category folders into world regions.
 *
 * The categories are country adjectives ("ghanaian", "south african"), which
 * makes for a flat alphabetical list of 40-odd folders in the files dialog —
 * fine to search, hopeless to browse. This map adds the missing middle layer so
 * the dialog can ask "which part of the world?" before "which country?".
 *
 * Anything not listed here falls into the last region automatically, so adding
 * a new folder under abc/ never breaks the dialog — it just lands in "Other"
 * until it is classified below.
 */
class RegionMap {
    /**
     * Ordered regions. `accent` is a hue used for the header's colour bar, so
     * regions stay distinguishable in both light and dark themes.
     */
    static REGIONS = [
        {
            id: 'europe',
            label: 'Europe',
            accent: 210,
            categories: [
                'austrian', 'czech', 'dutch', 'finnish', 'french', 'georgian',
                'german', 'hungarian', 'irish', 'italian', 'norwegian',
                'polish', 'portuguese', 'russian', 'scottish', 'spanish',
                'swedish', 'ukrainian', 'yiddish',
            ],
        },
        {
            id: 'africa',
            label: 'Africa',
            accent: 35,
            categories: [
                'congolese', 'egyptian', 'ghanaian', 'kenyan', 'moroccan',
                'south african', 'ugandan', 'zambian',
            ],
        },
        {
            id: 'middle-east',
            label: 'Middle East',
            accent: 300,
            categories: ['israeli', 'turkish'],
        },
        {
            id: 'asia',
            label: 'Asia',
            accent: 0,
            categories: [
                'chinese', 'indian', 'indonesian', 'japanese', 'kazakh', 'korean',
                'philippine', 'vietnamese',
            ],
        },
        {
            id: 'americas',
            label: 'Americas',
            accent: 145,
            categories: [
                'american', 'brazilian', 'jamaican', 'latino', 'mexican',
                'peruvian',
            ],
        },
        {
            id: 'oceania',
            label: 'Oceania',
            accent: 185,
            categories: ['australian', 'hawaiian', 'maori'],
        },
        {
            id: 'classical',
            label: 'Classical',
            accent: 265,
            categories: ['bartok', 'classical', 'dvorak'],
        },
        {
            // Catch-all: genres rather than places, plus anything unclassified
            id: 'other',
            label: 'Other',
            accent: 0,
            muted: true,
            categories: ['film', 'jazz', 'pop', 'practice', 'shanty', 'tv', 'unsorted'],
        },
    ];

    /** @returns {Object<string, string>} category name -> region id */
    static get lookup() {
        if (!this._lookup) {
            this._lookup = {};
            this.REGIONS.forEach(region => {
                region.categories.forEach(category => {
                    this._lookup[category] = region.id;
                });
            });
        }
        return this._lookup;
    }

    /**
     * The region a category belongs to, defaulting to the last one.
     *
     * Categories are paths, not plain names — abc/ nests in places
     * ("classical/bach/inventions", "pop/game") — so only the top folder
     * decides the region.
     *
     * @param {string} category - Folder path under abc/
     * @returns {Object} The region descriptor
     */
    static regionFor(category) {
        const top = category.toLowerCase().split('/')[0];
        const id = this.lookup[top];
        return this.REGIONS.find(r => r.id === id) || this.REGIONS[this.REGIONS.length - 1];
    }

    /**
     * Buckets a list of category names into regions, preserving region order
     * and dropping regions that ended up empty.
     * @param {string[]} categories - Folder names under abc/
     * @returns {Array<{region: Object, categories: string[]}>}
     */
    static group(categories) {
        const buckets = new Map(this.REGIONS.map(r => [r.id, []]));

        categories.forEach(category => {
            buckets.get(this.regionFor(category).id).push(category);
        });

        return this.REGIONS
            .map(region => ({ region, categories: buckets.get(region.id).sort() }))
            .filter(entry => entry.categories.length > 0);
    }
}
