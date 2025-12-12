/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { IntroStyle } from './types';

export const INTRO_STYLES: IntroStyle[] = [
  {
    id: 'visual_commentary',
    name: 'Slide Walkthrough',
    nameEn: 'Slide Walkthrough',
    description: `VISUAL COMMENTARY (スライド実況)
# AUDIO PROFILE: Alex & Sam
## "The Visual Guide" (視覚ガイド)

## The Scene: ライブ配信 / ウェビナー
リスナーがスライド画面を見ていることを前提とした実況スタイル。
HostとGuestが一緒に画面を見ながら、注目すべきポイントを指し示していく。

### HOSTING STYLE
* **ガイド:** 「ここの数字を見て」と誘導するが、色や装飾の話はしない。「この数字が意味する急成長」について語る。
* **リアクション:** ビジュアルのインパクトよりも、そこに示された**事実のインパクト**に反応する。
* **状況:** リスナーはスライドを見ている。具体的な情報を共有する。`,
    descriptionEn: `VISUAL COMMENTARY
# AUDIO PROFILE: Alex & Sam
## "The Visual Guide"

## The Scene: Live Stream / Webinar
A play-by-play style assuming the listener is looking at the slides.
The Host and Guest look at the screen together and point out key data points.

### HOSTING STYLE
* **Guide:** Says "Look at this number here," but avoids discussing colors/decoration. Discusses "the rapid growth this number represents."
* **Reaction:** Reacts to the **impact of the facts** shown, rather than visual aesthetics.
* **Context:** Listeners are viewing the slides. Share concrete info.`,
    defaultVoice: 'Zephyr', // Host (Female, Bright)
    secondVoice: 'Fenrir', // Guest (Male, Excited)
    color: 'yellow',
    icon: 'triangle',
    avatarSrc: 'https://www.gstatic.com/aistudio/starter-apps/synergy-intro/radio.jpeg',
    templateText: ""
  },
  {
    id: 'deep_dive',
    name: 'Deep Dive (2 Hosts)',
    nameEn: 'Deep Dive (2 Hosts)',
    description: `THE DEEP DIVE (本質の深掘り)
# AUDIO PROFILE: Sascha & Marina
## "Dual Perspective" (二つの視点)

## The Scene: ポッドキャストスタジオ
メインホスト（Host）と、鋭い洞察を持つエキスパート（Expert）の対話形式。
Hostは進行役として視聴者の疑問を代弁し、Expertはスライドのデータから深い意味を読み解く。

### HOSTING STYLE
* **対話:** Hostが質問し、Expertが答える、あるいは互いに意見を交わす。
* **テンポ:** 知的でリズミカルな掛け合い。
* **状況:** **デザインやレイアウトには一切触れない。** リスナーはスライドを見ていない前提で、スライドに書かれている「言葉の意味」や「主張の重要性」だけを熱く語る。`,
    descriptionEn: `THE DEEP DIVE
# AUDIO PROFILE: Sascha & Marina
## "Dual Perspective"

## The Scene: Podcast Studio
A dialogue between a main Host and an insightful Expert.
The Host acts as a facilitator voicing listener questions, while the Expert deciphers deep meaning from the slide data.

### HOSTING STYLE
* **Dialogue:** Host asks, Expert answers, or they exchange views.
* **Tempo:** Intellectual and rhythmic banter.
* **Context:** **No mention of design or layout.** Assuming listeners cannot see the slides, they passionately discuss the "meaning of the words" and the "importance of the arguments."`,
    defaultVoice: 'Puck', // Host (Male-ish)
    secondVoice: 'Kore', // Expert (Female-ish)
    color: 'blue',
    icon: 'square',
    avatarSrc: 'https://www.gstatic.com/aistudio/starter-apps/synergy-intro/podcaster.png',
    templateText: "" // Empty to trigger upload state
  }
];

export const CUSTOM_STYLE: IntroStyle = {
  id: 'custom',
  name: 'カスタムホスト',
  nameEn: 'Custom Host',
  description: '独自のスライド解説ペアを設定します。',
  descriptionEn: 'Configure your own slide commentary pair.',
  defaultVoice: 'Puck',
  secondVoice: 'Fenrir',
  color: 'white',
  icon: 'plus',
  templateText: "",
};

export const SUPPORTED_LANGUAGES = [
  { name: '日本語 (日本)', code: 'ja-JP' },
  { name: '英語 (アメリカ)', code: 'en-US' },
  { name: '英語 (イギリス)', code: 'en-GB' },
  { name: 'フランス語 (フランス)', code: 'fr-FR' },
  { name: 'ドイツ語 (ドイツ)', code: 'de-DE' },
  { name: 'スペイン語 (スペイン)', code: 'es-ES' },
  { name: '韓国語 (韓国)', code: 'ko-KR' },
  { name: '中国語 (北京)', code: 'cmn-CN' },
];

