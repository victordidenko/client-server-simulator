import { Board } from './charts/Board'
import { Controls } from './controls/Controls'
import { Header } from './Header'

export function App() {
  return (
    <>
      <Header />
      <Controls />
      <hr class='border-gray-400 ml-2 mr-2' />
      <Board />
    </>
  )
}
