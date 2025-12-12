/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import { ScriptSegment } from "../types";

// Initialize Gemini Client
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Audio Decoding Helper
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function createWavBlob(samples: Uint8Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length, true);

  const dataView = new Uint8Array(buffer, 44);
  dataView.set(samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

export interface GeneratedAudio {
  buffer: AudioBuffer;
  rawData: Uint8Array;
}

// -- helper to concatenate buffers --
function concatenateAudioBuffers(buffers: AudioBuffer[], context: AudioContext): AudioBuffer {
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = context.createBuffer(1, totalLength, 24000); // 24000 is typical for Gemini TTS
    
    let offset = 0;
    const outputData = result.getChannelData(0);
    
    for (const buf of buffers) {
        const inputData = buf.getChannelData(0);
        outputData.set(inputData, offset);
        offset += buf.length;
    }
    
    return result;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// -- Internal helper for single speaker generation --
async function generateSingleSpeakerAudio(text: string, voiceName: string): Promise<GeneratedAudio> {
    const ai = getClient();
    
    // Wrap text in a directive to ensure the model reads it instead of replying to it
    const promptText = `Please read the following text exactly as written: "${text}"`;

    const maxRetries = 10;
    let attempt = 0;

    while (true) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: promptText }] }],
                config: {
                    responseModalities: [Modality.AUDIO], 
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName }
                        }
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const textPart = response.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!base64Audio) {
                if (textPart) {
                     console.warn("Model returned text:", textPart);
                     throw new Error(`Model returned text instead of audio: "${textPart.substring(0, 50)}..."`);
                }
                throw new Error("No audio data returned from API.");
            }

            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            try {
                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
                return { buffer: audioBuffer, rawData: audioBytes };
            } finally {
                await outputAudioContext.close();
            }
        } catch (error: any) {
            attempt++;
            
            // Check for rate limits (429) or temporary server errors
            const errorMessage = JSON.stringify(error);
            const isRateLimit = 
                error.status === 429 || 
                (error.error && error.error.code === 429) || 
                errorMessage.includes("RESOURCE_EXHAUSTED") ||
                errorMessage.includes("429") ||
                errorMessage.includes("quota");
            
            const isServerBusy = error.status === 503 || error.status === 500;

            if ((isRateLimit || isServerBusy) && attempt <= maxRetries) {
                // Exponential backoff
                const delay = Math.pow(2, attempt) * 1000 + (Math.random() * 1000); 
                console.warn(`API Error (${isRateLimit ? 'Rate Limit' : 'Server Error'}). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
            
            throw error;
        }
    }
}

export const generateSpeech = async (
  text: string, 
  hostVoice: string,
  expertVoice?: string,
): Promise<GeneratedAudio> => {
  // Legacy multi-speaker support for raw text
  const ai = getClient();
  const cleanText = text.replace(/\[(?:\*\*)?SLIDE\s+\d+(?:\*\*)?\]/gi, '').trim();
  const isScript = cleanText.includes('Host:') || cleanText.includes('Expert:');
  const safeExpertVoice = expertVoice || 'Kore';
  // Add preamble to help model understand it's a script to read
  const inputContents = isScript ? `Read the following dialogue:\n${cleanText}` : `Read the following text:\nHost: ${cleanText}`;

  const voiceConfig = {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: hostVoice } } },
        { speaker: 'Expert', voiceConfig: { prebuiltVoiceConfig: { voiceName: safeExpertVoice } } }
      ]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: inputContents }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: voiceConfig,
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned.");

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    try {
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
      return { buffer: audioBuffer, rawData: audioBytes };
    } finally {
      await outputAudioContext.close();
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

/**
 * Generates audio segment by segment to ensure perfect synchronization.
 * Optimized to merge consecutive segments by the same speaker to reduce API calls.
 */
export const generateSequencedSpeech = async (
    rawSegments: ScriptSegment[],
    hostVoice: string,
    expertVoice: string
): Promise<{ audio: GeneratedAudio, segments: ScriptSegment[] }> => {
    
    // 1. Merge consecutive segments from same speaker within same slide
    // This reduces the number of API calls significantly, preventing rate limits
    const mergedSegments: ScriptSegment[] = [];
    if (rawSegments.length > 0) {
        let current = { ...rawSegments[0] };
        for (let i = 1; i < rawSegments.length; i++) {
            const next = rawSegments[i];
            // Merge if speaker AND slide index are the same
            if (next.speaker === current.speaker && next.slideIndex === current.slideIndex) {
                current.text += " " + next.text;
                // We don't update ID as the new segment represents the block
            } else {
                mergedSegments.push(current);
                current = { ...next };
            }
        }
        mergedSegments.push(current);
    }

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffers: AudioBuffer[] = [];
    const finalSegments: ScriptSegment[] = [];
    
    let currentOffset = 0;

    try {
        // Generate sequentially
        for (const segment of mergedSegments) {
            const speaker = segment.speaker;
            const text = segment.text.trim();
            if (!text) continue;

            const voiceName = speaker === 'Host' ? hostVoice : expertVoice;
            
            // Add pacing delay to avoid hitting rate limits (e.g. 15 RPM)
            // Even with merging, we want to be gentle.
            if (audioBuffers.length > 0) {
                 await sleep(1000); 
            }

            try {
                const audioResult = await generateSingleSpeakerAudio(text, voiceName);
                
                const duration = audioResult.buffer.duration;
                audioBuffers.push(audioResult.buffer);
                
                finalSegments.push({
                    ...segment,
                    startTime: currentOffset,
                    endTime: currentOffset + duration
                });
                
                currentOffset += duration;
            } catch (e) {
                console.error(`Failed to generate audio for segment: "${text.substring(0, 20)}..."`, e);
                // Fail gracefully? For now, throw to alert user.
                throw e;
            }
        }

        if (audioBuffers.length === 0) {
            throw new Error("No audio generated.");
        }

        // Stitch together
        const combinedBuffer = concatenateAudioBuffers(audioBuffers, outputAudioContext);
        
        // Convert back to raw Uint8Array for WAV creation
        const channelData = combinedBuffer.getChannelData(0);
        const rawData = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            // Float to 16-bit PCM
            const s = Math.max(-1, Math.min(1, channelData[i]));
            rawData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        return {
            audio: {
                buffer: combinedBuffer,
                rawData: new Uint8Array(rawData.buffer)
            },
            segments: finalSegments
        };

    } finally {
        await outputAudioContext.close();
    }
};

export const generateScriptFromPDF = async (
  pdfBase64: string, 
  personalityDescription: string,
  hostName: string,
  expertName: string,
  language: 'ja' | 'en' = 'ja'
): Promise<string> => {
  const ai = getClient();
  
  const jpPrompt = `
    あなたは2人のポッドキャストパーソナリティ（HostとExpert）のプロデューサーです。
    添付されたPDF（スライド資料）を元に、この2人が内容について語り合うポッドキャストの台本を作成してください。
    
    【設定】
    ${personalityDescription}

    【重要: キャラクター名】
    - Hostの役名は「${hostName}」です。
    - Expertの役名は「${expertName}」です。
    - 台本内の会話で相手を呼ぶときは、必ず「${hostName}さん」「${expertName}さん」と呼んでください。
    
    【台本のフォーマット】
    各発言の冒頭には、必ず話者の名前をラベルとして付けてください。
    例:
    ${hostName}: こんにちは、${expertName}さん。
    ${expertName}: はい、${hostName}さん。今日は...

    【構造とマーカー（重要）】
    **話している対象のスライドが変わるタイミングで、必ず \`[SLIDE X]\` （Xはページ番号1, 2...）というマーカーを挿入してください。**
    例:
    [SLIDE 1]
    ${hostName}: こんにちは、今回のテーマはこちらです。
    ${expertName}: 面白そうですね。
    [SLIDE 2]
    ${hostName}: さて、まずは現状の課題から見ていきましょう。

    【絶対に守るべき禁止事項】
    1. **視覚的描写の完全禁止**:
       - 「表紙が美しいですね」「青い背景が...」「文字が大きく...」といった、スライドの見た目に関する発言は**絶対にしないでください**。
       - 「そこに何が書いてあるか」「それが何を意味するか」という**中身**だけを語ってください。
    2. **メタ発言の禁止**:
       - 「スライドの右側には」「次のページに行きましょう」といった事務的な指示は避け、自然な会話の流れでトピックを移行させてください。

    【指示: 本質の深掘り】
    1. **意味を問う**:
       - Host (${hostName}): 単に読み上げるのではなく、「これってつまりどういうこと？」「なぜこれが重要なの？」と問うてください。
       - Expert (${expertName}): データの裏にある「企業の意図」「市場への影響」を推測して解説してください。
  `;

  const enPrompt = `
    You are the producer of a podcast featuring two personalities (Host and Expert).
    Based on the attached PDF (slides), create a podcast script where these two discuss the content.

    【Settings】
    ${personalityDescription}

    【Important: Character Names】
    - Host Name: "${hostName}"
    - Expert Name: "${expertName}"
    - Always address each other by name in the script (e.g., "${hostName}", "${expertName}").

    【Script Format】
    Start each line with the speaker's name as a label.
    Example:
    ${hostName}: Hello, ${expertName}.
    ${expertName}: Hi, ${hostName}. Today we are discussing...

    【Structure and Markers (CRITICAL)】
    **Insert the marker \`[SLIDE X]\` (where X is page number 1, 2...) whenever the topic shifts to a new slide.**
    Example:
    [SLIDE 1]
    ${hostName}: Hello, here is our theme today.
    ${expertName}: Looks interesting.
    [SLIDE 2]
    ${hostName}: So, let's look at the current challenges.

    【STRICT PROHIBITIONS】
    1. **No Visual Descriptions**:
       - NEVER mention the visual look of the slides (e.g., "Beautiful cover", "Blue background", "Big text").
       - Only discuss the **content** and **meaning** of what is written.
    2. **No Meta-Comments**:
       - Avoid procedural instructions like "On the right side of the slide" or "Let's go to the next page." Transition topics naturally in conversation.

    【Instruction: Deep Dive】
    1. **Ask for Meaning**:
       - Host (${hostName}): Don't just read. Ask "What does this actually mean?" or "Why is this important?"
       - Expert (${expertName}): Infer and explain the "corporate intent" or "market impact" behind the data.
  `;

  const prompt = language === 'en' ? enPrompt : jpPrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
          { text: prompt },
        ],
      },
    });

    return response.text || (language === 'en' ? "Failed to generate script." : "台本の生成に失敗しました。");
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    throw error;
  }
};

