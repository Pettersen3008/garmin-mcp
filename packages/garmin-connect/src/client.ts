import { exchangeTicket } from "./auth/oauth.ts";
import { getProfileDisplayName } from "./auth/profile.ts";
import type { SessionStore } from "./auth/session.ts";
import { createSessionStore } from "./auth/token-store.ts";
import { getActivity } from "./features/activities/get.ts";
import { listActivities } from "./features/activities/list.ts";
import type {
  Activity,
  EditActivityInput,
  ListActivitiesInput,
} from "./features/activities/model.ts";
import { deleteActivity, editActivity } from "./features/activities/mutate.ts";
import { getDailySummary } from "./features/daily-summary/get.ts";
import type { DailySummary } from "./features/daily-summary/model.ts";
import {
  getDailyBloodOxygen,
  getDailyBodyBattery,
  getDailyBodyComposition,
  getDailyHrv,
  getDailyRespiration,
  getDailyStress,
} from "./features/health-history/get.ts";
import type {
  DailyBloodOxygen,
  DailyBodyBattery,
  DailyBodyComposition,
  DailyHrv,
  DailyRespiration,
  DailyStress,
} from "./features/health-history/model.ts";
import { getDailyHeartRate } from "./features/heart-rate/get.ts";
import type { DailyHeartRate } from "./features/heart-rate/model.ts";
import { getSleep } from "./features/sleep/get.ts";
import type { SleepSummary } from "./features/sleep/model.ts";
import { getTrainingReadiness } from "./features/training/get-readiness.ts";
import { getTrainingStatus } from "./features/training/get-status.ts";
import type {
  TrainingReadiness,
  TrainingStatus,
} from "./features/training/model.ts";
import {
  createWorkout,
  deleteWorkout,
  editWorkout,
  getWorkout,
  listWorkouts,
  scheduleWorkout,
  unscheduleWorkout,
} from "./features/workouts/api.ts";
import type {
  Workout,
  WorkoutDraft,
  WorkoutSchedule,
  WorkoutSummary,
} from "./features/workouts/model.ts";
import { GarminAuthError } from "./http/errors.ts";
import {
  createRequestJson,
  type DiagnosticEvent,
  type Fetch,
} from "./http/request.ts";
import { type LocalDate, parseLocalDate } from "./local-date.ts";

export type GarminClient = {
  activities: {
    delete(input: { id: string }): Promise<Activity>;
    edit(input: EditActivityInput): Promise<Activity>;
    get(input: { id: string }): Promise<Activity>;
    list(input: ListActivitiesInput): Promise<Activity[]>;
  };
  dailySummary: {
    get(input: { date: LocalDate }): Promise<DailySummary>;
  };
  heartRate: {
    get(input: { date: LocalDate }): Promise<DailyHeartRate>;
  };
  health: {
    getBloodOxygen(input: { date: LocalDate }): Promise<DailyBloodOxygen>;
    getBodyBattery(input: {
      date: LocalDate;
    }): Promise<DailyBodyBattery | null>;
    getBodyComposition(input: {
      date: LocalDate;
    }): Promise<DailyBodyComposition>;
    getHrv(input: { date: LocalDate }): Promise<DailyHrv | null>;
    getRespiration(input: { date: LocalDate }): Promise<DailyRespiration>;
    getStress(input: { date: LocalDate }): Promise<DailyStress>;
  };
  sleep: {
    get(input: { date: LocalDate }): Promise<SleepSummary>;
  };
  training: {
    getReadiness(input: { date: LocalDate }): Promise<TrainingReadiness | null>;
    getStatus(input: { date: LocalDate }): Promise<TrainingStatus | null>;
  };
  workouts: {
    create(input: WorkoutDraft): Promise<Workout>;
    delete(input: { id: string }): Promise<Workout>;
    edit(input: { id: string; workout: WorkoutDraft }): Promise<Workout>;
    get(input: { id: string }): Promise<Workout>;
    list(input: { limit: number }): Promise<WorkoutSummary[]>;
    schedule(input: {
      workoutId: string;
      date: LocalDate;
    }): Promise<WorkoutSchedule>;
    unschedule(input: { id: string }): Promise<WorkoutSchedule>;
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
  const sessionStore = options.sessionStore ?? createSessionStore();
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const serviceTicket = options.serviceTicket;
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
  // A ticket session is persisted only after the profile read proves it works.
  let latestSession = session;
  let persist = serviceTicket === undefined;
  const requestJson = createRequestJson({
    ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
    fetch: fetchFn,
    now,
    session,
    sessionStore: {
      async save(nextSession) {
        latestSession = nextSession;
        if (persist) {
          await sessionStore.save(nextSession);
        }
      },
    },
  });
  const displayName = await getProfileDisplayName(requestJson);
  if (!persist) {
    await sessionStore.save(latestSession);
    persist = true;
  }
  const dated =
    <T>(get: (input: { date: LocalDate }) => Promise<T>) =>
    async (input: { date: LocalDate }) =>
      get({ date: parseLocalDate(input.date) });

  return {
    activities: {
      delete: ({ id }) => deleteActivity({ requestJson, id }),
      edit: (input) => editActivity({ requestJson, input }),
      get: ({ id }) => getActivity({ getJson: requestJson, id }),
      list: (input) => listActivities({ getJson: requestJson, input }),
    },
    dailySummary: {
      get: dated((input) => getDailySummary(requestJson, displayName, input)),
    },
    heartRate: {
      get: dated((input) => getDailyHeartRate(requestJson, displayName, input)),
    },
    health: {
      getBloodOxygen: dated((input) => getDailyBloodOxygen(requestJson, input)),
      getBodyBattery: dated((input) => getDailyBodyBattery(requestJson, input)),
      getBodyComposition: dated((input) =>
        getDailyBodyComposition(requestJson, input),
      ),
      getHrv: dated((input) => getDailyHrv(requestJson, input)),
      getRespiration: dated((input) => getDailyRespiration(requestJson, input)),
      getStress: dated((input) => getDailyStress(requestJson, input)),
    },
    sleep: {
      get: dated((input) => getSleep(requestJson, displayName, input)),
    },
    training: {
      getReadiness: dated((input) => getTrainingReadiness(requestJson, input)),
      getStatus: dated((input) => getTrainingStatus(requestJson, input)),
    },
    workouts: {
      create: (workout) => createWorkout({ requestJson, workout }),
      delete: ({ id }) => deleteWorkout({ requestJson, id }),
      edit: ({ id, workout }) => editWorkout({ requestJson, id, workout }),
      get: ({ id }) => getWorkout({ getJson: requestJson, id }),
      list: ({ limit }) => listWorkouts({ getJson: requestJson, limit }),
      schedule: ({ workoutId, date }) =>
        scheduleWorkout({ requestJson, workoutId, date }),
      unschedule: ({ id }) => unscheduleWorkout({ requestJson, id }),
    },
  };
}
