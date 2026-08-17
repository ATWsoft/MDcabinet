/** The package ships no types and has no @types – a minimal stub is enough. */
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'

  interface TaskListsOptions {
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskLists: MarkdownIt.PluginWithOptions<TaskListsOptions>
  export default taskLists
}
