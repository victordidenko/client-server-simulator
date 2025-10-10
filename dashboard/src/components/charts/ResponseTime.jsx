import { SolidUplot } from '@dschz/solid-uplot'
import { useUnit } from 'effector-solid'
import uPlot from 'uplot'
import { charts } from '../../app'

export function ResponseTime() {
  const responseTime = useUnit(charts.$responseTime)

  return (
    <SolidUplot
      autoResize={true}
      data={responseTime()}
      series={[
        {},
        {
          label: 'Min',
          stroke: 'rgba(100, 100, 100, 0.1)',
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Max',
          stroke: 'rgba(100, 100, 100, 0.1)',
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Avg',
          stroke: 'blue',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'P50',
          stroke: 'green',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'P80',
          stroke: 'purple',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'P95',
          stroke: 'red',
          width: 2,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Min→Latency',
          stroke: '#00BCD4',
          dash: [10, 5],
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Max→Latency',
          stroke: '#00BCD4',
          dash: [10, 5],
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Min←Latency',
          stroke: '#8BC34A',
          dash: [25, 7],
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
        {
          label: 'Max←Latency',
          stroke: '#8BC34A',
          dash: [25, 7],
          width: 1,
          points: { show: false },
          paths: uPlot.paths.spline(),
        },
      ]}
      bands={[
        {
          series: [2, 1],
          fill: 'rgba(100, 100, 100, 0.1)',
        },
        // {
        //   series: [10, 9],
        //   fill: 'rgba(50, 200, 100, 0.1)',
        // },
        // {
        //   series: [8, 7],
        //   fill: 'rgba(100, 100, 100, 0.1)',
        // },
        // {
        //   series: [10, 9],
        //   fill: 'rgba(100, 100, 100, 0.1)',
        // },
      ]}
      scales={{
        x: { time: true },
        // y: { auto: true, range: [0, 120] },
      }}
      axes={[
        {
          grid: { width: 1 },
          ticks: { width: 1 },
        },
        {
          label: 'Response Time, ms/s',
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
