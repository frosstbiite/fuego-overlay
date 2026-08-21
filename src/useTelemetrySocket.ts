import {
  useEffect,
  useRef,
} from 'react'

type MessageHandler<T> = (
  data: T,
) => void

type ConnectionHandler = (
  connected: boolean,
) => void

type OverlayClientType =
  | 'driver'
  | 'ticker'
  | 'unknown'

export function useTelemetrySocket<T>(
  onMessage: MessageHandler<T>,
  onConnectionChange?: ConnectionHandler,
  clientType: OverlayClientType = 'unknown',
) {
  const messageHandlerRef =
    useRef(onMessage)

  const connectionHandlerRef =
    useRef(onConnectionChange)

  const clientTypeRef =
    useRef(clientType)

  useEffect(() => {
    messageHandlerRef.current =
      onMessage
  }, [onMessage])

  useEffect(() => {
    connectionHandlerRef.current =
      onConnectionChange
  }, [onConnectionChange])

  useEffect(() => {
    clientTypeRef.current =
      clientType
  }, [clientType])

  useEffect(() => {
    let socket: WebSocket | null = null

    let reconnectTimer:
      ReturnType<typeof setTimeout> |
      undefined

    let stopped = false

    function connect() {
      if (stopped) {
        return
      }

      console.log(
        'Connecting to telemetry server...',
      )

      socket = new WebSocket(
        'ws://localhost:3200',
      )

      socket.onopen = () => {
        console.log(
          'Connected to telemetry server',
        )

        connectionHandlerRef.current?.(
          true,
        )

        socket?.send(
          JSON.stringify({
            type: 'registerClient',
            clientType:
              clientTypeRef.current,
          }),
        )
      }

      socket.onmessage = (event) => {
        try {
          const data =
            JSON.parse(event.data) as T

          messageHandlerRef.current(data)
        } catch (error) {
          console.error(
            'Could not read telemetry data:',
            error,
          )
        }
      }

      socket.onerror = () => {
        socket?.close()
      }

      socket.onclose = () => {
        connectionHandlerRef.current?.(
          false,
        )

        if (stopped) {
          return
        }

        console.log(
          'Telemetry disconnected. Reconnecting...',
        )

        clearTimeout(reconnectTimer)

        reconnectTimer = setTimeout(
          connect,
          1500,
        )
      }
    }

    connect()

    return () => {
      stopped = true

      clearTimeout(reconnectTimer)

      socket?.close()
    }
  }, [])
}