import OpenAI from "openai";
import { ObjectStorageService } from "./objectStorage";
import { File } from "@google-cloud/storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export class TranscriptionService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Transcribe a video file using OpenAI Whisper API
   * @param objectFile - The video file in object storage
   * @returns Promise<TranscriptSegment[]> - Array of transcript segments with timestamps
   */
  async transcribeVideo(objectFile: File): Promise<TranscriptSegment[]> {
    try {
      console.log(`Starting transcription for video: ${objectFile.name}`);
      
      // Create a read stream from the object storage file
      const fileStream = objectFile.createReadStream();
      
      // Convert stream to buffer for OpenAI API
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        fileStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        fileStream.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            
            // Check file size (Whisper API has a 25MB limit)
            if (buffer.length > 25 * 1024 * 1024) {
              throw new Error("Video file is too large for transcription (max 25MB)");
            }

            // Create a file-like object for the OpenAI API
            const fileBlob = new Blob([buffer], { type: 'video/mp4' });

            console.log(`Sending ${buffer.length} bytes to OpenAI Whisper API`);
            
            // Call OpenAI Whisper API with word-level timestamps
            const transcription = await openai.audio.transcriptions.create({
              file: fileBlob as any,
              model: "whisper-1",
              response_format: "verbose_json",
              timestamp_granularities: ["word"]
            });

            console.log(`Transcription completed for: ${objectFile.name}`);
            
            // Convert OpenAI response to our format
            const segments: TranscriptSegment[] = [];
            
            if (transcription.words) {
              // Group words into segments for better display
              let currentSegment: TranscriptSegment | null = null;
              const wordsPerSegment = 10; // Adjust as needed
              let wordCount = 0;

              for (const word of transcription.words) {
                if (!currentSegment || wordCount >= wordsPerSegment) {
                  if (currentSegment) {
                    segments.push(currentSegment);
                  }
                  currentSegment = {
                    start: word.start,
                    end: word.end,
                    text: word.word
                  };
                  wordCount = 1;
                } else {
                  currentSegment.end = word.end;
                  currentSegment.text += word.word;
                  wordCount++;
                }
              }
              
              // Add the last segment
              if (currentSegment) {
                segments.push(currentSegment);
              }
            } else if (transcription.segments) {
              // Fallback to segment-level timestamps if word-level not available
              for (const segment of transcription.segments) {
                segments.push({
                  start: segment.start,
                  end: segment.end,
                  text: segment.text
                });
              }
            }

            resolve(segments);
          } catch (error) {
            console.error("Error during transcription:", error);
            reject(error);
          }
        });
        
        fileStream.on('error', (error: Error) => {
          console.error("Error reading video file:", error);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error("Transcription failed:", error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Get the duration of a video file
   * @param objectFile - The video file in object storage
   * @returns Promise<string> - Duration in MM:SS format
   */
  async getVideoDuration(objectFile: File): Promise<string> {
    try {
      // Get file metadata to estimate duration
      const [metadata] = await objectFile.getMetadata();
      
      // For now, return a placeholder since we can't easily get duration from metadata
      // In a production app, you might use ffprobe or similar tool
      return "00:00";
    } catch (error) {
      console.error("Error getting video duration:", error);
      return "00:00";
    }
  }

  /**
   * Convert transcript segments to plain text
   * @param segments - Array of transcript segments
   * @returns string - Plain text transcript
   */
  segmentsToText(segments: TranscriptSegment[]): string {
    return segments.map(segment => segment.text).join(' ').trim();
  }

  /**
   * Find the active transcript segment for a given time
   * @param segments - Array of transcript segments
   * @param currentTime - Current video time in seconds
   * @returns TranscriptSegment | null - The active segment or null
   */
  getActiveSegment(segments: TranscriptSegment[], currentTime: number): TranscriptSegment | null {
    return segments.find(segment => 
      currentTime >= segment.start && currentTime <= segment.end
    ) || null;
  }
}

export const transcriptionService = new TranscriptionService();