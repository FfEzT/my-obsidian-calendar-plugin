import { DURATION_TYPES } from "obsidian-dataview"

export interface tick {
  name: string
  date: Date
  timeStart: DURATION_TYPES
  duration: DURATION_TYPES
}

export interface page {
  file: {
    path: string,
    name: string
  },
  date: Date
  timeStart: DURATION_TYPES
  duration: DURATION_TYPES
  ticks: tick[]
}