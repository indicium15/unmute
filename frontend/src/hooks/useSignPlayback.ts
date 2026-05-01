import { useState, useCallback, useRef } from "react"
import type { PlanItem } from "./useTranslation"

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
const SIGN_DURATION = 3000
const SIGN_GAP = 300
const SKIP_DURATION = 500

function resolveGifUrl(gifPath: string) {
  if (gifPath.startsWith("http://") || gifPath.startsWith("https://")) {
    return gifPath
  }

  const baseUrl = API_BASE.startsWith("http") ? API_BASE : `https://${API_BASE}`
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const cleanPath = gifPath.startsWith("/") ? gifPath : `/${gifPath}`
  return `${cleanBase}${cleanPath}`
}

export function useSignPlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentToken, setCurrentToken] = useState<string | undefined>()
  const [currentGifUrl, setCurrentGifUrl] = useState<string | undefined>()
  const [currentPlaybackKey, setCurrentPlaybackKey] = useState<string | undefined>()

  const playbackIdRef = useRef(0)

  const wait = useCallback(async (duration: number, playbackId: number) => {
    if (playbackId !== playbackIdRef.current) return false
    await new Promise((resolve) => setTimeout(resolve, duration))
    return playbackId === playbackIdRef.current
  }, [])

  const playSingleSign = useCallback(async (
    item: PlanItem,
    playbackId: number,
    itemIndex: number,
    iteration: number
  ) => {
    if (playbackId !== playbackIdRef.current || !item.sign_name) {
      return false
    }

    setCurrentToken(item.token)

    if (item.assets?.gif) {
      setCurrentGifUrl(resolveGifUrl(item.assets.gif))
      setCurrentPlaybackKey(`${playbackId}-${itemIndex}-${iteration}-${item.sign_name}`)
    } else {
      setCurrentGifUrl(undefined)
      setCurrentPlaybackKey(undefined)
    }

    return wait(SIGN_DURATION, playbackId)
  }, [wait])

  const playSequence = useCallback(async (plan: PlanItem[], options?: { loopSingle?: boolean }) => {
    playbackIdRef.current += 1
    const currentPlaybackId = playbackIdRef.current
    setIsPlaying(true)
    setCurrentToken(undefined)
    setCurrentGifUrl(undefined)
    setCurrentPlaybackKey(undefined)

    const signs = plan.filter((item) => item.type === "sign" && item.sign_name)
    const shouldLoopSingle = options?.loopSingle === true && signs.length === 1

    if (shouldLoopSingle) {
      const singleSign = signs[0]
      let iteration = 0

      while (currentPlaybackId === playbackIdRef.current) {
        await playSingleSign(singleSign, currentPlaybackId, 0, iteration)
        iteration += 1
        await wait(SIGN_GAP, currentPlaybackId)
      }
    } else {
      for (let i = 0; i < plan.length; i += 1) {
        if (currentPlaybackId !== playbackIdRef.current) break
        const item = plan[i]

        if (item.type === "sign" && item.sign_name) {
          await playSingleSign(item, currentPlaybackId, i, 0)

          if (i < plan.length - 1) {
            await wait(SIGN_GAP, currentPlaybackId)
          }
        } else {
          await wait(SKIP_DURATION, currentPlaybackId)
        }
      }
    }

    if (currentPlaybackId !== playbackIdRef.current) {
      return
    }

    setCurrentToken(undefined)
    setCurrentGifUrl(undefined)
    setCurrentPlaybackKey(undefined)
    setIsPlaying(false)
  }, [playSingleSign, wait])

  const stopPlayback = useCallback(() => {
    playbackIdRef.current += 1
    setCurrentToken(undefined)
    setCurrentGifUrl(undefined)
    setCurrentPlaybackKey(undefined)
    setIsPlaying(false)
  }, [])

  return {
    isPlaying,
    currentToken,
    currentGifUrl,
    currentPlaybackKey,
    playSequence,
    stopPlayback,
  }
}
