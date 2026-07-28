CREATE TABLE "MediaRating" (
    "imdbId" TEXT NOT NULL,
    "imdbRating" DECIMAL,
    "imdbVotes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRating_pkey" PRIMARY KEY ("imdbId")
);
