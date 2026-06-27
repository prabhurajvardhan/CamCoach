
import { AnalysisResult } from '../types';

export class VisionService {
  private prevFrameData: Uint8ClampedArray | null = null;
  private readonly motionThreshold = 15;
  private readonly lowLightThreshold = 45;

  /**
   * Analyzes a frame for brightness and motion.
   * PRIVACY STATEMENT: 
   * This logic processes raw pixel data locally in the browser's memory.
   * Frames are never stored, recorded, or uploaded.
   */
  analyzeFrame(canvas: HTMLCanvasElement): AnalysisResult {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not get canvas context");

    const { width, height } = canvas;
    const frame = ctx.getImageData(0, 0, width, height);
    const data = frame.data;

    let totalLuminance = 0;
    let totalMotion = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Relative luminance formula
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      totalLuminance += luminance;

      if (this.prevFrameData) {
        const diff = Math.abs(r - this.prevFrameData[i]) + 
                     Math.abs(g - this.prevFrameData[i + 1]) + 
                     Math.abs(b - this.prevFrameData[i + 2]);
        totalMotion += diff;
      }
    }

    const pixelCount = width * height;
    const avgLuminance = totalLuminance / pixelCount;
    const avgMotion = this.prevFrameData ? (totalMotion / (pixelCount * 3)) : 0;

    this.prevFrameData = new Uint8ClampedArray(data);

    return {
      brightness: avgLuminance,
      motionScore: avgMotion,
      isLowLight: avgLuminance < this.lowLightThreshold,
      isShaking: avgMotion > this.motionThreshold,
      timestamp: Date.now()
    };
  }

  reset() {
    this.prevFrameData = null;
  }
}

export const visionService = new VisionService();
