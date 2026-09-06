import type { Application, Announcement } from "../contracts/model.ts";

// CASはアプリ単位で原子的に行う。nullは新規作成を表す。
export interface Repository {
  listAnnouncements(): Promise<Announcement[]>;
  getAnnouncement(id: string): Promise<Announcement | null>;
  compareAndSwapAnnouncement(
    announcement: Announcement,
    expectedRevision: number | null,
  ): Promise<boolean>;
  deleteAnnouncement(id: string, expectedRevision: number): Promise<boolean>;
  list(): Promise<Application[]>;
  get(id: string): Promise<Application | null>;
  compareAndSwap(
    app: Application,
    expectedRevision: number | null,
  ): Promise<boolean>;
}
