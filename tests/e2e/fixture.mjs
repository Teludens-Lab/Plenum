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
    operator: "21000000-0000-4000-8000-000000000004"
  },
  participants: {
    author: "31000000-0000-4000-8000-000000000001",
    reviewer: "31000000-0000-4000-8000-000000000002",
    finalReviewer: "31000000-0000-4000-8000-000000000003"
  },
  assignments: {
    author: "41000000-0000-4000-8000-000000000001",
    reviewer: "41000000-0000-4000-8000-000000000002",
    finalReviewer: "41000000-0000-4000-8000-000000000003"
  },
  authenticationSessions: {
    author: "51000000-0000-4000-8000-000000000001",
    reviewer: "51000000-0000-4000-8000-000000000002",
    finalReviewer: "51000000-0000-4000-8000-000000000003",
    operator: "51000000-0000-4000-8000-000000000004"
  },
  tokens: {
    author: "ps150-author",
    reviewer: "ps150-reviewer",
    finalReviewer: "ps150-final-reviewer",
    operator: "ps150-operator"
  }
};

export function runtimeUrl() {
  return `/app/dashboard?sessionId=${fixture.sessionId}`;
}

export function operatorUrl() {
  return `/admin/dashboard?sessionId=${fixture.sessionId}`;
}
