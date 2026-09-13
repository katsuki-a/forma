import { describe } from "../localization/index.ts";
import {
  AppError,
  announcementInputSchema,
  type Announcement,
  type AnnouncementInput,
} from "../contracts/model.ts";
import type { Repository } from "./repository.ts";

export function announcementService(
  repository: Repository,
  context: { id: () => string; now: () => string },
) {
  return {
    listAnnouncements: () => repository.listAnnouncements(),
    async saveAnnouncement(candidate: AnnouncementInput) {
      const parsed = announcementInputSchema.safeParse(candidate);
      if (!parsed.success)
        throw new AppError("validation", describe("errors.announcementInput"));
      const input = parsed.data;
      const existing = input.id
        ? await repository.getAnnouncement(input.id)
        : null;
      if (input.id && !existing)
        throw new AppError(
          "not_found",
          describe("errors.announcementNotFound"),
        );
      if (existing && existing.revision !== input.revision)
        throw new AppError("conflict", describe("errors.announcementConflict"));
      const announcement: Announcement = {
        id: existing?.id ?? context.id(),
        revision: existing ? existing.revision + 1 : 0,
        title: input.title,
        body: input.body,
        createdAt: existing?.createdAt ?? context.now(),
        updatedAt: context.now(),
      };
      if (
        !(await repository.compareAndSwapAnnouncement(
          announcement,
          input.revision ?? null,
        ))
      )
        throw new AppError("conflict", describe("errors.announcementConflict"));
      return announcement;
    },
    async deleteAnnouncement(id: string, revision: number) {
      if (!(await repository.deleteAnnouncement(id, revision)))
        throw new AppError(
          "conflict",
          describe("errors.announcementDeleteConflict"),
        );
    },
  };
}
