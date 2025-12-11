/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { IntroStyle } from './types';

export const INTRO_STYLES: IntroStyle[] = [
  {
    id: 'deep_dive',
    name: 'Deep Dive (2 Hosts)',
    description: `THE DEEP DIVE (深掘り解説)
# AUDIO PROFILE: Sascha & Marina
## "Dual Perspective" (二つの視点)

## The Scene: ポッドキャストスタジオ
メインホスト（Host）と、鋭い洞察を持つエキスパート（Expert）の対話形式。
Hostは進行役として視聴者の疑問を代弁し、Expertはスライドのデータから深い意味を読み解く。

### HOSTING STYLE
* **対話:** Hostが質問し、Expertが答える、あるいは互いに意見を交わす。
* **テンポ:** 知的でリズミカルな掛け合い。
* **親しみやすさ:** 専門的な内容を、二人の会話を通じて噛み砕く。

### SAMPLE CONTEXT
複雑なスライド資料を、ラジオ番組のように聞きやすく解説する。`,
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