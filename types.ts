
export enum CoachStatus {
  IDLE = 'IDLE',
  WATCHING = 'WATCHING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  brightness: number;
  motionScore: number;
  isLowLight: boolean;
  isShaking: boolean;
  timestamp: number;
}

export interface FeedbackMessage {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success';
  timestamp: number;
}
