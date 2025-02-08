import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageInput } from '@/components/messageInput'
import settingsStore from '@/features/stores/settings'
import { VoiceLanguage } from '@/features/constants/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { useTranslation } from 'react-i18next'
import toastStore from '@/features/stores/toast'

const NO_SPEECH_TIMEOUT = 3000

// AudioContext の型定義を拡張
type AudioContextType = typeof AudioContext

type Props = {
  onChatProcessStart: (text: string) => void
}

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  // モーダル表示用の状態を追加
  const [modalOpen, setModalOpen] = useState(true)

  const realtimeAPIMode = settingsStore.getState().realtimeAPIMode
  const [userMessage, setUserMessage] = useState('')
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const keyPressStartTime = useRef<number | null>(null)
  const transcriptRef = useRef('')
  const isKeyboardTriggered = useRef(false)
  const audioBufferRef = useRef<Float32Array | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isListeningRef = useRef(false)
  const [isListening, setIsListening] = useState(false)

  const { t } = useTranslation()

  const getVoiceLanguageCode = (selectLanguage: string): VoiceLanguage => {
    switch (selectLanguage) {
      case 'ja':
        return 'ja-JP'
      case 'en':
        return 'en-US'
      case 'zh':
        return 'zh-TW'
      case 'zh-TW':
        return 'zh-TW'
      case 'ko':
        return 'ko-KR'
      default:
        return 'ja-JP'
    }
  }

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const newRecognition = new SpeechRecognition()
      const ss = settingsStore.getState()
      newRecognition.lang = getVoiceLanguageCode(ss.selectLanguage)
      newRecognition.continuous = true
      newRecognition.interimResults = true

      let noSpeechTimeout: NodeJS.Timeout
      let silenceTimeout: NodeJS.Timeout // 追加：入力が途絶えたと判断するタイマー

      newRecognition.onstart = () => {
        // 初回の無音状態用タイマー（必要ならそのまま利用）
        noSpeechTimeout = setTimeout(() => {
          toastStore.getState().addToast({
            message: t('Toasts.SpeechRecognitionError'),
            type: 'error',
            tag: 'no-speech-detected',
          })
          stopListening()
        }, NO_SPEECH_TIMEOUT)
      }

      newRecognition.onspeechstart = () => {
        clearTimeout(noSpeechTimeout)
      }

      newRecognition.onresult = (event) => {
        if (!isListeningRef.current) return

        // 認識結果を取得して連結
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('')
        transcriptRef.current = transcript
        setUserMessage(transcript)

        // 前回の沈黙タイマーをクリアし、再度タイマーをセット
        clearTimeout(silenceTimeout)
        silenceTimeout = setTimeout(() => {
          // 2秒間新しい音声入力がなかった場合、音声認識を終了（＝送信処理などを実行）
          stopListening()
        }, 2000) // 2000ミリ秒（2秒）
      }

      newRecognition.onend = () => {
        clearTimeout(noSpeechTimeout)
        clearTimeout(silenceTimeout)
        // onend イベントは stopListening() 内での処理で送信などが行われるので、
        // ここでは特に追加の送信処理は不要
      }

      newRecognition.onerror = (event) => {
        stopListening()
      }

      setRecognition(newRecognition)
    }
  }, [])

  useEffect(() => {
    const AudioContextClass = (window.AudioContext ||
      (window as any).webkitAudioContext) as AudioContextType
    const context = new AudioContextClass()
    setAudioContext(context)
  }, [])

  const startListening = useCallback(async () => {
    if (recognition && !isListeningRef.current && audioContext) {
      transcriptRef.current = ''
      setUserMessage('')
      try {
        recognition.start()
      } catch (error) {
        console.error('Error starting recognition:', error)
      }
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
                recognition.stop()
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
  }, [recognition, audioContext, realtimeAPIMode])

  const sendAudioBuffer = useCallback(() => {
    if (audioBufferRef.current && audioBufferRef.current.length > 0) {
      const base64Chunk = base64EncodeAudio(audioBufferRef.current)
      const ss = settingsStore.getState()
      const wsManager = webSocketStore.getState().wsManager
      if (wsManager?.websocket?.readyState === WebSocket.OPEN) {
        let sendContent: { type: string; text?: string; audio?: string }[] = []

        if (ss.realtimeAPIModeContentType === 'input_audio') {
          console.log('Sending buffer. Length:', audioBufferRef.current.length)
          sendContent = [
            {
              type: 'input_audio',
              audio: base64Chunk,
            },
          ]
        } else {
          const currentText = transcriptRef.current.trim()
          console.log('Sending text. userMessage:', currentText)
          if (currentText) {
            sendContent = [
              {
                type: 'input_text',
                text: currentText,
              },
            ]
          }
        }

        if (sendContent.length > 0) {
          wsManager.websocket.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: sendContent,
              },
            })
          )
          wsManager.websocket.send(
            JSON.stringify({
              type: 'response.create',
            })
          )
        }
      }
      audioBufferRef.current = null // 送信後にバッファをクリア
    } else {
      console.error('音声バッファが空です')
    }
  }, [])

  const stopListening = useCallback(async () => {
    isListeningRef.current = false
    setIsListening(false)
    if (recognition) {
      recognition.stop()

      if (realtimeAPIMode) {
        if (mediaRecorder) {
          mediaRecorder.stop()
          mediaRecorder.ondataavailable = null
          await new Promise<void>((resolve) => {
            mediaRecorder.onstop = async () => {
              console.log('stop MediaRecorder')
              if (audioChunksRef.current.length > 0) {
                const audioBlob = new Blob(audioChunksRef.current, {
                  type: 'audio/webm',
                })
                const arrayBuffer = await audioBlob.arrayBuffer()
                const audioBuffer =
                  await audioContext!.decodeAudioData(arrayBuffer)
                const processedData = processAudio(audioBuffer)

                audioBufferRef.current = processedData
                resolve()
              } else {
                console.error('音声チャンクが空です')
                resolve()
              }
            }
          })
        }
        sendAudioBuffer()
      }

      const trimmedTranscriptRef = transcriptRef.current.trim()
      if (isKeyboardTriggered.current) {
        const pressDuration = Date.now() - (keyPressStartTime.current || 0)
        // 押してから1秒以上かつ文字が存在する場合のみ送信
        if (pressDuration >= 1000 && trimmedTranscriptRef) {
          onChatProcessStart(trimmedTranscriptRef)
          setUserMessage('')
        }
        isKeyboardTriggered.current = false
      }
    }
  }, [
    recognition,
    realtimeAPIMode,
    mediaRecorder,
    sendAudioBuffer,
    audioContext,
    onChatProcessStart,
  ])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      keyPressStartTime.current = Date.now()
      isKeyboardTriggered.current = true
      startListening()
    }
  }, [startListening, stopListening])

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !isListeningRef.current) {
        keyPressStartTime.current = Date.now()
        isKeyboardTriggered.current = true
        await startListening()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        stopListening()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [startListening, stopListening])

  // メッセージ送信
  const handleSendMessage = useCallback(() => {
    if (userMessage.trim()) {
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }, [userMessage, onChatProcessStart])

  // メッセージ入力
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setUserMessage(e.target.value)
    },
    []
  )

  // モーダルの「開始する」ボタンが押された時のハンドラ
  const handleModalStart = useCallback(async () => {
    setModalOpen(false)
    // ブラウザによっては、AudioContextの再開が必要な場合があるのでここでresume()する
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    startListening()
  }, [audioContext, startListening])

  return (
    <>
      {modalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // 背景を半透明の黒にする
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000, // 他の要素より前面に表示
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.26)',
              textAlign: 'center', // 中央寄せにする
            }}
          >
            <h2>音声認識を開始しますか？</h2>
            <button onClick={handleModalStart}>開始する</button>
          </div>
        </div>
      )}

      {/* モーダルが閉じられているときのみ MessageInput を表示 */}
      {!modalOpen && (
        <MessageInput
          userMessage={userMessage}
          isMicRecording={isListening}
          onChangeUserMessage={handleInputChange}
          onClickMicButton={toggleListening}
          onClickSendButton={handleSendMessage}
        />
      )}
    </>
  )
}

