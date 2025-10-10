import { createEffect, createSignal, untrack } from 'solid-js'
import { Editor } from 'solid-prism-editor'
import {
  autoComplete,
  fuzzyFilter,
  registerCompletions,
} from 'solid-prism-editor/autocomplete'
import { defaultCommands, editHistory } from 'solid-prism-editor/commands'
import { cursorPosition } from 'solid-prism-editor/cursor'
import { indentGuides } from 'solid-prism-editor/guides'
import { highlightBracketPairs } from 'solid-prism-editor/highlight-brackets'
import { matchBrackets } from 'solid-prism-editor/match-brackets'
import { getClosestToken } from 'solid-prism-editor/utils'

import 'solid-prism-editor/prism/languages/python'
import 'solid-prism-editor/languages/python'

import 'solid-prism-editor/layout.css'
import 'solid-prism-editor/autocomplete.css'
import 'solid-prism-editor/autocomplete-icons.css'
import 'solid-prism-editor/themes/github-light.css'

const hooks = [
  [
    'set_state', //
    `set_state():
  # might return any value, it will be accessible through \`get_state()\` call
  pass`,
  ],
  [
    'on_request', //
    `on_request(req):
  # might return dict { "allow": bool, "delay": int, "timeout": int }
  pass`,
  ],
  [
    'on_response', //
    `on_response(req, resp):
  pass`,
  ],
  [
    'on_error', //
    `on_error(req, resp):
  pass`,
  ],
  [
    'on_fail', //
    `on_fail(req, err):
  pass`,
  ],
  [
    'on_retry', //
    `on_retry(req, resp, err):
  # might return dict { "allow": bool, "delay": int }
  pass`,
  ],
]

const hooksFnsCompletions = hooks.map(([label, insert]) => ({
  label,
  insert,
  icon: 'function',
}))

const hooksFnsCompletionsWithDefs = hooks.map(([label, insert]) => ({
  label,
  insert: 'def ' + insert,
  icon: 'function',
}))

const hooksCompletions = (context, editor) => {
  if (getClosestToken(editor, '.string, .comment', 0, 0, context.pos)) {
    return // Disable autocomplete in comments and strings
  }

  const lineBefore = context.lineBefore
  const wordBefore = /\w*$/.exec(lineBefore)[0]

  // when type function name right from beginning of the line - insert with `def`
  if (lineBefore === wordBefore) {
    return {
      from: context.pos - wordBefore.length,
      options: hooksFnsCompletionsWithDefs,
    }
  }

  // when type function name after `def ` - insert without `def`
  if (lineBefore === 'def ' + wordBefore) {
    return {
      from: context.pos - wordBefore.length,
      options: hooksFnsCompletions,
    }
  }
}

registerCompletions(['python'], {
  sources: [hooksCompletions],
})

const fullscreenButton = () => (editor) => {
  const button = document.createElement('button')
  button.setAttribute('type', 'button')
  button.setAttribute('title', 'fullscreen')
  button.innerText = '⤢'
  button.className =
    'absolute h-8 w-7 top-1 right-1 rounded bg-blue-100 opacity-50 hover:bg-blue-150 hover:opacity-100 z-100 text-xl'

  button.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }
    editor.container.requestFullscreen().catch((err) => {
      console.error(`Error enabling fullscreen: ${err.message}`)
    })
  })

  editor.container.prepend(button)
}

export function ClientBehaviorEditor(props) {
  const [initial, setInitial] = createSignal(props.code)
  const refresh = () => props.refresh

  createEffect(() => {
    refresh()
    const code = untrack(() => props.code)
    setInitial(code)
    props.setCode(code)
  })

  return (
    <Editor
      language='python'
      lineNumbers={false}
      class='min-h-40 max-h-96 relative'
      // readOnly={true}
      // onMount={(e) => (editor = e)}
      value={initial()}
      onUpdate={props.setCode}
      extensions={[
        matchBrackets(),
        highlightBracketPairs(),
        defaultCommands(),
        editHistory(),
        cursorPosition(),
        indentGuides(),
        autoComplete({
          filter: fuzzyFilter,
          closeOnBlur: true,
          explicitOnly: false,
          preferAbove: false,
        }),
        fullscreenButton(),
      ]}
    />
  )
}
