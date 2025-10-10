import { SolidUplot } from '@dschz/solid-uplot'
import { useUnit } from 'effector-solid'
import { charts } from '../../app'

export function ClientsCount() {
  const maxClientsCount = useUnit(charts.$maxClientsCount)
  const clients = useUnit(charts.$clients)
  const series = useUnit(charts.$clientsSeries)

  const maxY = () => Math.round(1.05 * maxClientsCount()) // max clients count + 5%

  return (
    <SolidUplot
      autoResize={true}
      data={clients()}
      series={series()}
      scales={{
        x: { time: true },
        y: { auto: false, range: [0, maxY()] },
      }}
      axes={[
        {
          grid: { width: 1 },
          ticks: { width: 1 },
        },
        {
          label: 'Clients, N',
          grid: { width: 1 },
          ticks: { width: 1 },
        },
      ]}
      legend={{
        show: true,
      }}
      cursor={{
        y: false,
        sync: { key: 'request-policy-simulation' },
        focus: { prox: 10 },
      }}
    />
  )
}