// リサンプリング関数
const resampleAudio = (
  audioData: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array => {
  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const position = i * ratio
    const leftIndex = Math.floor(position)
    const rightIndex = Math.ceil(position)
    const fraction = position - leftIndex

    if (rightIndex >= audioData.length) {
      result[i] = audioData[leftIndex]
    } else {
      result[i] =
        (1 - fraction) * audioData[leftIndex] + fraction * audioData[rightIndex]
    }
  }

  return result
}

// リサンプリングとモノラル変換を行う関数
const processAudio = (audioBuffer: AudioBuffer): Float32Array => {
  const targetSampleRate = 24000
  const numChannels = audioBuffer.numberOfChannels

  // モノラルに変換
  let monoData = new Float32Array(audioBuffer.length)
  for (let i = 0; i < audioBuffer.length; i++) {
    let sum = 0
    for (let channel = 0; channel < numChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i]
    }
    monoData[i] = sum / numChannels
  }

  // リサンプリング
  return resampleAudio(monoData, audioBuffer.sampleRate, targetSampleRate)
}

// Float32Array を PCM16 ArrayBuffer に変換する関数
const floatTo16BitPCM = (float32Array: Float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

// Float32Array を base64エンコードされた PCM16 データに変換する関数
const base64EncodeAudio = (float32Array: Float32Array) => {
  const arrayBuffer = floatTo16BitPCM(float32Array)
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  const chunkSize = 0x8000 // 32KB chunk size
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    )
  }
  return btoa(binary)
}
