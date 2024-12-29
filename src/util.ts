import { IEvent, IPage, ITick, IDate, CalendarEvent, ITasks } from "./types";
import { DataviewApi } from "obsidian-dataview/lib/api/plugin-api"
import { getAPI } from "obsidian-dataview"

import {
  COLOUR_FREQUENCY,
  COLOUR_DONE,
  COLOUR_TICK,
  TEXT_DONE,
  FORMAT_DEFAULT_ADD,
  DEFAULT_ADD,
  MillisecsInHour,
  DEFAULT_ADD_IN_MILLISEC,
  MillisecsInDay,
  MillisecsInMinute,
  FORMAT_DAY,
  FORMAT_HOUR,
  FORMAT_MINUTE,
  BACKGROUND_COLOUR,
  COLOUR_DEFAULT
} from "./constants"
import { Cache } from "./cache";
import FileManager from "./fileManager";
import MyPlugin from "./main";

const SLEEP_TIME = 1000 // ms

export const dv = getAPI() as DataviewApi

export function pageToEvents(page: IPage): IEvent[] {
  const result: IEvent[] = []

  const structureTemplate = {
    id: "",
    title: "",
    color: COLOUR_DEFAULT,
    borderColor: getColourFromPath(page.file.path),
    editable: true,
  }

  if (page.date) {
    const structure: IEvent = {
      ...structureTemplate,
      id: page.file.path,
      title: page.file.name,
      ...IDateToCalendarEvent(page)
    }
    if (page.frequency)
      structure.color = COLOUR_FREQUENCY
    if (page.status == TEXT_DONE)
        structure.color = COLOUR_DONE

    result.push(structure)
  }
  for (let tick of page.ticks) {
    const structure: IEvent = {
      ...structureTemplate,
      id: templateIDTick(page.file.path, tick.name),
      title: templateNameTick(page.file.name, tick.name),
      color: COLOUR_TICK,
      extendedProps: {
        tickName: tick.name,
        notePath: page.file.path
      },
      ...IDateToCalendarEvent(tick)
    }
    result.push(structure)
  }

  return result
}

function pathToFileWithoutFileName(path: string) {
  const path_separator = path.lastIndexOf("/");
  if (path_separator !== -1)
    return path.slice(0, path_separator);
  return "";
}

export function IDateToCalendarEvent(args: IDate): CalendarEvent {
  const structure: CalendarEvent = {
    start: new Date(args.date),
    allDay: false,
  }

  if (args.duration) {
    structure.start.setHours  (args.timeStart?.values?.hours   || 0)
    structure.start.setMinutes(args.timeStart?.values?.minutes || 0)

    let tmpTime = new Date(structure.start)
    if (args.duration === FORMAT_DEFAULT_ADD) {
        tmpTime.setMinutes(
            tmpTime.getMinutes() + DEFAULT_ADD.m
        )
        tmpTime.setHours(
            tmpTime.getHours() + DEFAULT_ADD.h
        )
        tmpTime.setDate(
            tmpTime.getDate() + DEFAULT_ADD.d
        )
    }
    else if (args.duration?.values?.minutes || args.duration?.values?.hours || args.duration?.values?.days) {
      const duration = args.duration.values

      tmpTime.setMinutes(
        tmpTime.getMinutes() + (duration.minutes || 0)
      )
      tmpTime.setHours(
        tmpTime.getHours() + (duration.hours || 0)
      )
      tmpTime.setDate(
        tmpTime.getDate() + (duration.days || 0)
      )
    }
    else {
      structure.allDay = true
    }

    if (!args.timeStart?.values)
      structure.allDay = true

    structure.end = tmpTime
  }
  else if (args.duration) {
    structure.allDay = true
  }
  else structure.allDay = true

  return structure
}

export function CalendarEventToIDate(event: CalendarEvent): IDate {
  const {start, end, allDay} = event
  // ! для ISO (он переводит в гринвич мое время)
  // я тут говорю, что я в гринвиче
  start.setMinutes(
    start.getMinutes() - start.getTimezoneOffset()
  )

  const result: IDate = {
    duration: "",
    timeStart: "",
    date: new Date(start)
  }

  // ! тут убираю гринвич для get'еров внизу
  start.setMinutes(
    start.getMinutes() + start.getTimezoneOffset()
  )

  let srcMillisec = end
  // @ts-ignore
  ? end - start
  : MillisecsInHour

  if (allDay) {
    result['timeStart'] = ""
    if (srcMillisec <= MillisecsInDay)
      srcMillisec = 0
  }
  else
    result['timeStart'] = start.getHours() + 'h' + start.getMinutes() + 'm'

  result['duration'] = DEFAULT_ADD_IN_MILLISEC === srcMillisec
  ? FORMAT_DEFAULT_ADD
  : millisecToString(srcMillisec)

  return result
}

