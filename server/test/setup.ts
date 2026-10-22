import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/db.js";

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Project", "AllowedRange", "Slot", "Host", "Guest", "ParticipationOption" CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
