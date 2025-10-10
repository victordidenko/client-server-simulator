import { createUniqueId, splitProps } from 'solid-js'

export function Input(props) {
  const [local, others] = splitProps(props, ['label', 'id', 'type', 'class'])

  const generatedId = createUniqueId()
  const inputId = local.id || `input-${generatedId}`

  return (
    <div class={`relative flex flex-col gap-0.5 w-fit ${local.class || ''}`}>
      <label
        for={inputId}
        class='absolute left-0 -top-4.5 z-10 text-xs font-normal text-gray-500 whitespace-nowrap'
      >
        {local.label}
      </label>
      <input
        id={inputId}
        type={local.type || 'number'}
        class='w-20 px-1 py-0.5 border rounded border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:ring-2 invalid:!ring-red-500'
        {...others}
      />
    </div>
  )
}
