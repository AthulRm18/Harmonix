import { create } from 'zustand';

export interface ReplayState {
  // Current run
  runId: string | null;
  setRunId: (id: string | null) => void;

  // Playback
  isPlaying: boolean;
  speed: number;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  stepForward: () => void;
  stepBackward: () => void;

  // Active screen
  activeScreen: string;
  setActiveScreen: (screen: string) => void;

  // Window size
  windowSize: number;
  setWindowSize: (s: number) => void;
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  runId: null,
  setRunId: (id) => set({ runId: id, currentTime: 0, isPlaying: false }),

  isPlaying: false,
  speed: 1.0,
  currentTime: 0,
  duration: 300,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed: Math.max(0.5, Math.min(16, speed)) }),
  setCurrentTime: (t) => set({ currentTime: Math.max(0, Math.min(t, get().duration)) }),
  setDuration: (d) => set({ duration: d }),
  stepForward: () => {
    const { currentTime, windowSize, duration } = get();
    set({ currentTime: Math.min(currentTime + windowSize, duration) });
  },
  stepBackward: () => {
    const { currentTime, windowSize } = get();
    set({ currentTime: Math.max(currentTime - windowSize, 0) });
  },

  activeScreen: 'replay',
  setActiveScreen: (screen) => set({ activeScreen: screen }),

  windowSize: 1.0,
  setWindowSize: (s) => set({ windowSize: s }),
}));
