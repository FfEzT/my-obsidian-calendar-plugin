import { MetadataCache, TFile } from "obsidian";
import { IEvent, IPage, ITick, IDate, CalendarEvent } from "./types";
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
  FORMAT_MINUTE
} from "./constants"

export const dv = getAPI()

// TODO переместить в MyPlugin
export async function getPage(file: TFile, MDCache:MetadataCache)
                : Promise<IPage> {
  let result: IPage = {
    file: {
      path: "",
      name: ""
    },
    date: new Date,
    timeStart: null,
    duration: null,
    ticks: []
  }

  // const tFile = app.vault.getFileByPath(file.path) as TFile
  const ticks = getTicksFromText(await app.vault.read(file))

  await app.fileManager.processFrontMatter(
    file,
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

export function pageToEvents(page: IPage): IEvent[] {
  const result: IEvent[] = []

  const structureTemplate = {
    id: "",
    title: "",
    color: "", // TODO
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
      structure.borderColor = COLOUR_FREQUENCY
    if (page.status == TEXT_DONE)
        structure.borderColor = COLOUR_DONE

    result.push(structure)
  }
  for (let tick of page.ticks) {
    const structure: IEvent = {
      ...structureTemplate,
      id: page.file.path + tick.name,
      title: '('+page.file.name+')' + tick.name,
      borderColor: COLOUR_TICK,
      extendedProps: {
        // tickName: tick.name,
        notePath: page.file.path
    },
      ...IDateToCalendarEvent(tick)
    }
    result.push(structure)
  }

  return result
}

export function IDateToCalendarEvent(args: IDate): CalendarEvent {
  const structure: CalendarEvent = {
    start: new Date(args.date),
    allDay: false,
  }

  if (args.duration && args.timeStart?.values) {
    structure.start.setHours  (args.timeStart.values.hours   || 0)
    structure.start.setMinutes(args.timeStart.values.minutes || 0)

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
      // tmpTime = null // TODO add if bugs
    }

    structure.end = tmpTime
  }
  else structure.allDay = true

  return structure
}

function getTicksFromText(text: string): ITick[] {
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

// TODO здесь исправление какой-то фичи
export function eventToIDate({start, end, allDay}: CalendarEvent): IDate {
  // ! для ISO (он переводит в гринвич мое время)
    // я тут говорю, что я в гринвиче
  start.setMinutes(
    start.getMinutes() - start.getTimezoneOffset()
  )

  const result: IDate = {
    duration: "",
    timeStart: "",
    date: start
  }

  // ! тут убираю гринвич для get'еров внизу
  start.setMinutes(
    start.getMinutes() + start.getTimezoneOffset()
  )

  if (allDay) {
    result['timeStart'] = ''
    result['duration'] = ''
  }
  else {
    result['timeStart'] = start.getHours() + 'h' + start.getMinutes() + 'm'

    // ! если выставлять из allDay во временой, то end = null
    const srcMillisec = end
    // @ts-ignore
    ? end - start
    : MillisecsInHour

    result['duration'] = DEFAULT_ADD_IN_MILLISEC === srcMillisec
    ? FORMAT_DEFAULT_ADD : millisecToString(srcMillisec)
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