/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { IntroStyle } from './types';

export const INTRO_STYLES: IntroStyle[] = [
  {
    id: 'deep_dive',
    name: 'Deep Dive (2 Hosts)',
    description: `THE DEEP DIVE (本質の深掘り)
# AUDIO PROFILE: Sascha & Marina
## "Dual Perspective" (二つの視点)

## The Scene: ポッドキャストスタジオ
メインホスト（Host）と、鋭い洞察を持つエキスパート（Expert）の対話形式。
Hostは進行役として視聴者の疑問を代弁し、Expertはスライドのデータから深い意味を読み解く。

### HOSTING STYLE
* **対話:** Hostが質問し、Expertが答える、あるいは互いに意見を交わす。
* **テンポ:** 知的でリズミカルな掛け合い。
* **状況:** **デザインやレイアウトには一切触れない。** リスナーはスライドを見ていない前提で、スライドに書かれている「言葉の意味」や「主張の重要性」だけを熱く語る。

### SAMPLE CONTEXT
複雑な資料の本質だけを抜き出し、ラジオ番組のように深く解説する。`,
    defaultVoice: 'Puck', // Host (Male-ish)
    secondVoice: 'Kore', // Expert (Female-ish)
    color: 'blue',
    icon: 'square',
    avatarSrc: 'https://www.gstatic.com/aistudio/starter-apps/synergy-intro/podcaster.png',
    templateText: "" // Empty to trigger upload state
  },
  {
    id: 'visual_commentary',
    name: 'Slide Walkthrough',
    description: `VISUAL COMMENTARY (スライド実況)
# AUDIO PROFILE: Alex & Sam
## "The Visual Guide" (視覚ガイド)

## The Scene: ライブ配信 / ウェビナー
リスナーがスライド画面を見ていることを前提とした実況スタイル。
HostとGuestが一緒に画面を見ながら、注目すべきポイントを指し示していく。

### HOSTING STYLE
* **ガイド:** 「ここの数字を見て」と誘導するが、色や装飾の話はしない。「この数字が意味する急成長」について語る。
* **リアクション:** ビジュアルのインパクトよりも、そこに示された**事実のインパクト**に反応する。
* **状況:** リスナーはスライドを見ている。具体的な情報を共有する。

### SAMPLE CONTEXT
デザインレビューではなく、内容のレビュー。図解の多い資料の意味解説。`,
    defaultVoice: 'Zephyr', // Host (Female, Bright)
    secondVoice: 'Fenrir', // Guest (Male, Excited)
    color: 'yellow',
    icon: 'triangle',
    avatarSrc: 'https://www.gstatic.com/aistudio/starter-apps/synergy-intro/radio.jpeg',
    templateText: ""
  }
];

export const CUSTOM_STYLE: IntroStyle = {
  id: 'custom',
  name: 'カスタムホスト',
  description: '独自のスライド解説ペアを設定します。',
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