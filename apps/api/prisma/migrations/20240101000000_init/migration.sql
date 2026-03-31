-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "agentName" TEXT,
    "payload" TEXT,
    "result" TEXT,
    "errorMsg" TEXT,
    "durationMs" INTEGER
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedAssistant" TEXT NOT NULL DEFAULT 'me',
    "sidebarOpen" BOOLEAN NOT NULL DEFAULT true,
    "selectedAgent" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "ConfigSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "configType" TEXT NOT NULL,
    "agentName" TEXT,
    "contentBefore" TEXT NOT NULL,
    "contentAfter" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_assistantId_agentName_idx" ON "AuditLog"("assistantId", "agentName");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
