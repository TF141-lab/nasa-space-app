import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on boot safely
export async function testFirestoreConnection(): Promise<void> {
  try {
    if (!db) {
      console.info('Firestore database is not initialized; local storage will be used.');
    }
  } catch {
    // Graceful offline fallback
  }
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutCommander() {
  return signOut(auth);
}

// Sanitize & enforce blueprint bounds before writing to Firestore
function clampInt(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function sanitizeString(str: string, maxLen: number, fallback: string): string {
  const cleaned = (str || '').trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
}

export interface OutpostSavePayload {
  commanderName: string;
  siteId: 'artemis_shackleton' | 'mars_jezero';
  sol: number;
  power: number;
  lifeSupport: number;
  shielding: number;
  scienceScore: number;
  status: 'active' | 'victory' | 'failed';
}

export async function saveOutpostProgress(
  saveId: string,
  payload: OutpostSavePayload,
  isNew: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const cleanSaveId = saveId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const path = `saves/${cleanSaveId}`;

  const validatedData = {
    ownerId: user.uid,
    commanderName: sanitizeString(payload.commanderName, 60, 'Junior Commander'),
    siteId: payload.siteId === 'mars_jezero' ? 'mars_jezero' : 'artemis_shackleton',
    sol: clampInt(payload.sol, 1, 10),
    power: clampInt(payload.power, 0, 100),
    lifeSupport: clampInt(payload.lifeSupport, 0, 100),
    shielding: clampInt(payload.shielding, 0, 100),
    scienceScore: clampInt(payload.scienceScore, 0, 10000),
    status: payload.status,
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'saves', cleanSaveId), {
        ...validatedData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'saves', cleanSaveId), {
        commanderName: validatedData.commanderName,
        sol: validatedData.sol,
        power: validatedData.power,
        lifeSupport: validatedData.lifeSupport,
        shielding: validatedData.shielding,
        scienceScore: validatedData.scienceScore,
        status: validatedData.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function recordMissionLog(payload: {
  commanderName: string;
  siteId: 'artemis_shackleton' | 'mars_jezero';
  solsSurvived: number;
  scienceScore: number;
  outcome: 'victory' | 'failed';
  summaryNote: string;
}): Promise<void> {
  const localLog: MissionLogRecord = {
    id: `local_log_${Date.now()}`,
    commanderName: sanitizeString(payload.commanderName, 60, 'Junior Commander'),
    siteId: payload.siteId === 'mars_jezero' ? 'mars_jezero' : 'artemis_shackleton',
    solsSurvived: clampInt(payload.solsSurvived, 1, 10),
    scienceScore: clampInt(payload.scienceScore, 0, 10000),
    outcome: payload.outcome === 'victory' ? 'victory' : 'failed',
    summaryNote: sanitizeString(
      payload.summaryNote,
      240,
      'Completed Junior Astronaut training run balancing Power, O2, and Shielding.'
    ),
  };

  // Always persist locally for offline/guest reliability
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem('starbound_mission_logs');
      const existing: MissionLogRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(localLog);
      window.localStorage.setItem('starbound_mission_logs', JSON.stringify(existing.slice(0, 20)));
    }
  } catch {
    // Non-critical local cache error
  }

  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const logId = `log_${user.uid.slice(0, 16)}_${Date.now()}`;
  const path = `missionLogs/${logId}`;

  try {
    await setDoc(doc(db, 'missionLogs', logId), {
      ownerId: user.uid,
      commanderName: localLog.commanderName,
      siteId: localLog.siteId,
      solsSurvived: localLog.solsSurvived,
      scienceScore: localLog.scienceScore,
      outcome: localLog.outcome,
      summaryNote: localLog.summaryNote,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface MissionLogRecord {
  id: string;
  commanderName: string;
  siteId: 'artemis_shackleton' | 'mars_jezero';
  solsSurvived: number;
  scienceScore: number;
  outcome: 'victory' | 'failed';
  summaryNote: string;
}

export async function fetchUserMissionLogs(): Promise<MissionLogRecord[]> {
  const getLocalLogs = (): MissionLogRecord[] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('starbound_mission_logs');
        return raw ? JSON.parse(raw) : [];
      }
    } catch {
      // Ignore local storage parse error
    }
    return [];
  };

  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return getLocalLogs();
  }

  const path = 'missionLogs';
  try {
    // Query without requiring a composite index: sort in memory
    const q = query(
      collection(db, 'missionLogs'),
      where('ownerId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const cloudLogs = snap.docs.map((d) => {
      const data = d.data();
      const createdAtMs = (data.createdAt && typeof data.createdAt.toMillis === 'function')
        ? data.createdAt.toMillis()
        : 0;
      return {
        id: d.id,
        commanderName: String(data.commanderName || 'Commander'),
        siteId: (data.siteId === 'mars_jezero' ? 'mars_jezero' : 'artemis_shackleton') as 'artemis_shackleton' | 'mars_jezero',
        solsSurvived: Number(data.solsSurvived || 1),
        scienceScore: Number(data.scienceScore || 0),
        outcome: (data.outcome === 'victory' ? 'victory' : 'failed') as 'victory' | 'failed',
        summaryNote: String(data.summaryNote || ''),
        _createdAtMs: createdAtMs,
      };
    });

    cloudLogs.sort((a, b) => b._createdAtMs - a._createdAtMs);
    const mappedCloud = cloudLogs.slice(0, 10).map(({ _createdAtMs, ...rest }) => rest);
    return mappedCloud.length > 0 ? mappedCloud : getLocalLogs();
  } catch (error) {
    console.warn('Falling back to local logs due to Firestore query error:', error);
    return getLocalLogs();
  }
}
