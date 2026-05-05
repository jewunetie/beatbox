-- CreateTable
CREATE TABLE "Track" (
    "spotifyId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "durationMs" INTEGER NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Take" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trackId" TEXT NOT NULL,
    "granularity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "calibrationOffsetMs" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Take_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("spotifyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Marker" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "takeId" INTEGER NOT NULL,
    "timeSeconds" REAL NOT NULL,
    "kind" TEXT NOT NULL,
    "confidence" REAL,
    CONSTRAINT "Marker_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "Take" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
