import { ListedFiles, TFile, TFolder, Vault, base64ToArrayBuffer } from "obsidian";

type FilesFolders = {
    folders: string[]
    files: string[]
}

export class VaultOps {
    vault: Vault

    constructor(vault: Vault) {
      this.vault = vault
    }

    async getTFile(path: string): Promise<TFile | null> {
      const file = this.vault.getAbstractFileByPath(path)
      if (file && file instanceof TFile) {
        return file
      }
      else {
        return null
      }
    }

    // if checking a folder, require including the last / in the path param
    async ensureFolderExists(path: string): Promise<boolean> {
        // extract folder path, return empty string is no folder path is matched (exclude the last /)
        const folderPath = path.match(/^(.*)\//)?.[1] || '';
        if (folderPath == "") {
            return false
        }

        const parts = folderPath.split('/');
        let currentPath = '';
        for (const part of parts) {
            currentPath += part + '/';
            try {
                const isExists = await this.vault.adapter.exists(currentPath, true)

                if (isExists)
                    continue

                await this.vault.adapter.mkdir(currentPath);
            } catch (e) {
                return false
            }
        }
        return true
    }

    async getAllInObsidian(): Promise<FilesFolders> {
        const rootPath = this.vault.configDir;

        const folders: string[] = [rootPath + "/"];
        const files: string[] = [];

        const traverseDirectory = async (path: string) => {
            let items: ListedFiles
            try {
                items = await this.vault.adapter.list(path);
            } catch (error) {
                // console.error(`Error traversing directory ${path}:`, error);
                return null
            }

            for (const folder of items.folders) {
                await traverseDirectory(folder);

                let folderPath = folder.startsWith('/') ? folder.slice(1) : folder;
                folderPath = folderPath === "" ? "" : `${folderPath}/`;

                folders.push(folderPath);
            }

            for (const file of items.files) {
                let filePath = file.startsWith('/') ? file.slice(1) : file;

                files.push(filePath);
            }
        };

        await traverseDirectory(rootPath);

        return {folders, files}
    }

    async getAllInVault(): Promise<FilesFolders> {
        const all = this.vault.getAllLoadedFiles();

        const folders: string[] = [];
        const files: string[] = [];

        for (let file of all) {
            if (file instanceof TFolder) {
                let path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
                path = path == "" ? "" : `${path}/`
                folders.push(path);
            }
            else if (file instanceof TFile) {
                const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
                files.push(path);
            }
        }

        // .obsidian folder
        const obsidianItems = await this.getAllInObsidian()
        const [obsidianFiles, obsidianFolders] = [obsidianItems.files, obsidianItems.folders]

        folders.push(...obsidianFolders)
        files.push(...obsidianFiles)

        return {folders, files};
    }

    async getFoldersInVault(): Promise<string[]> {
        const {folders} = await this.getAllInVault()

        return folders;
    }

    async getFilesInVault(): Promise<string[]> {
        const {files} = await this.getAllInVault()

        return files;
    }
}
