import { useUnit } from 'effector-solid'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  Show,
  untrack,
} from 'solid-js'
import { clients, simulation } from '../../app'
import { useSessionSignal } from '../../utils/signals'
import noopBehaviorCode from './behaviors/0-noop.star?raw'
import simpleRetriesBehaviorCode from './behaviors/1-simple-retries.star?raw'
import exponentialRetriesBehaviorCode from './behaviors/2-exponential-backoff.star?raw'
import exponentialJitteredRetriesBehaviorCode from './behaviors/3-exponential-backoff-jitter.star?raw'
import exponentialJitteredCircuitBreakerRetriesBehaviorCode from './behaviors/4-exponential-backoff-jitter-cb.star?raw'
import exponentialJitteredRetryBudgetRetriesBehaviorCode from './behaviors/5-exponential-backoff-jitter-rb.star?raw'
import requestPolicyBehaviorCode from './behaviors/6-request-policy.star?raw'
import requestPolicyDecayNoColorBehaviorCode from './behaviors/7-request-policy-decay-no-color.star?raw'
import requestPolicyDecayNoColorPostponeRetryBehaviorCode from './behaviors/8-request-policy-decay-no-color-postpone-retry.star?raw'
import { ClientBehaviorEditor } from './ClientBehaviorEditor'
import { Input } from './Input'
import { MutationErrorIndicator } from './MutationErrorIndicator'
import { Slider } from './Slider'

const behaviors = {
  'Noop': noopBehaviorCode,
  'Simple retries': simpleRetriesBehaviorCode,
  'Exponential backoff': exponentialRetriesBehaviorCode,
  'Exponential backoff w/jitter': exponentialJitteredRetriesBehaviorCode,
  'Exponential backoff w/jitter and circuit breaker':
    exponentialJitteredCircuitBreakerRetriesBehaviorCode,
  'Exponential backoff w/jitter and retry budget':
    exponentialJitteredRetryBudgetRetriesBehaviorCode,
  'Request policy': requestPolicyBehaviorCode,
  'Request policy (decay, no color)': requestPolicyDecayNoColorBehaviorCode,
  'Request policy (decay, no color, postpone retry)':
    requestPolicyDecayNoColorPostponeRetryBehaviorCode,
}

function ClientGroupForm({
  clientCount,
  setClientCount,
  requestRate,
  setRequestRate,
  rampUpTime,
  setRampUpTime,
  startupDelay,
  setStartupDelay,
  behavior,
  setBehavior,
  disabled = false,
}) {
  const generatedId = createUniqueId()
  const selectId = `select-${generatedId}`

  const [refresh, setRefresh] = createSignal(0)

  return (
    <div class='flex flex-col gap-7'>
      <div class='flex items-center gap-4'>
        <Input
          label='Number of Clients'
          min={1}
          max={1000}
          value={clientCount()}
          disabled={disabled}
          onInput={(e) => setClientCount(parseInt(e.target.value, 10))}
        />
        <Slider
          min={1}
          max={1000}
          step={1}
          value={clientCount()}
          onInput={setClientCount}
          disabled={disabled}
          class='flex-1'
        />
      </div>

      <div class='flex items-center gap-4'>
        <Input
          label='Request Rate (ms) w/20% jitter'
          min={10}
          max={1000}
          value={requestRate()}
          disabled={disabled}
          onInput={(e) => setRequestRate(parseInt(e.target.value, 10))}
        />
        <Slider
          min={10}
          max={1000}
          step={1}
          value={requestRate()}
          onInput={setRequestRate}
          disabled={disabled}
          class='flex-1'
        />
      </div>

      <div class='flex items-center gap-4'>
        <Input
          label='Ramp-up Time (s) w/50% jitter'
          min={0}
          max={600}
          value={rampUpTime()}
          disabled={disabled}
          onInput={(e) => setRampUpTime(parseInt(e.target.value, 10))}
        />
        <Slider
          min={0}
          max={600}
          step={1}
          value={rampUpTime()}
          onInput={setRampUpTime}
          disabled={disabled}
          class='flex-1'
        />
      </div>

      <div class='flex items-center gap-4'>
        <Input
          label='Startup Delay (s)'
          min={0}
          max={600}
          value={startupDelay()}
          disabled={disabled}
          onInput={(e) => setStartupDelay(parseInt(e.target.value, 10))}
        />
        <Slider
          min={0}
          max={600}
          step={1}
          value={startupDelay()}
          onInput={setStartupDelay}
          disabled={disabled}
          class='flex-1'
        />
      </div>

      <div class='flex flex-col'>
        <div class='flex justify-end'>
          <label
            for={selectId}
            class='text-xs font-normal text-gray-500 flex items-center'
          >
            Predefined behavior
          </label>
          <select
            id={selectId}
            class='ml-2 px-1 py-0.5 border rounded border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
            onInput={(e) => {
              setBehavior(behaviors[e.target.value])
              setRefresh(refresh() + 1)
            }}
          >
            <option value=''>Custom...</option>
            <For each={Object.keys(behaviors)}>
              {(b) => <option value={b}>{b}</option>}
            </For>
          </select>
        </div>

        <div class='min-h-40'>
          <ClientBehaviorEditor
            code={behavior()}
            setCode={setBehavior}
            refresh={refresh()}
          />
        </div>
      </div>
    </div>
  )
}

