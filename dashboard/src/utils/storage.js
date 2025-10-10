export const getFromLocalStorage = get(() => localStorage)
export const setToLocalStorage = set(() => localStorage)
export const getFromSessionStorage = get(() => sessionStorage)
export const setToSessionStorage = set(() => sessionStorage)

function get(storage) {
  return (key, fallback) => {
    try {
      const item = storage().getItem(key)
      return item !== null ? JSON.parse(item) : fallback
    } catch (err) {
      console.warn(`Failed to read key "${key}" from storage:`, err)
      return fallback
    }
  }
}

function set(storage) {
  return (key, value) => {
    try {
      storage().setItem(key, JSON.stringify(value))
    } catch (err) {
      console.warn(`Failed to write key "${key}" to storage:`, err)
    }
  }
}
