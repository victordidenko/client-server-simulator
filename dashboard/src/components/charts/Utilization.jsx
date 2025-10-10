import { SolidUplot } from '@dschz/solid-uplot'
import { useUnit } from 'effector-solid'
import { charts } from '../../app'

export function Utilization() {
  const utilization = useUnit(charts.$utilization)

  return (
    <SolidUplot
      autoResize={true}
      data={utilization()}
      series={[
        {},

        {
          label: 'CPU',
          stroke: '#e6194b', // red
          width: 2,
          points: { show: false },
        },
        {
          label: 'Memory',
          stroke: '#3cb44b', // green
          fill: '#3cb44b22',
          width: 2,
          points: { show: false },
        },
        {
          label: 'Queue',
          stroke: '#4363d8', // blue
          fill: '#4363d822',
          dash: [10, 2],
          width: 2,
          points: { show: false },
        },
        {
          label: 'Threads',
          stroke: '#f58231', // orange
          dash: [10, 2],
          width: 2,
          points: { show: false },
        },
      ]}
      scales={{
        x: { time: true },
        y: { auto: false, range: [0, 100] },
      }}
      axes={[
        {
          grid: { width: 1 },
          ticks: { width: 1 },
        },
        {
          label: 'Utilization, %',
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
