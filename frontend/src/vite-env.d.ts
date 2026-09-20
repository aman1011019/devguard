/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Browser speech APIs are not in the default TS DOM lib. */
interface Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}
