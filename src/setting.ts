import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";
import { COLOUR_REST, COLOUR_SLEEP, DEFAULT_SETTINGS, MSG_PLG_NAME } from "./constants";

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

    // TODO при смене выключать в текущей сессии инструмент, а не при перезагрузке
    new Setting(containerEl).setHeading().setName("It's recommended to reload ObsidianApp after changing the settings")
    new Setting(containerEl).addButton(
      btn => {
        btn.setButtonText("Set Default Values")
        .onClick(
          () => {
            this.plugin.saveSettings(DEFAULT_SETTINGS)
            new Notice(MSG_PLG_NAME + "The default settings has been applied")
          }
        )
      }
    )

    // Calendar
    new Setting(containerEl).setHeading()

    new Setting(containerEl).setName("Calendar").setHeading()

    new Setting(containerEl).setName("Slot duration")
    .setDesc(`Default: ${DEFAULT_SETTINGS.calendar.slotDuration}`)
    .addText(
      component => {
        component.setPlaceholder("hh:mm:ss")
        .setValue(settings.calendar.slotDuration)
        .onChange(
          value => {
            // Commentet cause It create a lot of Notice
            // const regExp = /^\d{2}:\d{2}:\d{2}$/

            // // NOTE проверяем соответствие формату
            // if (!regExp.test(value)) {
            //   value = DEFAULT_SETTINGS.calendar.slotDuration
            //   new Notice(MSG_PLG_NAME + "invalid SlotDuration format")
            // }

            settings.calendar.slotDuration = value
            this.plugin.saveSettings(settings)
          }
        )
      }
    )

    new Setting(containerEl).setName("Colours").setHeading()
    for (let key of Object.keys(settings.calendar.colours) as (keyof typeof settings.calendar.colours)[] ) {
      this.addColourSetting(
        containerEl, key,
        DEFAULT_SETTINGS.calendar.colours[key],
        settings.calendar.colours[key],
        (val:string) => {
          settings.calendar.colours[key] = val
          this.plugin.saveSettings(settings)
        }
      )
    }

    new Setting(containerEl).setName("RestTime").setHeading()
    for (let index in settings.calendar.restTime) {

      const el = settings.calendar.restTime[index]

      let name = ""
      if (el.color === COLOUR_REST) {
        name = "Rest time"
      }
      else if (el.color === COLOUR_SLEEP) {
        name = "Sleep time"
      }
      else
        continue

      new Setting(containerEl).setName(`Start of ${name} (${index})`).addText(
        text => {
          text.setValue(el.startTime).setPlaceholder("hh:mm:ss")
          .onChange(
            val => {
              settings.calendar.restTime[index].startTime = val
              this.plugin.saveSettings(settings)
            }
          )
        }
      )
      new Setting(containerEl).setName(`End of ${name} (${index})`).addText(
        text => {
          text.setValue(el.endTime).setPlaceholder("hh:mm:ss")
          .onChange(
            val => {
              settings.calendar.restTime[index].endTime = val
              this.plugin.saveSettings(settings)
            }
          )
        }
      )

    }


    // Status Corrector
    new Setting(containerEl).setHeading()
    new Setting(containerEl).setName("StatusCorrector").setHeading()
    // .setDesc("This is Description")

    const statusCorrector = settings.statusCorrector.isOn
    new Setting(containerEl)
      .setName("Enable tool")
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
  }

  private addColourSetting(containerEl: HTMLElement, name: string, defaultValue: string,
                        currentValue: string, callback: Function) {
    new Setting(containerEl).setName(name).setDesc(`Default: ${defaultValue}`)
    .addText(
      component => {
        component.setPlaceholder("#0f0f0f")
        .setValue(currentValue).onChange(val => callback(val))
      }
    )
  }
}
