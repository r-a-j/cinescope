import { TmdbTranslationItemDto, TmdbTranslationDataDto } from '../common/translation.dto';

export interface TmdbCollectionTranslationsDto {
    id: number;
    translations: TmdbTranslationItemDto<TmdbTranslationDataDto>[];
}