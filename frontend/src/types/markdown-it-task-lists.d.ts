/** Balík nemá vlastné typy ani @types – stačí nám minimálna deklarácia. */
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
