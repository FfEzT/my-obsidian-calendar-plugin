import MyPlugin from "./main"

export default class StatusCorrector {
  private parent: MyPlugin

  constructor(parent: MyPlugin) {
    this.parent = parent
  }
}
