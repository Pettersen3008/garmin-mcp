import { exchangeTicket } from "./auth/oauth.ts";
import { getProfileDisplayName } from "./auth/profile.ts";
import type { SessionStore } from "./auth/session.ts";
import { createKeychainSessionStore } from "./auth/token-store.ts";
import { getActivity } from "./features/activities/get.ts";
import { listActivities } from "./features/activities/list.ts";
import type {
  Activity,
  ListActivitiesInput,
} from "./features/activities/model.ts";
import { getDailySummary } from "./features/daily-summary/get.ts";
import type { DailySummary } from "./features/daily-summary/model.ts";
import { getSleep } from "./features/sleep/get.ts";
import type { SleepSummary } from "./features/sleep/model.ts";
import { getTrainingReadiness } from "./features/training/get-readiness.ts";
import { getTrainingStatus } from "./features/training/get-status.ts";
import type {
  TrainingReadiness,
  TrainingStatus,
} from "./features/training/model.ts";
import { GarminAuthError } from "./http/errors.ts";
import {
  createGetJson,
  type DiagnosticEvent,
  type Fetch,
} from "./http/request.ts";
import type { LocalDate } from "./local-date.ts";

export type GarminClient = {
  activities: {
    get(input: { id: string }): Promise<Activity>;
    list(input: ListActivitiesInput): Promise<Activity[]>;
  };
  dailySummary: {
    get(input: { date: LocalDate }): Promise<DailySummary>;
  };
  sleep: {
    get(input: { date: LocalDate }): Promise<SleepSummary>;
  };
  training: {
    getReadiness(input: { date: LocalDate }): Promise<TrainingReadiness | null>;
    getStatus(input: { date: LocalDate }): Promise<TrainingStatus | null>;
  };
};

export async function createGarminClient(
  options: {
    diagnostics?: (event: DiagnosticEvent) => void;
    fetch?: Fetch;
    now?: () => number;
    serviceTicket?: string;
    sessionStore?: SessionStore;
  } = {},
): Promise<GarminClient> {
  const sessionStore = options.sessionStore ?? createKeychainSessionStore();
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const serviceTicket = options.serviceTicket;
  const saveBootstrappedSession = serviceTicket !== undefined;
  const session =
    serviceTicket !== undefined
      ? await exchangeTicket({
          fetch: fetchFn,
          now,
          ticket: serviceTicket,
        })
      : await sessionStore.load();
  if (!session) {
    throw new GarminAuthError(
      "No Garmin session found. Set GARMIN_SERVICE_TICKET once or run bun run auth",
    );
  }
  let activeSession = session;
  const activeSessionStore: SessionStore = saveBootstrappedSession
    ? {
        async load() {
          return activeSession;
        },
        async save(nextSession) {
          activeSession = nextSession;
        },
      }
    : sessionStore;
  const getJson = createGetJson({
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    fetch: fetchFn,
    now,
    session: activeSession,
    sessionStore: activeSessionStore,
  });
  const displayName = await getProfileDisplayName(getJson);
  if (saveBootstrappedSession) {
    await sessionStore.save(activeSession);
  }

  return {
    activities: {
      get: ({ id }) => getActivity({ getJson, id }),
      list: (input) => listActivities({ getJson, input }),
    },
    dailySummary: {
      get: (input) => getDailySummary(getJson, displayName, input),
    },
    sleep: {
      get: (input) => getSleep(getJson, displayName, input),
    },
    training: {
      getReadiness: (input) => getTrainingReadiness(getJson, input),
      getStatus: (input) => getTrainingStatus(getJson, input),
    },
  };
}
