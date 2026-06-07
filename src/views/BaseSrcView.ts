import { ItemView, Notice, WorkspaceLeaf } from 'obsidian'
import { getAPI } from 'obsidian-dataview'
import { MSG_PLG_NAME } from 'src/constants'
import { Src } from 'src/types'

export type INoteSourcesActions = {
  openSourceFolderPresetsModal(): void
}

type DataviewPreset = {
  name: string
  query: string
}

function stripCodeFence(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:dataview)?\s*/i, '')
    t = t.replace(/\s*```\s*$/i, '')
  }
  return t.trim()
}

function sleep(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })
}

async function waitDvReady(app: import('obsidian').App) {
  const api = getAPI(app)
  if (!api)
    return undefined
  for (let i = 0; i < 200; i++) {
    if (api.index.initialized)
      return api
    await sleep(50)
  }
  return api
}

function isLuxonDateTime(val: unknown): boolean {
  return (
    typeof val === 'object'
    && val !== null
    && typeof (val as { isValid?: unknown }).isValid === 'boolean'
  )
}

/** Dataview link object (path + embed flag) */
function isDataviewLink(val: unknown): val is { path: string } {
  if (typeof val !== 'object' || val === null)
    return false
  const o = val as { path?: unknown; embed?: unknown }
  return (
    typeof o.path === 'string'
    && o.path.endsWith('.md')
    && typeof o.embed === 'boolean'
  )
}

function collectPathsFromLiteral(val: unknown): string[] {
  if (val == null)
    return []

  if (typeof val === 'string') {
    if (val.endsWith('.md') && !val.includes('\n'))
      return [val]
    return []
  }

  if (typeof val === 'number' || typeof val === 'boolean')
    return []

  if (isLuxonDateTime(val))
    return []

  if (isDataviewLink(val))
    return [val.path]

  if (Array.isArray(val))
    return val.flatMap(collectPathsFromLiteral)

  if (typeof val === 'object' && val !== null) {
    const o = val as Record<string, unknown>
    if (typeof o.path === 'string' && o.path.endsWith('.md'))
      return [o.path]
    const file = o.file
    if (file && typeof file === 'object') {
      const fp = (file as { path?: unknown }).path
      if (typeof fp === 'string' && fp.endsWith('.md'))
        return [fp]
    }
  }

  return []
}

function collectPathsFromTaskGrouping(group: unknown): string[] {
  const out: string[] = []
  if (!group)
    return out

  if (!Array.isArray(group))
    return out

  for (const el of group) {
    if (el && typeof el === 'object' && 'rows' in el) {
      const rows = (el as { rows: unknown }).rows
      out.push(...collectPathsFromTaskGrouping(rows))
    }
    else if (el && typeof el === 'object') {
      const item = el as { path?: string; children?: unknown[] }
      if (typeof item.path === 'string' && item.path.endsWith('.md'))
        out.push(item.path)
      if (Array.isArray(item.children))
        out.push(...collectPathsFromTaskGrouping(item.children))
    }
  }
  return out
}

async function runDataviewToPaths(
  app: import('obsidian').App,
  rawSource: string,
): Promise<{ paths: Set<string>; error?: string }> {
  const text = stripCodeFence(rawSource)
  if (!text)
    return { paths: new Set() }

  const api = await waitDvReady(app)
  if (!api)
    return { paths: new Set(), error: 'Dataview is not installed or not ready' }

  const fullQuery = /^\s*(LIST|TABLE|TASK|CALENDAR)\b/im.test(text)

  if (!fullQuery) {
    try {
      const arr = api.pagePaths(text).array() as string[]
      return { paths: new Set(arr) }
    }
    catch (e) {
      return {
        paths: new Set(),
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  const result = await api.query(text, '')
  if (!result.successful)
    return { paths: new Set(), error: result.error }

  const v = result.value
  if (v.type === 'list') {
    const all: string[] = []
    for (const lit of v.values)
      all.push(...collectPathsFromLiteral(lit))
    return { paths: new Set(all) }
  }
  if (v.type === 'table') {
    const all: string[] = []
    for (const row of v.values) {
      for (const cell of row)
        all.push(...collectPathsFromLiteral(cell))
    }
    return { paths: new Set(all) }
  }
  if (v.type === 'task')
    return { paths: new Set(collectPathsFromTaskGrouping(v.values)) }

  if (v.type === 'calendar') {
    const all: string[] = []
    for (const row of v.values)
      all.push(...collectPathsFromLiteral(row.link))
    return { paths: new Set(all) }
  }

  return { paths: new Set(), error: 'Unsupported query result type' }
}

export abstract class BaseSrcView extends ItemView {
  private selectedSrcPaths: Set<string> = new Set()

  private _eventSrc: Src[]

  /** null = no Dataview filter; otherwise note path must be in this set */
  private dataviewAllowedPaths: Set<string> | null = null

  private dataviewQueryDraft = ''

  constructor(
    leaf: WorkspaceLeaf,
    eventSrc: Src[],
    private noteSourcesActions: INoteSourcesActions,
  ) {
    super(leaf)

    this._eventSrc = eventSrc
    for (const src of eventSrc)
      this.selectedSrcPaths.add(src.path)

    this.dataviewQueryDraft = this.readStoredQueryText()
  }

  private storageKeyQuery(): string {
    return `${MSG_PLG_NAME}:dv-query:${this.app.vault.getName()}:${this.getViewType()}`
  }

  private storageKeyPresets(): string {
    return `${MSG_PLG_NAME}:dv-presets:${this.app.vault.getName()}:${this.getViewType()}`
  }

  private readStoredQueryText(): string {
    try {
      return localStorage.getItem(this.storageKeyQuery()) ?? ''
    }
    catch {
      return ''
    }
  }

  private writeStoredQueryText(q: string) {
    try {
      localStorage.setItem(this.storageKeyQuery(), q)
    }
    catch {
      /* vault may block storage */
    }
  }

  private readPresets(): DataviewPreset[] {
    try {
      const raw = localStorage.getItem(this.storageKeyPresets())
      if (!raw)
        return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed))
        return []
      return parsed.filter(
        (p): p is DataviewPreset =>
          !!p
          && typeof p === 'object'
          && typeof (p as DataviewPreset).name === 'string'
          && typeof (p as DataviewPreset).query === 'string',
      )
    }
    catch {
      return []
    }
  }

  private writePresets(presets: DataviewPreset[]) {
    try {
      localStorage.setItem(this.storageKeyPresets(), JSON.stringify(presets))
    }
    catch {
      /* ignore */
    }
  }

  protected selectAllSrcPaths() {
    this.selectedSrcPaths.clear()
    for (const src of this._eventSrc)
      this.selectedSrcPaths.add(src.path)
  }

  public reloadAfterSourceFoldersChange(src: Src[]) {
    this._eventSrc = src

    this.selectAllSrcPaths()
    this.resetViewForSourceChange()
  }

  protected abstract resetViewForSourceChange(): void

  /**
   * Renders folder checkboxes plus a Dataview query panel (filter + saved presets).
   * Prefer this over {@link renderSrcCheckboxes} so the Dataview UI is not cleared when folders re-render.
   */
  protected renderSrcCheckboxesWithDataviewFilter(container: HTMLElement) {
    container.empty()
    const dvHost = container.createDiv({ cls: 'mcal-dv-filter' })
    this.renderDataviewQueryBlock(dvHost)
    const folderHost = container.createDiv({ cls: 'mcal-folder-src' })
    this.renderSrcCheckboxes(folderHost)
  }

  private renderDataviewQueryBlock(host: HTMLElement) {
    host.createEl('div', { cls: 'setting-item-name', text: 'Dataview: notes to show' })
    host.createEl('div', {
      cls: 'setting-item-description',
      text:
        'Leave empty to use only the folders below. Otherwise enter a Dataview source (same as after FROM: #tag, "Folder", etc.) or a full LIST / TABLE / TASK / CALENDAR query. Only paths that appear in the result are shown, in addition to folder selection.',
    })

    const ta = host.createEl('textarea', {
      cls: 'mcal-dv-textarea',
      attr: { rows: 5, placeholder: '#status/active\n\nLIST FROM #status/active' },
    })
    ta.style.width = '100%'
    this.dataviewQueryDraft = this.readStoredQueryText()
    ta.value = this.dataviewQueryDraft
    ta.addEventListener('input', () => {
      this.dataviewQueryDraft = ta.value
    })

    const statusEl = host.createEl('div', { cls: 'setting-item-description mcal-dv-status' })

    const btnRow = host.createDiv({ cls: 'mcal-dv-btn-row' })
    btnRow.style.display = 'flex'
    btnRow.style.flexWrap = 'wrap'
    btnRow.style.gap = '8px'
    btnRow.style.marginTop = '6px'
    btnRow.style.marginBottom = '8px'

    const applyBtn = btnRow.createEl('button', { text: 'Apply filter', cls: 'mod-cta' })
    applyBtn.addEventListener('click', () => {
      void this.applyDataviewFilter(ta.value, statusEl)
    })

    const clearBtn = btnRow.createEl('button', { text: 'Clear filter' })
    clearBtn.addEventListener('click', () => {
      ta.value = ''
      this.dataviewQueryDraft = ''
      void this.applyDataviewFilter('', statusEl)
    })

    const presetWrap = host.createDiv({ cls: 'mcal-dv-preset-wrap' })
    presetWrap.style.marginTop = '4px'
    presetWrap.createEl('div', { cls: 'setting-item-name', text: 'Saved queries' })

    const presetRow = presetWrap.createDiv()
    presetRow.style.display = 'flex'
    presetRow.style.flexWrap = 'wrap'
    presetRow.style.gap = '8px'
    presetRow.style.alignItems = 'center'
    presetRow.style.marginBottom = '6px'

    const select = presetRow.createEl('select')
    select.style.minWidth = '140px'

    const nameInput = presetRow.createEl('input', {
      type: 'text',
      attr: { placeholder: 'Preset name' },
    })
    nameInput.style.minWidth = '120px'

    const repopulateSelect = (selectedName?: string) => {
      select.empty()
      const blank = select.createEl('option', { text: '— choose —', value: '' })
      blank.value = ''
      for (const p of this.readPresets()) {
        const opt = select.createEl('option', { text: p.name, value: p.name })
        opt.value = p.name
      }
      if (selectedName)
        select.value = selectedName
    }
    repopulateSelect()

    const savePresetBtn = presetRow.createEl('button', { text: 'Save preset' })
    savePresetBtn.addEventListener('click', () => {
      const name = nameInput.value.trim()
      if (!name) {
        new Notice(`${MSG_PLG_NAME}: enter a preset name`)
        return
      }
      const query = ta.value
      const list = this.readPresets().filter(p => p.name !== name)
      list.push({ name, query })
      list.sort((a, b) => a.name.localeCompare(b.name))
      this.writePresets(list)
      repopulateSelect(name)
      new Notice(`${MSG_PLG_NAME}: preset “${name}” saved`)
    })

    const loadBtn = presetRow.createEl('button', { text: 'Load' })
    loadBtn.addEventListener('click', () => {
      const name = select.value
      if (!name) {
        new Notice(`${MSG_PLG_NAME}: choose a preset`)
        return
      }
      const found = this.readPresets().find(p => p.name === name)
      if (!found) {
        new Notice(`${MSG_PLG_NAME}: preset not found`)
        return
      }
      ta.value = found.query
      this.dataviewQueryDraft = found.query
      void this.applyDataviewFilter(found.query, statusEl)
    })

    const delBtn = presetRow.createEl('button', { text: 'Delete preset' })
    delBtn.addEventListener('click', () => {
      const name = select.value
      if (!name) {
        new Notice(`${MSG_PLG_NAME}: choose a preset to delete`)
        return
      }
      const list = this.readPresets().filter(p => p.name !== name)
      this.writePresets(list)
      repopulateSelect()
      new Notice(`${MSG_PLG_NAME}: preset “${name}” removed`)
    })

    void this.applyDataviewFilter(this.dataviewQueryDraft, statusEl, true)
  }

  /**
   * @param silent if true, do not show error Notice (used when re-applying stored text on open)
   */
  private async applyDataviewFilter(
    raw: string,
    statusEl: HTMLElement,
    silent = false,
  ) {
    const trimmed = stripCodeFence(raw).trim()
    this.writeStoredQueryText(raw)
    this.dataviewQueryDraft = raw

    const setStatus = (msg: string, isErr = false) => {
      statusEl.setText(msg)
      statusEl.toggleClass('mod-warning', isErr)
    }

    if (!trimmed) {
      this.dataviewAllowedPaths = null
      setStatus('Filter off: all notes in selected folders (subject to cache).')
      await this.refreshView()
      return
    }

    const { paths, error } = await runDataviewToPaths(this.app, raw)
    if (error) {
      if (!silent)
        new Notice(`${MSG_PLG_NAME}: Dataview — ${error}`)
      setStatus(error, true)
      return
    }

    this.dataviewAllowedPaths = paths
    setStatus(`Filter on: ${paths.size} note path(s) matched.`)
    await this.refreshView()
  }

  protected renderSrcCheckboxes(srcCheckboxContainer: HTMLElement) {
    srcCheckboxContainer.empty()
    srcCheckboxContainer.addClass('src-checkboxes')

    const manageBtn = srcCheckboxContainer.createEl('button', { text: 'Folders & presets' })
    manageBtn.addClass('mod-cta')
    manageBtn.addEventListener('click', () => {
      this.noteSourcesActions.openSourceFolderPresetsModal()
    })

    const selectAllButton = srcCheckboxContainer.createEl('button', { text: 'Select All' })
    selectAllButton.addEventListener('click', async () => {
      for (const src of this._eventSrc)
        this.selectedSrcPaths.add(src.path)
      this.renderSrcCheckboxes(srcCheckboxContainer)
      await this.refreshView()
    })

    const selectNoneButton = srcCheckboxContainer.createEl('button', { text: 'Clear' })
    selectNoneButton.addEventListener('click', async () => {
      this.selectedSrcPaths.clear()
      this.renderSrcCheckboxes(srcCheckboxContainer)
      await this.refreshView()
    })

    for (const src of this._eventSrc) {
      const id = `src-checkbox-${this.getViewType()}-${src.path}`

      const checkboxContainer = srcCheckboxContainer.createDiv({ cls: 'src-checkbox-item' })

      const checkbox = checkboxContainer.createEl('input', {
        type: 'checkbox',
        attr: {
          id,
          checked: this.selectedSrcPaths.has(src.path) ? 'checked' : null,
        },
      })

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked)
          this.selectedSrcPaths.add(src.path)
        else
          this.selectedSrcPaths.delete(src.path)

        await this.refreshView()
      })

      checkboxContainer.createEl('label', {
        text: src.path || '/',
        attr: { for: id },
      })
    }
  }

  protected isPathInActiveSrc(pagePath: string): boolean {
    const eventSrc = this._eventSrc.filter(
      src => src.isIn(pagePath),
    )
    if (eventSrc.length == 0)
      return false

    const src = eventSrc.reduce(
      (prevSrc, curSrc) => {
        if (prevSrc.getFolderDepth() < curSrc.getFolderDepth())
          return curSrc

        return prevSrc
      },
      eventSrc[0],
    )

    if (!this.selectedSrcPaths.has(src.path))
      return false

    if (this.dataviewAllowedPaths !== null && !this.dataviewAllowedPaths.has(pagePath))
      return false

    return true
  }

  protected get eventSrc(): Src[] {
    return this._eventSrc
  }

  protected abstract refreshView(): Promise<void>
}
