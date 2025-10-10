import {
  attach,
  combine,
  createEffect,
  createEvent,
  createStore,
  sample,
} from 'effector'
import { getFromSessionStorage, setToSessionStorage } from '../../utils/storage'
import { log } from '../common'

export const RECONNECT_TIMEOUT = 3000

export const CONNECTING = 0
export const OPEN = 1
export const CLOSING = 2
export const CLOSED = 3
export const ERROR = 4

export const name = getName()

export function createWebSocket(url) {
  const connect = createEvent()
  const open = createEvent()
  const close = createEvent()
  const error = createEvent()
  const message = createEvent()
  const data = createEvent()

  const $socket = createStore(null)

  const $error = createStore(null)
    .on(error, (_, payload) => payload)
    .reset(open)

  const $updater = createStore(0).on([open, close, error], (x) => x + 1)

  const $connected = combine(
    $socket,
    $updater,
    (socket) => socket != null && socket.readyState === WebSocket.OPEN
  )

  const $status = combine($socket, $error, $updater, (socket, error) => {
    const status = {
      [WebSocket.CONNECTING]: CONNECTING,
      [WebSocket.OPEN]: OPEN,
      [WebSocket.CLOSING]: CLOSING,
      [WebSocket.CLOSED]: CLOSED,
      [ERROR]: ERROR,
    }[
      error && socket?.readyState !== WebSocket.CONNECTING
        ? ERROR
        : (socket?.readyState ?? WebSocket.CLOSED)
    ]

    const message = {
      [CONNECTING]: 'WebSocket connecting...',
      [OPEN]: 'WebSocket connected',
      [CLOSING]: 'WebSocket connection is closing...',
      [CLOSED]: 'WebSocket connection closed, reconnecting...',
      [ERROR]: `WebSocket connection error, reconnecting...`,
    }[status]

    return { status, message }
  })

  const reconnectTimeoutFx = createEffect((delay) => {
    return new Promise((resolve) => setTimeout(resolve, delay))
  })

  const closeFx = attach({
    source: $socket,
    effect(socket) {
      if (socket != null && socket.readyState !== WebSocket.CLOSED) {
        socket.removeEventListener('open', open)
        socket.removeEventListener('close', close)
        socket.removeEventListener('message', message)
        socket.removeEventListener('error', error)
        socket.close()
      }
    },
  })

  const connectFx = attach({
    source: $socket,
    effect(socket) {
      closeFx()

      const protocol =
        window.location.protocol === 'https:' ? 'wss://' : 'ws://'
      const endpoint = `${protocol}${window.location.host}${url}?name=${name}`

      socket = new WebSocket(endpoint)

      socket.addEventListener('open', open)
      socket.addEventListener('close', close)
      socket.addEventListener('message', message)
      socket.addEventListener('error', error)

      return socket
    },
  })

  const messageParseFx = createEffect((raw) => JSON.parse(raw))

  sample({
    clock: connect,
    target: connectFx,
  })

  sample({
    clock: connectFx.doneData,
    target: $socket,
  })

  sample({
    clock: connectFx.failData,
    target: error,
  })

  sample({
    clock: [error, close],
    target: closeFx,
  })

  sample({
    clock: closeFx.finally,
    fn: () => null,
    target: $socket,
  })

  sample({
    clock: [error, close],
    fn: () => RECONNECT_TIMEOUT,
    target: reconnectTimeoutFx,
  })

  sample({
    clock: reconnectTimeoutFx.done,
    target: connectFx,
  })

  sample({
    clock: message,
    fn: (event) => event.data,
    target: messageParseFx,
  })

  sample({
    clock: messageParseFx.doneData,
    target: data,
  })

  sample({
    clock: messageParseFx.failData,
    fn: (error) => ['Error parsing WebSocket message:', error],
    target: log.errorFx,
  })

  return {
    connect,
    open,
    close,
    error,
    message,
    data,
    $socket,
    $error,
    $updater,
    $connected,
    $status,
  }
}

/**
 * Helper: generate a random name for a client (JS version)
 * Uses different adjectives/animals than Go version.
 */
function randomName() {
  const adjectives = [
    'Mighty',
    'Tiny',
    'Fuzzy',
    'Shiny',
    'Witty',
    'Giant',
    'Swift',
    'Silent',
    'Crimson',
    'Azure',
  ]
  const animals = [
    'Otter',
    'Falcon',
    'Panda',
    'Shark',
    'Lynx',
    'Moose',
    'Gecko',
    'Bison',
    'Koala',
    'Eagle',
  ]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  return adj + animal
}

function getName() {
  const key = 'simulation__ws-name'
  let name = getFromSessionStorage(key)
  if (name == null) {
    name = randomName()
    setToSessionStorage(key, name)
  }
  return name
}
