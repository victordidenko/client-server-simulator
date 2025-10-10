import { createEffect } from 'effector'

const call = (method) => {
  return (data) => (Array.isArray(data) ? method(...data) : method(data))
}

export const log = {
  logFx: createEffect(call(console.log)),
  errorFx: createEffect(call(console.error)),
}
