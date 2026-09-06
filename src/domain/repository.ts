import type { Application } from '../contracts/model.ts';

// CASはアプリ単位で原子的に行う。nullは新規作成を表す。
export interface Repository {
  list(): Promise<Application[]>;
  get(id: string): Promise<Application | null>;
  compareAndSwap(app: Application, expectedRevision: number | null): Promise<boolean>;
}
