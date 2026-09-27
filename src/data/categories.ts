export interface CategoryDef {
  id: string
  name: string
  slug: string
  kind: "list" | "genre" | "company" | "network"
  mediaType: "movie" | "tv"
  value: string
}

export const listCategories: CategoryDef[] = [
  { id: "popular-movies",  name: "Popular Movies",       slug: "popular-movies",  kind: "list", mediaType: "movie", value: "popular"    },
  { id: "top-movies",      name: "Top Rated Movies",     slug: "top-movies",      kind: "list", mediaType: "movie", value: "top-rated"  },
  { id: "upcoming",        name: "Upcoming",             slug: "upcoming",        kind: "list", mediaType: "movie", value: "upcoming"   },
  { id: "popular-tv",      name: "Popular TV Shows",     slug: "popular-tv",      kind: "list", mediaType: "tv",    value: "popular"    },
  { id: "top-tv",          name: "Top Rated TV Shows",   slug: "top-tv",          kind: "list", mediaType: "tv",    value: "top-rated"  },
]

export const studioCategories: CategoryDef[] = [
  { id: "warner-bros",          name: "Warner Bros.",        slug: "warner-bros",          kind: "company", mediaType: "movie", value: "174"    },
  { id: "sony-pictures",        name: "Sony Pictures",       slug: "sony-pictures",        kind: "company", mediaType: "movie", value: "34"     },
  { id: "disney",               name: "Disney",              slug: "disney",               kind: "company", mediaType: "movie", value: "2"      },
  { id: "universal",            name: "Universal",           slug: "universal",            kind: "company", mediaType: "movie", value: "33"     },
  { id: "paramount",            name: "Paramount",           slug: "paramount",            kind: "company", mediaType: "movie", value: "4"      },
  { id: "20th-century-studios", name: "20th Century Studios",slug: "20th-century-studios", kind: "company", mediaType: "movie", value: "25"     },
  { id: "marvel",               name: "Marvel",              slug: "marvel",               kind: "company", mediaType: "movie", value: "420"    },
  { id: "dc",                   name: "DC",                  slug: "dc",                   kind: "company", mediaType: "movie", value: "128064" },
  { id: "pixar",                name: "Pixar",               slug: "pixar",                kind: "company", mediaType: "movie", value: "3"      },
  { id: "dreamworks",           name: "DreamWorks",          slug: "dreamworks",           kind: "company", mediaType: "movie", value: "521"    },
  { id: "a24",                  name: "A24",                 slug: "a24",                  kind: "company", mediaType: "movie", value: "41077"  },
]

export const networkCategories: CategoryDef[] = [
  { id: "netflix",        name: "Netflix",        slug: "netflix",        kind: "network", mediaType: "tv", value: "213"  },
  { id: "hbo",            name: "HBO",            slug: "hbo",            kind: "network", mediaType: "tv", value: "49"   },
  { id: "apple-tv-plus",  name: "Apple TV+",      slug: "apple-tv-plus",  kind: "network", mediaType: "tv", value: "2552" },
  { id: "prime-video",    name: "Prime Video",    slug: "prime-video",    kind: "network", mediaType: "tv", value: "1024" },
  { id: "hulu",           name: "Hulu",           slug: "hulu",           kind: "network", mediaType: "tv", value: "453"  },
  { id: "peacock",        name: "Peacock",        slug: "peacock",        kind: "network", mediaType: "tv", value: "3353" },
  { id: "cartoon-network",name: "Cartoon Network",slug: "cartoon-network",kind: "network", mediaType: "tv", value: "56"   },
  { id: "nickelodeon",    name: "Nickelodeon",    slug: "nickelodeon",    kind: "network", mediaType: "tv", value: "13"   },
  { id: "adult-swim",     name: "Adult Swim",     slug: "adult-swim",     kind: "network", mediaType: "tv", value: "80"   },
]

/** Все статические категории (без genres) */
export const allStaticCategories: CategoryDef[] = [
  ...listCategories,
  ...studioCategories,
  ...networkCategories,
]
