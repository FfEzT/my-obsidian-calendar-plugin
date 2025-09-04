import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";
import { COLOUR_REST, COLOUR_SLEEP, DEFAULT_SETTINGS, MSG_PLG_NAME } from "./constants";
import { Src, SrcJSON } from "./types";
import { VaultOps } from "./vaultOps";

export class MySettingTab_ extends PluginSettingTab {
  plugin: MyPlugin;

  vaultOps: VaultOps

  constructor(app: App, plugin: MyPlugin, vaultOps: VaultOps) {
    super(app, plugin);

    this.plugin = plugin;
    this.vaultOps = vaultOps
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

export class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin

  vaultOps: VaultOps

  constructor(app: App, plugin: MyPlugin, vaultOps: VaultOps) {
    super(app, plugin);

    this.plugin = plugin;
    this.vaultOps = vaultOps
  }

  async display() {
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

    // Source folders section
    new Setting(containerEl).setHeading()
    new Setting(containerEl).setName("Event Sources").setHeading()
    .setDesc("Folders to search for event notes")

    // Display source folders
    for (let index_ in settings.source.noteSources) {
      const index = Number(index_)
      const src = settings.source.noteSources[index]

      new Setting(containerEl)
        .setName(`Source folder ${index + 1}`)
        .addText(async (text) => {
          const src = settings.source.noteSources[index];
          const folders = await this.vaultOps.getFoldersInVault();

          text.setPlaceholder('Enter folder path')
            .setValue(src.path)
            .onChange(async (value) => {
              if (!folders.contains(value))
                return

              const newSrc = new Src(value);
              // Preserve existing excludes
              if (src.excludes && src.excludes.length > 0) {
                newSrc.addExcludes(src.excludes);
              }
              settings.source.noteSources[index] = newSrc.toSrcJson();
              await this.plugin.saveSettings(settings);
            });

          const dataList = document.createElement('datalist');
          dataList.id = `folder-suggestions-${index}`;

          const allFolders = Array.from(folders);
          for (let folder of allFolders) {
            const option = document.createElement('option');
            option.value = folder;
            dataList.appendChild(option);
          }

          text.inputEl.setAttribute('list', `folder-suggestions-${index}`);
          text.inputEl.parentElement?.appendChild(dataList);
        })
        .addExtraButton(button => {
          button
            .setIcon("trash")
            .setTooltip("Remove this folder")
            .onClick(() => {
              if (settings.source.noteSources.length > 1) {
                settings.source.noteSources.splice(index, 1);
                this.plugin.saveSettings(settings);
                this.display(); // Refresh settings
              } else {
                new Notice("Cannot remove the last folder");
              }
            });
        });

      // Add excludes setting
      // new Setting(containerEl)
      //   .setName(`Excludes for folder ${index + 1}`)
      //   .setDesc("Comma-separated subfolders to exclude (optional)")
      //   .addText(text => {
      //     text
      //       .setPlaceholder("subfolder1, subfolder2")
      //       .setValue(src.excludes ? src.excludes.join(", ") : "")
      //       .onChange(async (value) => {
      //         const excludes = value.split(",")
      //           .map(item => item.trim())
      //           .filter(item => item.length > 0);

      //         const newSrc = new Src(src.path);
      //         if (excludes.length > 0) {
      //           newSrc.addExcludes(excludes);
      //         }
      //         settings.source.noteSources[index] = newSrc;
      //         await this.plugin.saveSettings(settings);
      //       });
      //   });
    }

    // Add new folder button
    new Setting(containerEl)
      .setName("Add new folder")
      .setDesc("Add another folder to search for events")
      .addButton(button =>
        button
          .setButtonText("Add Folder")
          .setCta()
          .onClick(() => {
            settings.source.noteSources.push(new Src("").toSrcJson());
            this.plugin.saveSettings(settings);
            this.display(); // Refresh settings
          })
      );

    // Default create path
    new Setting(containerEl)
      .setName("Default create path")
      .setDesc("Default path where new notes will be created")
      .addText(async (text) => {
        const folders = await this.vaultOps.getFoldersInVault()

        text.setPlaceholder('Enter folder path')
            .setValue(settings.source.defaultCreatePath || '')
            .onChange(async (value) => {
                if (!folders.contains(value)) {
                    return;
                }

                settings.source.defaultCreatePath = value;
                await this.plugin.saveSettings(settings);
            });

        const dataList = document.createElement('datalist');
        dataList.id = `default-path-suggestions`;

        const allFolders = Array.from(folders);
        for (let folder of allFolders) {
            const option = document.createElement('option');
            option.value = folder;
            dataList.appendChild(option);
        }

        text.inputEl.setAttribute('list', `default-path-suggestions`);
        text.inputEl.parentElement?.appendChild(dataList);
    });

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
