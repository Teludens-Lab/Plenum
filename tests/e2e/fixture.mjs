export const fixture = {
  organizationId: "11000000-0000-4000-8000-000000000001",
  projectId: "12000000-0000-4000-8000-000000000001",
  revisionId: "13000000-0000-4000-8000-000000000001",
  releaseId: "14000000-0000-4000-8000-000000000001",
  sessionId: "15000000-0000-4000-8000-000000000001",
  deploymentId: "16000000-0000-4000-8000-000000000001",
  people: {
    author: "21000000-0000-4000-8000-000000000001",
    reviewer: "21000000-0000-4000-8000-000000000002",
    finalReviewer: "21000000-0000-4000-8000-000000000003",
    operator: "21000000-0000-4000-8000-000000000004",
    redAuthor: "21000000-0000-4000-8000-000000000005",
    greenReviewer: "21000000-0000-4000-8000-000000000006",
    redReviewer: "21000000-0000-4000-8000-000000000007"
  },
  participants: {
    author: "31000000-0000-4000-8000-000000000001",
    reviewer: "31000000-0000-4000-8000-000000000002",
    finalReviewer: "31000000-0000-4000-8000-000000000003",
    redAuthor: "31000000-0000-4000-8000-000000000005",
    greenReviewer: "31000000-0000-4000-8000-000000000006",
    redReviewer: "31000000-0000-4000-8000-000000000007"
  },
  assignments: {
    author: "41000000-0000-4000-8000-000000000001",
    reviewer: "41000000-0000-4000-8000-000000000002",
    finalReviewer: "41000000-0000-4000-8000-000000000003",
    redAuthor: "41000000-0000-4000-8000-000000000005",
    greenReviewer: "41000000-0000-4000-8000-000000000006",
    redReviewer: "41000000-0000-4000-8000-000000000007"
  },
  authenticationSessions: {
    author: "51000000-0000-4000-8000-000000000001",
    reviewer: "51000000-0000-4000-8000-000000000002",
    finalReviewer: "51000000-0000-4000-8000-000000000003",
    operator: "51000000-0000-4000-8000-000000000004",
    redAuthor: "51000000-0000-4000-8000-000000000005",
    greenReviewer: "51000000-0000-4000-8000-000000000006",
    redReviewer: "51000000-0000-4000-8000-000000000007"
  },
  tokens: {
    author: "ps150-author",
    reviewer: "ps150-reviewer",
    finalReviewer: "ps150-final-reviewer",
    operator: "ps150-operator",
    redAuthor: "ps200-red-author",
    greenReviewer: "ps210-green-reviewer",
    redReviewer: "ps210-red-reviewer"
  },
  proposalArtifactId: "61000000-0000-4000-8000-000000000001"
};

export function runtimeUrl() {
  return `/app/dashboard?sessionId=${fixture.sessionId}`;
}

export function operatorUrl() {
  return `/admin/dashboard?sessionId=${fixture.sessionId}`;
}
