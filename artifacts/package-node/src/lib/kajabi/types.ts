export type JsonApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null }>;
  links?: Record<string, unknown>;
};

export type JsonApiResourceIdentifier = {
  id: string;
  type: string;
};

export type KajabiResponse<T = JsonApiResource | JsonApiResource[]> = {
  data: T;
  included?: JsonApiResource[];
  links?: Record<string, string | null>;
  meta?: {
    count?: number;
    total_count?: number;
    total_pages?: number;
    current_page?: number;
  };
};

export type NormalizedStatus =
  | "success"
  | "declined"
  | "denied"
  | "cancelled"
  | "active"
  | "inactive"
  | "deactivated"
  | "failed"
  | "unknown";

export type SyncResult = {
  recordsProcessed: number;
  pagesFetched: number;
  errors: string[];
};

export type BatchSyncResource = "customers" | "offers" | "products" | "purchases";

export type BatchSyncResult = {
  resource: BatchSyncResource;
  page: number;
  pageSize: number;
  recordsProcessed: number;
  totalRecords: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
  nextPage: number | null;
};
