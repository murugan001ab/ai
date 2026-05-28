import { useEffect, useState } from 'react'

import { getCameras } from '../services/camera.service'
import type { CameraItem } from '../features/cameras/types'

const WEBRTC_BASE = 'http://192.168.0.122:8889'

export default function Live() {
  const [cameras, setCameras] = useState<CameraItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCameras()
  }, [])

  async function loadCameras() {
    try {
      setLoading(true)

      const response = await getCameras(1, 50)

      setCameras(response.data)
    } catch (error) {
      console.error('Failed to load cameras:', error)
    } finally {
      setLoading(false)
    }
  }

  function getWebRTCUrl(rtspUrl: string) {
    try {
      // rtsp://192.168.0.10:554/cam1
      // -> cam1

      const url = new URL(rtspUrl)

      const streamName = url.pathname.replace('/', '')

      return `${WEBRTC_BASE}/${streamName}`
    } catch (error) {
      console.error('Invalid RTSP URL:', rtspUrl)

      return ''
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '24px',
        }}
      >
        Loading cameras...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <h1
        style={{
          color: 'white',
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '24px',
        }}
      >
        CCTV Live Dashboard
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '20px',
        }}
      >
        {cameras.map((camera) => {
          const liveUrl = getWebRTCUrl(camera.rtsp_url)

          return (
            <div
              key={camera.id}
              style={{
                background: '#111827',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid #1e293b',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '600',
                  borderBottom: '1px solid #1e293b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{camera.name}</span>

                <span
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background:
                      camera.status === 'active'
                        ? '#16a34a'
                        : '#dc2626',
                    color: 'white',
                  }}
                >
                  {camera.status.toUpperCase()}
                </span>
              </div>

              <iframe
                src={liveUrl}
                title={camera.name}
                allow='autoplay; fullscreen'
                allowFullScreen
                style={{
                  width: '100%',
                  height: '320px',
                  border: 'none',
                  background: 'black',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}