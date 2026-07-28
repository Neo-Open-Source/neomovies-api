CREATE TABLE "ExternalId" (
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'movie',
    "imdbId" TEXT,
    "kpId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalId_pkey" PRIMARY KEY ("tmdbId")
);
