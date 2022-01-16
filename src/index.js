const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { writeFile, rename } = require('fs');
const { parse, unparse } = require("papaparse");
const { join } = require('path');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}
let mainWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, "./utils/preload.js"),
    },
    icon: path.join(__dirname, "../public/assets/img/Icon_72.png"),
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'));
  mainWindow.webContents.openDevTools()
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.on("save", (e, sheet) => {
  if (sheet.path && !sheet.saveAs) {
    writeFile(path, parseData(sheet.data), (err) => {
      if (err) {
        console.log(err)
        return
      }
      console.log("Saved")
    })
  } else {
    openSaveASDialouge(sheet.id, sheet.sheetName, sheet.path, sheet.data);
  }
})

//Rename event
ipcMain.on("rename", (e, { id, newName, filePath }) => {
  if (filePath) {
    const dir = filePath.split("/");
    dir.pop();

    if (!checkExtension(newName, ["csv"])) {
      newName += ".csv";
    }
    dir.push(newName)
    rename(filePath, dir.join("/"), err => {
      if (err) {
        console.log(err)
        return
      }
      console.log(`Renamed from to ${newName}`);
      mainWindow.webContents.send("name-changed", { id, sheetName: removeExtension(newName), path: filePath })
    })
  }
})

//User defined functions
function openSaveASDialouge(id, sheetName, path, data) {
  const saveDir = join(app.getPath("desktop"), `${sheetName}${checkExtension(sheetName, ["csv"]) ? "" : ".csv"}`)
  
  dialog.showSaveDialog({
    title: "Select File path to save",
    defaultPath: path || saveDir,
    buttonLabel: "Save As",
    filters: [
      { name: "CSV files", extensions: 'csv' }
    ],
    closable: true,
  })
    .then((file) => {
      if (!file.canceled) {
        //Unparse data writefile

        writeFile(file.filePath, parseData(data), (err) => {
          if (err)
            console.log(err);
          //Send the path to browserWindow
          const chunk = file.filePath.split("/");
          mainWindow.webContents.send("saved-file", { id, path: file.filePath, sheetName: removeExtension(chunk[chunk.length - 1]) })
          console.log("saved")
        })
      }
    })
}


const checkExtension = (filename = "", extensions = []) => {
  const parts = filename.split('.');
  return extensions.includes(parts[parts.length - 1])
}

function removeExtension(filename = "") {
  const chunk = filename.split(".");
  chunk.pop()
  return chunk.join(".")
}

function parseData(data, callback) {
  if (typeof (data) === "object") {
    return unparse(data, {
      quotes: true,
      skipEmptyLines: true,
    })
  }
  else if (typeof (data) === "string") {
    const byteSize = str => new Blob([str]).size;

    if (byteSize(data) >= 204800) {
      parse(data, {
        worker: true,
        skipEmptyLines: true,
        complete: (result) => {

          if (result.errors) {
            console.log(result.errors)
          }
          callback(result.data)
        }
      })
    } else {
      return parse(data)
    }
  } else {
    console.log("Invalid type")
  }
}

