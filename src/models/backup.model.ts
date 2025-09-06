import { ContentModel } from "./content.model";
import { SettingModel } from "./setting.model";

export interface BackupModel {
  version: BackupVersion;
  createdAt: string;
  app: string;
  data: {
    watchlist_contents: ContentModel[];
    watched_contents: ContentModel[];
    settings: SettingModel | null;
  };
}

export type BackupVersion = 1;