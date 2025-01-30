import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { Message } from '@/features/messages/messages'
import { Viewer } from '../vrmViewer/viewer'
import { messageSelectors } from '../messages/messageSelectors'
import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch'

export interface PersistedState {
  userOnboarded: boolean // ユーザーがオンボーディングを完了したかどうか
  chatLog: Message[] // チャットのログ
  showIntroduction: boolean // イントロダクションを表示するかどうか
}

// 一時的な状態を定義するインターフェース
export interface TransientState {
  viewer: Viewer // ビューアーの状態
  live2dViewer: any // Live2Dビューアーの状態
  assistantMessage: string // アシスタントのメッセージ
  slideMessages: string[] // スライドメッセージ
  chatProcessing: boolean // チャット処理中かどうか
  chatProcessingCount: number // チャット処理のカウント
  incrementChatProcessingCount: () => void // チャット処理のカウントを増やす関数
  decrementChatProcessingCount: () => void // チャット処理のカウントを減らす関数
  backgroundImageUrl: string // 背景画像のURL
  modalImage: string // モーダル画像
  triggerShutter: boolean // シャッターをトリガーするかどうか
  webcamStatus: boolean // ウェブカメラのステータス
  captureStatus: boolean // キャプチャのステータス
  isCubismCoreLoaded: boolean // Cubismコアがロードされているかどうか
  setIsCubismCoreLoaded: (loaded: boolean) => void // Cubismコアのロード状態を設定する関数
  isLive2dLoaded: boolean // Live2Dがロードされているかどうか
  setIsLive2dLoaded: (loaded: boolean) => void // Live2Dのロード状態を設定する関数
}

// HomeState型は、PersistedStateとTransientStateの両方を含む型です
export type HomeState = PersistedState & TransientState

// homeStoreは、zustandライブラリを使用して状態管理を行うためのストアを作成します
const homeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      // 永続化される状態の初期値を設定します
      userOnboarded: false,
      chatLog: [],
      showIntroduction: process.env.NEXT_PUBLIC_SHOW_INTRODUCTION !== 'false',
      assistantMessage: '',

      // 一時的な状態の初期値を設定します
      viewer: new Viewer(),
      live2dViewer: null,
      slideMessages: [],
      chatProcessing: false,
      chatProcessingCount: 0,
      incrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: chatProcessingCount + 1,
        }))
      },
      decrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: chatProcessingCount - 1,
        }))
      },
      backgroundImageUrl:
        process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH ?? '/bg-c.png',
      modalImage: '',
      triggerShutter: false,
      webcamStatus: false,
      captureStatus: false,
      isCubismCoreLoaded: false,
      setIsCubismCoreLoaded: (loaded) =>
        set(() => ({ isCubismCoreLoaded: loaded })),
      isLive2dLoaded: false,
      setIsLive2dLoaded: (loaded) => set(() => ({ isLive2dLoaded: loaded })),
    }),
    {
      name: 'aitube-kit-home',
      partialize: ({ chatLog, showIntroduction }) => ({
        chatLog: messageSelectors.cutImageMessage(chatLog),
        showIntroduction,
      }),
    }
  )
)

// chatLogの変更を監視して保存
homeStore.subscribe((state, prevState) => {
  // chatLogが変更され、かつchatLogが空でない場合に保存処理を実行
  if (state.chatLog !== prevState.chatLog && state.chatLog.length > 0) {
    fetch('/api/save-chat-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: state.chatLog, // 現在のchatLogの内容を送信
        isNewFile: prevState.chatLog.length === 0, // 前のchatLogが空だったかどうかを示すフラグ
      }),
    }).catch((error) => console.error('Error saving chat log:', error)) // エラーハンドリング
  }
})

export default homeStore
