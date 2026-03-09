export interface TmdbJobDepartmentDto {
    /**
     * The name of the department (e.g., 'Directing', 'Writing', 'Sound').
     */
    department: string;
    /**
     * A list of specific job titles within that department.
     */
    jobs: string[];
}