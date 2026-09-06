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
        throw new AppError(
          "validation",
          "お知らせのタイトルと本文を確認してください。",
        );
      const input = parsed.data;
      const existing = input.id
        ? await repository.getAnnouncement(input.id)
        : null;
      if (input.id && !existing)
        throw new AppError("not_found", "お知らせが見つかりません。");
      if (existing && existing.revision !== input.revision)
        throw new AppError(
          "conflict",
          "お知らせが変更されています。最新の内容を読み直してください。",
        );
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
        throw new AppError(
          "conflict",
          "お知らせが変更されています。最新の内容を読み直してください。",
        );
      return announcement;
    },
    async deleteAnnouncement(id: string, revision: number) {
      if (!(await repository.deleteAnnouncement(id, revision)))
        throw new AppError(
          "conflict",
          "お知らせが変更または削除されています。最新の内容を読み直してください。",
        );
    },
  };
}
