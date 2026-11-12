"use client";

// The profile for this visit. It lives in memory: reload the tab and it is gone.
// It is written to this browser's localStorage only when the person ticks
// "remember". The resume's raw text is never written anywhere.
import { useSyncExternalStore } from "react";
import { emptyProfile, migrateAnswersV2, validProfile, type CandidateProfile, type Facts, type Preferences, type ResumeProfile } from "./profile";

const KEY_V3 = "fine_print.profile.v3";
const KEY_V2 = "fine_print.answers.v2";

export interface Session {
  profile: CandidateProfile;
  /** Raw resume text. Memory only. */
  resumeText: string | null;
  remember: boolean;
  /** Goes up whenever the resume or everything is cleared or replaced. In-flight work
   *  started under an older number must not write its results. */
  epoch: number;
  loaded: boolean;
}

const SERVER: Session = { profile: emptyProfile(), resumeText: null, remember: false, epoch: 0, loaded: false };
let state: Session = SERVER;
const listeners = new Set<() => void>();

function persist() {
  try {
    if (state.remember) window.localStorage.setItem(KEY_V3, JSON.stringify(state.profile));
    else window.localStorage.removeItem(KEY_V3);
  } catch {
    /* storage unavailable: the visit still works */
  }
}

function set(next: Partial<Session>, save = true) {
  state = { ...state, ...next };
  if (save && state.loaded) persist();
  listeners.forEach((l) => l());
}

/** Reads what an earlier visit chose to save. Called once, in the browser. */
export function loadSaved() {
  if (state.loaded) return;
  let profile = emptyProfile();
  let remember = false;
  try {
    const v3 = window.localStorage.getItem(KEY_V3);
    const v2 = window.localStorage.getItem(KEY_V2);
    if (v3) {
      profile = validProfile(JSON.parse(v3));
      remember = true;
    } else if (v2) {
      // The earlier version saved its four answers automatically. Carry them over,
      // keep them saved, and leave every new field unknown.
      profile = { ...emptyProfile(), facts: migrateAnswersV2(JSON.parse(v2)) };
      remember = Object.keys(profile.facts).length > 0;
    }
    if (v2) window.localStorage.removeItem(KEY_V2);
  } catch {
    /* bad or blocked storage: start empty */
  }
  set({ profile, remember, loaded: true });
}

export const actions = {
  setFacts(patch: Partial<Facts>) {
    const facts = { ...state.profile.facts, ...patch };
    for (const k of Object.keys(facts) as (keyof Facts)[]) if (facts[k] === undefined) delete facts[k];
    set({ profile: { ...state.profile, facts } });
  },
  setPrefs(prefs: Preferences) {
    set({ profile: { ...state.profile, prefs } });
  },
  setResume(resume: ResumeProfile, text: string | null) {
    set({ profile: { ...state.profile, resume }, resumeText: text, epoch: state.epoch + 1 });
  },
  editResume(resume: ResumeProfile) {
    set({ profile: { ...state.profile, resume } });
  },
  /** Removes the resume, everything read from it, and anything computed from it. */
  clearResume() {
    set({ profile: { ...state.profile, resume: null }, resumeText: null, epoch: state.epoch + 1 });
  },
  clearAll() {
    set({ profile: emptyProfile(), resumeText: null, remember: false, epoch: state.epoch + 1 });
  },
  setRemember(remember: boolean) {
    set({ remember });
  },
};

export function getSession(): Session {
  return state;
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}
