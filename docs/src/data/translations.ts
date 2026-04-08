export interface FeatureItem {
  title: string;
  icon: string;
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
    heroTitle: "NeoMovies API",
    heroSubtitle: "Rust · Serverless · Vercel · Kinopoisk · Neo ID SSO",
    btnGetStarted: "Get Started →",
    btnApiRef: "API Reference",
    features: [
      {
        title: "Neo ID SSO",
        icon: "lock",
        description:
          "Single sign-on via Neo ID. One account across all NeoMovies services. JWT access tokens with 15-minute expiry and 30-day refresh tokens.",
      },
      {
        title: "Kinopoisk API",
        icon: "film",
        description:
          "Search, popular, top-rated, and full film details — all powered by Kinopoisk. Russian-language results out of the box.",
      },
      {
        title: "Video Players",
        icon: "play",
        description:
          "Embeddable iframes for Alloha, Lumex, Vibix, HDVB, and Collaps. Season and episode support for TV shows.",
      },
      {
        title: "Favorites",
        icon: "star",
        description:
          "Per-user favorites list with idempotent add/remove and media-type aware checks.",
      },
      {
        title: "Torrent Search",
        icon: "magnet",
        description:
          "Search torrents by Kinopoisk ID via RedAPI. Optional season and episode filtering. Sorted by seeders.",
      },
      {
        title: "Serverless on Vercel",
        icon: "zap",
        description:
          "Each endpoint is a standalone Rust serverless function. Zero cold-start overhead, automatic scaling, CORS on every response.",
      },
    ],
  },
  ru: {
    heroTitle: "NeoMovies API",
    heroSubtitle: "Rust · Serverless · Vercel · Кинопоиск · Neo ID SSO",
    btnGetStarted: "Начать →",
    btnApiRef: "API Reference",
    features: [
      {
        title: "Neo ID SSO",
        icon: "lock",
        description:
          "Единый вход через Neo ID. Один аккаунт для всех сервисов NeoMovies. JWT access-токены на 15 минут и refresh-токены на 30 дней.",
      },
      {
        title: "Kinopoisk API",
        icon: "film",
        description:
          "Поиск, популярное, топ по рейтингу и полные данные о фильмах — всё через Кинопоиск. Результаты на русском языке.",
      },
      {
        title: "Видеоплееры",
        icon: "play",
        description:
          "Встраиваемые iframe для Alloha, Lumex, Vibix, HDVB и Collaps. Поддержка сезонов и эпизодов для сериалов.",
      },
      {
        title: "Избранное",
        icon: "star",
        description:
          "Персональный список избранного с идемпотентным добавлением/удалением и проверкой по типу медиа.",
      },
      {
        title: "Поиск торрентов",
        icon: "magnet",
        description:
          "Поиск торрентов по ID Кинопоиска через RedAPI. Фильтрация по сезону и эпизоду. Сортировка по сидам.",
      },
      {
        title: "Serverless на Vercel",
        icon: "zap",
        description:
          "Каждый эндпоинт — отдельная Rust serverless-функция. Автоматическое масштабирование, CORS на каждый ответ.",
      },
    ],
  },
};