export function getTicksFromText(text: string): ITick[] {
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

    if (name == '')
      continue

    result.push(
      {name, date, timeStart, duration}
    )

  }
  return result
}

function millisecToString(millisec:number): string {
  const days = Math.floor(
      millisec / (MillisecsInDay)
  )
  millisec -= days * MillisecsInDay

  const hours = Math.floor(
      millisec / (MillisecsInHour)
  )
  millisec -= hours * MillisecsInHour

  const minutes = Math.floor(
      millisec / (MillisecsInMinute)
  )
  millisec -= minutes * MillisecsInMinute

  let resString = ''
  if (days)
      resString += days.toString() + FORMAT_DAY
  if (hours)
      resString += hours.toString() + FORMAT_HOUR
  if (minutes)
      resString += minutes.toString() + FORMAT_MINUTE

  return resString
}

export function isEqualObj(object1:any, object2:any) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      areObjects && !isEqualObj(val1, val2) ||
      !areObjects && val1 !== val2
    ) {
      return false;
    }
  }

  return true;
}

function isObject(object: any) {
  return object != null && typeof object === 'object';
}

// каким будет ID в календаре тик
export function templateIDTick(path: string, tickName:string) {
  return path + tickName
}

// как будет отображаться в календаре тик
export function templateNameTick(fileName: string, tickName:string) {
  return "("+fileName+")" + tickName
}

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// TODO не работает на отрицательных числах
// и при min > max
function toRange(src: number, min: number, max: number) {
  max -= min
  src %= max+1

  return (src + min)
}

function getColourFromPath(path: string): string {
  const str = pathToFileWithoutFileName(path)

  // NOTE типа каждый первый, второй или третий символ строки
  const str1 = hashString([...str].filter((_, index) => (index + 1) % 3 !== 0).join(""))
  const str2 = hashString([...str].filter((_, index) => (index + 2) % 3 !== 0).join(""))
  const str3 = hashString([...str].filter((_, index) => (index + 3) % 3 !== 0).join(""))

  const hue = toRange(str1 + BACKGROUND_COLOUR.hue.shift,
    BACKGROUND_COLOUR.hue.min,
    BACKGROUND_COLOUR.hue.max
  )
  const saturation = toRange(str2 + BACKGROUND_COLOUR.saturation.shift,
    BACKGROUND_COLOUR.saturation.min,
    BACKGROUND_COLOUR.saturation.max)
  const lightness  = toRange(str3 + BACKGROUND_COLOUR.lightness.shift,
    BACKGROUND_COLOUR.lightness.min,
    BACKGROUND_COLOUR.lightness.max
  )
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

async function waitDvInit() {
  while (!dv.index.initialized)
    await sleep(SLEEP_TIME)
}

let haveChanged = false
let interval: NodeJS.Timer
export function setChanged() {
  if (haveChanged) {
    clearInterval(interval)
  }

  haveChanged = true
  interval = setInterval(
    () => haveChanged = false,
    SLEEP_TIME
  )
}


export async function getNotesWithoutParent(src: string): Promise<IPage[]> {
  await waitDvInit()

  const child = dv.pages(`"${src}"`).where(
    (page: any) => !page.parent
  ).array()

  return child as IPage[]
}

export async function getProgress(plg: MyPlugin, page: IPage): Promise<ITasks> {
  const result = {done:0, all:0}
  const cache = plg.cache
  const fileManager = plg.fileManager

  await waitDvInit()

  const pages = new Set()
  const stack = [page.file.path]
  while (stack.length > 0) {
    const path = stack.pop() as string
    const page = cache.getPage(path)
    const meta = dv.page(path)

    if (!page || !meta)
      continue

    const tasks = fileManager.getTaskCount(page)

    result.all  +=  tasks.all
    result.done  +=  tasks.done


    const inlinks = meta.file.inlinks.array()
    if (inlinks.length == 0) {
      if (page.status) {
        ++result.all

        if (page.status == TEXT_DONE)
          ++result.done
      }
    }

    for (let inlink of inlinks ) {
      if (pages.has(inlink.path))
        continue

      pages.add(inlink.path)
      stack.push(inlink.path)
    }
  }

  return result
}

export async function getChildNotePaths(path: string): Promise<string[]> {
  await waitDvInit()

  const meta = dv.page(path)
  const inlinks = meta?.file.inlinks.array()

  const result: string[] = []
  for (let inlink of inlinks) {
    result.push( inlink.path )
  }

  return result
}

export async function getParentNote(page: IPage): Promise<(IPage|undefined)[]> {
  await waitDvInit()

  const meta = dv.page(page.file.path)
  const outlinks = meta?.file.outlinks.array()

  const result: IPage[] = []
  for (let outlink of outlinks) {
    result.push( dv.page(outlink.path) as IPage )
  }

  return result
}
