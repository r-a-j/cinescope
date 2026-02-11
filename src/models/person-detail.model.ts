export interface PersonDetailModel {
    adult: boolean;
    also_known_as: string[];
    biography: string;
    birthday: string;
    deathday?: string;
    gender: number;
    homepage?: string;
    id: number;
    imdb_id: string;
    known_for_department: string;
    name: string;
    place_of_birth: string;
    popularity: number;
    profile_path: string;
    images?: PersonImages;
    external_ids?: PersonExternalIds;
}

export interface PersonImages {
    profiles: PersonImage[];
}

export interface PersonImage {
    aspect_ratio: number;
    file_path: string;
    height: number;
    vote_average: number;
    vote_count: number;
    width: number;
}

export interface PersonExternalIds {
    imdb_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    tiktok_id?: string;
    twitter_id?: string;
    wikipedia_id?: string;
}
