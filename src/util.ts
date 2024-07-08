import { MetadataCache, TFile } from "obsidian";
import { page, tick } from "./types";
import { getAPI, DURATION_TYPES } from "obsidian-dataview"

export const dv = getAPI()

export async function getPage(file: TFile, MDCache:MetadataCache)
                : Promise<page> {
  let result: page = {
  file: {
    path: "",
    name: ""
  },
  date: new Date,
  timeStart: null,
  duration: null,
  ticks: []
  }

  const tFile = MDCache.getFirstLinkpathDest(file.path, '') as TFile
  const ticks = getTicksFromText(await app.vault.read(tFile))

  await app.fileManager.processFrontMatter(
    tFile,
    async property => {
      const page = {
      file: {
        path: file.path,
        name: file.basename
      },
      ticks,
      ...property
      }

      const duration = dv.duration(property.duration)
      // ! если убрать это, то не будет случай с FORMAT_DEFAULT_ADD
      if (duration)
      page.duration = duration

      page.timeStart = dv.duration(property.timeStart)
      page.date = dv.date(property.date)

      result = page
    }
  )

  return result
}

function getTicksFromText(text: string): tick[] {
  const result = []
  const regExpTicks = /\[t::.+\]/gm
  const matches = text.match(regExpTicks)

  if (matches) for (let match of matches) {
    const args = match.slice(1, -1).split("::")[1].split(',')
    if (!args)
      continue

    const name = args[0]?.trim()
    const date = dv.date(args[1]?.trim())
    const timeStart = dv.duration(args[2]?.trim())

    const tempDuration = args[3]?.trim()
    const duration = tempDuration == 'x'
    ? 'x'
    : dv.duration(args[3]?.trim())

    if (name == '' || !date)
      continue

    result.push(
      {name, date, timeStart, duration}
    )

  }
  return result
}