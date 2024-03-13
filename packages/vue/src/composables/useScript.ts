import type {
  UseScriptInput as BaseUseScriptInput,
  SchemaAugmentations,
  ScriptBase,
  ScriptInstance,
  UseScriptOptions,
  UseScriptStatus,
} from '@unhead/schema'
import { useScript as _useScript } from 'unhead'
import type { ComputedRef, Ref } from 'vue'
import { computed, getCurrentInstance, ref } from 'vue'
import { NetworkEvents } from '@unhead/shared'
import type { MaybeComputedRefEntriesOnly } from '../types'
import { injectHead } from './injectHead'

export interface VueScriptInstance<T> extends Omit<ScriptInstance<T>, 'loaded' | 'status'> {
  loaded: ComputedRef<boolean>
  status: Ref<UseScriptStatus>
}

export type UseScriptInput = string | (MaybeComputedRefEntriesOnly<Omit<ScriptBase & SchemaAugmentations['script'], 'src'>> & { src: string })

export function useScript<T>(_input: UseScriptInput, _options?: UseScriptOptions<T>): T & { $script: VueScriptInstance<T> } {
  const input = typeof _input === 'string' ? { src: _input } : _input
  const head = injectHead()
  const ctx = getCurrentInstance()
  const options = _options || {}
  // @ts-expect-error untyped
  options.head = head
  const status = ref('awaitingLoad')

  NetworkEvents.forEach((fn) => {
    // @ts-expect-error untyped
    const _fn = typeof input[fn] === 'function' ? input[fn].bind(ctx) : null
    // rebinding the events for the vue context
    if (_fn) {
      // @ts-expect-error untyped
      input[fn] = (e: Event) => _fn(e)
    }
  })

  options.stub = ({ script, fn }) => {
    if (fn === '$script') {
      return {
        ...script,
        status,
        loaded: computed(() => status.value === 'loaded'),
      }
    }
  }

  const instance = _useScript(input as BaseUseScriptInput, options) as T & { $script: VueScriptInstance<T> }

  function syncStatus({ script }: { script: ScriptInstance<T> }) {
    if (script.id === instance.$script.id) {
      status.value = script.status
      // clean up
      if (script.status === 'removed')
        head.hooks.removeHook(`script:updated`, syncStatus)
    }
  }
  // sync the status
  head.hooks.hook(`script:updated`, syncStatus)
  return instance
}