export function ClientConfig() {
  const { data: status, pending: _pendingStatus } = useUnit(
    simulation.statusQuery
  )
  const { data: clientGroups, pending: _pendingClientGroups } = useUnit(
    clients.clientsQuery
  )

  const { start: create, pending: creating } = useUnit(
    clients.createClientsMutation
  )

  const { start: _get, pending: _getting } = useUnit(clients.getClientsMutation)

  const { start: update, pending: updating } = useUnit(
    clients.updateClientsMutation
  )

  const { start: remove, pending: removing } = useUnit(
    clients.removeClientsMutation
  )

  const { start: clean, pending: cleaning } = useUnit(
    clients.cleanClientsMutation
  )

  const createClientsError = useUnit(clients.$createClientsMutationError)
  const _getClientsError = useUnit(clients.$getClientsMutationError)
  const updateClientsError = useUnit(clients.$updateClientsMutationError)
  const removeClientsError = useUnit(clients.$removeClientsMutationError)
  const cleanClientsError = useUnit(clients.$cleanClientsMutationError)

  const is = {
    running: () => status()?.status === 'RUNNING',
    creating: () => creating(),
    removing: () => removing(),
    cleaning: () => cleaning(),
    updating: () => updating(),
    disabled: () => creating() || removing() || cleaning() || updating(),
  }

  // Accordion state - dynamically determined based on existing groups
  const [expandedItem, setExpandedItem] = useSessionSignal(
    'simulation__expanded-id',
    null
  )

  // New client group form state
  const [newClientCount, setNewClientCount] = createSignal(100)
  const [newRequestRate, setNewRequestRate] = createSignal(100)
  const [newRampUpTime, setNewRampUpTime] = createSignal(3)
  const [newStartupDelay, setNewStartupDelay] = createSignal(0)
  const [newBehavior, setNewBehavior] = createSignal('')

  // Edit existing client group state
  const [editState, setEditState] = createSignal({})

  const simulationId = createMemo(() => status()?.id)

  createEffect(() => {
    simulationId() // react to simulation id changes
    setNewClientCount(100)
    setNewRequestRate(100)
    setNewRampUpTime(3)
    setNewStartupDelay(0)
    setEditState({})
  })

  createEffect(() => {
    const groups = clientGroups()
    if (!groups) return

    const expanded = untrack(() => expandedItem())
    const state = untrack(() => editState()[expanded])

    function expandFirst() {
      if (groups && groups.length > 0) {
        setExpandedItem(groups[0].id)
        initEditState(groups[0])
      } else {
        setExpandedItem('new')
      }
    }

    if (expanded) {
      if (expanded !== 'new') {
        const group = groups.find((g) => g.id === expanded)
        if (group) {
          if (!state) {
            initEditState(group)
          }
        } else {
          expandFirst()
        }
      }
    } else {
      expandFirst()
    }
  })

  const initEditState = (config) => {
    setEditState({
      [config.id]: {
        count: createSignal(config.count),
        requestRate: createSignal(config.requestRate),
        rampUpTime: createSignal(config.rampUpTime / 1000),
        startupDelay: createSignal(config.startupDelay / 1000),
        behavior: createSignal(config.behavior || ''),
      },
    })
  }

  const getEditSignals = (configId) => {
    return editState()[configId]
  }

  const handleToggleAccordion = (itemId) => {
    if (expandedItem() === itemId) {
      // Don't allow collapsing the currently expanded item
      return
    }

    if (itemId !== 'new' && clientGroups()) {
      const config = clientGroups().find((c) => c.id === itemId)
      if (config && !editState()[itemId]) {
        initEditState(config)
      }
    }

    setExpandedItem(itemId)
  }

  const handleAddClientsConfig = () => {
    const newId = Math.random().toString(16).slice(2, 10)
    create({
      id: newId,
      count: newClientCount(),
      requestRate: newRequestRate(),
      rampUpTime: newRampUpTime() * 1000,
      startupDelay: newStartupDelay() * 1000,
      behavior: newBehavior(),
    })
    setNewBehavior('')
    setExpandedItem(newId)
  }

  const handleUpdateClientsConfig = (id) => {
    const editSignals = editState()[id]
    if (!editSignals) return
    update({
      id,
      count: editSignals.count[0](),
      requestRate: editSignals.requestRate[0](),
      rampUpTime: editSignals.rampUpTime[0]() * 1000,
      startupDelay: editSignals.startupDelay[0]() * 1000,
      behavior: editSignals.behavior[0](),
    })
  }

  const handleRemoveClientsConfig = (id) => {
    remove(id)
  }

  const handleCleanClientsConfig = () => {
    clean()
  }

  return (
    <div class='bg-white p-2 h-full'>
      <h3 class='text-lg font-semibold mb-3'>Client Configuration</h3>

      <div class='space-y-1'>
        {/* Existing Client Groups */}
        <Show when={clientGroups()?.length > 0}>
          <For each={clientGroups()}>
            {(config, index) => (
              <Show when={config}>
                <div class='rounded overflow-hidden'>
                  {/* Accordion Header */}
                  <div class='flex items-center'>
                    <button
                      type='button'
                      onClick={() => handleToggleAccordion(config.id)}
                      class={`flex-1 flex justify-between items-center h-8 px-2 text-left ${
                        expandedItem() === config.id
                          ? 'bg-blue-100 hover:bg-blue-150'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <div class='flex items-center gap-2'>
                        <div
                          class='w-4 h-4 text-xs text-center text-white rounded-sm'
                          style={{ 'background-color': config.color }}
                        >
                          {index() + 1}
                        </div>
                        <span class='font-semibold'>
                          {config.count} clients
                        </span>
                        <span class='text-sm text-gray-600'>
                          {config.requestRate}ms rate,{' '}
                          {config.rampUpTime / 1000}s ramp-up
                        </span>
                      </div>
                    </button>
                    <Show when={!is.running()}>
                      <button
                        type='button'
                        title='Remove group'
                        disabled={is.disabled()}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveClientsConfig(config.id)
                        }}
                        class={`h-8 w-7 text-sm ${
                          is.disabled()
                            ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                            : 'bg-red-100 hover:bg-red-200 text-red-700'
                        }`}
                        aria-label='Remove group'
                      >
                        ✕
                      </button>
                    </Show>
                  </div>

                  {/* Accordion Content */}
                  <Show when={expandedItem() === config.id}>
                    <div class='p-3 pt-7 bg-gray-50'>
                      <Show
                        when={getEditSignals(config.id)}
                        fallback={
                          <div class='text-center py-2'>Loading...</div>
                        }
                      >
                        {(editSignals) => (
                          <div>
                            <ClientGroupForm
                              clientCount={editSignals().count[0]}
                              setClientCount={editSignals().count[1]}
                              requestRate={editSignals().requestRate[0]}
                              setRequestRate={editSignals().requestRate[1]}
                              rampUpTime={editSignals().rampUpTime[0]}
                              setRampUpTime={editSignals().rampUpTime[1]}
                              startupDelay={editSignals().startupDelay[0]}
                              setStartupDelay={editSignals().startupDelay[1]}
                              behavior={editSignals().behavior[0]}
                              setBehavior={editSignals().behavior[1]}
                              disabled={is.running() || is.disabled()}
                            />

                            <div class='flex gap-2 pt-4'>
                              <div class='relative'>
                                <button
                                  type='button'
                                  onClick={() =>
                                    handleUpdateClientsConfig(config.id)
                                  }
                                  disabled={is.running() || is.disabled()}
                                  class={`px-2 py-1 text-sm rounded ${
                                    is.running() || is.disabled()
                                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                >
                                  Update Group
                                </button>
                                <MutationErrorIndicator
                                  error={updateClientsError()}
                                />
                              </div>

                              <Show when={!is.running()}>
                                <div class='relative'>
                                  <button
                                    type='button'
                                    disabled={is.disabled()}
                                    onClick={() =>
                                      handleRemoveClientsConfig(config.id)
                                    }
                                    class={`px-2 py-1 text-sm rounded ${
                                      is.disabled()
                                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                                    }`}
                                  >
                                    Remove Group
                                  </button>
                                  <MutationErrorIndicator
                                    error={removeClientsError()}
                                  />
                                </div>
                              </Show>
                            </div>
                          </div>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </Show>

        {/* Add New Client Group */}
        <div class=' rounded overflow-hidden'>
          {/* Accordion Header */}
          <div class='flex items-center'>
            <button
              type='button'
              onClick={() => handleToggleAccordion('new')}
              class={`flex-1 flex justify-between items-center h-8 px-2 text-left ${
                expandedItem() === 'new'
                  ? 'bg-blue-100 hover:bg-blue-150'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div class='flex items-center gap-2'>
                <div class='w-4 h-4 text-xs leading-3.5 text-center text-white rounded-sm bg-gray-400'>
                  +
                </div>
                <span class='font-semibold'>Add new client group</span>
              </div>
            </button>
            <Show when={clientGroups()?.length > 0}>
              <button
                type='button'
                title='Clear all groups'
                onClick={(e) => {
                  e.stopPropagation()
                  handleCleanClientsConfig()
                }}
                disabled={is.running() || is.disabled()}
                class={`h-8 w-7 text-sm ${
                  is.running() || is.disabled()
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
                aria-label='Clear all groups'
              >
                🗑️
              </button>
            </Show>
          </div>

          {/* Accordion Content */}
          <Show when={expandedItem() === 'new'}>
            <div class='p-3 pt-7 bg-gray-50'>
              <ClientGroupForm
                clientCount={() => newClientCount()}
                setClientCount={setNewClientCount}
                requestRate={() => newRequestRate()}
                setRequestRate={setNewRequestRate}
                rampUpTime={() => newRampUpTime()}
                setRampUpTime={setNewRampUpTime}
                startupDelay={() => newStartupDelay()}
                setStartupDelay={setNewStartupDelay}
                behavior={newBehavior}
                setBehavior={setNewBehavior}
                disabled={is.running() || is.disabled()}
              />

              <div class='flex gap-2 pt-4'>
                <div class='relative'>
                  <button
                    type='button'
                    onClick={handleAddClientsConfig}
                    disabled={is.running() || is.disabled()}
                    class={`px-2 py-1 text-sm rounded ${
                      is.running() || is.disabled()
                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    Add Client Group
                  </button>
                  <MutationErrorIndicator error={createClientsError()} />
                </div>

                <Show when={clientGroups()?.length > 0}>
                  <div class='relative'>
                    <button
                      type='button'
                      onClick={handleCleanClientsConfig}
                      disabled={is.running() || is.disabled()}
                      class={`px-2 py-1 text-sm rounded ${
                        is.running() || is.disabled()
                          ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                          : 'bg-red-100 hover:bg-red-200 text-red-700'
                      }`}
                    >
                      Clear All Groups
                    </button>
                    <MutationErrorIndicator error={cleanClientsError()} />
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
