-- CreateTable
CREATE TABLE "ParticipationOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ParticipationOption_pkey" PRIMARY KEY ("id")
);

-- AddColumn (nullable first for data migration)
ALTER TABLE "Slot" ADD COLUMN "participationOptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationOption_projectId_label_key" ON "ParticipationOption"("projectId", "label");

-- AddForeignKey
ALTER TABLE "ParticipationOption" ADD CONSTRAINT "ParticipationOption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create default ParticipationOption for each Project that has Slots
INSERT INTO "ParticipationOption" ("id", "label", "color", "projectId")
SELECT
    gen_random_uuid(),
    '参加',
    '#0F82B1',
    sub."projectId"
FROM (SELECT DISTINCT "projectId" FROM "Slot") AS sub;

-- Also create for Projects without Slots (recommended for consistency)
INSERT INTO "ParticipationOption" ("id", "label", "color", "projectId")
SELECT
    gen_random_uuid(),
    '参加',
    '#0F82B1',
    p."id"
FROM "Project" p
WHERE NOT EXISTS (
    SELECT 1 FROM "ParticipationOption" po WHERE po."projectId" = p."id"
);

-- Update existing Slots to reference default ParticipationOption
UPDATE "Slot" s
SET "participationOptionId" = (
    SELECT po."id"
    FROM "ParticipationOption" po
    WHERE po."projectId" = s."projectId"
    LIMIT 1
);

-- Now make the column NOT NULL
ALTER TABLE "Slot" ALTER COLUMN "participationOptionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_participationOptionId_fkey" FOREIGN KEY ("participationOptionId") REFERENCES "ParticipationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
