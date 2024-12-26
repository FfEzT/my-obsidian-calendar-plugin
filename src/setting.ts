import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    let { containerEl } = this;
    containerEl.empty();

    const settings = this.plugin.getSettings()

    // Status Corrector
    new Setting(containerEl).setName("StatusCorrector").setHeading()
    // .setDesc("This is Description")

    const statusCorrector = settings.statusCorrector.isOn
    new Setting(containerEl)
      .setName("Enable tool") // TODO при смене выключать в текущей сессии инструмент, а не при перезагрузке
      .addToggle(
        toggle =>
          toggle
            .setValue(statusCorrector)
            .onChange(
              value => {
                settings.statusCorrector.isOn = value
                this.plugin.saveSettings(settings)

                this.display()
              }
            )
      )
      if (statusCorrector) {
        new Setting(containerEl)
          .setName("Start on Start Up")
          .addToggle(
            toggle => toggle.setValue(settings.statusCorrector.startOnStartUp)
              .onChange(
                val => {
                  settings.statusCorrector.startOnStartUp = val
                  this.plugin.saveSettings(settings)
                }
              )
          )
      }
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
