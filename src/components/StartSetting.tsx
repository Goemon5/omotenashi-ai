import { useState, useCallback, useRef } from 'react'
import settingsStore from '@/features/stores/settings'
// ...other imports

export const StartSetting = () => {
  // 既存のstateやrefの定義
  const [userMessage, setUserMessage] = useState('')
  // モーダル表示状態を管理するstateを追加
  const [showModal, setShowModal] = useState(true)
  const keyPressStartTime = useRef<number | null>(null)
  const isKeyboardTriggered = useRef(false)
  const isListeningRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const transcriptRef = useRef('')
  const audioChunksRef = useRef<Blob[]>([])
  // recognition を削除し、audioContext, realtimeAPIMode, mediaRecorder などは既存のロジックに従う前提

  // 例: audioContext, realtimeAPIMode, setMediaRecorder の取得は既存のロジックに従う

  const startListening = useCallback(async () => {
    if (!isListeningRef.current && audioContext) {
      transcriptRef.current = ''
      setUserMessage('')
      // recognition.start() を削除
      isListeningRef.current = true
      setIsListening(true)

      if (realtimeAPIMode) {
        audioChunksRef.current = [] // 音声チャンクをリセット

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
          setMediaRecorder(recorder)

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              if (!isListeningRef.current) {
                // recognition の停止処理は削除
                recorder.stop()
                recorder.ondataavailable = null
                return
              }
              audioChunksRef.current.push(event.data)
              console.log('add audio chunk:', audioChunksRef.current.length)
            }
          }

          recorder.start(100) // より小さな間隔でデータを収集
        })
      }
    }
  }, [audioContext, realtimeAPIMode])

  const toggleListening = useCallback(() => {
    keyPressStartTime.current = Date.now()
    isKeyboardTriggered.current = true
    startListening()
  }, [startListening])

  // 「aaabutton」が押されたらモーダルを閉じて音声入力を開始する処理
  const handleAAAButtonClick = useCallback(() => {
    setShowModal(false)
    startListening()
  }, [startListening])

  return (
    <div>
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-8 shadow-lg max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">音声入力を開始</h2>
            <p className="mb-4">マイクの許可を確認し、音声入力を開始します。</p>
            <button
              onClick={handleAAAButtonClick}
              className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              aaabutton
            </button>
          </div>
        </div>
      )}
      {/* 他のUIコンポーネント */}
    </div>
  )
}