export const dramatizeText = async (text: string, styleInstruction?: string, language: 'ja' | 'en' = 'ja'): Promise<string> => {
  const ai = getClient();
  
  const jpPrompt = `
    以下のポッドキャスト台本を、指定されたスタイルに合わせてリライト（推敲）してください。
    ただし、以下のルールを厳守してください。
    1. **マーカーの維持**: \`[SLIDE 1]\`, \`[SLIDE 2]\` などのスライドマーカーは、**位置を変えずにそのまま残してください**。これはシステムがスライドを切り替えるために必須です。
    2. **話者ラベルの維持**: 現在のラベル（例: Host: または 名前:）を変更しないでください。
    3. **視覚描写の削除**: 「デザイン」「色」「レイアウト」への言及はすべて削除し、本質の議論に置き換えてください。

    スタイル指示: ${styleInstruction}
    入力テキスト:
    "${text}"
  `;

  const enPrompt = `
    Rewrite (polish) the following podcast script to match the specified style.
    STRICTLY follow these rules:
    1. **Maintain Markers**: \`[SLIDE 1]\`, \`[SLIDE 2]\` etc. must remain **in their exact original positions**. This is required for the system to switch slides.
    2. **Maintain Labels**: Do not change the current speaker labels (e.g., Host: or Name:).
    3. **Remove Visual Descriptions**: Remove any mention of "design", "color", or "layout" and replace with discussion of the core essence.

    Style Instruction: ${styleInstruction}
    Input Text:
    "${text}"
  `;

  const prompt = language === 'en' ? enPrompt : jpPrompt;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || text;
  } catch (error) {
    console.error("Error dramatizing text:", error);
    throw error;
  }
};