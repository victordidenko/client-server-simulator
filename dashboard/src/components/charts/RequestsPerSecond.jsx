import { SolidUplot } from '@dschz/solid-uplot'
import { useUnit } from 'effector-solid'
import uPlot from 'uplot'
import { charts } from '../../app'

export function RequestsPerSecond() {
  const rps = useUnit(charts.$rps)

  return (
    <SolidUplot
      autoResize={true}
      data={rps()}
      series={[
        {},

        {
          label: 'Requests→',
          stroke: 'royalblue', // #4169e1
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Response←',
          stroke: 'mediumseagreen', // #3cb371
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Error←',
          stroke: 'orange', // #ff9800
          fill: '#ff980022',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Failed×',
          stroke: 'firebrick', // #b22222
          fill: '#b2222222',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: '→Request',
          stroke: 'darkviolet', // #9400d3
          width: 2,
          dash: [10, 2],
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: '←Response',
          stroke: 'teal', // #008080
          width: 2,
          dash: [10, 2],
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: '←Error',
          stroke: 'tomato', // #ff6347
          width: 2,
          dash: [10, 2],
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Blocked×',
          stroke: 'goldenrod', // #daa520'
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Request↻',
          stroke: 'deepskyblue', // #00bfff'
          width: 1.5,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
      ]}
      // bands={[
      //   {
      //     series: [2, 1],
      //     fill: 'rgba(100, 100, 100, 0.1)',
      //   },
      // ]}
      scales={{
        x: { time: true },
        // y: { auto: true, range: [0, 1000] },
      }}
      axes={[
        {
          grid: { width: 1 },
          ticks: { width: 1 },
        },
        {
          label: 'Requests/Responces, rps',
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
