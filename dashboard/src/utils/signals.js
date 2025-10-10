import { createSignal } from 'solid-js'
import { getFromSessionStorage, setToSessionStorage } from './storage'

export function useSessionSignal(key, initialValue) {
  const [value, setValue] = createSignal(
    getFromSessionStorage(key, initialValue)
  )

  const updateValue = (newValue) => {
    setValue(newValue)
    setToSessionStorage(key, newValue)
  }

  return [value, updateValue]
}
