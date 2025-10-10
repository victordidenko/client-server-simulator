import { ClientConfig } from './ClientConfig'
import { NetworkConfig } from './NetworkConfig'
import { ServerConfig } from './ServerConfig'
import { Simulation } from './Simulation'

export function Controls() {
  return (
    <div class='mb-8'>
      <div class='grid grid-cols-3 gap-2'>
        <div class='col-span-1'>
          <ClientConfig />
        </div>
        <div class='col-span-1'>
          <NetworkConfig />
        </div>
        <div class='col-span-1'>
          <div class='space-y-4'>
            <ServerConfig />
          </div>
        </div>
      </div>
      <Simulation />
    </div>
  )
}
