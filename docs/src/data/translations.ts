export interface FeatureItem {
  title: string;
  description: string;
}

export interface HomeTranslations {
  heroTitle: string;
  heroSubtitle: string;
  btnGetStarted: string;
  btnApiRef: string;
  features: FeatureItem[];
}

export const translations: Record<string, HomeTranslations> = {
  en: {
    heroTitle: "NeoWatch API",
    heroSubtitle: "TypeScript · Bun · Elysia · TMDB · Neo ID SSO",
    btnGetStarted: "Get Started →",
    btnApiRef: "API Reference",
    features: [
      {
        title: "Neo ID SSO",
        description:
          "Single sign-on via Neo ID with OAuth 2.0 and OpenID Connect. JWT access tokens with 15-minute expiry and 30-day refresh tokens.",
      },
      {
        title: "TMDB Integration",
        description:
          "Full movie and TV show metadata from The Movie Database. Search, popular, top-rated, genres, and collections.",
      },
      {
        title: "Video Players",
        description:
          "Multiple streaming providers: Alloha, Collaps, CDN, and HLS proxy. Season and episode support for TV shows.",
      },
      {
        title: "Favorites & Watch Later",
        description:
          "Per-user favorites and watch later lists with idempotent add/remove. Cross-device sync via Neo ID account.",
      },
      {
        title: "Torrent Search",
        description:
          "Search torrents via RedAPI integration. Optional season and episode filtering for TV shows. Sorted by seeders.",
      },
      {
        title: "Serverless on Vercel",
        description:
          "Deployed as serverless functions on Vercel Edge Network. Automatic scaling, CORS on every response.",
      },
    ],
  },
  ru: {
    heroTitle: "NeoWatch API",
    heroSubtitle: "TypeScript · Bun · Elysia · TMDB · Neo ID SSO",
    btnGetStarted: "Начать →",
    btnApiRef: "API Reference",
    features: [
      {
        title: "Neo ID SSO",
        description:
          "Единый вход через Neo ID с OAuth 2.0 и OpenID Connect. JWT access-токены на 15 минут и refresh-токены на 30 дней.",
      },
      {
        title: "Интеграция с TMDB",
        description:
          "Полные данные о фильмах и сериалах из The Movie Database. Поиск, популярное, топ по рейтингу, жанры и коллекции.",
      },
      {
        title: "Видеоплееры",
        description:
          "Множество провайдеров: Alloha, Collaps, CDN и HLS proxy. Поддержка сезонов и эпизодов для сериалов.",
      },
      {
        title: "Избранное и Watch Later",
        description:
          "Персональные списки избранного и отложенного с идемпотентным добавлением/удалением. Синхронизация между устройствами через Neo ID.",
      },
      {
        title: "Поиск торрентов",
        description:
          "Поиск торрентов через RedAPI. Фильтрация по сезону и эпизоду для сериалов. Сортировка по сидам.",
      },
      {
        title: "Serverless на Vercel",
        description:
          "Развёрнуто как serverless-функции на Vercel Edge Network. Автоматическое масштабирование, CORS на каждый ответ.",
      },
    ],
  },
};
