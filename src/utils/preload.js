const { ipcRenderer, contextBridge } = require("electron");
const { parse } = require("papaparse");

contextBridge.exposeInMainWorld('electron', {
    save: (sheet, callback, saveAs = false) => {
        ipcRenderer.send("save", { ...sheet, saveAs });
        ipcRenderer.on("saved-file", (e, res) => {
            callback(res)
        })
    },
    rename: ({ id, filePath, newName }, callback) => {
        ipcRenderer.send("rename", { id, filePath, newName });
        ipcRenderer.on("name-changed", (e, res) => callback(res || {}))
    },
    open: (files = [], callback) => { //files: [...e.target.files]
        files.forEach((file) => {
            if (file.type === "text/csv") {
                parse(file, {
                    complete: (res) => {
                        if (res.errors) console.log(res.errors)

                        callback({data: res.data, sheetName: removeExtension(file.name), path: file.path})
                    },
                })
            }
        })
    }
})

function removeExtension(filename = "") {
    const chunk = filename.split(".");
    chunk.pop()
    return chunk.join(".")
  }
  