export interface GQLSearchIssuesResponse {
  search: {
    issueCount: number;
    edges: {
      node: {
        id: string;
        number: number;
        title: string;
        body: string | null;
        url: string;
        createdAt: string;
        updatedAt: string;
        labels: {
          nodes: { name: string }[];
        };
        repository: {
          nameWithOwner: string;
        };
      };
    }[];
  };
}

export interface GQLRepositoryResponse {
  repository: {
    id: string;
    name: string;
    nameWithOwner: string;
    description: string | null;
    url: string;
    primaryLanguage: { name: string } | null;
    stargazerCount: number;
    forkCount: number;
    openIssuesCount: { totalCount: number };
    defaultBranchRef: { name: string } | null;
  };
}

export interface GQLViewerResponse {
  viewer: {
    login: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    bio: string | null;
    followers: { totalCount: number };
    following: { totalCount: number };
    createdAt: string | null;
    location: string | null;
    company: string | null;
  };
}

export interface GQLSearchRepositoriesResponse {
  search: {
    edges: {
      node: {
        id: string;
        name: string;
        nameWithOwner: string;
        description: string | null;
        url: string;
        primaryLanguage: { name: string } | null;
        stargazerCount: number;
        forkCount: number;
      };
    }[];
  };
}

export interface GQLRepositoryTreeEntry {
  name: string;
  type: string;
  mode: number;
  object: {
    entries?: { name: string; type: string }[];
    byteSize?: number;
  };
}

export interface GQLRepositoryTreeResponse {
  repository: {
    object: {
      entries: GQLRepositoryTreeEntry[];
    } | null;
  };
}

export interface GQLPRReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: {
          id: string;
          isResolved: boolean;
          comments: {
            nodes: { databaseId: number }[];
          };
        }[];
      };
    } | null;
  };
}
