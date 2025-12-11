/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Gemini Client
// Note: We use process.env.API_KEY as per instructions.
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

export const generateSpeech = async (
  text: string, 
  hostVoice: string,
  expertVoice?: string,
  styleInstruction?: string
): Promise<GeneratedAudio> => {
  const ai = getClient();
  
  // Remove slide markers for TTS generation to avoid reading them aloud
  // Handles [SLIDE 1], [**SLIDE 1**], etc.
  const cleanText = text.replace(/\[(?:\*\*)?SLIDE\s+\d+(?:\*\*)?\]/gi, '').trim();

  // Determine if the text is already in script format (Host: ... Expert: ...)
  const isScript = cleanText.includes('Host:') || cleanText.includes('Expert:');
  
  // If no expert voice provided, pick a default generic one (though app usually provides one)
  const safeExpertVoice = expertVoice || 'Kore';

  // If it's a script, we send it as is. If it's raw text, we wrap it in a speaker label.
  const inputContents = isScript 
    ? cleanText 
    : `Host: ${cleanText}`;

  const voiceConfig = {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        {
          speaker: 'Host',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: hostVoice },
          }
        },
        {
          speaker: 'Expert',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeExpertVoice },
          }
        }
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

    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini.");
    }

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, 
    });

    try {
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
      
      return { buffer: audioBuffer, rawData: audioBytes };
    } finally {
      await outputAudioContext.close();
    }

  } catch (error) {
    console.error("Error generating speech:", error);
    if (typeof error === 'object' && error !== null) {
      console.error("Detailed Error Details:", JSON.stringify(error, null, 2));
    }
    throw error;
  }
};

export const generateScriptFromPDF = async (
  pdfBase64: string, 
  personalityDescription: string
): Promise<string> => {
  const ai = getClient();

  const prompt = `
    あなたは2人のポッドキャストパーソナリティ（HostとExpert）のプロデューサーです。
    添付されたPDF（スライド資料）を元に、この2人が内容について語り合うポッドキャストの台本を作成してください。
    
    【設定】
    ${personalityDescription}

    【構造とマーカー（重要）】
    **話している対象のスライドが変わるタイミングで、必ず \`[SLIDE X]\` （Xはページ番号1, 2...）というマーカーを挿入してください。**
    例:
    [SLIDE 1]
    Host: こんにちは、今回のテーマはこちらです。
    Expert: 面白そうですね。
    [SLIDE 2]
    Host: さて、まずは現状の課題から見ていきましょう。

    【絶対に守るべき禁止事項】
    1. **視覚的描写の完全禁止**:
       - 「表紙が美しいですね」「青い背景が...」「文字が大きく...」といった、スライドの見た目に関する発言は**絶対にしないでください**。
       - 「そこに何が書いてあるか」「それが何を意味するか」という**中身**だけを語ってください。
    2. **メタ発言の禁止**:
       - 「スライドの右側には」「次のページに行きましょう」といった事務的な指示は避け、自然な会話の流れでトピックを移行させてください。

    【指示: 本質の深掘り】
    1. **意味を問う**:
       - Host: 単に読み上げるのではなく、「これってつまりどういうこと？」「なぜこれが重要なの？」と問うてください。
       - Expert: データの裏にある「企業の意図」「市場への影響」を推測して解説してください。

    【フォーマット】
    [SLIDE 1]
    Host: [セリフ]
    Expert: [セリフ]
    [SLIDE 2]
    ...
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: 'application/pdf',
            },
          },
          { text: prompt },
        ],
      },
    });

    return response.text || "台本の生成に失敗しました。";
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    throw error;
  }
};

export const dramatizeText = async (text: string, styleInstruction?: string): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    以下のポッドキャスト台本を、指定されたスタイルに合わせてリライト（推敲）してください。
    ただし、以下のルールを厳守してください。

    1. **マーカーの維持**: \`[SLIDE 1]\`, \`[SLIDE 2]\` などのスライドマーカーは、**位置を変えずにそのまま残してください**。これはシステムがスライドを切り替えるために必須です。
    2. **対話形式の維持**: \`Host:\` と \`Expert:\` の形式を守ってください。
    3. **視覚描写の削除**: 「デザイン」「色」「レイアウト」への言及はすべて削除し、本質の議論に置き換えてください。

    スタイル指示: ${styleInstruction}
    
    入力テキスト:
    "${text}"
  `;

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