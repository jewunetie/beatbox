-- CreateTable
CREATE TABLE "Track" (
    "spotifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "durationMs" INTEGER NOT NULL,
    "coverUrl" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("spotifyId")
);

-- CreateTable
CREATE TABLE "Take" (
    "id" SERIAL NOT NULL,
    "trackId" TEXT NOT NULL,
    "granularity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "calibrationOffsetMs" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Take_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marker" (
    "id" SERIAL NOT NULL,
    "takeId" INTEGER NOT NULL,
    "timeSeconds" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "Marker_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Take" ADD CONSTRAINT "Take_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("spotifyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take"("id") ON DELETE CASCADE ON UPDATE CASCADE;
