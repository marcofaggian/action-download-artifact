export type SelectedArtifact = {
  [name: string]:
    | {
        /** @example 5 */
        id: number;
        /** @example MDEwOkNoZWNrU3VpdGU1 */
        node_id: string;
        /**
         * @description The name of the artifact.
         * @example AdventureWorks.Framework
         */
        name: string;
        /**
         * @description The size in bytes of the artifact.
         * @example 12345
         */
        size_in_bytes: number;
        /** @example https://api.github.com/repos/github/hello-world/actions/artifacts/5 */
        url: string;
        /** @example https://api.github.com/repos/github/hello-world/actions/artifacts/5/zip */
        archive_download_url: string;
        /** @description Whether or not the artifact has expired. */
        expired: boolean;
        /** Format: date-time */
        created_at: string | null;
        /** Format: date-time */
        expires_at: string | null;
        /** Format: date-time */
        updated_at: string | null;
        workflow_run?: {
          /** @example 10 */
          id?: number;
          /** @example 42 */
          repository_id?: number;
          /** @example 42 */
          head_repository_id?: number;
          /** @example main */
          head_branch?: string;
          /** @example 009b8a3a9ccbb128af87f9b1c0f4c62e8a304f6d */
          head_sha?: string;
        } | null;
      }
    | undefined;
};
