import { get, writable } from "svelte/store";
// {id: Date.now(),sheetName: "", path: "", data=[[]]}
export const sheets = writable("[]");

export const selectedTab = writable(null); //For Tabs
export const selectedPanel = writable(null); //For Tabs

/*For menu bar*/
export const Files = writable([
  { name: "New", accelerator: "Ctrl + N", click: () => createSheet() },
  { name: "Open", accelerator: "Ctrl + O", click: () => open() },
  { name: "Save", accelerator: "Ctrl + S", click: () => { } },
  { name: "Save As", accelerator: "Ctrl + Shift + S", click: () => { } },
]);

export const Data = writable([
  {name: "Sort sheet", accelerator: "Ctrl + Q", click: () => {}}
])
/* Menu bar */


const createSheet = (sheetData) => {
  const newSheetName = `NewSheet_${Date.now()}`;
  const sheetsDetail = {
    id: sheetData.id || Date.now(),
    sheetName: sheetData.sheetName || newSheetName,
    data: sheetData.data || [[]],
    path: sheetData.path || "",
    savedChange: sheetData ? true : false
  };

  if (get(sheets) === "[]")
    sheets.set(JSON.stringify([sheetsDetail]));
  else {
    sheets.update(v => {
      let initVal = JSON.parse(v);
      initVal.push(sheetsDetail);
      return JSON.stringify(initVal)
    })
  }
  location.href = `#/sheet`;
};

const open = () => {
  const input = document.getElementById("open-file-input"); //files: e.target.files
  input.setAttribute("value", "");
  input.click();
}