import { App, PluginSettingTab, Setting, Plugin } from "obsidian";
import MyPlugin from "./main";

export class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();

    // TODO
    new Setting(containerEl)
      // .setName("Date format")
      // .setDesc("Default date format")
      // .addText((text) =>
      //   text
      //     .setPlaceholder("MMMM dd, yyyy")
      //     .setValue(this.plugin.settings.dateFormat)
      //     .onChange(async (value) => {
      //       this.plugin.settings.dateFormat = value;
      //       await this.plugin.saveSettings();
      //     })
      // );
  }
}
