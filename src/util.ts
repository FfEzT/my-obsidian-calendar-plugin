import { IPage, ITick, IDate, CalendarEvent, ITasks } from "./types";
import { DataviewApi } from "obsidian-dataview/lib/api/plugin-api"
import { getAPI } from "obsidian-dataview"
import { DURATION_TYPES } from "obsidian-dataview"

import {
  TEXT_DONE,
  MillisecsInHour,
  MillisecsInDay,
  MillisecsInMinute,
  FORMAT_DAY,
  FORMAT_HOUR,
  FORMAT_MINUTE,
  BACKGROUND_COLOUR,
} from "./constants"
import MyPlugin from "./main";
import { Cache } from "./cache";
import NoteManager from "./NoteManager";

const SLEEP_TIME = 1000 // ms

export const dv = getAPI() as DataviewApi

function getLinkClass(path: string) {
    const tempPage = dv.page(path)
    if (tempPage?.file?.link) {
        return tempPage.file.link.constructor
    }
    return null
}

function pathToFileWithoutFileName(path: string) {
  const path_separator = path.lastIndexOf("/");
  if (path_separator !== -1)
    return path.slice(0, path_separator);
  return "";
}

// TODO в calendar переводить?
export function IDateToCalendarEvent(args: IDate): CalendarEvent {
  const structure: CalendarEvent = {
    start: new Date(args.ff_date),
    allDay: false,
  }

  if (args.ff_duration) {
    structure.start.setHours  (args.ff_timeStart?.values?.hours   || 0)
    structure.start.setMinutes(args.ff_timeStart?.values?.minutes || 0)

    let tmpTime = new Date(structure.start)
    if (args.ff_duration?.values?.minutes || args.ff_duration?.values?.hours || args.ff_duration?.values?.days) {
      const duration = args.ff_duration.values

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

    if (!args.ff_timeStart?.values)
      structure.allDay = true

    structure.end = tmpTime
  }
  else if (args.ff_duration) {
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
    ff_duration: "",
    ff_timeStart: "",
    ff_date: new Date(start)
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
    result['ff_timeStart'] = ""
    if (srcMillisec <= MillisecsInDay)
      srcMillisec = 0
  }
  else
    result['ff_timeStart'] = start.getHours() + 'h' + start.getMinutes() + 'm'

  result['ff_duration'] = millisecToString(srcMillisec)

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
    const ff_date = dv.date(args[1]?.trim())
    const ff_timeStart = dv.duration(args[2]?.trim())

    const tempDuration = args[3]?.trim()
    const ff_duration = dv.duration(args[3]?.trim())

    if (name == '')
      continue

    result.push(
      {name, ff_date, ff_timeStart, ff_duration}
    )

  }
  return result
}

export function millisecToString(millisec:number): string {
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

    if (val1 instanceof Date && val2 instanceof Date) {
      return val1 == val2
    }
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

export function getColourFromPath(path: string): string {
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

export async function getNotesWithoutParent(src_: string): Promise<IPage[]> {
  await waitDvInit()
  let src = src_.slice(0, src_.length-1)
  const folder = '"' + src + '"'
  const child = dv.pages(folder).where(
    (page:any) => !page.ff_l_parent
  ).array();

  return child as IPage[]
}

function isChildren(parentPath: string, childPath: string): boolean {
  const Link = getLinkClass(parentPath)

  const page = dv.page(childPath)
  if (!page)
    return false

  if (page.ff_l_parent instanceof Link
      && page.ff_l_parent.path === parentPath)
  {
    return true
  }
  else if (page.ff_l_parent instanceof Array) {
      const cond = page.ff_l_parent.some(
          el => el instanceof Link && el.path === parentPath
      )

      return cond
  }
  return false
}

export function getBlockers(path: string): Set<string> {
  const Link = getLinkClass(path)

  const page = dv.page(path)
  if (!page)
    return new Set

  if (page.ff_l_blocks instanceof Array) {
    const paths = page.ff_l_blocks
    .filter(el => el instanceof Link)
    .map(
      link => link.path
    )

    return new Set(paths)
  }
  return new Set

}

export async function getProgress(cache: Cache, noteManager: NoteManager, filePath: string): Promise<ITasks> {
  const result = {done:0, all:0}

  await waitDvInit()

  const pages = new Set()
  const stack = [filePath]
  while (stack.length > 0) {
    const path = stack.pop() as string
    const page = cache.getPage(path)
    const meta = dv.page(path)

    if (!page || !meta)
      continue

    const tasks = noteManager.getTaskCount(page)

    result.all  +=  tasks.all
    result.done +=  tasks.done


    const inlinks = meta.file.inlinks.array()
    if (page.ff_status) {
      ++result.all

      if (page.ff_status == TEXT_DONE)
        ++result.done
    }

    for (let inlink of inlinks) {
      if (pages.has(inlink.path))
        continue

      pages.add(inlink.path)
      if ( isChildren(meta.file.path, inlink.path) )
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
    if (meta && isChildren(meta.file.path, inlink.path) )
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
    if (meta && isChildren(outlink.path, meta.file.path) )
      result.push( dv.page(outlink.path) as IPage )
  }

  return result
}

export function safeParseInt(str: string): number {
  const num = Number(str);
  return Number.isInteger(num) ? num : NaN;
}

export function timeAdd(start: Date, duration: DURATION_TYPES): Date {
  const dur = duration.as("minutes")

  const result = new Date(start)
  result.setMinutes(result.getMinutes() + dur)

  return result
}

export function throttle(func: Function, ms: number): Function {
  let isThrottled = false,
    savedArgs: any,
    savedThis: any;

  function wrapper() {

    if (isThrottled) {
      savedArgs = arguments;
      savedThis = this;
      return;
    }

    func.apply(this, arguments);

    isThrottled = true;

    setTimeout(function() {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}