export const TRANSLATIONS = {
  ja: {
    title: "Slide to Podcast",
    hostNameLabel: "Host Name",
    expertNameLabel: "Expert Name",
    defaultHostName: "こはく",
    defaultExpertName: "まき",
    uploadPdfTitle: "PDFをアップロード",
    selectFile: "ファイルを選択",
    or: "- OR -",
    import: "Import",
    analyzing: "分析中...",
    generateScript: "台本を生成する",
    tabScript: "Script",
    tabPresentation: "Presentation",
    export: "Export",
    edit: "Edit",
    done: "Done",
    save: "保存",
    settings: "設定",
    errorPdf: "PDFファイルのみ対応しています。",
    errorAnalyze: "スライドの解析に失敗しました。",
    errorImport: "無効なファイル形式です。",
    errorGen: "音声生成に失敗しました: ",
    errorQuota: "API利用枠の上限に達しました(429)。設定(⚙)からAPIキーを有料プランのものに変更してください。",
    readyToPlay: "Ready to play",
    noScript: "スクリプトが見つかりません。編集モードを確認してください。",
    configTitle: "設定",
    apiKeyTitle: "API Key Settings",
    apiKeyDesc: "\"Resource Exhausted\" (429 Error) が発生する場合は、こちらから有料プランのAPIキーを選択してください。",
    apiKeyLink: "Google AI Studio 料金プランについて",
    selectKeyBtn: "APIキーを選択 / 変更",
    voiceSelectTitle: "スピーカーのボイスを選択",
    voiceSelectDesc: "これらのボイスは多言語対応で、テキストに合わせて適応します。",
    gender: "性別",
    all: "すべて",
    male: "男性",
    female: "女性",
    notFound: "条件に合うボイスが見つかりません。",
    sysPromptTitle: "システムプロンプト",
    customSettings: "カスタムスタイルの設定",
    voiceSettings: "ボイス設定 (2名)",
    hostRole: "Host (メイン進行)",
    expertRole: "Expert (解説役)",
    personaDesc: "プロンプトのペルソナに最適なボイスの組み合わせを選択してください。",
    sysInstruction: "システム指示書",
    sysPreview: "システム指示書プレビュー",
    sysPlaceholder: "ここにシステム指示を入力してください。ペルソナ、口調、ペース、ルールなどを定義します...",
    sysHelper: "イントロダクション担当者のペルソナ、スタイル、ルールを定義してください。",
    cancel: "キャンセル",
    saveSettings: "設定を保存",
    customCreate: "カスタム作成"
  },
  en: {
    title: "Slide to Podcast",
    hostNameLabel: "Host Name",
    expertNameLabel: "Expert Name",
    defaultHostName: "Alex",
    defaultExpertName: "Sam",
    uploadPdfTitle: "Upload PDF",
    selectFile: "Select File",
    or: "- OR -",
    import: "Import",
    analyzing: "Analyzing...",
    generateScript: "Generate Script",
    tabScript: "Script",
    tabPresentation: "Presentation",
    export: "Export",
    edit: "Edit",
    done: "Done",
    save: "Save",
    settings: "Settings",
    errorPdf: "Only PDF files are supported.",
    errorAnalyze: "Failed to analyze slides.",
    errorImport: "Invalid file format.",
    errorGen: "Failed to generate audio: ",
    errorQuota: "API quota exceeded (429). Please select a paid plan API key in Settings (⚙).",
    readyToPlay: "Ready to play",
    noScript: "No script parsed. Check the Edit mode.",
    configTitle: "Settings",
    apiKeyTitle: "API Key Settings",
    apiKeyDesc: "If you encounter \"Resource Exhausted\" (429 Error), please select a paid plan API key here.",
    apiKeyLink: "About Google AI Studio Billing",
    selectKeyBtn: "Select / Change API Key",
    voiceSelectTitle: "Select Speaker Voice",
    voiceSelectDesc: "These voices are multilingual and adapt to the text.",
    gender: "Gender",
    all: "All",
    male: "Male",
    female: "Female",
    notFound: "No voices found matching criteria.",
    sysPromptTitle: "System Prompt",
    customSettings: "Custom Style Settings",
    voiceSettings: "Voice Settings (2 Speakers)",
    hostRole: "Host (Main Anchor)",
    expertRole: "Expert (Commentator)",
    personaDesc: "Select the best voice combination for the persona.",
    sysInstruction: "System Instruction",
    sysPreview: "System Instruction Preview",
    sysPlaceholder: "Enter system instructions here. Define persona, tone, pace, rules, etc...",
    sysHelper: "Define the persona, style, and rules for the podcasters.",
    cancel: "Cancel",
    saveSettings: "Save Settings",
    customCreate: "Create Custom"
  }
};